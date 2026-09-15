import { createHandle, type Handle } from "../handle.js";
import { append, baseStyle, bindPointer, make, palette, resolveOptions } from "./dom.js";
import { clamp01, valueForClient } from "./math.js";
import type { KitControl } from "./types.js";

export interface SliderOptions {
  parent?: HTMLElement;
  axis?: "x" | "y";
  size?: number;
  initial?: number;
}

export interface SliderControl extends KitControl<number> {
  readonly axis: "x" | "y";
}

const THUMB = 26;
const TRACK = 10;

export function slider(first?: SliderOptions | HTMLElement, rest?: SliderOptions): SliderControl {
  const opts = resolveOptions(first, rest);
  const { parent, axis = "x", size = 220, initial = 0.5 } = opts;
  const horizontal = axis === "x";
  const value = createHandle<number>(clamp01(initial));

  const major = size;
  const minor = THUMB + 14;

  const root = make("div", {
    ...baseStyle,
    ...(horizontal
      ? { width: `${major}px`, height: `${minor}px` }
      : { width: `${minor}px`, height: `${major}px` }),
    background: palette.bg,
    borderRadius: `${minor / 2}px`,
    border: `1px solid ${palette.border}`,
    padding: "0",
  });

  const track = make("div", {
    position: "absolute",
    background: palette.track,
    borderRadius: "99px",
    ...(horizontal
      ? { left: `${THUMB / 2}px`, right: `${THUMB / 2}px`, top: "50%", height: `${TRACK}px`, transform: "translateY(-50%)" }
      : { top: `${THUMB / 2}px`, bottom: `${THUMB / 2}px`, left: "50%", width: `${TRACK}px`, transform: "translateX(-50%)" }),
  });

  const fill = make("div", {
    position: "absolute",
    background: palette.accent,
    borderRadius: "99px",
    ...(horizontal
      ? { left: `${THUMB / 2}px`, top: "50%", height: `${TRACK}px`, transform: "translateY(-50%)" }
      : { top: `${THUMB / 2}px`, left: "50%", width: `${TRACK}px`, transform: "translateX(-50%)" }),
  });

  const thumb = make("div", {
    position: "absolute",
    width: `${THUMB}px`,
    height: `${THUMB}px`,
    borderRadius: "50%",
    background: palette.fg,
    boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
    border: `3px solid ${palette.accent}`,
  });

  append(root, track, fill, thumb);

  const apply = () => {
    const v = value.value;
    if (horizontal) {
      const left = THUMB / 2 + v * (major - THUMB);
      thumb.style.left = `${left}px`;
      thumb.style.top = "50%";
      thumb.style.transform = "translateY(-50%)";
      fill.style.width = `${Math.max(0, left - THUMB / 2 + TRACK / 2)}px`;
    } else {
      const top = THUMB / 2 + (1 - v) * (major - THUMB);
      thumb.style.top = `${top}px`;
      thumb.style.left = "50%";
      thumb.style.transform = "translateX(-50%)";
      fill.style.top = `${THUMB / 2}px`;
      fill.style.height = `${Math.max(0, top + TRACK / 2 - THUMB / 2)}px`;
    }
  };

  const drag = (clientX: number, clientY: number) => {
    const rect = root.getBoundingClientRect();
    const v = valueForClient(clientX, clientY, rect, horizontal, THUMB);
    if (v !== value.value) value._setValue(v);
  };

  const unbind = bindPointer(root, {
    down: (e) => drag(e.clientX, e.clientY),
    move: (e) => {
      if (e.buttons & 1) drag(e.clientX, e.clientY);
    },
  });

  root.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      value._setValue(clamp01(value.value + 0.05));
    } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      value._setValue(clamp01(value.value - 0.05));
    }
  });
  root.tabIndex = 0;

  const onChange = value.on("change", apply);
  apply();

  if (parent) append(parent, root);
  else append(document.body, root);

  return {
    el: root,
    axis,
    value,
    destroy() {
      unbind();
      onChange();
      root.remove();
    },
  };
}