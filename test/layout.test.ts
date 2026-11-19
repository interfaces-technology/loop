import { describe, it, expect, beforeEach } from "vitest";
import { layout, clearLayouts } from "../src/layout.js";
import { output } from "../src/input.js";
import { resetReceiptLayout } from "../src/sinks/receipt.js";

describe("layout", () => {
  beforeEach(() => {
    clearLayouts();
    resetReceiptLayout();
  });

  it('returns a receipt sink for layout("receipt")', () => {
    const receipt = layout("receipt");
    expect(receipt.role).toBe("sink");
    expect(receipt.name).toBe("receipt");
    expect(receipt.accepts).toBe("data");
    expect(receipt.dataType).toBe("text");
  });

  it("throws for unknown layouts", () => {
    expect(() => layout("lights")).toThrow(/Unknown layout/);
  });

  it('output("receipt") resolves to the same sink', () => {
    const fromLayout = layout("receipt");
    const fromOutput = output("receipt");
    expect(fromOutput).toBe(fromLayout);
  });
});
