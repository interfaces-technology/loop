import type { Vec } from "./types.js";
import { valuesEqual } from "./types.js";
import { getRuntime, type TickInfo } from "./runtime.js";

type ChangeFn<T> = (v: T) => void;
type BindFn<T> = (v: T, el: unknown) => void;

export interface Handle<T = number | Vec> {
  readonly value: T;
  on(event: "change", fn: ChangeFn<T>): () => void;
  bind(el: unknown, apply: BindFn<T>): () => void;
  /** Release every listener, binding, and sampler, and detach from the loop. */
  dispose(): void;
  _tick(info?: TickInfo): void;
  _setValue(v: T): void;
  _setSampler(sampler: (() => T) | null): void;
}

export function createHandle<T>(initial: T): Handle<T> {
  let current = initial;
  const changeListeners = new Set<ChangeFn<T>>();
  const bindings = new Set<{ el: unknown; apply: BindFn<T> }>();
  let sampler: (() => T) | null = null;
  let registered = false;

  const ensureRegistered = (): void => {
    if (!registered && (sampler !== null || bindings.size > 0)) {
      registered = true;
      getRuntime().registerHandle(handle as Handle<unknown>);
    }
  };

  const maybeUnregister = (): void => {
    if (registered && sampler === null && bindings.size === 0) {
      registered = false;
      getRuntime().unregisterHandle(handle as Handle<unknown>);
    }
  };

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
      ensureRegistered();
      return () => {
        bindings.delete(binding);
        maybeUnregister();
      };
    },

    dispose(): void {
      changeListeners.clear();
      bindings.clear();
      sampler = null;
      maybeUnregister();
    },

    _tick(): void {
      if (sampler) {
        handle._setValue(sampler());
      }
    },

    _setValue(v: T) {
      const changed =
        typeof current === "number" && typeof v === "number"
          ? current !== v
          : typeof current === "object" && typeof v === "object"
            ? !valuesEqual(current as number | Vec, v as number | Vec)
            : current !== v;

      if (!changed) return;

      current = v;
      for (const fn of changeListeners) {
        fn(v);
      }
      for (const { el, apply } of bindings) {
        apply(v, el);
      }
    },

    _setSampler(s: (() => T) | null) {
      sampler = s;
      if (s) {
        ensureRegistered();
      } else {
        maybeUnregister();
      }
    },
  };

  return handle;
}
