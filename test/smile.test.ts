import { describe, it, expect, beforeEach } from "vitest";
import { getSmileInput, setSmileSampler, resetSmileInput } from "../src/sources/smile.js";

describe("smile input", () => {
  beforeEach(() => {
    resetSmileInput();
  });

  it("returns a normalized handle via sampler", () => {
    const smile = getSmileInput();
    setSmileSampler(() => 1.5);
    smile._tick();
    expect(smile.value).toBe(1);
  });

  it("uses a custom sampler when provided", () => {
    const smile = getSmileInput();
    setSmileSampler(() => 0.82);
    smile._tick();
    expect(smile.value).toBe(0.82);
  });

  it("idles at neutral without a sampler instead of echoing itself", () => {
    const smile = getSmileInput();
    smile._tick();
    expect(smile.value).toBe(0);
    // A manual write must not survive the next tick — there is no real source.
    smile._setValue(0.9);
    smile._tick();
    expect(smile.value).toBe(0);
  });
});
