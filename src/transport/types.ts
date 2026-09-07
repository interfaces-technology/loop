import type { Packet } from "../types.js";

export type TransportStatus = "idle" | "connecting" | "connected" | "disconnected" | "error";

export interface Transport {
  readonly status: TransportStatus;
  connect(): Promise<void>;
  disconnect(): void;
  send(packet: Packet): void;
  onPacket(fn: (packet: Packet) => void): () => void;
  onStatus(fn: (status: TransportStatus) => void): () => void;
}
