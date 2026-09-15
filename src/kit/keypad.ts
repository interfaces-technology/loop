import { createHandle, type Handle } from "../handle.js";
import { append, baseStyle, make, palette, resolveOptions } from "./dom.js";
import type { KitControl } from "./types.js";

export interface KeypadOptions {
  parent?: HTMLElement;
  digits?: string[];
  initial?: string;
}

export interface KeypadControl extends KitControl<string> {
  clear(): void;
  backspace(): void;
}

const DEFAULT_DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "clear"];

export function keypad(first?: KeypadOptions | HTMLElement, rest?: KeypadOptions): KeypadControl {
  const opts = resolveOptions(first, rest);
  const { parent, digits = DEFAULT_DIGITS, initial = "" } = opts;
  const value = createHandle<string>(initial);

  const root = make("div", {
    ...baseStyle,
    flexDirection: "column",
    gap: "10px",
    background: palette.bg,
    padding: "14px",
    borderRadius: "18px",
    border: `1px solid ${palette.border}`,
    width: "220px",
  });

  const display = make("div", {
    background: "#0c0e13",
    border: `1px solid ${palette.border}`,
    borderRadius: "12px",
    padding: "10px 14px",
    minHeight: "42px",
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    fontFamily: "monospace",
    fontSize: "20px",
    letterSpacing: "0.08em",
    color: palette.fg,
    overflow: "hidden",
  });

  const grid = make("div", {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "8px",
  });

  const paint = () => {
    display.textContent = value.value || "·";
  };

  const keys: Array<{ key: string; action: "digit" | "clear" | "backspace" }> =
    digits.map((d) => ({
      key: d,
      action: d === "clear" ? "clear" : d === "⌫" ? "backspace" : "digit",
    }));

  const press = (k: (typeof keys)[number]) => {
    if (k.action === "clear") {
      value._setValue("");
    } else if (k.action === "backspace") {
      value._setValue(value.value.slice(0, -1));
    } else {
      value._setValue((value.value + k.key).slice(0, 12));
    }
  };

  for (const k of keys) {
    const btn = make("button", {
      ...baseStyle,
      width: "100%",
      height: "52px",
      borderRadius: "12px",
      background: palette.surface,
      border: `1px solid ${palette.border}`,
      color: k.action === "digit" ? palette.fg : palette.dim,
      fontSize: k.action === "backspace" ? "18px" : "20px",
      fontWeight: k.action === "digit" ? "600" : "400",
      transition: "background 100ms ease",
    });
    btn.type = "button";
    btn.textContent = k.key;
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      btn.style.background = palette.accent;
      btn.style.color = "#0f1020";
      press(k);
    });
    const reset = () => {
      btn.style.background = palette.surface;
      btn.style.color = k.action === "digit" ? palette.fg : palette.dim;
    };
    btn.addEventListener("pointerup", reset);
    btn.addEventListener("pointerleave", reset);
    btn.addEventListener("pointercancel", reset);
    grid.appendChild(btn);
  }

  append(root, display, grid);
  paint();

  const onChange = value.on("change", paint);

  if (parent) append(parent, root);
  else append(document.body, root);

  return {
    el: root,
    value,
    clear() {
      value._setValue("");
    },
    backspace() {
      value._setValue(value.value.slice(0, -1));
    },
    destroy() {
      onChange();
      root.remove();
    },
  };
}