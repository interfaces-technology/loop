export { button, type ButtonControl, type ButtonOptions } from "./button.js";
export { slider, type SliderControl, type SliderOptions } from "./slider.js";
export { dial, type DialControl, type DialOptions } from "./dial.js";
export { dpad, type DpadControl, type DpadOptions } from "./dpad.js";
export { keypad, type KeypadControl, type KeypadOptions } from "./keypad.js";
export { rotate, type RotateControl, type RotateOptions } from "./rotate.js";
export type { KitControl } from "./types.js";

export {
  clamp01,
  angleForValue,
  valueForAngle,
  angleAtPoint,
  positionToValue,
  valueForClient,
} from "./math.js";