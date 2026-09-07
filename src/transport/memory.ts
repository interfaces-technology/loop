import type { Packet } from "../types.js";
import type { Transport, TransportStatus } from "./types.js";

const rooms = new Map<string, MemoryTransport>();

export function memoryTransport(room: string): Transport {
  const existing = rooms.get(room);
  if (existing) return existing;

  const transport = new MemoryTransport(room);
  rooms.set(room, transport);
  return transport;
}

export function clearMemoryTransports(): void {
  rooms.clear();
}

class MemoryTransport implements Transport {
  readonly room: string;
  status: TransportStatus = "idle";
  private listeners = new Set<(packet: Packet) => void>();
  private statusListeners = new Set<(status: TransportStatus) => void>();

  constructor(room: string) {
    this.room = room;
  }

  async connect(): Promise<void> {
    this.setStatus("connected");
  }

  disconnect(): void {
    this.setStatus("disconnected");
    rooms.delete(this.room);
  }

  send(packet: Packet): void {
    if (this.status !== "connected") return;
    for (const listener of this.listeners) {
      listener(packet);
    }
  }

  onPacket(fn: (packet: Packet) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
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
