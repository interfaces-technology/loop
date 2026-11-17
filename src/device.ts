import type { Vec } from "./types.js";

/**
 * A physical or logical input device. Identity is stable for the life of a
 * connection so values from two controllers stay separated instead of being
 * blended together.
 */
export interface Device {
  /** Stable, unique id, e.g. `"gamepad:0"`, `"keyboard"`, `"serial:1"`. */
  readonly id: string;
  /** Device family, e.g. `"gamepad"`, `"keyboard"`, `"midi"`. */
  readonly kind: string;
  /** Ordinal within the family (gamepad index, port number, 0 for singletons). */
  readonly index: number;
  /** Human-readable label, e.g. the browser's gamepad `id` string. */
  readonly label: string;
}

/** Compose the canonical device id from its family and ordinal. */
export function deviceId(kind: string, index: number): string {
  return index === 0 && SINGLETON_KINDS.has(kind) ? kind : `${kind}:${index}`;
}

const SINGLETON_KINDS = new Set(["keyboard", "smile", "midi", "on-screen"]);

/** Treat a device kind as a singleton (id without `:index`), e.g. named inputs. */
export function markSingletonKind(kind: string): void {
  SINGLETON_KINDS.add(kind);
}

export interface DeviceEntry<T> {
  device: Device;
  value: T;
}

/**
 * A live collection of one source's value handles, separated by device. Reads
 * are additive: `values()` returns every connected device's handle, and `get`
 * or `at` address a single one by identity.
 */
export interface DeviceSet<T> {
  /** The source this set belongs to, e.g. `"sliders"`. */
  readonly name: string;
  /** Every device currently feeding this source, ordered by kind then index. */
  devices(): Device[];
  /** Resolve a handle by full device id, e.g. `"gamepad:0"`. */
  get(id: string): T | undefined;
  /** Resolve a handle by ordinal within its family, e.g. `at(1)` → `gamepad:1`. */
  at(index: number): T | undefined;
  /** Every connected device's handle, ordered by kind then index. */
  values(): T[];
  /** `{ device, value }` pairs, ordered by kind then index. */
  entries(): Array<{ device: Device; value: T }>;
  /** Visit each connected device's handle. */
  each(fn: (value: T, device: Device) => void): void;
  /** Subscribe to device connect/disconnect. Fires with this set's devices. */
  on(event: "change", fn: (devices: Device[]) => void): () => void;
}

class DeviceRegistry {
  private readonly map = new Map<string, Device>();
  private readonly listeners = new Set<(devices: Device[]) => void>();

  upsert(kind: string, index: number, label: string): Device {
    const id = deviceId(kind, index);
    const existing = this.map.get(id);
    if (existing) {
      if (existing.label === label) return existing;
      const updated: Device = { ...existing, label };
      this.map.set(id, updated);
      this.emit();
      return updated;
    }
    const device: Device = { id, kind, index, label };
    this.map.set(id, device);
    this.emit();
    return device;
  }

  remove(kind: string, index: number): void {
    if (this.map.delete(deviceId(kind, index))) {
      this.emit();
    }
  }

  list(kind?: string): Device[] {
    const devices = [...this.map.values()];
    const filtered = kind === undefined ? devices : devices.filter((d) => d.kind === kind);
    return filtered.sort((a, b) =>
      a.kind === b.kind ? a.index - b.index : a.kind < b.kind ? -1 : 1,
    );
  }

  on(fn: (devices: Device[]) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    const snapshot = this.list();
    for (const fn of this.listeners) fn(snapshot);
  }
}

let registry: DeviceRegistry | null = null;

export function getDeviceRegistry(): DeviceRegistry {
  if (!registry) {
    registry = new DeviceRegistry();
  }
  return registry;
}

/** Test seam: drop all tracked devices and listeners. */
export function resetDeviceRegistry(): void {
  registry = null;
}

/**
 * Build a `DeviceSet` over a resolver that returns the current id → entry map.
 * The resolver runs on every access so the set always reflects live lanes.
 */
export function createDeviceSet<T>(
  name: string,
  resolve: () => Map<string, DeviceEntry<T>>,
): DeviceSet<T> {
  const ordered = (): DeviceEntry<T>[] => {
    const entries = [...resolve().values()];
    return entries.sort((a, b) =>
      a.device.kind === b.device.kind
        ? a.device.index - b.device.index
        : a.device.kind < b.device.kind
          ? -1
          : 1,
    );
  };

  const devices = (): Device[] => ordered().map((e) => e.device);

  return {
    name,
    devices,

    get(id: string): T | undefined {
      return resolve().get(id)?.value;
    },

    at(index: number): T | undefined {
      return ordered().find((e) => e.device.index === index)?.value;
    },

    values: () => ordered().map((e) => e.value),

    entries: () => ordered().map((e) => ({ device: e.device, value: e.value })),

    each(fn: (value: T, device: Device) => void): void {
      for (const { device, value } of ordered()) fn(value, device);
    },

    on(event: "change", fn: (devices: Device[]) => void): () => void {
      if (event !== "change") {
        throw new Error(`Unknown event: ${event}`);
      }
      return getDeviceRegistry().on(() => fn(devices()));
    },
  };
}

/** A connected gamepad as reported by `navigator.getGamepads()`. */
export interface GamepadInfo {
  index: number;
  id: string;
}

// `navigator.getGamepads()` is called once per runtime tick and shared by
// every lane sampler — the runtime's frame callback is one synchronous
// block, so a microtask boundary is exactly a tick boundary.
let padSnapshot: (Gamepad | null)[] | null = null;

/** Raw gamepad list, cached for the duration of the current tick. */
export function gamepadSnapshot(): (Gamepad | null)[] {
  if (!padSnapshot) {
    padSnapshot =
      typeof navigator !== "undefined" && navigator.getGamepads
        ? [...navigator.getGamepads()]
        : [];
    queueMicrotask(() => {
      padSnapshot = null;
    });
  }
  return padSnapshot;
}

/** Test seam: drop the cached snapshot. */
export function clearGamepadSnapshot(): void {
  padSnapshot = null;
}

/** Snapshot the browser's connected gamepads, skipping empty slots. */
export function scanGamepads(): GamepadInfo[] {
  const out: GamepadInfo[] = [];
  for (const gp of gamepadSnapshot()) {
    if (gp) out.push({ index: gp.index, id: gp.id });
  }
  return out;
}

export type { Vec };
