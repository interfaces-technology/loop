import type { Handle } from "./handle.js";
import type { Vec } from "./types.js";
import { sink, type Stage } from "./component.js";
import { getKeyboardInput } from "./sources/keyboard.js";
import { getDpadInput, getDpadDeviceSet } from "./sources/dpad.js";
import { getSlidersInput, getSlidersDeviceSet, type SliderBundle } from "./sources/gamepad.js";
import { getSmileInput } from "./sources/smile.js";
import { layout } from "./layout.js";
import {
  createDeviceSet,
  getDeviceRegistry,
  markSingletonKind,
  type DeviceEntry,
  type DeviceSet,
} from "./device.js";

export interface SliderHandles {
  x: Handle<number>;
  y: Handle<number>;
  rotation: Handle<number>;
}

export type InputHandle = Handle<string> | Handle<Vec> | Handle<number> | SliderHandles;
export type InputFactory = () => InputHandle;
export type OutputFactory = () => Stage;

const inputInstances = new Map<string, InputHandle>();
const outputInstances = new Map<string, Stage>();
const inputFactories = new Map<string, InputFactory>();
const outputFactories = new Map<string, OutputFactory>();
const customDeviceSets = new Map<string, DeviceSet<unknown>>();

inputFactories.set("keyboard", getKeyboardInput);
inputFactories.set("dpad", getDpadInput);
inputFactories.set("sliders", getSlidersInput);
inputFactories.set("smile", getSmileInput);

outputFactories.set("receipt", () => layout("receipt"));

/** Register a reusable input by name. Replaces any previous factory of that name. */
export function registerInput(name: string, factory: InputFactory): void {
  inputFactories.set(name, factory);
  inputInstances.delete(name);
  customDeviceSets.delete(name);
  markSingletonKind(name);
}

/** Register a reusable output (hardware sink) by name. */
export function registerOutput(name: string, factory: OutputFactory): void {
  outputFactories.set(name, factory);
  outputInstances.delete(name);
}

function isSliderHandles(v: InputHandle): v is SliderHandles {
  return typeof v === "object" && v !== null && "x" in v && "y" in v && "rotation" in v;
}

export function resolveInput(name: string): InputHandle {
  const existing = inputInstances.get(name);
  if (existing) return existing;

  const factory = inputFactories.get(name);
  if (!factory) {
    throw new Error(
      `Unknown input: "${name}". Registered inputs: ${[...inputFactories.keys()].join(", ")}`,
    );
  }

  const handle = factory();
  inputInstances.set(name, handle);
  return handle;
}

export function input(name: string): Handle<string> | Handle<Vec> | Handle<number> {
  const resolved = resolveInput(name);
  if (isSliderHandles(resolved)) {
    throw new Error(
      `Input "${name}" returns multiple handles. Use loop.input("sliders").x / .y / .rotation`,
    );
  }
  return resolved;
}

function singleDeviceSet<T>(
  name: string,
  kind: string,
  label: string,
  get: () => T,
): DeviceSet<T> {
  return createDeviceSet(name, () => {
    const device = getDeviceRegistry().upsert(kind, 0, label);
    const map = new Map<string, DeviceEntry<T>>();
    map.set(device.id, { device, value: get() });
    return map;
  });
}

let keyboardDeviceSet: DeviceSet<Handle<string>> | null = null;
let smileDeviceSet: DeviceSet<Handle<number>> | null = null;

/**
 * Like `input(name)`, but returns values separated by device identity. Each
 * connected device gets its own handle, addressed by `get("gamepad:0")` or
 * `at(1)`. Use it whenever two controllers (or a controller plus the keyboard)
 * feed the same control and you must keep them apart.
 */
export function inputs(name: "dpad"): DeviceSet<Handle<Vec>>;
export function inputs(name: "sliders"): DeviceSet<SliderBundle>;
export function inputs(name: "keyboard"): DeviceSet<Handle<string>>;
export function inputs(name: "smile"): DeviceSet<Handle<number>>;
export function inputs(name: string): DeviceSet<unknown>;
export function inputs(name: string): DeviceSet<unknown> {
  switch (name) {
    case "dpad":
      return getDpadDeviceSet();
    case "sliders":
      return getSlidersDeviceSet();
    case "keyboard":
      keyboardDeviceSet ??= singleDeviceSet(
        "keyboard",
        "keyboard",
        "Keyboard",
        getKeyboardInput,
      );
      return keyboardDeviceSet;
    case "smile":
      smileDeviceSet ??= singleDeviceSet("smile", "smile", "Smile", getSmileInput);
      return smileDeviceSet;
    default: {
      // Custom registered inputs get a single-device view under their own
      // name; resolveInput throws the unknown-input error for bad names.
      let set = customDeviceSets.get(name);
      if (!set) {
        const resolved = resolveInput(name);
        set = singleDeviceSet(name, name, name, () => resolved);
        customDeviceSets.set(name, set);
      }
      return set;
    }
  }
}

export function output(name: string): Stage {
  const existing = outputInstances.get(name);
  if (existing) return existing;

  const factory = outputFactories.get(name);
  const stage = factory
    ? factory()
    : sink({
        to: name,
        accepts: ["value", "frame", "data"],
        render() {
          throw new Error(
            `Output "${name}" has no sink registered. Use loop.registerOutput("${name}", factory).`,
          );
        },
      });

  outputInstances.set(name, stage);
  return stage;
}

export function clearInputRegistries(): void {
  inputInstances.clear();
  outputInstances.clear();
}

export { getSlidersInput };
