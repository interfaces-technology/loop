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

  it("applies bindings only when the value changes", () => {
    const h = createHandle(0);
    let calls = 0;
    h.bind({}, () => {
      calls += 1;
    });
    expect(calls).toBe(1);

    h._setValue(0);
    expect(calls).toBe(1);

    h._setValue(1);
    h._setValue(1);
    expect(calls).toBe(2);
  });

  it("_tick samples once and notifies only on change", () => {
    let source = 0;
    const h = createHandle(0);
    const fn = vi.fn();
    h._setSampler(() => source);
    h.on("change", fn);

    h._tick();
    expect(fn).not.toHaveBeenCalled();

    source = 1;
    h._tick();
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(1);
  });

  it("dispose removes listeners and bindings", () => {
    const h = createHandle(0);
    const onChange = vi.fn();
    const onBind = vi.fn();
    h.on("change", onChange);
    h.bind({}, onBind);
    expect(onBind).toHaveBeenCalledTimes(1);

    h.dispose();
    h._setValue(1);

    expect(onChange).not.toHaveBeenCalled();
    expect(onBind).toHaveBeenCalledTimes(1);
  });
});
