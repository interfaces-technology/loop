import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { tick, getRuntime, resetRuntime, type TickInfo } from "../src/runtime.js";
import { createHandle } from "../src/handle.js";
import { pipe } from "../src/pipe.js";
import { source, sink } from "../src/component.js";

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

  it("keeps ticking when a tick callback throws", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    let calls = 0;

    tick(() => {
      calls += 1;
      if (calls === 1) throw new Error("boom");
    });

    vi.advanceTimersByTime(16);
    vi.advanceTimersByTime(16);

    expect(calls).toBeGreaterThanOrEqual(2);
    expect(getRuntime().isRunning).toBe(true);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("keeps ticking other work when a pipeline throws", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    let sinkCalls = 0;
    let ticks = 0;

    pipe(
      source({ from: "s", emits: "value", read: () => ({ kind: "value", value: 1 }) }),
      sink({
        to: "bad",
        accepts: "value",
        render() {
          sinkCalls += 1;
          throw new Error("sink boom");
        },
      }),
    ).start();

    tick(() => {
      ticks += 1;
    });

    vi.advanceTimersByTime(16);
    vi.advanceTimersByTime(16);

    expect(sinkCalls).toBeGreaterThanOrEqual(1);
    expect(ticks).toBeGreaterThanOrEqual(2);
    expect(getRuntime().isRunning).toBe(true);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
