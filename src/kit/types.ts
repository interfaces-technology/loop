import type { Handle } from "../handle.js";

export interface KitControl<T> {
  el: HTMLElement;
  value: Handle<T>;
  destroy(): void;
}