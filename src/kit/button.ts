import { createHandle, type Handle } from "../handle.js";
import { append, baseStyle, bindPointer, make, palette, resolveOptions } from "./dom.js";
import type { KitControl } from "./types.js";

export interface ButtonOptions {
  parent?: HTMLElement;
  label?: string;
  toggle?: boolean;
  initial?: number;
}

export interface ButtonControl extends KitControl<number> {
  label: string;
  setLabel(text: string): void;
}

export function button(first?: ButtonOptions | HTMLElement, rest?: ButtonOptions): ButtonControl {
  const opts = resolveOptions(first, rest);
  const { parent, label = "button", toggle = false, initial = toggle ? 1 : 0 } = opts;
  const value = createHandle<number>(initial);

  const root = make("button", {
    ...baseStyle,
    width: "72px",
    height: "72px",
    borderRadius: "16px",
    background: palette.surface,
    border: `1px solid ${palette.border}`,
    color: palette.fg,
    fontSize: "13px",
    fontWeight: "600",
    letterSpacing: "0.02em",
    transition: "background 120ms ease, transform 80ms ease, box-shadow 120ms ease",
    boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
  });
  root.type = "button";
  root.tabIndex = 0;
  root.setAttribute("aria-pressed", String(value.value === 1));
  root.textContent = label;

  const syncPressed = (pressed: boolean) => {
    const next = pressed ? 1 : 0;
    if (next !== value.value) value._setValue(next);
    root.setAttribute("aria-pressed", String(next === 1));
    root.style.background = next === 1 ? palette.accent : palette.surface;
    root.style.color = next === 1 ? "#0f1020" : palette.fg;
    root.style.transform = next === 1 ? "scale(0.94)" : "scale(1)";
  };

  const press = () => {
    if (toggle) {
      syncPressed(value.value === 0);
    } else {
      syncPressed(true);
    }
  };
  const release = () => {
    if (!toggle) syncPressed(false);
  };

  const unbind = bindPointer(root, { down: press, up: release });
  root.addEventListener("pointerleave", release);
  root.addEventListener("keydown", (e) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      press();
    }
  });
  root.addEventListener("keyup", (e) => {
    if (e.key === " " || e.key === "Enter") release();
  });

  if (parent) append(parent, root);
  else append(document.body, root);

  return {
    el: root,
    value,
    label,
    setLabel(text: string) {
      root.textContent = text;
    },
    destroy() {
      unbind();
      root.remove();
    },
  };
}