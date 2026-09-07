import type { Packet } from "../types.js";
import { deserializePacket, serializePacket } from "./serialize.js";
import type { Transport, TransportStatus } from "./types.js";

const CHANNEL_PREFIX = "loop-relay:";

export function broadcastTransport(room: string): Transport {
  return new BroadcastChannelTransport(room);
}

class BroadcastChannelTransport implements Transport {
  status: TransportStatus = "idle";
  private channel: BroadcastChannel | null = null;
  private packetListeners = new Set<(packet: Packet) => void>();
  private statusListeners = new Set<(status: TransportStatus) => void>();

  constructor(private readonly room: string) {}

  async connect(): Promise<void> {
    if (typeof BroadcastChannel === "undefined") {
      this.setStatus("error");
      throw new Error("BroadcastChannel is not available in this environment");
    }

    this.setStatus("connecting");
    this.channel = new BroadcastChannel(`${CHANNEL_PREFIX}${this.room}`);

    this.channel.onmessage = (event: MessageEvent<string>) => {
      try {
        const packet = deserializePacket(event.data);
        for (const fn of this.packetListeners) {
          fn(packet);
        }
      } catch {
        // Ignore malformed packets from other tabs.
      }
    };

    this.setStatus("connected");
  }

  disconnect(): void {
    this.channel?.close();
    this.channel = null;
    this.setStatus("disconnected");
  }

  send(packet: Packet): void {
    if (!this.channel || this.status !== "connected") return;
    this.channel.postMessage(serializePacket(packet));
  }

  onPacket(fn: (packet: Packet) => void): () => void {
    this.packetListeners.add(fn);
    return () => this.packetListeners.delete(fn);
  }

  onStatus(fn: (status: TransportStatus) => void): () => void {
    this.statusListeners.add(fn);
    return () => this.statusListeners.delete(fn);
  }

  private setStatus(next: TransportStatus): void {
    this.status = next;
    for (const fn of this.statusListeners) {
      fn(next);
    }
  }
}
