import { describe, it, expect, afterEach, vi } from "vitest";
import { initMidi, resetMidi } from "../src/sources/midi.js";
import { resetSlidersInput } from "../src/sources/gamepad.js";
import { resetRuntime } from "../src/runtime.js";

function fakeAccess() {
  const input: { onmidimessage: ((e: { data: number[] }) => void) | null } = {
    onmidimessage: null,
  };
  const access = { inputs: new Map([[0, input]]) };
  return { input, access };
}

describe("midi lifecycle", () => {
  afterEach(() => {
    resetMidi();
    resetSlidersInput();
    resetRuntime();
    vi.unstubAllGlobals();
  });

  it("attaches handlers and resetMidi detaches them", async () => {
    const { input, access } = fakeAccess();
    vi.stubGlobal("navigator", { requestMIDIAccess: async () => access });

    await initMidi();
    expect(typeof input.onmidimessage).toBe("function");

    resetMidi();
    expect(input.onmidimessage).toBeNull();

    // A fresh init attaches a new handler rather than stacking on the old.
    await initMidi();
    expect(typeof input.onmidimessage).toBe("function");
  });

  it("drops an init that resolves after resetMidi", async () => {
    const { input, access } = fakeAccess();
    let resolveAccess!: (a: unknown) => void;
    vi.stubGlobal("navigator", {
      requestMIDIAccess: () =>
        new Promise((r) => {
          resolveAccess = r;
        }),
    });

    const pending = initMidi();
    resetMidi();
    resolveAccess(access);
    await pending;

    expect(input.onmidimessage).toBeNull();
  });
});
