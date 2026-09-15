import { describe, it, expect, afterEach, beforeAll, vi } from "vitest";
import { JSDOM } from "jsdom";
import {
  clamp01,
  angleForValue,
  valueForAngle,
  angleAtPoint,
  positionToValue,
  valueForClient,
} from "../src/kit/math.js";
import { button } from "../src/kit/button.js";
import { slider } from "../src/kit/slider.js";
import { dial } from "../src/kit/dial.js";
import { dpad } from "../src/kit/dpad.js";
import { keypad } from "../src/kit/keypad.js";
import { rotate } from "../src/kit/rotate.js";

const cleanup: Array<() => void> = [];

beforeAll(() => {
  const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
  const g = globalThis as Record<string, unknown>;
  const w = dom.window;
  g.window = w;
  g.document = w.document;
  g.HTMLElement = w.HTMLElement;
  g.KeyboardEvent = w.KeyboardEvent;
  g.PointerEvent =
    w.PointerEvent ??
    class PointerEvent extends w.MouseEvent {
      pointerId: number;
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 1;
      }
    };
});

afterEach(() => {
  document.body.innerHTML = "";
  for (const fn of cleanup.splice(0)) fn();
});

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
    x: left,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

describe("kit math", () => {
  it("clamp01 bounds to 0..1", () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(2)).toBe(1);
    expect(clamp01(0.5)).toBe(0.5);
  });

  it("dial angle round-trips value", () => {
    expect(valueForAngle(angleForValue(0))).toBe(0);
    expect(valueForAngle(angleForValue(0.5))).toBeCloseTo(0.5, 6);
    expect(valueForAngle(angleForValue(1))).toBeCloseTo(1, 6);
  });

  it("dial clamps below start angle to min", () => {
    // 90° (3 o'clock) is inside the sweep; 200° (below start) clamps to 0
    expect(valueForAngle(90)).toBeGreaterThan(0.7);
    expect(valueForAngle(200)).toBe(0);
  });

  it("angleAtPoint is clockwise from 12 o'clock", () => {
    expect(angleAtPoint(10, -10, 10, 0)).toBe(0); // top
    expect(angleAtPoint(20, 0, 10, 0)).toBe(90); // right
    expect(angleAtPoint(10, 10, 10, 0)).toBe(180); // bottom
    expect(angleAtPoint(0, 0, 10, 0)).toBe(270); // left
  });

  it("positionToValue maps client coordinates", () => {
    const r = rect(10, 20, 200, 40);
    expect(positionToValue(210, 30, r, true)).toBe(1);
    expect(positionToValue(10, 30, r, true)).toBe(0);
    expect(positionToValue(10, 20, r, false)).toBe(1); // top = 1
    expect(positionToValue(10, 60, r, false)).toBe(0);
  });

  it("valueForClient accounts for thumb travel", () => {
    const r = rect(0, 0, 220, 40);
    expect(valueForClient(0, 0, r, true, 26)).toBe(0);
    expect(valueForClient(220, 0, r, true, 26)).toBe(1);
    expect(valueForClient(110, 0, r, true, 26)).toBeGreaterThan(0.48);
    expect(valueForClient(110, 0, r, true, 26)).toBeLessThan(0.52);
  });
});

describe("kit components", () => {
  it("button is momentary and clears on release", () => {
    const c = button({ label: "go" });
    cleanup.push(c.destroy);
    expect(c.el.tagName).toBe("BUTTON");
    expect(c.value.value).toBe(0);

    const target = c.el as HTMLButtonElement;
    c.el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    expect(c.value.value).toBe(1);
    c.el.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    expect(c.value.value).toBe(0);
  });

  it("button toggles when toggle: true", () => {
    const c = button({ label: "power", toggle: true, initial: 0 });
    cleanup.push(c.destroy);
    c.el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    c.el.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    expect(c.value.value).toBe(1);
    c.el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    c.el.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    expect(c.value.value).toBe(0);
  });

  it("slider renders into parent and updates thumb position", () => {
    const host = document.createElement("div");
    const c = slider({ parent: host, initial: 0.5 });
    cleanup.push(c.destroy);
    expect(host.contains(c.el)).toBe(true);
    c.value._setValue(1);
    expect(c.el.style.width).toBe("220px");
    expect(c.value.value).toBe(1);
  });

  it("slider maps a pointer drag to its value", () => {
    const c = slider({ initial: 0 });
    cleanup.push(c.destroy);
    vi.spyOn(c.el, "getBoundingClientRect").mockReturnValue(rect(0, 0, 220, 40));
    c.el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: 220, clientY: 20 }));
    expect(c.value.value).toBe(1);
  });

  it("dial reads the pointer angle as its value", () => {
    const c = dial({ size: 96, initial: 0 });
    cleanup.push(c.destroy);
    vi.spyOn(c.el, "getBoundingClientRect").mockReturnValue(rect(0, 0, 96, 96));

    // top of the knob (12 o'clock) -> 0.5
    c.el.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, clientX: 48, clientY: 0 }),
    );
    expect(c.value.value).toBeCloseTo(0.5, 3);

    // 3 o'clock -> 0.833 (within the 270° sweep)
    c.el.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, clientX: 96, clientY: 48 }),
    );
    expect(c.value.value).toBeCloseTo(0.8333, 3);

    // bottom (6 o'clock) sits in the dial's dead zone -> clamps to 0
    c.el.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, clientX: 48, clientY: 96 }),
    );
    expect(c.value.value).toBe(0);
  });

  it("dpad emits a Vec and mirrors the keyboard", () => {
    const c = dpad();
    cleanup.push(c.destroy);
    expect(c.value.value).toEqual({ x: 0, y: 0 });

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp" }));
    expect(c.value.value).toEqual({ x: 0, y: -1 });

    c.setActive("right", true);
    expect(c.value.value).toEqual({ x: 1, y: -1 });

    document.dispatchEvent(new KeyboardEvent("keyup", { key: "ArrowUp" }));
    c.setActive("right", false);
    expect(c.value.value).toEqual({ x: 0, y: 0 });
  });

  it("keypad accumulates taps and clears", () => {
    const c = keypad();
    cleanup.push(c.destroy);
    const buttons = [...c.el.querySelectorAll("button")];
    const byLabel = (label: string) => buttons.find((b) => b.textContent === label)!;

    byLabel("1").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    byLabel("1").dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    byLabel("2").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    expect(c.value.value).toBe("12");

    byLabel("⌫").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    expect(c.value.value).toBe("1");

    byLabel("clear").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    expect(c.value.value).toBe("");
  });

  it("keypad fires change listeners as digits are pressed", () => {
    const c = keypad();
    cleanup.push(c.destroy);
    const fn = vi.fn();
    c.value.on("change", fn);
    c.value._setValue("7");
    expect(fn).toHaveBeenCalledWith("7");
  });

  it("controls adopt a raw element as parent: dial(div), slider(div, opts)", () => {
    const host = document.createElement("div");
    const d = dial(host);
    cleanup.push(d.destroy);
    expect(host.contains(d.el)).toBe(true);

    const host2 = document.createElement("div");
    const s = slider(host2, { axis: "y" });
    cleanup.push(s.destroy);
    expect(host2.contains(s.el)).toBe(true);
    expect(s.axis).toBe("y");
  });

  it("rotate makes an element draggable around its center, emitting degrees", () => {
    const knob = document.createElement("div");
    const c = rotate(knob, { initial: 0 });
    cleanup.push(c.destroy);
    expect(c.el).toBe(knob);
    expect(c.value.value).toBe(0);

    vi.spyOn(knob, "getBoundingClientRect").mockReturnValue(rect(0, 0, 100, 100));

    // grab at 12 o'clock -> 0/360, drag to 3 o'clock -> 90
    knob.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, clientX: 50, clientY: 0 }),
    );
    knob.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        clientX: 100,
        clientY: 50,
        buttons: 1,
      }),
    );
    expect(c.value.value).toBeCloseTo(90, 3);
    expect(knob.style.rotate).toBe("90deg");

    // keyboard nudges work too
    knob.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    expect(c.value.value).toBeCloseTo(95, 3);
  });

  it("rotate clamps to min/max and honors snap steps", () => {
    const knob = document.createElement("div");
    const c = rotate(knob, { min: 0, max: 180, steps: 30, initial: 10 });
    cleanup.push(c.destroy);
    expect(c.value.value).toBe(10); // initial preserved, not snapped

    c.setDegrees(95);
    expect(c.value.value).toBe(90); // snapped to nearest 30
    c.setDegrees(200);
    expect(c.value.value).toBe(180); // clamped to max
  });
});