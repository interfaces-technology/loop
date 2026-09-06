import { describe, it, expect } from "vitest";
import { isVec, normalizeScalar, normalizeBipolar, normalizeVec, valuesEqual } from "../src/types.js";

describe("types", () => {
  it("isVec identifies vectors", () => {
    expect(isVec({ x: 1, y: 2 })).toBe(true);
    expect(isVec(0.5)).toBe(false);
  });

  it("normalizeScalar clamps to 0-1", () => {
    expect(normalizeScalar(-0.5)).toBe(0);
    expect(normalizeScalar(1.5)).toBe(1);
    expect(normalizeScalar(0.5)).toBe(0.5);
  });

  it("normalizeBipolar clamps to -1..1", () => {
    expect(normalizeBipolar(-2)).toBe(-1);
    expect(normalizeBipolar(2)).toBe(1);
  });

  it("normalizeVec clamps per axis", () => {
    expect(normalizeVec({ x: 2, y: -2 })).toEqual({ x: 1, y: -1, z: undefined });
  });

  it("valuesEqual compares scalars and vecs", () => {
    expect(valuesEqual(0.5, 0.5)).toBe(true);
    expect(valuesEqual({ x: 1, y: 2 }, { x: 1, y: 2 })).toBe(true);
    expect(valuesEqual({ x: 1, y: 2, z: 0 }, { x: 1, y: 2 })).toBe(true);
    expect(valuesEqual(0.5, 1)).toBe(false);
  });
});
