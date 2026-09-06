import { createHandle, type Handle } from "../handle.js";
import type { Packet } from "../types.js";
import { getRuntime } from "../runtime.js";

let keyboardHandle: Handle<string> | null = null;
let attached = false;

function attachKeyboardListeners(): void {
  if (attached || typeof document === "undefined") return;
  attached = true;

  document.addEventListener("input", (e) => {
    const target = e.target;
    if (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement) {
      keyboardHandle?._setValue(target.value);
    }
  });
}

export function getKeyboardInput(): Handle<string> {
  if (!keyboardHandle) {
    keyboardHandle = createHandle("");
    attachKeyboardListeners();
    getRuntime().registerHandle(keyboardHandle as Handle<unknown>);
  }
  return keyboardHandle;
}

export function keyboardSourceRead(): Packet | null {
  const handle = getKeyboardInput();
  return { kind: "data", type: "text", value: handle.value };
}
