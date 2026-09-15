import { createHandle, type Handle } from "../handle.js";
import { bindPointer } from "./dom.js";
import { angleAtPoint } from "./math.js";
import type { KitControl } from "./types.js";

export interface RotateOptions {
  initial?: number;
  min?: number;
  max?: number;
  steps?: number;
}

export interface RotateControl extends KitControl<number> {
  setDegrees(deg: number): void;
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function rotate(el: HTMLElement, opts: RotateOptions = {}): RotateControl {
  const { initial = 0, min = 0, max = 360, steps = 0 } = opts;
  const span = Math.max(0.0001, max - min);
  const value = createHandle<number>(clamp(initial, min, max));

  el.style.touchAction = "none";
  el.style.userSelect = "none";
  el.style.webkitUserSelect = "none";
  el.style.cursor = "grab";
  el.tabIndex = 0;
  el.setAttribute("role", "slider");
  el.setAttribute("aria-valuemin", String(min));
  el.setAttribute("aria-valuemax", String(max));

  const quantize = (v: number) => (steps > 0 ? Math.round(v / steps) * steps : v);

  const apply = () => {
    const deg = clamp(value.value, min, max);
    el.style.rotate = `${deg}deg`;
    el.setAttribute("aria-valuenow", String(Math.round(deg)));
  };

  const drag = (clientX: number, clientY: number) => {
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const angle = angleAtPoint(clientX, clientY, cx, cy);
    const mapped = min + (angle / 360) * span;
    const v = quantize(clamp(mapped, min, max));
    if (v !== value.value) value._setValue(v);
  };

  const unbind = bindPointer(el, {
    down: (e) => {
      el.style.cursor = "grabbing";
      drag(e.clientX, e.clientY);
    },
    move: (e) => {
      if (e.buttons & 1) drag(e.clientX, e.clientY);
    },
    up: () => {
      el.style.cursor = "grab";
    },
  });

  const onKey = (e: KeyboardEvent) => {
    const step = steps > 0 ? steps : 5;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      value._setValue(quantize(clamp(value.value + step, min, max)));
    } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      value._setValue(quantize(clamp(value.value - step, min, max)));
    }
  };
  el.addEventListener("keydown", onKey);

  const onChange = value.on("change", apply);
  apply();

  return {
    el,
    value,
    setDegrees(deg: number) {
      value._setValue(quantize(clamp(deg, min, max)));
    },
    destroy() {
      unbind();
      onChange();
      el.removeEventListener("keydown", onKey);
    },
  };
}

export function isRotateControl(c: unknown): c is RotateControl {
  return typeof c === "object" && c !== null && "setDegrees" in c;
}