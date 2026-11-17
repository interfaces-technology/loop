import { createHandle, type Handle } from "../handle.js";
import type { Vec, Packet } from "../types.js";
import { normalizeVec } from "../types.js";
import { getRuntime } from "../runtime.js";
import {
  createDeviceSet,
  getDeviceRegistry,
  type DeviceEntry,
  type DeviceSet,
  type GamepadInfo,
} from "../device.js";
import { onGamepads } from "./gamepads.js";

const ZERO: Vec = { x: 0, y: 0 };

const KEY_MAP: Record<string, { x?: number; y?: number }> = {
  ArrowUp: { y: -1 },
  ArrowDown: { y: 1 },
  ArrowLeft: { x: -1 },
  ArrowRight: { x: 1 },
  w: { y: -1 },
  s: { y: 1 },
  a: { x: -1 },
  d: { x: 1 },
  W: { y: -1 },
  S: { y: 1 },
  A: { x: -1 },
  D: { x: 1 },
};

let keysDown = new Set<string>();
let listenersAttached = false;

function attachDpadListeners(): void {
  if (listenersAttached || typeof document === "undefined") return;
  listenersAttached = true;

  document.addEventListener("keydown", (e) => {
    if (KEY_MAP[e.key]) {
      keysDown.add(e.key);
      e.preventDefault();
    }
  });

  document.addEventListener("keyup", (e) => {
    keysDown.delete(e.key);
  });
}

function readKeyboardDpad(): Vec {
  let x = 0;
  let y = 0;

  for (const key of keysDown) {
    const dir = KEY_MAP[key];
    if (dir) {
      if (dir.x) x += dir.x;
      if (dir.y) y += dir.y;
    }
  }

  return x !== 0 || y !== 0 ? normalizeVec({ x, y }) : ZERO;
}

function readPadDpad(index: number): Vec {
  if (typeof navigator === "undefined" || !navigator.getGamepads) return ZERO;
  const gp = navigator.getGamepads()[index];
  if (!gp) return ZERO;

  let x = 0;
  let y = 0;
  if (gp.buttons[14]?.pressed) x -= 1;
  if (gp.buttons[15]?.pressed) x += 1;
  if (gp.buttons[12]?.pressed) y -= 1;
  if (gp.buttons[13]?.pressed) y += 1;

  return x !== 0 || y !== 0 ? normalizeVec({ x, y }) : ZERO;
}

// ---------------------------------------------------------------------------
// Legacy blended input — `loop.input("dpad")`.
// One handle that samples gamepad, then keyboard. Device-separated values live
// in `getDpadDeviceSet()`.
// ---------------------------------------------------------------------------

let dpadHandle: Handle<Vec> | null = null;
let activeDevice = "none";

function pollGamepadDpad(): Vec {
  if (typeof navigator === "undefined" || !navigator.getGamepads) return ZERO;

  const gamepads = navigator.getGamepads();
  for (const gp of gamepads) {
    if (!gp) continue;
    const v = readPadDpad(gp.index);
    if (v.x !== 0 || v.y !== 0) {
      activeDevice = "gamepad";
      return v;
    }
  }
  return ZERO;
}

function pollKeyboardDpad(): Vec {
  const v = readKeyboardDpad();
  if (v.x !== 0 || v.y !== 0) {
    activeDevice = "keyboard";
    return v;
  }
  return ZERO;
}

function sampleDpad(): Vec {
  const gp = pollGamepadDpad();
  if (gp.x !== 0 || gp.y !== 0) return gp;

  const kb = pollKeyboardDpad();
  if (kb.x !== 0 || kb.y !== 0) return kb;

  activeDevice = "none";
  return ZERO;
}

export function getDpadInput(): Handle<Vec> {
  if (!dpadHandle) {
    dpadHandle = createHandle(ZERO);
    attachDpadListeners();
    dpadHandle._setSampler(sampleDpad);
    getRuntime().registerHandle(dpadHandle as Handle<unknown>);
  }
  return dpadHandle;
}

export function getDpadActiveDevice(): string {
  return activeDevice;
}

export function dpadSourceRead(): Packet | null {
  const v = sampleDpad();
  return { kind: "value", value: v };
}

// ---------------------------------------------------------------------------
// Device-separated lanes — `loop.inputs("dpad")`.
// One `Handle<Vec>` per device identity: `keyboard`, `gamepad:0`, `gamepad:1`.
// ---------------------------------------------------------------------------

const gamepadLanes = new Map<number, DeviceEntry<Handle<Vec>>>();
let keyboardLane: DeviceEntry<Handle<Vec>> | null = null;
let lanesBound = false;

function reconcilePads(pads: GamepadInfo[]): void {
  const seen = new Set(pads.map((pad) => pad.index));

  for (const pad of pads) {
    if (!gamepadLanes.has(pad.index)) {
      const device = getDeviceRegistry().upsert("gamepad", pad.index, pad.id);
      const handle = createHandle(ZERO);
      handle._setSampler(() => readPadDpad(pad.index));
      getRuntime().registerHandle(handle as Handle<unknown>);
      gamepadLanes.set(pad.index, { device, value: handle });
    }
  }

  for (const [index, lane] of gamepadLanes) {
    if (!seen.has(index)) {
      lane.value.dispose();
      gamepadLanes.delete(index);
    }
  }
}

function ensureLanes(): void {
  if (lanesBound) return;
  lanesBound = true;
  onGamepads(reconcilePads);
}

function ensureKeyboardLane(): void {
  if (keyboardLane) return;
  attachDpadListeners();
  const device = getDeviceRegistry().upsert("keyboard", 0, "Keyboard");
  const handle = createHandle(ZERO);
  handle._setSampler(readKeyboardDpad);
  getRuntime().registerHandle(handle as Handle<unknown>);
  keyboardLane = { device, value: handle };
}

function resolveDpadLanes(): Map<string, DeviceEntry<Handle<Vec>>> {
  ensureLanes();
  ensureKeyboardLane();

  const out = new Map<string, DeviceEntry<Handle<Vec>>>();
  for (const lane of gamepadLanes.values()) out.set(lane.device.id, lane);
  if (keyboardLane) out.set(keyboardLane.device.id, keyboardLane);
  return out;
}

let dpadDeviceSet: DeviceSet<Handle<Vec>> | null = null;

/** Values separated by device identity, one `Handle<Vec>` per device. */
export function getDpadDeviceSet(): DeviceSet<Handle<Vec>> {
  if (!dpadDeviceSet) {
    dpadDeviceSet = createDeviceSet("dpad", resolveDpadLanes);
  }
  return dpadDeviceSet;
}

/** Test seam: drop every keyboard/gamepad lane. */
export function resetDpadDeviceSet(): void {
  for (const lane of gamepadLanes.values()) lane.value.dispose();
  gamepadLanes.clear();
  keyboardLane = null;
  dpadDeviceSet = null;
  lanesBound = false;
}

/** Tear down the blended handle and every device lane. */
export function resetDpadInput(): void {
  dpadHandle = null;
  keysDown = new Set();
  activeDevice = "none";
  resetDpadDeviceSet();
}
