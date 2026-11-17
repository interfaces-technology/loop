import type { Packet, Vec } from "../types.js";
import { isVec } from "../types.js";

/** Upper bound on a single relayed packet, in UTF-8 bytes. */
export const MAX_WIRE_BYTES = 64 * 1024;

const encoder = new TextEncoder();

/** UTF-8 byte length. Always >= UTF-16 length, so length checks short-circuit. */
function utf8Bytes(text: string): number {
  return encoder.encode(text).length;
}

const warned = new Set<string>();

function warnOnce(reason: string, message: string): void {
  if (warned.has(reason)) return;
  warned.add(reason);
  console.warn(`[loop] ${message}`);
}

let unserializableKey = 0;

/**
 * Cheap, allocation-light signature used to skip resending an unchanged packet.
 * Value packets avoid JSON entirely; only `data` falls back to stringification.
 */
export function packetKey(packet: Packet): string {
  if (packet.kind === "value") {
    const v = packet.value;
    return typeof v === "number" ? `v:${v}` : `v:${v.x},${v.y},${v.z ?? 0}`;
  }
  if (packet.kind === "data") {
    const v = packet.value;
    if (typeof v === "string") return `d:${packet.type}:${v}`;
    try {
      return `d:${packet.type}:${JSON.stringify(v)}`;
    } catch {
      // Unserializable values can't be deduped safely — force a send each tick.
      return `d:${packet.type}:!${unserializableKey++}`;
    }
  }
  return "f";
}

export interface WirePacket {
  kind: "value" | "data";
  value?: number | Vec;
  type?: string;
  data?: unknown;
}

/**
 * Serialize a packet for the wire, or return `null` when it must be dropped:
 * `frame` packets are not relayed in v0.1, and oversized or unserializable
 * payloads exceed the wire contract. Drops are warned about once per reason.
 */
export function serializePacket(packet: Packet): string | null {
  if (packet.kind === "frame") {
    warnOnce("frame", "Frame packets cannot be relayed yet; dropping.");
    return null;
  }

  const wire: WirePacket =
    packet.kind === "value"
      ? { kind: "value", value: packet.value }
      : { kind: "data", type: packet.type, data: packet.value };

  let json: string;
  try {
    json = JSON.stringify(wire);
  } catch {
    warnOnce("unserializable", "Packet value is not JSON-serializable; dropping.");
    return null;
  }

  // UTF-8 bytes are always >= UTF-16 length, so an over-limit length already
  // proves the packet is oversized without paying for the encode.
  if (json.length > MAX_WIRE_BYTES || utf8Bytes(json) > MAX_WIRE_BYTES) {
    warnOnce(
      "oversize",
      `Packet exceeds the ${MAX_WIRE_BYTES}-byte wire limit; dropping.`,
    );
    return null;
  }
  return json;
}

export function payloadToJsonText(data: unknown): string {
  if (typeof data === "string") return data;
  if (data instanceof ArrayBuffer) return new TextDecoder().decode(data);
  if (ArrayBuffer.isView(data)) {
    return new TextDecoder().decode(data);
  }
  throw new Error(`Unsupported wire payload type: ${Object.prototype.toString.call(data)}`);
}

export function deserializePacket(raw: string): Packet {
  // Same short-circuit as serialize: length alone can prove oversize.
  if (raw.length > MAX_WIRE_BYTES || utf8Bytes(raw) > MAX_WIRE_BYTES) {
    throw new Error(`Packet exceeds the ${MAX_WIRE_BYTES}-byte wire limit`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Malformed wire packet: not valid JSON");
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Malformed wire packet: expected an object");
  }

  const wire = parsed as WirePacket;

  if (wire.kind === "value") {
    const value = wire.value ?? 0;
    if (typeof value !== "number" && !isVec(value)) {
      throw new Error("Malformed wire packet: value must be a number or vector");
    }
    return { kind: "value", value };
  }

  if (wire.kind === "data") {
    if (typeof wire.type !== "string") {
      throw new Error("Malformed wire packet: data packets require a string type");
    }
    return { kind: "data", type: wire.type, value: wire.data };
  }

  throw new Error(`Unknown wire packet kind: ${String((wire as { kind?: unknown }).kind)}`);
}
