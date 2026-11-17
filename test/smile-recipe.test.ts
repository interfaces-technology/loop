import { describe, it, expect } from "vitest";
import { createSmilePrintTransform } from "../src/transforms/smile-print.js";
import type { Packet } from "../src/types.js";

function runTransform(values: number[], options?: { threshold?: number; cooldownMs?: number }): string[] {
  const stage = createSmilePrintTransform(options);
  const outputs: string[] = [];

  for (const value of values) {
    const packet: Packet = { kind: "value", value };
    const out = stage.process?.(packet);
    if (out?.kind === "data") {
      outputs.push(String(out.value));
    }
  }

  return outputs;
}

describe("smile print transform", () => {
  it("does not emit below threshold", () => {
    const outputs = runTransform([0.1, 0.5, 0.69]);
    expect(outputs.every((value) => value === "")).toBe(true);
  });

  it("emits once on rising edge past threshold", () => {
    const outputs = runTransform([0.2, 0.8, 0.9, 0.95]);
    const prints = outputs.filter((value) => value !== "");
    expect(prints).toHaveLength(1);
    expect(prints[0]).toMatch(/Smile detected!/);
  });

  it("emits again after dropping below and rising again", () => {
    const outputs = runTransform([0.8, 0.2, 0.85], { cooldownMs: 0 });
    const prints = outputs.filter((value) => value !== "");
    expect(prints).toHaveLength(2);
  });

  it("respects cooldown between prints while held high", () => {
    const stage = createSmilePrintTransform({ threshold: 0.7, cooldownMs: 2000 });
    let now = 0;
    const originalNow = Date.now;
    Date.now = () => now;

    const first = stage.process?.({ kind: "value", value: 0.8 });
    now = 500;
    const blocked = stage.process?.({ kind: "value", value: 0.2 });
    now = 600;
    const second = stage.process?.({ kind: "value", value: 0.85 });

    Date.now = originalNow;

    expect(first?.kind === "data" ? first.value : "").toMatch(/Smile detected!/);
    expect(blocked?.kind === "data" ? blocked.value : "").toBe("");
    expect(second?.kind === "data" ? second.value : "").toBe("");
  });
});
