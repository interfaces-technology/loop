import type { Packet } from "../types.js";
import { deserializePacket, payloadToJsonText, serializePacket } from "./serialize.js";
import type { Transport, TransportStatus } from "./types.js";

const BASE_RECONNECT_MS = 500;
const MAX_RECONNECT_MS = 10_000;

export function websocketTransport(url: string, room: string): Transport {
  return new WebSocketTransport(url, room);
}

class WebSocketTransport implements Transport {
  status: TransportStatus = "idle";
  private socket: WebSocket | null = null;
  private connectPromise: Promise<void> | null = null;
  private packetListeners = new Set<(packet: Packet) => void>();
  private statusListeners = new Set<(status: TransportStatus) => void>();
  private shouldReconnect = false;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pending: string | null = null;

  constructor(
    private readonly url: string,
    private readonly room: string,
  ) {}

  connect(): Promise<void> {
    if (this.status === "connected") return Promise.resolve();
    // Share one in-flight attempt so concurrent connect() calls can't open
    // competing sockets.
    if (this.connectPromise) return this.connectPromise;
    this.shouldReconnect = true;
    this.clearReconnect();
    const attempt = this.open();
    const clear = () => {
      if (this.connectPromise === attempt) this.connectPromise = null;
    };
    attempt.then(clear, clear);
    this.connectPromise = attempt;
    return attempt;
  }

  disconnect(): void {
    this.shouldReconnect = false;
    this.clearReconnect();
    this.socket?.close();
    this.socket = null;
    this.pending = null;
    this.setStatus("disconnected");
  }

  send(packet: Packet): void {
    const text = serializePacket(packet);
    if (text === null) return;
    if (this.socket && this.status === "connected" && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(text);
      return;
    }
    // Buffer only the newest packet; for live signals freshness beats history.
    this.pending = text;
  }

  onPacket(fn: (packet: Packet) => void): () => void {
    this.packetListeners.add(fn);
    return () => this.packetListeners.delete(fn);
  }

  onStatus(fn: (status: TransportStatus) => void): () => void {
    this.statusListeners.add(fn);
    return () => this.statusListeners.delete(fn);
  }

  private open(): Promise<void> {
    if (typeof WebSocket === "undefined") {
      this.setStatus("error");
      return Promise.reject(new Error("WebSocket is not available in this environment"));
    }

    this.setStatus("connecting");
    const endpoint = buildEndpoint(this.url, this.room);

    let socket: WebSocket;
    try {
      socket = new WebSocket(endpoint);
    } catch (err) {
      // A synchronous constructor failure (e.g. an invalid URL) never fires
      // onclose, so without this the reconnect loop would stall forever.
      this.setStatus("error");
      this.scheduleReconnect();
      return Promise.reject(err instanceof Error ? err : new Error(String(err)));
    }

    this.socket = socket;
    socket.binaryType = "arraybuffer";

    // Events from a superseded socket (disconnect/connect race, late close)
    // must not touch the live one.
    const isCurrent = () => this.socket === socket;

    return new Promise<void>((resolve, reject) => {
      let rejected = false;
      const rejectOnce = (err: Error) => {
        if (!rejected) {
          rejected = true;
          reject(err);
        }
      };

      socket.onopen = () => {
        if (!isCurrent()) return;
        this.reconnectAttempts = 0;
        this.setStatus("connected");
        this.flushPending();
        resolve();
      };

      socket.onerror = () => {
        if (!isCurrent()) return;
        if (this.status !== "connected") {
          this.setStatus("error");
          rejectOnce(new Error(`WebSocket failed to connect to ${endpoint}`));
        }
      };

      socket.onclose = () => {
        if (!isCurrent()) return;
        this.socket = null;
        if (this.status !== "connected") {
          this.setStatus("error");
          rejectOnce(new Error(`WebSocket closed before connecting to ${endpoint}`));
        } else {
          this.setStatus("disconnected");
        }
        this.scheduleReconnect();
      };

      socket.onmessage = (event: MessageEvent) => {
        if (!isCurrent()) return;
        const data = event.data;
        if (typeof Blob !== "undefined" && data instanceof Blob) {
          void data
            .text()
            .then((text) => this.dispatchPacket(text))
            .catch(() => {
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

  private flushPending(): void {
    if (this.pending === null || !this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    const text = this.pending;
    this.pending = null;
    this.socket.send(text);
  }

  private scheduleReconnect(): void {
    if (!this.shouldReconnect || this.reconnectTimer !== null) return;
    const delay = Math.min(BASE_RECONNECT_MS * 2 ** this.reconnectAttempts, MAX_RECONNECT_MS);
    this.reconnectAttempts += 1;
    const jitter = delay * 0.2 * Math.random();

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.shouldReconnect) return;
      void this.open().catch(() => {
        // The retry failed to open; onclose (or a sync throw) schedules the next.
      });
    }, delay + jitter);
  }

  private clearReconnect(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempts = 0;
  }

  private dispatchPacket(raw: string): void {
    let packet: Packet;
    try {
      packet = deserializePacket(raw);
    } catch {
      // Ignore malformed packets.
      return;
    }
    // A throwing listener must not starve the others or get eaten as a
    // parse error — isolate each delivery.
    for (const fn of this.packetListeners) {
      try {
        fn(packet);
      } catch (err) {
        console.error("[loop] websocket packet listener threw", err);
      }
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
