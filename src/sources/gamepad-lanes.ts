import {
  getDeviceRegistry,
  type DeviceEntry,
  type GamepadInfo,
} from "../device.js";
import { onGamepads } from "./gamepads.js";

export interface PadLaneManager<V> {
  /** Current lanes in pad-index order. */
  values(): IterableIterator<DeviceEntry<V>>;
  /** Subscribe to the gamepad hub (idempotent). */
  bind(): void;
  /** Dispose every lane and unbind from the hub. */
  reset(): void;
}

/**
 * Shared lifecycle for per-gamepad input lanes: one value per connected
 * pad, created on arrival and disposed on removal. The source supplies
 * how a lane value is built and torn down; the hub owns device identity.
 */
export function createPadLaneManager<V>(opts: {
  create: (index: number) => V;
  dispose: (value: V) => void;
}): PadLaneManager<V> {
  const lanes = new Map<number, DeviceEntry<V>>();
  let bound = false;

  function reconcile(pads: GamepadInfo[]): void {
    const seen = new Set(pads.map((pad) => pad.index));

    for (const pad of pads) {
      if (!lanes.has(pad.index)) {
        const device = getDeviceRegistry().upsert("gamepad", pad.index, pad.id);
        lanes.set(pad.index, { device, value: opts.create(pad.index) });
      }
    }

    for (const [index, lane] of lanes) {
      if (!seen.has(index)) {
        opts.dispose(lane.value);
        lanes.delete(index);
      }
    }
  }

  return {
    values: () => lanes.values(),
    bind() {
      if (bound) return;
      bound = true;
      onGamepads(reconcile);
    },
    reset() {
      for (const lane of lanes.values()) opts.dispose(lane.value);
      lanes.clear();
      bound = false;
    },
  };
}
