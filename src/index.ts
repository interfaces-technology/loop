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
import type { Kind } from "./types.js";
import { pipe, connect } from "./pipe.js";
import { tick } from "./runtime.js";
import { resetRuntime } from "./runtime.js";
import {
  input,
  inputs,
  output,
  resolveInput,
  getSlidersInput,
  registerInput,
  registerOutput,
  clearInputRegistries,
} from "./input.js";
import { getDeviceRegistry, resetDeviceRegistry } from "./device.js";
import { resetGamepadHub } from "./sources/gamepads.js";
import { getDpadActiveDevice, resetDpadInput } from "./sources/dpad.js";
import {
  getSlidersActiveDevice,
  setSlidersActiveDevice,
  resetSlidersInput,
} from "./sources/gamepad.js";
import { resetKeyboardInput } from "./sources/keyboard.js";
import { initMidi, resetMidi } from "./sources/midi.js";
import { room as relayRoom, clearRelayRooms } from "./relay.js";
import { broadcastTransport } from "./transport/broadcast.js";
import { websocketTransport } from "./transport/websocket.js";
import { memoryTransport, clearMemoryTransports } from "./transport/memory.js";
import { layout, registerLayout, clearLayouts } from "./layout.js";
import { setSmileSampler, resetSmileInput } from "./sources/smile.js";
import { createSmilePrintTransform } from "./transforms/smile-print.js";
import { filter, capture } from "./operations.js";

const loop = {
  source: <E extends Kind>(def: SourceDef<E>) => source(def),
  transform: <A extends Kind, E extends Kind>(def: TransformDef<A, E>) => transform(def),
  sink: <A extends Kind>(def: SinkDef<A>) => sink(def),
  component: (def: ComponentDef) => component(def),

  pipe,
  connect,

  input,
  inputs,
  initMidi,
  output,
  tick,

  /** Every connected device, optionally filtered by family (`"gamepad"`). */
  devices: (kind?: string) => getDeviceRegistry().list(kind),
  /** Subscribe to device connect/disconnect. Fires with the full device list. */
  onDevices: (fn: (devices: import("./device.js").Device[]) => void) =>
    getDeviceRegistry().on(fn),

  registerInput,
  registerOutput,
  registerLayout,

  filter,
  capture,

  resolveInput,
  getSlidersInput,

  getDpadActiveDevice,
  getSlidersActiveDevice,
  setSlidersActiveDevice,

  layout,

  setSmileSampler,
  createSmilePrintTransform,

  relay: {
    room: relayRoom,
    broadcastTransport,
    websocketTransport,
    memoryTransport,
    clear: clearRelayRooms,
  },

  /** Tear down every singleton: relay rooms, layouts, inputs, and the frame loop. */
  reset(): void {
    clearRelayRooms();
    clearLayouts();
    clearMemoryTransports();
    clearInputRegistries();
    resetGamepadHub();
    resetRuntime();
    resetDpadInput();
    resetKeyboardInput();
    resetSlidersInput();
    resetMidi();
    resetSmileInput();
    resetDeviceRegistry();
  },
};

export default loop;

export type { SourceDef, TransformDef, SinkDef, ComponentDef, Stage } from "./component.js";
export type { Pipeline } from "./pipe.js";
export type { Handle } from "./handle.js";
export type { TickInfo } from "./runtime.js";
export type { Packet, PacketOf, Vec, Kind, Frame, DataType } from "./types.js";
export type { Transport, TransportStatus } from "./transport/types.js";
export type { RelayRoom } from "./relay.js";
export type { ReceiptLayout } from "./sinks/receipt.js";
export type { InputHandle, InputFactory, OutputFactory, SliderHandles } from "./input.js";
export type { FilterFn } from "./operations.js";
export type { Device, DeviceSet, DeviceEntry } from "./device.js";
export { getDeviceRegistry } from "./device.js";

export {
  source,
  transform,
  sink,
  component,
  pipe,
  connect,
  input,
  inputs,
  initMidi,
  output,
  registerInput,
  registerOutput,
  registerLayout,
  filter,
  capture,
  tick,
};
