import { createHandle, type Handle } from "../handle.js";
import type { Vec, Packet } from "../types.js";
import { normalizeVec } from "../types.js";
import { getRuntime } from "../runtime.js";

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

let dpadHandle: Handle<Vec> | null = null;
let keysDown = new Set<string>();
let activeDevice = "none";
let listenersAttached = false;

function pollGamepadDpad(): Vec {
  if (typeof navigator === "undefined" || !navigator.getGamepads) return ZERO;

  const gamepads = navigator.getGamepads();
  for (const gp of gamepads) {
    if (!gp) continue;

    let x = 0;
    let y = 0;

    if (gp.buttons[14]?.pressed) x -= 1;
    if (gp.buttons[15]?.pressed) x += 1;
    if (gp.buttons[12]?.pressed) y -= 1;
    if (gp.buttons[13]?.pressed) y += 1;

    if (x !== 0 || y !== 0) {
      activeDevice = "gamepad";
      return normalizeVec({ x, y });
    }
  }
  return ZERO;
}

function pollKeyboardDpad(): Vec {
  let x = 0;
  let y = 0;

  for (const key of keysDown) {
    const dir = KEY_MAP[key];
    if (dir) {
      if (dir.x) x += dir.x;
      if (dir.y) y += dir.y;
    }
  }

  if (x !== 0 || y !== 0) {
    activeDevice = "keyboard";
    return normalizeVec({ x, y });
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
