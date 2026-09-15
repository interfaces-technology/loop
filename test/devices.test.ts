import { describe, it, expect } from "vitest";
import { escposInit, escposFeed, escposCut, escposText, encodeReceipt, ESC, GS } from "../src/devices/escpos.js";
import { receipt } from "../src/devices/receipt.js";
import type { Packet } from "../src/types.js";

describe("escpos", () => {
  it("escposInit emits the initialize command", () => {
    expect(Array.from(escposInit())).toEqual([ESC, 0x40]);
  });

  it("escposCut emits full, then partial cut", () => {
    expect(Array.from(escposCut("full"))).toEqual([GS, 0x56, 0x42, 0x00]);
    expect(Array.from(escposCut("partial"))).toEqual([GS, 0x56, 0x41, 0x00]);
  });

  it("escposFeed emits n-line feed", () => {
    expect(Array.from(escposFeed(3))).toEqual([ESC, 0x64, 3]);
  });

  it("escposText emits utf-8 bytes plus a line feed", () => {
    const bytes = escposText("TV 13");
    const text = new TextDecoder().decode(bytes.subarray(0, bytes.length - 1));
    expect(text).toBe("TV 13");
    expect(bytes[bytes.length - 1]).toBe(0x0a);
  });

  it("encodeReceipt wraps lines in init + feed + cut", () => {
    const bytes = encodeReceipt(["Line A", "Line B"], { feed: 1 });
    const parts = Array.from(bytes);
    expect(parts[0]).toBe(ESC);
    expect(parts[1]).toBe(0x40);
    expect(parts).toContain(0x1d);
    expect(parts[parts.length - 1]).toBe(0x00);
    expect(parts[parts.length - 4]).toBe(GS);
    expect(parts[parts.length - 3]).toBe(0x56);
    const decoder = new TextDecoder();
    const whole = decoder.decode(bytes);
    expect(whole).toContain("Line A");
    expect(whole).toContain("Line B");
  });
});

const fresh = () => receipt({ transport: "capture" });

describe("receipt printer", () => {
  const text = (value: string): Packet => ({ kind: "data", type: "text", value });
  const cut: Packet = { kind: "data", type: "cut", value: "" };
  const jobEnd: Packet = { kind: "data", type: "job-end", value: "" };

  it("buffers lines into a job and flushes on cut", () => {
    const printer = fresh();
    printer.sink.render(text("hello"));
    printer.sink.render(text("world"));
    expect(printer.jobs).toEqual([]);

    printer.sink.render(cut);
    expect(printer.jobs).toEqual([["hello", "world"]]);
  });

  it("flushes on job-end as well", () => {
    const printer = fresh();
    printer.sink.render(text("total: 12.50"));
    printer.sink.render(jobEnd);
    expect(printer.jobs).toEqual([["total: 12.50"]]);
  });

  it("accepts number data as lines", () => {
    const printer = fresh();
    printer.sink.render({ kind: "data", type: "number", value: 42 });
    printer.sink.render(cut);
    expect(printer.jobs).toEqual([["42"]]);
  });

  it("ignores untagged and frame packets", () => {
    const printer = fresh();
    printer.sink.render({ kind: "value", value: 0.5 });
    printer.sink.render(cut);
    expect(printer.jobs).toEqual([]);
  });

  it("keeps multiple jobs in order", () => {
    const printer = fresh();
    printer.sink.render(text("one"));
    printer.sink.render(cut);
    printer.sink.render(text("two"));
    printer.sink.render(cut);
    expect(printer.jobs).toEqual([["one"], ["two"]]);
  });

  it("clear() resets captured jobs", () => {
    const printer = fresh();
    printer.sink.render(text("x"));
    printer.sink.render(cut);
    printer.clear();
    expect(printer.jobs).toEqual([]);
  });

  it("encodes finished jobs through onJob", () => {
    const seen: Uint8Array[] = [];
    const printer = receipt({ onJob: (bytes) => seen.push(bytes) });
    printer.sink.render(text("hey"));
    printer.sink.render(cut);
    expect(seen).toHaveLength(1);
    expect(new TextDecoder().decode(seen[0])).toContain("hey");
  });

  it("returns a shared default instance when called with no args", () => {
    expect(receipt()).toBe(receipt());
    const custom = fresh();
    expect(custom).not.toBe(receipt());
  });

  it("declares the accepted data type so pipe type-checking matches", () => {
    expect(receipt().sink.dataType).toBe("text");
  });
});