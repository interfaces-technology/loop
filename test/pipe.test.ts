import { describe, it, expect, vi } from "vitest";
import { source, transform, sink } from "../src/component.js";
import { pipe, runPipeline } from "../src/pipe.js";
import type { Packet } from "../src/types.js";

describe("pipe type-checking", () => {
  it("wires compatible value stages", async () => {
    const src = source({
      from: "test",
      emits: "value",
      read: () => ({ kind: "value", value: 0.5 }),
    });

    const xform = transform({
      accepts: "value",
      emits: "value",
      process: (p) => {
        if (p.kind !== "value" || typeof p.value !== "number") return p;
        return { kind: "value", value: p.value * 2 };
      },
    });

    const results: Packet[] = [];
    const snk = sink({
      to: "log",
      accepts: "value",
      render: (p) => results.push(p),
    });

    const pipeline = pipe(src, xform, snk);

    const { runPipeline } = await import("../src/pipe.js");
    runPipeline(pipeline.stages);

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ kind: "value", value: 1 });
  });

  it("throws on kind mismatch at pipe() time", () => {
    const src = source({
      from: "test",
      emits: "value",
      read: () => ({ kind: "value", value: 0.5 }),
    });

    const snk = sink({
      to: "frame-only",
      accepts: "frame",
      render: () => {},
    });

    expect(() => pipe(src, snk)).toThrow(/Type mismatch/);
  });

  it("throws on data type mismatch at pipe() time", () => {
    const src = source({
      from: "test",
      emits: "data",
      dataType: "text",
      read: () => ({ kind: "data", type: "text", value: "hi" }),
    });

    const snk = sink({
      to: "events",
      accepts: "data",
      dataType: "event",
      render: () => {},
    });

    expect(() => pipe(src, snk)).toThrow(/Data type mismatch/);
  });

  it("allows data through when types match", async () => {
    const src = source({
      from: "test",
      emits: "data",
      dataType: "text",
      read: () => ({ kind: "data", type: "text", value: "hello" }),
    });

    const xform = transform({
      accepts: "data",
      emits: "data",
      dataType: "text",
      process: (p) => {
        if (p.kind !== "data") return p;
        return { kind: "data", type: "text", value: String(p.value).toUpperCase() };
      },
    });

    const results: Packet[] = [];
    const snk = sink({
      to: "log",
      accepts: "data",
      dataType: "text",
      render: (p) => results.push(p),
    });

    const pipeline = pipe(src, xform, snk);
    const { runPipeline } = await import("../src/pipe.js");
    runPipeline(pipeline.stages);

    expect(results[0]).toEqual({ kind: "data", type: "text", value: "HELLO" });
  });
});

describe("transform names", () => {
  it("uses def.name for diagnostics and defaults to 'transform'", () => {
    const named = transform({
      name: "double",
      accepts: "value",
      emits: "value",
      process: (p) => p,
    });
    const plain = transform({ accepts: "value", emits: "value", process: (p) => p });
    expect(named.name).toBe("double");
    expect(plain.name).toBe("transform");
  });

  it("surfaces the name in adjacency errors", () => {
    const src = source({ from: "src", emits: "value", read: () => null });
    const bad = transform({ name: "needs-data", accepts: "data", emits: "data", process: (p) => p });
    expect(() => pipe(src, bad)).toThrow(/needs-data/);
  });
});

describe("runtime kind validation", () => {
  it("drops packets whose kind contradicts the stage's emits", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const bad = {
      role: "source" as const,
      name: "bad",
      emits: "data" as const,
      read: () => ({ kind: "value" as const, value: 1 }),
    };
    const seen: Packet[] = [];
    const snk = sink({ to: "snk", accepts: ["value", "data"], render: (p) => seen.push(p) });

    runPipeline([bad, snk]);
    runPipeline([bad, snk]);

    expect(seen).toHaveLength(0);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
