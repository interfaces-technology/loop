import { describe, it, expect } from "vitest";
import { filter, capture } from "../src/operations.js";
import { createHandle } from "../src/handle.js";
import type { PacketOf } from "../src/types.js";

describe("operations", () => {
  it("filter maps a value packet", () => {
    const stage = filter((v) => (typeof v === "number" ? v * 2 : v));
    const out = stage.process?.({ kind: "value", value: 0.25 });
    expect(out).toEqual({ kind: "value", value: 0.5 });
  });

  it("filter maps vector axes", () => {
    const stage = filter((v) => (typeof v === "number" ? v : { x: -v.x, y: -v.y }));
    const out = stage.process?.({ kind: "value", value: { x: 1, y: -0.5 } });
    expect(out).toEqual({ kind: "value", value: { x: -1, y: 0.5 } });
  });

  it("capture bridges a handle into a value source", () => {
    const handle = createHandle(0.7);
    const src = capture(handle);
    expect(src.emits).toBe("value");
    expect(src.read?.()).toEqual<PacketOf<"value">>({ kind: "value", value: 0.7 });

    handle._setValue(0.9);
    expect(src.read?.()).toEqual({ kind: "value", value: 0.9 });
  });
});
