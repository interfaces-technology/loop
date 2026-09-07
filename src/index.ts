import {
  source,
  transform,
  sink,
  component,
  type SourceDef,
  type TransformDef,
  type SinkDef,
  type ComponentDef,
} from "./component.js";
import { pipe, connect } from "./pipe.js";
import { tick } from "./runtime.js";
import { input, output, resolveInput, getSlidersInput } from "./input.js";
import { getDpadActiveDevice } from "./sources/dpad.js";
import { getSlidersActiveDevice, setSlidersActiveDevice } from "./sources/gamepad.js";
import { room as relayRoom, clearRelayRooms } from "./relay.js";
import { broadcastTransport } from "./transport/broadcast.js";
import { websocketTransport } from "./transport/websocket.js";
import { memoryTransport } from "./transport/memory.js";

function notImplemented(name: string): never {
  throw new Error(`${name} is not implemented yet (coming in slice 4+)`);
}

const loop = {
  source: (def: SourceDef) => source(def),
  transform: (def: TransformDef) => transform(def),
  sink: (def: SinkDef) => sink(def),
  component: (def: ComponentDef) => component(def),

  pipe,
  connect,

  input,
  output,
  tick,

  resolveInput,
  getSlidersInput,

  getDpadActiveDevice,
  getSlidersActiveDevice,
  setSlidersActiveDevice,

  layout: () => notImplemented("loop.layout"),
  filter: () => notImplemented("loop.filter"),
  capture: () => notImplemented("loop.capture"),

  relay: {
    room: relayRoom,
    broadcastTransport,
    websocketTransport,
    memoryTransport,
    clear: clearRelayRooms,
  },
};

export default loop;

export type { SourceDef, TransformDef, SinkDef, ComponentDef } from "./component.js";
export type { Pipeline } from "./pipe.js";
export type { Handle } from "./handle.js";
export type { Packet, Vec, Kind } from "./types.js";
export type { Transport, TransportStatus } from "./transport/types.js";
export type { RelayRoom } from "./relay.js";

export {
  source,
  transform,
  sink,
  component,
  pipe,
  connect,
  input,
  output,
  tick,
};
