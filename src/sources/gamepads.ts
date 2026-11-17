import { getDeviceRegistry, scanGamepads, type GamepadInfo } from "../device.js";
import { getRuntime } from "../runtime.js";

type GamepadListener = (pads: GamepadInfo[]) => void;

const listeners = new Set<GamepadListener>();
let signature = "";
let stopTick: (() => void) | null = null;

/**
 * Single owner of the `gamepad` device family. It polls the browser, keeps the
 * registry's connected set in sync, and notifies lane owners when pads arrive
 * or leave — so every preset sees the same identity for the same physical pad.
 */
function sync(): void {
  const pads = scanGamepads();
  const registry = getDeviceRegistry();

  const seen = new Set<number>();
  for (const pad of pads) {
    seen.add(pad.index);
    registry.upsert("gamepad", pad.index, pad.id);
  }
  for (const device of registry.list("gamepad")) {
    if (!seen.has(device.index)) registry.remove("gamepad", device.index);
  }

  const next = pads
    .map((p) => `${p.index}:${p.id}`)
    .sort()
    .join("|");
  if (next === signature) return;
  signature = next;
  for (const fn of listeners) fn(pads);
}

function ensureStarted(): void {
  if (!stopTick) {
    stopTick = getRuntime().addTick(sync);
  }
}

function maybeStopped(): void {
  if (listeners.size === 0 && stopTick) {
    stopTick();
    stopTick = null;
  }
}

/** Subscribe to gamepad connect/disconnect. Runs the listener once immediately. */
export function onGamepads(fn: GamepadListener): () => void {
  ensureStarted();
  listeners.add(fn);
  fn(scanGamepads());
  return () => {
    listeners.delete(fn);
    maybeStopped();
  };
}

/** Test seam: detach all listeners and stop the poll tick. */
export function resetGamepadHub(): void {
  listeners.clear();
  signature = "";
  maybeStopped();
}
