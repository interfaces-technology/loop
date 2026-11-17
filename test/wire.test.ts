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
    expect(() => serializePacket({ kind: "data", type: "text", value: huge })).toThrow(
      /wire limit/,
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
});
