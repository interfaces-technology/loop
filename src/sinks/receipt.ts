import { sink, type Stage } from "../component.js";
import type { Packet } from "../types.js";
import { encodePrintJob, escposInit } from "./escpos.js";

export interface SerialPortLike {
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
}

export interface ReceiptLayout extends Stage {
  readonly connected: boolean;
  connect(requestPort?: () => Promise<SerialPortLike>): Promise<void>;
  disconnect(): void;
  setSimulatedHandler(fn: ((bytes: Uint8Array) => void) | null): void;
}

interface SerialNavigator {
  serial: {
    requestPort(): Promise<SerialPortLike>;
  };
}

function getSerialNavigator(): SerialNavigator | null {
  if (typeof navigator === "undefined") return null;
  const serial = (navigator as Navigator & Partial<SerialNavigator>).serial;
  if (!serial?.requestPort) return null;
  return { serial };
}

let receiptSingleton: ReceiptLayout | null = null;

export function createReceiptLayout(): ReceiptLayout {
  if (receiptSingleton) return receiptSingleton;

  let writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  let port: SerialPortLike | null = null;
  let connected = false;
  let lastPrinted = "";
  let simulatedHandler: ((bytes: Uint8Array) => void) | null = null;

  async function writeBytes(bytes: Uint8Array): Promise<void> {
    if (connected && writer) {
      await writer.write(bytes);
      return;
    }
    simulatedHandler?.(bytes);
  }

  const stage = sink({
    to: "receipt",
    accepts: "data",
    dataType: "text",
    render(packet: Packet) {
      if (packet.kind !== "data" || packet.type !== "text") return;
      const text = String(packet.value);
      if (!text || text === lastPrinted) return;
      lastPrinted = text;
      const bytes = encodePrintJob(text);
      void writeBytes(bytes).catch(() => {
        // Serial write failures are surfaced via connect(); ignore render-time errors.
      });
    },
  });

  const receipt: ReceiptLayout = {
    role: stage.role,
    name: stage.name,
    accepts: stage.accepts,
    dataType: stage.dataType,
    render: stage.render,

    get connected() {
      return connected;
    },

    setSimulatedHandler(fn) {
      simulatedHandler = fn;
    },

    async connect(requestPort) {
      if (connected) return;

      const request =
        requestPort ??
        (async () => {
          const serialNav = getSerialNavigator();
          if (!serialNav) {
            throw new Error(
              "Web Serial is unavailable. Use Chrome over HTTPS/localhost, or enable simulated mode.",
            );
          }
          return serialNav.serial.requestPort();
        });

      port = await request();
      await port.open({ baudRate: 9600 });

      if (!port.writable) {
        await port.close();
        port = null;
        throw new Error("Serial port is not writable");
      }

      writer = port.writable.getWriter();
      connected = true;
      await writer.write(escposInit());
      lastPrinted = "";
    },

    disconnect() {
      if (writer) {
        void writer.close().catch(() => undefined);
        writer = null;
      }
      if (port) {
        void port.close().catch(() => undefined);
        port = null;
      }
      connected = false;
      lastPrinted = "";
    },
  };

  receiptSingleton = receipt;
  return receipt;
}

export function resetReceiptLayout(): void {
  receiptSingleton?.disconnect();
  receiptSingleton = null;
}
