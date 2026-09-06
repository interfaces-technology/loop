import { describe, it, expect } from "vitest";
import { source, transform, sink } from "../src/component.js";
import { pipe } from "../src/pipe.js";
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
