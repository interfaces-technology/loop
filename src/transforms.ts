import type { TransformDef } from "./component.js";
import type { Vec } from "./types.js";
import { isVec } from "./types.js";

export interface ToTextOptions {
  precision?: number;
}

export function parseNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const text = typeof v === "string" ? v.trim() : "";
  if (text === "") return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

export function toNumber(): TransformDef {
  return {
    accepts: "data",
    acceptsType: "text",
    emits: "data",
    dataType: "number",
    process(input) {
      if (input.kind !== "data") return input;
      const n = parseNumber(input.value);
      if (n === null) return null;
      return { kind: "data", type: "number", value: n };
    },
  };
}

export function toText(opts: ToTextOptions = {}): TransformDef {
  const { precision = 2 } = opts;
  return {
    accepts: "data",
    acceptsType: "number",
    emits: "data",
    dataType: "text",
    process(input) {
      if (input.kind !== "data") return input;
      const n = parseNumber(input.value);
      if (n === null) return { kind: "data", type: "text", value: String(input.value) };
      return { kind: "data", type: "text", value: n.toFixed(precision) };
    },
  };
}

export function clamp(min: number, max: number): TransformDef {
  return {
    accepts: "value",
    emits: "value",
    process(input) {
      if (input.kind !== "value") return input;
      if (isVec(input.value)) {
        return { kind: "value", value: clampVec(input.value, min, max) };
      }
      return { kind: "value", value: Math.max(min, Math.min(max, input.value)) };
    },
  };
}

function clampVec(v: Vec, min: number, max: number): Vec {
  return {
    x: Math.max(min, Math.min(max, v.x)),
    y: Math.max(min, Math.min(max, v.y)),
    z: v.z !== undefined ? Math.max(min, Math.min(max, v.z)) : undefined,
  };
}