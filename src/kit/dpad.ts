import { createHandle, type Handle } from "../handle.js";
import type { Vec } from "../types.js";
import { append, baseStyle, make, palette, resolveOptions } from "./dom.js";
import type { KitControl } from "./types.js";

export interface DpadOptions {
  parent?: HTMLElement;
  cell?: number;
  keyboard?: boolean;
}

export interface DpadControl extends KitControl<Vec> {
  setActive(dir: "up" | "down" | "left" | "right", active: boolean): void;
}

type Dir = "up" | "down" | "left" | "right";

const DIR_VEC: Record<Dir, Vec> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const KEY_DIR: Record<string, Dir> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  W: "up",
  s: "down",
  S: "down",
  a: "left",
  A: "left",
  d: "right",
  D: "right",
};

export function dpad(first?: DpadOptions | HTMLElement, rest?: DpadOptions): DpadControl {
  const opts = resolveOptions(first, rest);
  const { parent, cell = 64, keyboard = true } = opts;
  const gap = Math.round(cell * 0.12);
  const value = createHandle<Vec>({ x: 0, y: 0 });
  const pressed = new Set<Dir>();
  const buttons = new Map<Dir, HTMLButtonElement>();
  const releaseKey: Array<() => void> = [];

  const root = make("div", {
    ...baseStyle,
    display: "grid",
    gridTemplateColumns: `repeat(3, ${cell}px)`,
    gridTemplateRows: `repeat(3, ${cell}px)`,
    gap: `${gap}px`,
    background: palette.bg,
    padding: `${gap}px`,
    borderRadius: `${cell * 0.35}px`,
    border: `1px solid ${palette.border}`,
  });

  const dirCells: Record<Dir, [number, number]> = {
    up: [0, 1],
    left: [1, 0],
    right: [1, 2],
    down: [2, 1],
  };

  const center = make("div", {
    width: `${Math.round(cell * 0.28)}px`,
    height: `${Math.round(cell * 0.28)}px`,
    borderRadius: "50%",
    background: palette.track,
    alignSelf: "center",
    justifySelf: "center",
  });

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const dir = (Object.keys(dirCells) as Dir[]).find(
        (d) => dirCells[d]![0] === row && dirCells[d]![1] === col,
      );
      if (dir) {
        const btn = make("button", {
          ...baseStyle,
          width: `${cell}px`,
          height: `${cell}px`,
          borderRadius: `${cell * 0.28}px`,
          background: palette.surface,
          border: `1px solid ${palette.border}`,
          color: palette.dim,
          fontSize: `${Math.round(cell * 0.3)}px`,
          lineHeight: "1",
          transition: "background 100ms ease, color 100ms ease",
        });
        btn.type = "button";
        btn.dataset.dir = dir;
        btn.textContent = DIR_LABEL[dir];
        buttons.set(dir, btn);
        root.appendChild(btn);
      } else if (row === 1 && col === 1) {
        root.appendChild(center);
      } else {
        root.appendChild(make("div"));
      }
    }
  }

  const compute = () => {
    let x = 0;
    let y = 0;
    for (const dir of pressed) {
      x += DIR_VEC[dir].x;
      y += DIR_VEC[dir].y;
    }
    const next = { x, y };
    const current = value.value;
    if (current.x !== x || current.y !== y) value._setValue(next);
  };

  const paint = () => {
    for (const [dir, btn] of buttons) {
      const active = pressed.has(dir);
      btn.style.background = active ? palette.accent : palette.surface;
      btn.style.color = active ? "#0f1020" : palette.dim;
    }
  };

  const setDir = (dir: Dir, active: boolean) => {
    if (active) pressed.add(dir);
    else pressed.delete(dir);
    paint();
    compute();
  };

  for (const [dir, btn] of buttons) {
    const down = () => setDir(dir, true);
    const up = () => setDir(dir, false);
    btn.addEventListener("pointerdown", down);
    btn.addEventListener("pointerup", up);
    btn.addEventListener("pointerleave", up);
    btn.addEventListener("pointercancel", up);
    releaseKey.push(() => {
      btn.removeEventListener("pointerdown", down);
      btn.removeEventListener("pointerup", up);
      btn.removeEventListener("pointerleave", up);
      btn.removeEventListener("pointercancel", up);
    });
  }

  if (keyboard) {
    const onDown = (e: KeyboardEvent) => {
      const dir = KEY_DIR[e.key];
      if (dir) {
        e.preventDefault();
        setDir(dir, true);
      }
    };
    const onUp = (e: KeyboardEvent) => {
      const dir = KEY_DIR[e.key];
      if (dir) setDir(dir, false);
    };
    document.addEventListener("keydown", onDown);
    document.addEventListener("keyup", onUp);
    releaseKey.push(() => {
      document.removeEventListener("keydown", onDown);
      document.removeEventListener("keyup", onUp);
    });
  }

  if (parent) append(parent, root);
  else append(document.body, root);

  return {
    el: root,
    value,
    setActive(dir, active) {
      setDir(dir, active);
    },
    destroy() {
      for (const fn of releaseKey) fn();
      root.remove();
    },
  };
}

const DIR_LABEL: Record<Dir, string> = {
  up: "▲",
  down: "▼",
  left: "◀",
  right: "▶",
};