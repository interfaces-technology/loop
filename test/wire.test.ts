import { describe, it, expect } from "vitest";
import {
  serializePacket,
  deserializePacket,
  packetKey,
  MAX_WIRE_BYTES,
} from "../src/transport/serialize.js";

describe("wire guards", () => {
  it("rejects malformed JSON", () => {
    expect(() => deserializePacket("{not json")).toThrow(/not valid JSON/);
  });

  it("rejects non-object payloads", () => {
    expect(() => deserializePacket("42")).toThrow(/expected an object/);
  });

  it("rejects unknown packet kinds", () => {
    expect(() => deserializePacket(JSON.stringify({ kind: "blob" }))).toThrow(
      /Unknown wire packet kind/,
    );
  });

  it("rejects value packets with a bad payload", () => {
    expect(() => deserializePacket(JSON.stringify({ kind: "value", value: "nope" }))).toThrow(
      /number or vector/,
    );
  });

  it("rejects data packets without a string type", () => {
    expect(() => deserializePacket(JSON.stringify({ kind: "data", value: "hi" }))).toThrow(
      /string type/,
    );
  });

  it("rejects packets larger than the wire limit", () => {
    const huge = "x".repeat(MAX_WIRE_BYTES + 1);
    expect(() => deserializePacket(huge)).toThrow(/wire limit/);
  });

  it("rejects multibyte packets over the limit even when short enough in UTF-16", () => {
    // Each '€' is one UTF-16 unit but three UTF-8 bytes.
    const euro = "€".repeat(Math.floor(MAX_WIRE_BYTES / 2));
    expect(euro.length).toBeLessThanOrEqual(MAX_WIRE_BYTES);
    expect(() => deserializePacket(euro)).toThrow(/wire limit/);
  });
});

describe("serializePacket drops", () => {
  it("returns null for frame packets", () => {
    const frame = { width: 2, height: 2, data: new Uint8ClampedArray(16) };
    expect(serializePacket({ kind: "frame", frame })).toBeNull();
  });

  it("returns null for oversized packets instead of throwing", () => {
    const huge = "x".repeat(MAX_WIRE_BYTES + 1);
    expect(serializePacket({ kind: "data", type: "text", value: huge })).toBeNull();
  });

  it("returns null for unserializable values instead of throwing", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(serializePacket({ kind: "data", type: "event", value: circular })).toBeNull();
    expect(serializePacket({ kind: "data", type: "event", value: 10n })).toBeNull();
  });

  it("still serializes ordinary packets", () => {
    expect(serializePacket({ kind: "value", value: 0.5 })).toBe(
      JSON.stringify({ kind: "value", value: 0.5 }),
    );
    expect(serializePacket({ kind: "data", type: "text", value: "hi" })).toBe(
      JSON.stringify({ kind: "data", type: "text", data: "hi" }),
    );
  });
});

describe("packetKey", () => {
  it("matches for equal value packets", () => {
    expect(packetKey({ kind: "value", value: 0.5 })).toBe(packetKey({ kind: "value", value: 0.5 }));
    expect(packetKey({ kind: "value", value: { x: 1, y: 2 } })).toBe(
      packetKey({ kind: "value", value: { x: 1, y: 2, z: 0 } }),
    );
  });

  it("differs when values change", () => {
    expect(packetKey({ kind: "value", value: 0.5 })).not.toBe(
      packetKey({ kind: "value", value: 0.6 }),
    );
    expect(packetKey({ kind: "value", value: { x: 1, y: 2 } })).not.toBe(
      packetKey({ kind: "value", value: { x: 1, y: 3 } }),
    );
  });

  it("includes the data type", () => {
    expect(packetKey({ kind: "data", type: "text", value: "a" })).toBe("d:text:a");
  });

  it("does not throw on unserializable data values and never dedupes them", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const packet = { kind: "data" as const, type: "event", value: circular };
    expect(packetKey(packet)).not.toBe(packetKey(packet));
    expect(() => packetKey({ kind: "data", type: "event", value: 10n })).not.toThrow();
  });
});
