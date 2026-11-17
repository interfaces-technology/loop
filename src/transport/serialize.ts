import type { Packet, Vec } from "../types.js";
import { isVec } from "../types.js";

/** Upper bound on a single relayed packet, in UTF-8 bytes. */
export const MAX_WIRE_BYTES = 64 * 1024;

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
    return `d:${packet.type}:${typeof packet.value === "string" ? packet.value : JSON.stringify(packet.value)}`;
  }
  return "f";
}

export interface WirePacket {
  kind: "value" | "data";
  value?: number | Vec;
  type?: string;
  data?: unknown;
}

export function serializePacket(packet: Packet): string {
  if (packet.kind === "frame") {
    throw new Error("Frame packets cannot be relayed yet (coming in a later slice)");
  }

  const wire: WirePacket =
    packet.kind === "value"
      ? { kind: "value", value: packet.value }
      : { kind: "data", type: packet.type, data: packet.value };

  const json = JSON.stringify(wire);
  if (json.length > MAX_WIRE_BYTES) {
    throw new Error(
      `Packet exceeds the ${MAX_WIRE_BYTES}-byte wire limit (${json.length} bytes)`,
    );
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
  if (raw.length > MAX_WIRE_BYTES) {
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
