import type { Packet } from "../types.js";
import { deserializePacket, payloadToJsonText, serializePacket } from "./serialize.js";
import type { Transport, TransportStatus } from "./types.js";

export function websocketTransport(url: string, room: string): Transport {
  return new WebSocketTransport(url, room);
}

class WebSocketTransport implements Transport {
  status: TransportStatus = "idle";
  private socket: WebSocket | null = null;
  private packetListeners = new Set<(packet: Packet) => void>();
  private statusListeners = new Set<(status: TransportStatus) => void>();

  constructor(
    private readonly url: string,
    private readonly room: string,
  ) {}

  async connect(): Promise<void> {
    if (typeof WebSocket === "undefined") {
      this.setStatus("error");
      throw new Error("WebSocket is not available in this environment");
    }

    this.setStatus("connecting");

    const endpoint = buildEndpoint(this.url, this.room);

    await new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(endpoint);
      this.socket = socket;
      socket.binaryType = "arraybuffer";

      socket.onopen = () => {
        this.setStatus("connected");
        resolve();
      };

      socket.onerror = () => {
        this.setStatus("error");
        reject(new Error(`WebSocket failed to connect to ${endpoint}`));
      };

      socket.onclose = () => {
        if (this.status === "connecting") {
          this.setStatus("error");
          reject(new Error(`WebSocket closed before connecting to ${endpoint}`));
          return;
        }
        this.setStatus("disconnected");
      };

      socket.onmessage = (event: MessageEvent) => {
        const data = event.data;
        if (typeof Blob !== "undefined" && data instanceof Blob) {
          void data.text().then((text) => this.dispatchPacket(text)).catch(() => {
            // Ignore malformed packets.
          });
          return;
        }
        try {
          this.dispatchPacket(payloadToJsonText(data));
        } catch {
          // Ignore malformed packets.
        }
      };
    });
  }

  disconnect(): void {
    this.socket?.close();
    this.socket = null;
    this.setStatus("disconnected");
  }

  send(packet: Packet): void {
    if (!this.socket || this.status !== "connected") return;
    if (this.socket.readyState !== WebSocket.OPEN) return;
    this.socket.send(serializePacket(packet));
  }

  onPacket(fn: (packet: Packet) => void): () => void {
    this.packetListeners.add(fn);
    return () => this.packetListeners.delete(fn);
  }

  onStatus(fn: (status: TransportStatus) => void): () => void {
    this.statusListeners.add(fn);
    return () => this.statusListeners.delete(fn);
  }

  private dispatchPacket(raw: string): void {
    try {
      const packet = deserializePacket(raw);
      for (const fn of this.packetListeners) {
        fn(packet);
      }
    } catch {
      // Ignore malformed packets.
    }
  }

  private setStatus(next: TransportStatus): void {
    this.status = next;
    for (const fn of this.statusListeners) {
      fn(next);
    }
  }
}

function buildEndpoint(url: string, room: string): string {
  const base = url.replace(/\/$/, "");
  const encodedRoom = encodeURIComponent(room);

  if (base.includes("{room}")) {
    return base.replace("{room}", encodedRoom);
  }

  return `${base}/${encodedRoom}`;
}
