import { createHandle, type Handle } from "../handle.js";
import { append, baseStyle, bindPointer, make, palette, resolveOptions } from "./dom.js";
import { angleAtPoint, angleForValue, clamp01, valueForAngle } from "./math.js";
import type { KitControl } from "./types.js";

export interface DialOptions {
  parent?: HTMLElement;
  size?: number;
  initial?: number;
  label?: string;
}

export interface DialControl extends KitControl<number> {
  label: string;
}

export function dial(first?: DialOptions | HTMLElement, rest?: DialOptions): DialControl {
  const opts = resolveOptions(first, rest);
  const { parent, size = 96, initial = 0.5, label = "dial" } = opts;
  const value = createHandle<number>(clamp01(initial));
  const ringRadius = size / 2;
  const needle = ringRadius * 0.62;

  const root = make("div", {
    ...baseStyle,
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: "50%",
    background: palette.surface,
    border: `1px solid ${palette.border}`,
    boxShadow: "0 4px 14px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)",
  });
  root.tabIndex = 0;
  root.setAttribute("role", "slider");
  root.setAttribute("aria-valuemin", "0");
  root.setAttribute("aria-valuemax", "100");
  root.setAttribute("aria-label", label);

  const arc = make("div", {
    position: "absolute",
    inset: "9px",
    borderRadius: "50%",
    background: palette.track,
    webkitMask: "radial-gradient(closest-side, transparent 62%, #000 64%)",
    mask: "radial-gradient(closest-side, transparent 62%, #000 64%)",
  });

  const needleEl = make("div", {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: "2px",
    height: `${needle}px`,
    borderRadius: "2px",
    background: palette.accent,
    transformOrigin: "50% 100%",
  });

  const cap = make("div", {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: "18px",
    height: "18px",
    borderRadius: "50%",
    background: palette.bg,
    border: `2px solid ${palette.accent}`,
    transform: "translate(-50%, -50%)",
    boxShadow: "inset 0 0 6px rgba(0,0,0,0.5)",
  });

  append(root, arc, needleEl, cap);

  const apply = () => {
    const v = value.value;
    const angle = angleForValue(v);
    needleEl.style.transform = `translate(-50%, -100%) rotate(${angle}deg)`;
    arc.style.background =
      `conic-gradient(from ${angleForValue(0)}deg, ${palette.accent} 0deg, ` +
      `${palette.accent} ${(270 * v).toFixed(1)}deg, ${palette.track} ${(270 * v).toFixed(1)}deg 360deg)`;
    root.setAttribute("aria-valuenow", String(Math.round(v * 100)));
  };

  const onChange = value.on("change", apply);

  const drag = (clientX: number, clientY: number) => {
    const rect = root.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const angle = angleAtPoint(clientX, clientY, cx, cy);
    const v = valueForAngle(angle);
    if (v !== value.value) value._setValue(v);
  };

  const unbind = bindPointer(root, {
    down: (e) => drag(e.clientX, e.clientY),
    move: (e) => {
      if (e.buttons & 1) drag(e.clientX, e.clientY);
    },
  });

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.02 : 0.02;
    value._setValue(clamp01(value.value + delta));
  };
  root.addEventListener("wheel", onWheel, { passive: false });

  root.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      value._setValue(clamp01(value.value + 0.02));
    } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      value._setValue(clamp01(value.value - 0.02));
    }
  });

  apply();

  if (parent) append(parent, root);
  else append(document.body, root);

  return {
    el: root,
    label,
    value,
    destroy() {
      unbind();
      onChange();
      root.removeEventListener("wheel", onWheel);
      root.remove();
    },
  };
}