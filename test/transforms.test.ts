import { describe, it, expect } from "vitest";
import type { Packet } from "../src/types.js";
import { toNumber, toText, clamp } from "../src/transforms.js";

describe("toNumber", () => {
  const def = toNumber();

  it("parses numeric text into a number packet", () => {
    const out = def.process({ kind: "data", type: "text", value: "42" });
    expect(out).toEqual({ kind: "data", type: "number", value: 42 });
  });

  it("parses decimals and signs", () => {
    expect(def.process({ kind: "data", type: "text", value: "-3.75" })).toEqual({
      kind: "data",
      type: "number",
      value: -3.75,
    });
  });

  it("drops non-numeric text (returns null)", () => {
    expect(def.process({ kind: "data", type: "text", value: "hello" })).toBeNull();
    expect(def.process({ kind: "data", type: "text", value: "" })).toBeNull();
    expect(def.process({ kind: "data", type: "text", value: "  " })).toBeNull();
  });

  it("passes value packets through untouched", () => {
    const input = { kind: "value", value: 0.5 } as Packet;
    expect(def.process(input)).toBe(input);
  });
});

describe("toText", () => {
  const def = toText();

  it("formats a number into text", () => {
    expect(def.process({ kind: "data", type: "number", value: 12.5 })).toEqual({
      kind: "data",
      type: "text",
      value: "12.50",
    });
  });

  it("honors precision", () => {
    const whole = toText({ precision: 0 });
    expect(whole.process({ kind: "data", type: "number", value: 12.6 })).toEqual({
      kind: "data",
      type: "text",
      value: "13",
    });
  });

  it("stringifies non-numeric data", () => {
    expect(def.process({ kind: "data", type: "text", value: "hi" })).toEqual({
      kind: "data",
      type: "text",
      value: "hi",
    });
  });
});

describe("clamp", () => {
  const def = clamp(0.2, 0.8);

  it("clamps scalars into the range", () => {
    expect(def.process({ kind: "value", value: 0.05 })).toEqual({ kind: "value", value: 0.2 });
    expect(def.process({ kind: "value", value: 3 })).toEqual({ kind: "value", value: 0.8 });
    expect(def.process({ kind: "value", value: 0.5 })).toEqual({ kind: "value", value: 0.5 });
  });

  it("clamps vectors per axis", () => {
    expect(def.process({ kind: "value", value: { x: -1, y: 2, z: 0.4 } })).toEqual({
      kind: "value",
      value: { x: 0.2, y: 0.8, z: 0.4 },
    });
  });
});