import { describe, it, expect } from "vitest";
import {
  escposInit,
  escposText,
  escposFeed,
  escposCut,
  encodePrintJob,
} from "../src/sinks/escpos.js";

describe("escpos", () => {
  it("encodes init command", () => {
    expect(Array.from(escposInit())).toEqual([0x1b, 0x40]);
  });

  it("encodes text as UTF-8", () => {
    expect(Array.from(escposText("Hi"))).toEqual([0x48, 0x69]);
  });

  it("encodes line feeds", () => {
    expect(Array.from(escposFeed(2))).toEqual([0x0a, 0x0a]);
    expect(escposFeed(0).length).toBe(0);
  });

  it("encodes full and partial cut", () => {
    expect(Array.from(escposCut(false))).toEqual([0x1d, 0x56, 0x00]);
    expect(Array.from(escposCut(true))).toEqual([0x1d, 0x56, 0x01]);
  });

  it("builds a full print job", () => {
    const job = encodePrintJob("Loop", { feed: 1, cut: true });
    expect(Array.from(job)).toEqual([
      0x1b, 0x40,
      0x4c, 0x6f, 0x6f, 0x70,
      0x0a,
      0x1d, 0x56, 0x00,
    ]);
  });
});
