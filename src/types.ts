export type Vec = { x: number; y: number; z?: number };

/**
 * A resolution-independent pixel buffer. Structurally compatible with the DOM's
 * `ImageData` (width / height / data), but deliberately not coupled to it so
 * frames can cross workers and Node.
 */
export interface Frame {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
}

export type Kind = "value" | "frame" | "data";

/**
 * Well-known `data` tags. Any string is accepted so teams can register their
 * own conventions, but these two render with autocomplete.
 */
export type KnownDataType = "text" | "event";
export type DataType = KnownDataType | (string & {});

/** The packet shape carried for a given kind of signal. */
export type PacketOf<K extends Kind> = K extends "value"
  ? { kind: "value"; value: number | Vec }
  : K extends "frame"
    ? { kind: "frame"; frame: Frame }
    : { kind: "data"; type: DataType; value: unknown };

export type ValuePacket = PacketOf<"value">;
export type FramePacket = PacketOf<"frame">;
export type DataPacket = PacketOf<"data">;

export type Packet = ValuePacket | FramePacket | DataPacket;

export function isVec(v: unknown): v is Vec {
  return typeof v === "object" && v !== null && "x" in v && "y" in v;
}

export function isFrame(v: unknown): v is Frame {
  return (
    typeof v === "object" &&
    v !== null &&
    "width" in v &&
    "height" in v &&
    "data" in v
  );
}

export function isPacket(v: unknown): v is Packet {
  if (typeof v !== "object" || v === null) return false;
  const kind = (v as { kind?: unknown }).kind;
  if (kind === "value") {
    const value = (v as { value?: unknown }).value;
    return typeof value === "number" || isVec(value);
  }
  if (kind === "frame") {
    return isFrame((v as { frame?: unknown }).frame);
  }
  if (kind === "data") {
    return typeof (v as { type?: unknown }).type === "string";
  }
  return false;
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
