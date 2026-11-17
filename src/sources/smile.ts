import { createHandle, type Handle } from "../handle.js";
import { getRuntime } from "../runtime.js";
import { normalizeScalar } from "../types.js";

let smileHandle: Handle<number> | null = null;
let customSampler: (() => number) | null = null;

export function getSmileInput(): Handle<number> {
  if (!smileHandle) {
    smileHandle = createHandle(0);
    smileHandle._setSampler(() => {
      const raw = customSampler ? customSampler() : smileHandle!.value;
      return normalizeScalar(raw);
    });
    getRuntime().registerHandle(smileHandle as Handle<unknown>);
  }
  return smileHandle;
}

export function setSmileSampler(fn: (() => number) | null): void {
  customSampler = fn;
}

export function resetSmileInput(): void {
  customSampler = null;
  smileHandle = null;
}
