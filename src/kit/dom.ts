export const palette = {
  bg: "#15171c",
  surface: "#1e2129",
  track: "#2a2e38",
  border: "#3a3f4d",
  fg: "#eef0f6",
  dim: "#9aa0ae",
  accent: "#8b7cff",
};

type Style = Partial<CSSStyleDeclaration>;

export function make<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  style?: Style,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (style) Object.assign(node.style, style);
  if (text !== undefined) node.textContent = text;
  return node;
}

export function append(parent: HTMLElement, ...children: HTMLElement[]): HTMLElement {
  for (const child of children) parent.appendChild(child);
  return parent;
}

export function bindPointer(
  el: HTMLElement,
  handlers: {
    down?: (e: PointerEvent) => void;
    move?: (e: PointerEvent) => void;
    up?: (e: PointerEvent) => void;
  },
): () => void {
  const onDown = (e: PointerEvent) => {
    el.setPointerCapture?.(e.pointerId);
    handlers.down?.(e);
  };
  const onMove = (e: PointerEvent) => handlers.move?.(e);
  const onUp = (e: PointerEvent) => {
    el.releasePointerCapture?.(e.pointerId);
    handlers.up?.(e);
  };

  el.addEventListener("pointerdown", onDown);
  el.addEventListener("pointermove", onMove);
  el.addEventListener("pointerup", onUp);
  el.addEventListener("pointercancel", onUp);

  return () => {
    el.removeEventListener("pointerdown", onDown);
    el.removeEventListener("pointermove", onMove);
    el.removeEventListener("pointerup", onUp);
    el.removeEventListener("pointercancel", onUp);
  };
}

export const baseStyle: Style = {
  position: "relative",
  display: "inline-flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  boxSizing: "border-box",
  userSelect: "none",
  webkitUserSelect: "none",
  touchAction: "none",
  outline: "none",
  fontFamily:
    "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  cursor: "pointer",
};

export function resolveOptions<T extends object>(
  first: HTMLElement | T | undefined,
  rest: T | undefined,
): T {
  const isElement = typeof HTMLElement !== "undefined" && first instanceof HTMLElement;
  if (isElement) {
    return { ...(rest ?? {}), parent: first } as T;
  }
  return (first ?? {}) as T;
}