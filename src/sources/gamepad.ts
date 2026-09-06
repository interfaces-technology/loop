import { createHandle, type Handle } from "../handle.js";
import type { Packet } from "../types.js";
import { normalizeScalar } from "../types.js";
import { getRuntime } from "../runtime.js";

export interface SliderBundle {
  x: Handle<number>;
  y: Handle<number>;
  rotation: Handle<number>;
}

let bundle: SliderBundle | null = null;
let activeDevice = "on-screen";
let gamepadConnected = false;

function pollGamepad(): { x: number; y: number; rotation: number } | null {
  if (typeof navigator === "undefined" || !navigator.getGamepads) return null;

  const gamepads = navigator.getGamepads();
  for (const gp of gamepads) {
    if (!gp) continue;

    const lx = gp.axes[0] ?? 0;
    const ly = gp.axes[1] ?? 0;
    const rt = gp.buttons[7]?.value ?? 0;

    const hasInput = Math.abs(lx) > 0.05 || Math.abs(ly) > 0.05 || rt > 0.05;
    if (hasInput || gamepadConnected) {
      gamepadConnected = true;
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

function sampleSliders(fallback: { x: number; y: number; rotation: number }): {
  x: number;
  y: number;
  rotation: number;
} {
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
