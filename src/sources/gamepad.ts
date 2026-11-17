import { createHandle, type Handle } from "../handle.js";
import type { Packet } from "../types.js";
import { normalizeScalar } from "../types.js";
import { getRuntime } from "../runtime.js";
import {
  createDeviceSet,
  getDeviceRegistry,
  type Device,
  type DeviceEntry,
  type DeviceSet,
  type GamepadInfo,
  gamepadSnapshot,
} from "../device.js";
import { onGamepads } from "./gamepads.js";

export interface SliderBundle {
  x: Handle<number>;
  y: Handle<number>;
  rotation: Handle<number>;
}

type Triple = { x: number; y: number; rotation: number };

function readPad(index: number): Triple | null {
  const gp = gamepadSnapshot()[index];
  if (!gp) return null;

  const lx = gp.axes[0] ?? 0;
  const ly = gp.axes[1] ?? 0;
  const rt = gp.buttons[7]?.value ?? 0;
  return {
    x: normalizeScalar((lx + 1) / 2),
    y: normalizeScalar((-ly + 1) / 2),
    rotation: normalizeScalar(rt),
  };
}

function createBundle(initial: Triple, sample?: () => Triple): SliderBundle {
  const x = createHandle(initial.x);
  const y = createHandle(initial.y);
  const rotation = createHandle(initial.rotation);

  if (sample) {
    x._setSampler(() => sample().x);
    y._setSampler(() => sample().y);
    rotation._setSampler(() => sample().rotation);
    getRuntime().registerHandle(x as Handle<unknown>);
    getRuntime().registerHandle(y as Handle<unknown>);
    getRuntime().registerHandle(rotation as Handle<unknown>);
  }

  return { x, y, rotation };
}

// ---------------------------------------------------------------------------
// Legacy blended input — `loop.input("sliders")`.
// One bundle that samples whichever device is currently active. Kept for
// back-compat; device-separated values live in `getSlidersDeviceSet()`.
// ---------------------------------------------------------------------------

let bundle: SliderBundle | null = null;
let activeDevice = "on-screen";

function pollGamepad(): Triple | null {
  const gamepads = gamepadSnapshot();
  for (const gp of gamepads) {
    if (!gp) continue;

    const lx = gp.axes[0] ?? 0;
    const ly = gp.axes[1] ?? 0;
    const rt = gp.buttons[7]?.value ?? 0;

    const hasInput = Math.abs(lx) > 0.05 || Math.abs(ly) > 0.05 || rt > 0.05;
    if (hasInput) {
      activeDevice = "gamepad";
      return {
        x: normalizeScalar((lx + 1) / 2),
        y: normalizeScalar((-ly + 1) / 2),
        rotation: normalizeScalar(rt),
      };
    }
  }
  return null;
}

function sampleSliders(fallback: Triple): Triple {
  const gp = pollGamepad();
  if (gp) return gp;

  if (activeDevice === "midi") {
    return fallback;
  }

  activeDevice = "on-screen";
  return fallback;
}

export function getSlidersInput(): SliderBundle {
  if (!bundle) {
    const x = createHandle(0.5);
    const y = createHandle(0.5);
    const rotation = createHandle(0);

    const fallback = () => ({
      x: x.value,
      y: y.value,
      rotation: rotation.value,
    });

    const sampler = () => sampleSliders(fallback());

    x._setSampler(() => sampler().x);
    y._setSampler(() => sampler().y);
    rotation._setSampler(() => sampler().rotation);

    getRuntime().registerHandle(x as Handle<unknown>);
    getRuntime().registerHandle(y as Handle<unknown>);
    getRuntime().registerHandle(rotation as Handle<unknown>);

    bundle = { x, y, rotation };
  }
  return bundle;
}

export function setSlidersActiveDevice(device: string): void {
  activeDevice = device;
}

export function getSlidersActiveDevice(): string {
  return activeDevice;
}

export function slidersSourceRead(axis: "x" | "y" | "rotation"): Packet | null {
  const sliders = getSlidersInput();
  const value = sliders[axis].value;
  return { kind: "value", value };
}

// ---------------------------------------------------------------------------
// Device-separated lanes — `loop.inputs("sliders")`.
// One bundle per device identity: `gamepad:0`, `gamepad:1`, `midi`, `on-screen`.
// ---------------------------------------------------------------------------

const gamepadLanes = new Map<number, DeviceEntry<SliderBundle>>();
let onScreenLane: DeviceEntry<SliderBundle> | null = null;
let midiLane: DeviceEntry<SliderBundle> | null = null;
let lanesBound = false;

function reconcilePads(pads: GamepadInfo[]): void {
  const seen = new Set(pads.map((pad) => pad.index));

  for (const pad of pads) {
    if (!gamepadLanes.has(pad.index)) {
      const device = getDeviceRegistry().upsert("gamepad", pad.index, pad.id);
      const fallback: Triple = { x: 0.5, y: 0.5, rotation: 0 };
      const value = createBundle(fallback, () => readPad(pad.index) ?? fallback);
      gamepadLanes.set(pad.index, { device, value });
    }
  }

  for (const [index, lane] of gamepadLanes) {
    if (!seen.has(index)) {
      lane.value.x.dispose();
      lane.value.y.dispose();
      lane.value.rotation.dispose();
      gamepadLanes.delete(index);
    }
  }
}

function ensureLanes(): void {
  if (lanesBound) return;
  lanesBound = true;
  onGamepads(reconcilePads);
}

/** The on-screen slider lane. UI code writes into these handles. */
export function getOnScreenLane(): SliderBundle {
  if (!onScreenLane) {
    const device: Device = getDeviceRegistry().upsert("on-screen", 0, "On-screen");
    onScreenLane = { device, value: createBundle({ x: 0.5, y: 0.5, rotation: 0 }) };
  }
  return onScreenLane.value;
}

/** The MIDI lane. The MIDI source writes into these handles. */
export function getMidiLane(): SliderBundle {
  if (!midiLane) {
    const device: Device = getDeviceRegistry().upsert("midi", 0, "MIDI");
    midiLane = { device, value: createBundle({ x: 0.5, y: 0.5, rotation: 0 }) };
  }
  return midiLane.value;
}

function resolveSliderLanes(): Map<string, DeviceEntry<SliderBundle>> {
  ensureLanes();
  getOnScreenLane();

  const out = new Map<string, DeviceEntry<SliderBundle>>();
  for (const lane of gamepadLanes.values()) out.set(lane.device.id, lane);
  if (midiLane) out.set(midiLane.device.id, midiLane);
  if (onScreenLane) out.set(onScreenLane.device.id, onScreenLane);
  return out;
}

let sliderDeviceSet: DeviceSet<SliderBundle> | null = null;

/** Values separated by device identity, one `SliderBundle` per device. */
export function getSlidersDeviceSet(): DeviceSet<SliderBundle> {
  if (!sliderDeviceSet) {
    sliderDeviceSet = createDeviceSet("sliders", resolveSliderLanes);
  }
  return sliderDeviceSet;
}

/** Test seam: drop every gamepad/midi lane. */
export function resetSlidersDeviceSet(): void {
  for (const lane of gamepadLanes.values()) {
    lane.value.x.dispose();
    lane.value.y.dispose();
    lane.value.rotation.dispose();
  }
  gamepadLanes.clear();
  midiLane = null;
  onScreenLane = null;
  sliderDeviceSet = null;
  lanesBound = false;
}

/** Tear down the blended handle and every device lane. */
export function resetSlidersInput(): void {
  bundle = null;
  activeDevice = "on-screen";
  resetSlidersDeviceSet();
}
