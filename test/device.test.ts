import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  createDeviceSet,
  getDeviceRegistry,
  resetDeviceRegistry,
  type DeviceEntry,
} from "../src/device.js";
import {
  getSlidersDeviceSet,
  getSlidersInput,
  getSlidersActiveDevice,
  resetSlidersInput,
} from "../src/sources/gamepad.js";
import { getDpadDeviceSet, resetDpadInput } from "../src/sources/dpad.js";
import { resetGamepadHub } from "../src/sources/gamepads.js";
import { resetRuntime } from "../src/runtime.js";

interface PadOptions {
  lx?: number;
  ly?: number;
  rt?: number;
  right?: boolean;
  up?: boolean;
}

function makePad(index: number, id: string, opts: PadOptions = {}) {
  const buttons = Array.from({ length: 17 }, () => ({ pressed: false, value: 0 }));
  buttons[7] = { pressed: (opts.rt ?? 0) > 0, value: opts.rt ?? 0 };
  if (opts.right) buttons[15] = { pressed: true, value: 1 };
  if (opts.up) buttons[12] = { pressed: true, value: 1 };
  return { index, id, axes: [opts.lx ?? 0, opts.ly ?? 0, 0, 0], buttons };
}

function installGamepads(pads: unknown[]): void {
  Object.defineProperty(globalThis, "navigator", {
    value: { getGamepads: () => pads },
    configurable: true,
    writable: true,
  });
}

function tickTriple(bundle: { x: { _tick(): void }; y: { _tick(): void }; rotation: { _tick(): void } }) {
  bundle.x._tick();
  bundle.y._tick();
  bundle.rotation._tick();
}

describe("device registry", () => {
  beforeEach(() => resetDeviceRegistry());
  afterEach(() => resetDeviceRegistry());

  it("upserts and lists devices ordered by family then index", () => {
    const reg = getDeviceRegistry();
    reg.upsert("gamepad", 1, "Pad B");
    reg.upsert("gamepad", 0, "Pad A");
    expect(reg.list("gamepad").map((d) => d.id)).toEqual(["gamepad:0", "gamepad:1"]);
  });

  it("drops the index from singleton device ids", () => {
    expect(getDeviceRegistry().upsert("keyboard", 0, "Keyboard").id).toBe("keyboard");
  });

  it("notifies listeners on connect and disconnect", () => {
    const reg = getDeviceRegistry();
    const sizes: number[] = [];
    reg.on((devices) => sizes.push(devices.length));
    reg.upsert("gamepad", 0, "Pad A");
    reg.remove("gamepad", 0);
    expect(sizes).toEqual([1, 0]);
  });

  it("does not notify when nothing changed", () => {
    const reg = getDeviceRegistry();
    reg.upsert("gamepad", 0, "Pad A");
    const fn = () => {
      throw new Error("should not fire");
    };
    reg.on(fn);
    reg.upsert("gamepad", 0, "Pad A");
  });
});

describe("DeviceSet", () => {
  it("separates values by device identity", () => {
    const store = new Map<string, DeviceEntry<number>>();
    const set = createDeviceSet("test", () => store);
    store.set("gamepad:0", {
      device: { id: "gamepad:0", kind: "gamepad", index: 0, label: "A" },
      value: 10,
    });
    store.set("gamepad:1", {
      device: { id: "gamepad:1", kind: "gamepad", index: 1, label: "B" },
      value: 20,
    });

    expect(set.get("gamepad:1")).toBe(20);
    expect(set.at(0)).toBe(10);
    expect(set.at(1)).toBe(20);
    expect(set.values()).toEqual([10, 20]);
    expect(set.devices().map((d) => d.id)).toEqual(["gamepad:0", "gamepad:1"]);

    const seen: Array<[string, number]> = [];
    set.each((value, device) => seen.push([device.id, value]));
    expect(seen).toEqual([
      ["gamepad:0", 10],
      ["gamepad:1", 20],
    ]);
  });

  it("returns undefined for an unknown device", () => {
    const set = createDeviceSet("test", () => new Map());
    expect(set.get("gamepad:9")).toBeUndefined();
    expect(set.at(9)).toBeUndefined();
  });
});

describe("device-separated gamepad sliders", () => {
  beforeEach(() => installGamepads([]));
  afterEach(() => {
    resetSlidersInput();
    resetDpadInput();
    resetGamepadHub();
    resetRuntime();
    resetDeviceRegistry();
  });

  it("keeps two controllers' values apart", () => {
    installGamepads([
      makePad(0, "Pad A", { lx: 0, ly: -1, rt: 1 }),
      makePad(1, "Pad B", { lx: 1, ly: 0 }),
    ]);

    const set = getSlidersDeviceSet();
    expect(set.devices().map((d) => d.id)).toEqual(["gamepad:0", "gamepad:1", "on-screen"]);

    const padA = set.get("gamepad:0")!;
    const padB = set.get("gamepad:1")!;
    tickTriple(padA);
    tickTriple(padB);

    expect(padA.x.value).toBeCloseTo(0.5);
    expect(padA.y.value).toBeCloseTo(1);
    expect(padA.rotation.value).toBeCloseTo(1);

    expect(padB.x.value).toBeCloseTo(1);
    expect(padB.y.value).toBeCloseTo(0.5);
    expect(padB.rotation.value).toBeCloseTo(0);
  });

  it("falls back from gamepad to on-screen when the pad goes idle", () => {
    installGamepads([makePad(0, "Pad", { lx: 1 })]);
    const sliders = getSlidersInput();
    tickTriple(sliders);
    expect(getSlidersActiveDevice()).toBe("gamepad");
    expect(sliders.x.value).toBeCloseTo(1);

    // Pad still connected but centered — it must stop starving other inputs.
    installGamepads([makePad(0, "Pad")]);
    sliders.x._setValue(0.25);
    tickTriple(sliders);
    expect(getSlidersActiveDevice()).toBe("on-screen");
    expect(sliders.x.value).toBeCloseTo(0.25);
  });

  it("separates d-pad vectors per controller", () => {
    installGamepads([
      makePad(0, "Pad A", { right: true }),
      makePad(1, "Pad B", { up: true }),
    ]);

    const set = getDpadDeviceSet();
    const padA = set.get("gamepad:0")!;
    const padB = set.get("gamepad:1")!;
    padA._tick();
    padB._tick();

    expect(padA.value).toEqual({ x: 1, y: 0 });
    expect(padB.value).toEqual({ x: 0, y: -1 });
  });
});

describe("dpad keyboard listeners", () => {
  afterEach(() => {
    resetDpadInput();
    resetRuntime();
    vi.unstubAllGlobals();
  });

  it("ignores editable targets and clears pressed keys on blur", () => {
    class El {}
    class InputEl extends El {
      tagName = "INPUT";
    }
    const docListeners = new Map<string, (e: never) => void>();
    const winListeners = new Map<string, () => void>();
    vi.stubGlobal("document", {
      hidden: false,
      addEventListener: (t: string, fn: never) => docListeners.set(t, fn),
    });
    vi.stubGlobal("window", {
      addEventListener: (t: string, fn: never) => winListeners.set(t, fn),
    });
    vi.stubGlobal("HTMLElement", El);

    const kb = getDpadDeviceSet().get("keyboard")!;
    kb._tick();
    expect(kb.value).toEqual({ x: 0, y: 0 });

    const pd = vi.fn();
    const keydown = docListeners.get("keydown")!;
    // Typing into a field must not move the d-pad or eat the keystroke.
    keydown({ key: "w", target: new InputEl(), preventDefault: pd } as never);
    expect(pd).not.toHaveBeenCalled();
    kb._tick();
    expect(kb.value).toEqual({ x: 0, y: 0 });

    keydown({ key: "w", target: new El(), preventDefault: pd } as never);
    expect(pd).toHaveBeenCalled();
    kb._tick();
    expect(kb.value).toEqual({ x: 0, y: -1 });

    // Window blur must not leave keys stuck down.
    winListeners.get("blur")!();
    kb._tick();
    expect(kb.value).toEqual({ x: 0, y: 0 });
  });
});
