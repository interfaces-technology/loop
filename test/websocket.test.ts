import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { websocketTransport } from "../src/transport/websocket.js";
import type { TransportStatus } from "../src/transport/types.js";

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  static failNext = false;

  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  readonly url: string;
  readyState = FakeWebSocket.CONNECTING;
  binaryType = "";
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;

  constructor(url: string | URL) {
    if (FakeWebSocket.failNext) {
      FakeWebSocket.failNext = false;
      throw new Error("invalid url");
    }
    this.url = String(url);
    FakeWebSocket.instances.push(this);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.readyState = FakeWebSocket.CLOSED;
  }

  emitOpen(): void {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.();
  }

  emitClose(): void {
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.();
  }

  emitMessage(data: unknown): void {
    this.onmessage?.({ data } as MessageEvent);
  }
}

describe("websocketTransport", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeWebSocket.instances = [];
    FakeWebSocket.failNext = false;
    vi.stubGlobal("WebSocket", FakeWebSocket);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("connects, sends, and receives packets", async () => {
    const transport = websocketTransport("ws://relay.test", "room");
    const statuses: TransportStatus[] = [];
    transport.onStatus((s) => statuses.push(s));

    const promise = transport.connect();
    const socket = FakeWebSocket.instances[0]!;
    expect(socket.url).toBe("ws://relay.test/room");
    socket.emitOpen();
    await promise;

    expect(transport.status).toBe("connected");
    expect(statuses).toContain("connected");

    const received: unknown[] = [];
    transport.onPacket((p) => received.push(p));
    socket.emitMessage(JSON.stringify({ kind: "value", value: 0.5 }));
    expect(received).toEqual([{ kind: "value", value: 0.5 }]);

    transport.send({ kind: "value", value: 1 });
    expect(socket.sent).toEqual([JSON.stringify({ kind: "value", value: 1 })]);
    transport.disconnect();
  });

  it("shares one socket across concurrent connect() calls", async () => {
    const transport = websocketTransport("ws://relay.test", "r");
    const p1 = transport.connect();
    const p2 = transport.connect();
    expect(FakeWebSocket.instances).toHaveLength(1);

    FakeWebSocket.instances[0]!.emitOpen();
    await Promise.all([p1, p2]);
    expect(transport.status).toBe("connected");
    transport.disconnect();
  });

  it("buffers only the newest packet while connecting and flushes on open", async () => {
    const transport = websocketTransport("ws://relay.test", "r");
    const promise = transport.connect();
    transport.send({ kind: "value", value: 1 });
    transport.send({ kind: "value", value: 2 });

    const socket = FakeWebSocket.instances[0]!;
    expect(socket.sent).toHaveLength(0);
    socket.emitOpen();
    await promise;

    expect(socket.sent).toEqual([JSON.stringify({ kind: "value", value: 2 })]);
    transport.disconnect();
  });

  it("recovers when the WebSocket constructor throws synchronously", async () => {
    const transport = websocketTransport("ws://relay.test", "r");
    const statuses: TransportStatus[] = [];
    transport.onStatus((s) => statuses.push(s));

    FakeWebSocket.failNext = true;
    await expect(transport.connect()).rejects.toThrow("invalid url");
    expect(transport.status).toBe("error");

    // The failed attempt scheduled a reconnect; the retry succeeds.
    await vi.advanceTimersByTimeAsync(1000);
    expect(FakeWebSocket.instances).toHaveLength(1);
    FakeWebSocket.instances[0]!.emitOpen();
    expect(transport.status).toBe("connected");
    transport.disconnect();
  });

  it("rejects connect() when the socket closes before opening, then retries", async () => {
    const transport = websocketTransport("ws://relay.test", "r");
    const promise = transport.connect();
    const socket = FakeWebSocket.instances[0]!;
    socket.emitClose();

    await expect(promise).rejects.toThrow(/closed before connecting/);

    await vi.advanceTimersByTimeAsync(1000);
    expect(FakeWebSocket.instances.length).toBeGreaterThanOrEqual(2);
    transport.disconnect();
  });

  it("ignores events from a superseded socket", async () => {
    const transport = websocketTransport("ws://relay.test", "r");
    const p1 = transport.connect();
    const socketA = FakeWebSocket.instances[0]!;
    socketA.emitOpen();
    await p1;

    transport.send({ kind: "value", value: 1 });
    expect(socketA.sent).toHaveLength(1);

    // disconnect() closes A asynchronously; a new connect() can race its
    // late close event.
    transport.disconnect();
    const p2 = transport.connect();
    const socketB = FakeWebSocket.instances[1]!;
    socketB.emitOpen();
    await p2;
    expect(transport.status).toBe("connected");

    // A's late close must not tear down B.
    socketA.emitClose();
    expect(transport.status).toBe("connected");
    transport.send({ kind: "value", value: 2 });
    expect(socketB.sent).toEqual([JSON.stringify({ kind: "value", value: 2 })]);
    transport.disconnect();
  });
});
