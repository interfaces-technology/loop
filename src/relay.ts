import { sink, source, type Stage } from "./component.js";
import { createHandle, type Handle } from "./handle.js";
import { getRuntime } from "./runtime.js";
import type { Kind, Packet, Vec } from "./types.js";
import { isVec } from "./types.js";
import { broadcastTransport } from "./transport/broadcast.js";
import type { Transport, TransportStatus } from "./transport/types.js";

const roomRegistry = new Map<string, RelayRoom>();

export interface RelayRoom {
  readonly code: string;
  readonly transport: Transport;
  connect(): Promise<void>;
  disconnect(): void;
  outbound(opts: { accepts: Kind | Kind[]; dataType?: string }): Stage;
  inbound(opts: { emits: Kind; dataType?: string }): Stage;
  subscribe<T extends number | Vec>(initial: T): Handle<T>;
  publish(getPacket: () => Packet | null): () => void;
  onStatus(fn: (status: TransportStatus) => void): () => void;
}

export function room(code: string, transport?: Transport): RelayRoom {
  const existing = roomRegistry.get(code);
  if (existing) return existing;

  const relayRoom = createRelayRoom(code, transport ?? broadcastTransport(code));
  roomRegistry.set(code, relayRoom);
  return relayRoom;
}

export function clearRelayRooms(): void {
  for (const relayRoom of roomRegistry.values()) {
    relayRoom.disconnect();
  }
  roomRegistry.clear();
}

function createRelayRoom(code: string, transport: Transport): RelayRoom {
  let latestPacket: Packet | null = null;
  let connected = false;
  const unsubPacket = transport.onPacket((packet) => {
    latestPacket = packet;
  });

  const relayRoom: RelayRoom = {
    code,
    transport,

    async connect() {
      if (connected) return;
      await transport.connect();
      connected = true;
    },

    disconnect() {
      unsubPacket();
      transport.disconnect();
      roomRegistry.delete(code);
      connected = false;
    },

    outbound(opts) {
      return sink({
        to: `relay:${code}:out`,
        accepts: opts.accepts,
        dataType: opts.dataType,
        render(packet) {
          transport.send(packet);
        },
      });
    },

    inbound(opts) {
      return source({
        from: `relay:${code}:in`,
        emits: opts.emits,
        dataType: opts.dataType,
        read() {
          return latestPacket;
        },
      });
    },

    subscribe<T extends number | Vec>(initial: T): Handle<T> {
      const handle = createHandle(initial);

      transport.onPacket((packet) => {
        if (packet.kind !== "value") return;

        const value = packet.value;
        if (typeof initial === "number" && typeof value === "number") {
          handle._setValue(value as T);
        } else if (isVec(initial) && isVec(value)) {
          handle._setValue(value as T);
        }
      });

      getRuntime().registerHandle(handle as Handle<unknown>);
      return handle;
    },

    publish(getPacket) {
      let last: string | null = null;

      return getRuntime().addTick(() => {
        const packet = getPacket();
        if (!packet) return;

        const key = JSON.stringify(packet);
        if (key === last) return;
        last = key;

        transport.send(packet);
      });
    },

    onStatus(fn) {
      return transport.onStatus(fn);
    },
  };

  return relayRoom;
}
