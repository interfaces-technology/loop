import type { RegisteredSink } from "../sink-registry.js";
import type { Packet } from "../types.js";
import { encodeReceipt, escposText } from "./escpos.js";

export interface ReceiptOptions {
  transport?: "capture" | "serial";
  /** Called whenever a finished receipt is encoded — always available, test-friendly. */
  onJob?: (bytes: Uint8Array, lines: string[]) => void;
}

export interface ReceiptPrinter {
  readonly options: { transport: "capture" | "serial"; onJob?: (bytes: Uint8Array, lines: string[]) => void };
  readonly sink: RegisteredSink;
  /** Every completed receipt as its list of lines. */
  readonly jobs: string[][];
  clear(): void;
}

const TEXT_TYPES = new Set(["text", "number"]);

function packetText(packet: Packet): string | null {
  if (packet.kind !== "data") return null;
  if (!TEXT_TYPES.has(packet.type)) return null;
  if (typeof packet.value === "number") return String(packet.value);
  if (typeof packet.value === "string") return packet.value;
  return null;
}

let defaultPrinter: ReceiptPrinter | null = null;

export function receipt(opts?: ReceiptOptions): ReceiptPrinter {
  if (opts === undefined) {
    defaultPrinter ??= createPrinter({ transport: "capture" });
    return defaultPrinter;
  }
  return createPrinter(opts);
}

function createPrinter(opts: ReceiptOptions): ReceiptPrinter {
  const options: { transport: "capture" | "serial"; onJob?: (bytes: Uint8Array, lines: string[]) => void } = {
    transport: opts.transport ?? "capture",
    onJob: opts.onJob,
  };
  const jobs: string[][] = [];
  let current: string[] = [];
  let serialWriter:
    | {
        write(data: Uint8Array): Promise<void>;
        close(): Promise<void>;
      }
    | null = null;

  function flushJob(): void {
    if (current.length === 0) return;
    jobs.push(current);
    void writeJob(current);
    current = [];
  }

  async function writeJob(lines: string[]): Promise<void> {
    const bytes = encodeReceipt(lines);
    options.onJob?.(bytes, lines);
    if (!serialWriter) return;
    try {
      await serialWriter.write(bytes);
    } catch (err) {
      console.error("loop: receipt serial write failed", err);
      serialWriter = null;
    }
  }

  const sink: RegisteredSink = {
    to: "receipt",
    accepts: "data",
    dataType: "text",
    async connect() {
      if (options.transport !== "serial") return;
      const nav = navigator as Navigator & {
        serial?: { requestPort(): Promise<{ open(opts: { baudRate: number }): Promise<void>; writable: WritableStream<Uint8Array> }> };
      };
      if (!nav.serial) {
        console.warn("loop: Web Serial unavailable — receipts are captured, not printed");
        return;
      }
      try {
        const port = await nav.serial.requestPort();
        await port.open({ baudRate: 9600 });
        serialWriter = {
          async write(data) {
            const w = port.writable.getWriter();
            await w.write(data);
            w.releaseLock();
          },
          async close() {
            try {
              await port.writable.getWriter().close();
            } catch {
              // address already closed
            }
          },
        };
      } catch (err) {
        console.error("loop: receipt printer could not connect", err);
      }
    },
    disconnect() {
      void serialWriter?.close().catch(() => {});
      serialWriter = null;
    },
    render(packet) {
      if (packet.kind !== "data") return;
      if (packet.type === "cut" || packet.type === "job-end") {
        flushJob();
        return;
      }
      const line = packetText(packet);
      if (line === null) return;
      current.push(line);
      if (serialWriter) {
        void serialWriter.write(escposText(line)).catch(() => {});
      }
    },
  };

  return {
    options,
    sink,
    jobs,
    clear() {
      jobs.length = 0;
      current = [];
    },
  };
}