import { describe, it, expect, vi } from "vitest";
import { createHandle } from "../src/handle.js";

describe("Handle", () => {
  it("returns initial value", () => {
    const h = createHandle(0.5);
    expect(h.value).toBe(0.5);
  });

  it("fires change on setValue", () => {
    const h = createHandle(0);
    const fn = vi.fn();
    h.on("change", fn);
    h._setValue(1);
    expect(fn).toHaveBeenCalledWith(1);
    expect(h.value).toBe(1);
  });

  it("does not fire change when value unchanged", () => {
    const h = createHandle(0.5);
    const fn = vi.fn();
    h.on("change", fn);
    h._setValue(0.5);
    expect(fn).not.toHaveBeenCalled();
  });

  it("fires change for Vec when axes differ", () => {
    const h = createHandle({ x: 0, y: 0 });
    const fn = vi.fn();
    h.on("change", fn);
    h._setValue({ x: 1, y: 0 });
    expect(fn).toHaveBeenCalledWith({ x: 1, y: 0 });
  });

  it("bind applies value to element", () => {
    const h = createHandle(0.5);
    const el = { text: "" };
    h.bind(el, (v, e) => {
      (e as { text: string }).text = String(v);
    });
    expect(el.text).toBe("0.5");
    h._setValue(1);
    expect(el.text).toBe("1");
  });
});
