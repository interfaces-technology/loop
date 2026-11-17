import { sink, source, type Stage } from "./component.js";
import { createHandle, type Handle } from "./handle.js";
import { getRuntime } from "./runtime.js";
import type { Kind, Packet, Vec } from "./types.js";
import { isVec } from "./types.js";
import { broadcastTransport } from "./transport/broadcast.js";
import { packetKey } from "./transport/serialize.js";
import type { Transport, TransportStatus } from "./transport/types.js";

const roomRegistry = new Map<string, RelayRoom>();
const warnedTransportMismatch = new Set<string>();

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
  if (existing) {
    if (
      transport !== undefined &&
      transport !== existing.transport &&
      !warnedTransportMismatch.has(code)
    ) {
      warnedTransportMismatch.add(code);
      console.warn(
        `[loop] relay room "${code}" is already connected on a different transport; the new transport was ignored.`,
      );
    }
    return existing;
  }

  const relayRoom = createRelayRoom(code, transport ?? broadcastTransport(code));
  roomRegistry.set(code, relayRoom);
  return relayRoom;
}

export function clearRelayRooms(): void {
  for (const relayRoom of roomRegistry.values()) {
    relayRoom.disconnect();
  }
  roomRegistry.clear();
  warnedTransportMismatch.clear();
}

function createRelayRoom(code: string, transport: Transport): RelayRoom {
  let latestPacket: Packet | null = null;
  let packetSeq = 0;
  let connected = false;
  const unsubPacket = transport.onPacket((packet) => {
    latestPacket = packet;
    packetSeq += 1;
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
      warnedTransportMismatch.delete(code);
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
      // Emit each received packet exactly once per stage. Without this, read()
      // would return the same latestPacket every tick and sinks would render
      // identical data at frame rate. Multiple inbound() stages each track
      // their own position, so every consumer still sees every packet.
      let lastSeq = 0;
      return source({
        from: `relay:${code}:in`,
        emits: opts.emits,
        dataType: opts.dataType,
        read() {
          if (latestPacket === null || packetSeq === lastSeq) return null;
          lastSeq = packetSeq;
          return latestPacket;
        },
      });
    },

    subscribe<T extends number | Vec>(initial: T): Handle<T> {
      const handle = createHandle(initial);

      const off = transport.onPacket((packet) => {
        if (packet.kind !== "value") return;

        const value = packet.value;
        if (typeof initial === "number" && typeof value === "number") {
          handle._setValue(value as T);
        } else if (isVec(initial) && isVec(value)) {
          handle._setValue(value as T);
        }
      });

      const dispose = handle.dispose.bind(handle);
      handle.dispose = () => {
        off();
        dispose();
      };

      return handle;
    },

    publish(getPacket) {
      let last: string | null = null;

      return getRuntime().addTick(() => {
        const packet = getPacket();
        if (!packet) return;

        const key = packetKey(packet);
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
