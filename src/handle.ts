import type { Vec } from "./types.js";
import { valuesEqual } from "./types.js";
import { getRuntime } from "./runtime.js";

type ChangeFn<T> = (v: T) => void;
type BindFn<T> = (v: T, el: unknown) => void;

export interface Handle<T = number | Vec> {
  readonly value: T;
  on(event: "change", fn: ChangeFn<T>): () => void;
  bind(el: unknown, apply: BindFn<T>): () => void;
  _tick(): void;
  _setValue(v: T): void;
  _getSampler(): (() => T) | null;
  _setSampler(sampler: () => T): void;
}

export function createHandle<T>(initial: T): Handle<T> {
  let current = initial;
  const changeListeners = new Set<ChangeFn<T>>();
  const bindings = new Set<{ el: unknown; apply: BindFn<T> }>();
  let sampler: (() => T) | null = null;

  const handle: Handle<T> = {
    get value() {
      return current;
    },

    on(event: "change", fn: ChangeFn<T>): () => void {
      if (event !== "change") {
        throw new Error(`Unknown event: ${event}`);
      }
      changeListeners.add(fn);
      return () => changeListeners.delete(fn);
    },

    bind(el: unknown, apply: BindFn<T>): () => void {
      const binding = { el, apply };
      bindings.add(binding);
      apply(current, el);
      getRuntime().registerHandle(handle as Handle<unknown>);
      return () => bindings.delete(binding);
    },

    _tick() {
      if (sampler) {
        const next = sampler();
        handle._setValue(next);
      }
      for (const { el, apply } of bindings) {
        apply(current, el);
      }
    },

    _setValue(v: T) {
      const changed =
        typeof current === "number" && typeof v === "number"
          ? current !== v
          : typeof current === "object" && typeof v === "object"
            ? !valuesEqual(current as number | Vec, v as number | Vec)
            : current !== v;

      if (changed) {
        current = v;
        for (const fn of changeListeners) {
          fn(v);
        }
        for (const { el, apply } of bindings) {
          apply(v, el);
        }
      }
    },

    _getSampler() {
      return sampler;
    },

    _setSampler(s: () => T) {
      sampler = s;
      getRuntime().registerHandle(handle as Handle<unknown>);
    },
  };

  return handle;
}
