import { createHandle, type Handle } from "./handle.js";
import type { Vec } from "./types.js";
import { source, sink, type Stage } from "./component.js";
import { getKeyboardInput } from "./sources/keyboard.js";
import { getDpadInput } from "./sources/dpad.js";
import { getSlidersInput } from "./sources/gamepad.js";
import { initMidi } from "./sources/midi.js";

type InputHandle = Handle<string> | Handle<Vec> | Handle<number> | SliderHandles;

interface SliderHandles {
  x: Handle<number>;
  y: Handle<number>;
  rotation: Handle<number>;
}

const inputRegistry = new Map<string, InputHandle>();
const outputRegistry = new Map<string, Stage>();

function isSliderHandles(v: InputHandle): v is SliderHandles {
  return typeof v === "object" && v !== null && "x" in v && "y" in v && "rotation" in v;
}

export function resolveInput(name: string): InputHandle {
  const existing = inputRegistry.get(name);
  if (existing) return existing;

  let handle: InputHandle;

  switch (name) {
    case "keyboard":
      handle = getKeyboardInput();
      break;
    case "dpad":
      handle = getDpadInput();
      break;
    case "sliders":
      handle = getSlidersInput();
      initMidi();
      break;
    default:
      throw new Error(`Unknown input: "${name}". Built-in inputs: keyboard, dpad, sliders`);
  }

  inputRegistry.set(name, handle);
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

export function output(name: string): Stage {
  const existing = outputRegistry.get(name);
  if (existing) return existing;

  const stage = sink({
    to: name,
    accepts: ["value", "frame", "data"],
    render() {
      throw new Error(`Output "${name}" has no hardware sink registered (coming in slice 4+)`);
    },
  });

  outputRegistry.set(name, stage);
  return stage;
}

export { getSlidersInput };
