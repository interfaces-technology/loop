import type { Packet, Vec } from "../types.js";

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

  return JSON.stringify(wire);
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
  const wire = JSON.parse(raw) as WirePacket;

  if (wire.kind === "value") {
    return { kind: "value", value: wire.value ?? 0 };
  }

  if (wire.kind === "data") {
    return { kind: "data", type: wire.type ?? "unknown", value: wire.data };
  }

  throw new Error(`Unknown wire packet kind: ${(wire as { kind?: string }).kind}`);
}
