import { describe, it, expect, beforeEach } from "vitest";
import { createReceiptLayout, resetReceiptLayout, type SerialPortLike } from "../src/sinks/receipt.js";
import type { Packet } from "../src/types.js";

function createMockPort(): {
  port: SerialPortLike;
  writes: Uint8Array[];
} {
  const writes: Uint8Array[] = [];
  let writable: WritableStream<Uint8Array> | null = null;

  const port: SerialPortLike = {
    readable: null,
    writable: null,
    async open() {
      writable = new WritableStream<Uint8Array>({
        write(chunk) {
          writes.push(new Uint8Array(chunk));
        },
      });
      port.writable = writable;
    },
    async close() {
      writable = null;
      port.writable = null;
    },
  };

  return { port, writes };
}

describe("receipt sink", () => {
  beforeEach(() => {
    resetReceiptLayout();
  });

  it("deduplicates identical text payloads", async () => {
    const receipt = createReceiptLayout();
    const writes: Uint8Array[] = [];
    receipt.setSimulatedHandler((bytes) => writes.push(bytes));

    const packet: Packet = { kind: "data", type: "text", value: "Hello" };
    receipt.render?.(packet);
    receipt.render?.(packet);
    receipt.render?.(packet);

    expect(writes).toHaveLength(1);
  });

  it("prints when text changes", () => {
    const receipt = createReceiptLayout();
    const writes: Uint8Array[] = [];
    receipt.setSimulatedHandler((bytes) => writes.push(bytes));

    receipt.render?.({ kind: "data", type: "text", value: "A" });
    receipt.render?.({ kind: "data", type: "text", value: "B" });

    expect(writes).toHaveLength(2);
  });

  it("skips empty text", () => {
    const receipt = createReceiptLayout();
    const writes: Uint8Array[] = [];
    receipt.setSimulatedHandler((bytes) => writes.push(bytes));

    receipt.render?.({ kind: "data", type: "text", value: "" });

    expect(writes).toHaveLength(0);
  });

  it("connects to a serial port and writes init bytes", async () => {
    const receipt = createReceiptLayout();
    const { port, writes } = createMockPort();

    await receipt.connect(async () => port);
    expect(receipt.connected).toBe(true);
    expect(writes[0]).toEqual(new Uint8Array([0x1b, 0x40]));

    receipt.render?.({ kind: "data", type: "text", value: "Loop" });
    expect(writes.length).toBeGreaterThan(1);

    receipt.disconnect();
    expect(receipt.connected).toBe(false);
  });
});
