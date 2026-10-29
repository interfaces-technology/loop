import { describe, it, expect } from "vitest";
import { source, transform, sink } from "../src/component.js";
import { link } from "../src/link.js";
import type { Packet } from "../src/types.js";

describe("link type-checking", () => {
  it("wires compatible value stages", async () => {
    const src = source({
      from: "test",
      out: "value",
      poll: () => ({ kind: "value", v: 0.5 }),
    });

    const xform = transform({
      in: "value",
      out: "value",
      process: (p) => {
        if (p.kind !== "value" || typeof p.v !== "number") return p;
        return { kind: "value", v: p.v * 2 };
      },
    });

    const results: Packet[] = [];
    const snk = sink({
      to: "log",
      in: "value",
      draw: (p) => results.push(p),
    });

    const pipeline = link(src, xform, snk);

    const { runPipeline } = await import("../src/link.js");
    runPipeline(pipeline.stages);

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ kind: "value", v: 1 });
  });

  it("throws on kind mismatch at link() time", () => {
    const src = source({
      from: "test",
      out: "value",
      poll: () => ({ kind: "value", v: 0.5 }),
    });

    const snk = sink({
      to: "frame-only",
      in: "frame",
      draw: () => {},
    });

    expect(() => link(src, snk)).toThrow(/Type mismatch/);
  });

  it("throws on data type mismatch at link() time", () => {
    const src = source({
      from: "test",
      out: "data",
      dataType: "text",
      poll: () => ({ kind: "data", type: "text", value: "hi" }),
    });

    const snk = sink({
      to: "events",
      in: "data",
      dataType: "event",
      draw: () => {},
    });

    expect(() => link(src, snk)).toThrow(/Data type mismatch/);
  });

  it("allows data through when types match", async () => {
    const src = source({
      from: "test",
      out: "data",
      dataType: "text",
      poll: () => ({ kind: "data", type: "text", value: "hello" }),
    });

    const xform = transform({
      in: "data",
      out: "data",
      dataType: "text",
      process: (p) => {
        if (p.kind !== "data") return p;
        return { kind: "data", type: "text", value: String(p.value).toUpperCase() };
      },
    });

    const results: Packet[] = [];
    const snk = sink({
      to: "log",
      in: "data",
      dataType: "text",
      draw: (p) => results.push(p),
    });

    const pipeline = link(src, xform, snk);
    const { runPipeline } = await import("../src/link.js");
    runPipeline(pipeline.stages);

    expect(results[0]).toEqual({ kind: "data", type: "text", value: "HELLO" });
  });
});
