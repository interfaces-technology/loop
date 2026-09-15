import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerSink, listSinks, output, hasSink, ensureConnected } from "../src/sink-registry.js";
import { runPipeline } from "../src/pipe.js";
import { source } from "../src/component.js";

describe("sink registry", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("registers a sink and exposes it in listSinks", () => {
    const unregister = registerSink("light", {
      to: "light",
      accepts: "value",
      render: () => {},
    });
    expect(hasSink("light")).toBe(true);
    expect(listSinks()).toContain("light");
    unregister();
    expect(hasSink("light")).toBe(false);
  });

  it("output() delivers packets to a registered sink through a pipe", () => {
    const received: number[] = [];
    registerSink("light", {
      to: "light",
      accepts: "value",
      render: (p) => {
        if (p.kind === "value" && typeof p.value === "number") received.push(p.value);
      },
    });

    const pipe = [
      source({ from: "test", emits: "value", read: () => ({ kind: "value", value: 0.5 }) }),
      output("light"),
    ];
    runPipeline(pipe);

    expect(received).toEqual([0.5]);
  });

  it("rejects unregistered output() with a helpful error", () => {
    expect(() => output("receipt")).toThrow(/no sink adapter.*registerSink/m);
  });

  it("is idempotent — output() returns the same stage each call", () => {
    registerSink("screen", { to: "screen", accepts: "value", render: () => {} });
    expect(output("screen")).toBe(output("screen"));
  });

  it("calls an optional connect() hook exactly once", () => {
    const connect = vi.fn();
    registerSink("printer", {
      to: "printer",
      accepts: "data",
      connect,
      render: () => {},
    });

    ensureConnected("printer");
    ensureConnected("printer");
    expect(connect).toHaveBeenCalledTimes(1);
  });

  it('ships a "log" built-in by default', () => {
    expect(hasSink("log")).toBe(true);
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    runPipeline([
      source({ from: "t", emits: "value", read: () => ({ kind: "value", value: 0.25 }) }),
      output("log"),
    ]);
    runPipeline([
      source({
        from: "t",
        emits: "data",
        dataType: "text",
        read: () => ({ kind: "data", type: "text", value: "hi" }),
      }),
      output("log"),
    ]);
    expect(spy).toHaveBeenCalledWith("loop.log", 0.25);
    expect(spy).toHaveBeenCalledWith("loop.log", "[text]", "hi");
  });
});