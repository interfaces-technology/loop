import { describe, it, expect, beforeEach } from "vitest";
import {
  registerInput,
  input,
  inputs,
  registerOutput,
  output,
  clearInputRegistries,
} from "../src/input.js";
import { createHandle } from "../src/handle.js";
import { sink } from "../src/component.js";

describe("input / output registries", () => {
  beforeEach(() => {
    clearInputRegistries();
  });

  it("exposes built-in inputs", () => {
    expect(input("dpad").value).toEqual({ x: 0, y: 0 });
  });

  it("registers a custom input", () => {
    const handle = createHandle(0.42);
    registerInput("custom", () => handle);
    expect(input("custom")).toBe(handle);
  });

  it("exposes custom inputs through inputs() as a single-device set", () => {
    const handle = createHandle(7);
    registerInput("custom", () => handle);

    const set = inputs("custom");
    expect(set.get("custom")).toBe(handle);
    expect(set.devices().map((d) => d.id)).toEqual(["custom"]);

    // Re-registering swaps the underlying handle.
    const replacement = createHandle(9);
    registerInput("custom", () => replacement);
    expect(inputs("custom").get("custom")).toBe(replacement);
  });

  it("replaces a previously registered input", () => {
    registerInput("custom", () => createHandle(0));
    const replacement = createHandle(5);
    registerInput("custom", () => replacement);
    expect(input("custom")).toBe(replacement);
  });

  it("registers a custom output sink", () => {
    const received: unknown[] = [];
    registerOutput("log", () =>
      sink({
        to: "log",
        accepts: "value",
        render: (packet) => received.push(packet),
      }),
    );

    const stage = output("log");
    stage.render?.({ kind: "value", value: 1 });
    expect(received).toEqual([{ kind: "value", value: 1 }]);
  });

  it("throws for an unknown input", () => {
    expect(() => input("nope")).toThrow(/Unknown input/);
  });

  it("output for an unregistered name yields a sink that explains how to register", () => {
    const stage = output("mystery");
    expect(() => stage.render?.({ kind: "value", value: 0 })).toThrow(
      /no sink registered/,
    );
  });
});
