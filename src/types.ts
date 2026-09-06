export type Vec = { x: number; y: number; z?: number };

export type Packet =
  | { kind: "value"; value: number | Vec }
  | { kind: "frame"; frame: ImageData }
  | { kind: "data"; type: string; value: unknown };

export type Kind = Packet["kind"];

export function isVec(v: number | Vec): v is Vec {
  return typeof v === "object" && v !== null && "x" in v && "y" in v;
}

export function valuesEqual(a: number | Vec, b: number | Vec): boolean {
  if (typeof a === "number" && typeof b === "number") return a === b;
  if (isVec(a) && isVec(b)) {
    return a.x === b.x && a.y === b.y && (a.z ?? 0) === (b.z ?? 0);
  }
  return false;
}

export function normalizeScalar(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export function normalizeBipolar(v: number): number {
  return Math.max(-1, Math.min(1, v));
}

export function normalizeVec(v: Vec, bipolar = true): Vec {
  const clamp = bipolar ? normalizeBipolar : normalizeScalar;
  return {
    x: clamp(v.x),
    y: clamp(v.y),
    z: v.z !== undefined ? clamp(v.z) : undefined,
  };
}
