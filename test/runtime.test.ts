import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { tick, getRuntime, resetRuntime, type TickInfo } from "../src/runtime.js";
import { createHandle } from "../src/handle.js";

describe("runtime", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
    resetRuntime();
  });

  afterEach(() => {
    resetRuntime();
    vi.useRealTimers();
  });

  it("passes monotonic time and delta to tick callbacks", () => {
    const ticks: TickInfo[] = [];
    tick((info) => ticks.push(info));

    vi.advanceTimersByTime(16);
    vi.advanceTimersByTime(16);

    expect(ticks.length).toBeGreaterThanOrEqual(2);
    expect(ticks[0]?.delta).toBe(0);
    expect(ticks[1]?.delta).toBe(16);
    expect(ticks[1]?.time).toBeGreaterThan(ticks[0]?.time ?? 0);
  });

  it("stops automatically once no work remains", () => {
    const stop = tick(() => {});
    expect(getRuntime().isRunning).toBe(true);

    stop();
    expect(getRuntime().isRunning).toBe(false);
  });

  it("runs while a handle is sampled and stops when it is disposed", () => {
    const handle = createHandle(0);
    handle._setSampler(() => 1);
    expect(getRuntime().isRunning).toBe(true);

    vi.advanceTimersByTime(16);
    expect(handle.value).toBe(1);

    handle.dispose();
    expect(getRuntime().isRunning).toBe(false);
  });
});
