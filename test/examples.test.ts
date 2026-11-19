import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import * as loopNs from "../src/index.js";
import loopDefault from "../src/index.js";

const examplesDir = fileURLToPath(new URL("../examples", import.meta.url));
const files = readdirSync(examplesDir).filter((f) => f.endsWith(".html"));

const apiNames = new Set([...Object.keys(loopNs), ...Object.keys(loopDefault)]);

describe("examples smoke test", () => {
  it("finds the example files", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    it(`${file} imports the built bundle and only uses exported loop APIs`, () => {
      const html = readFileSync(join(examplesDir, file), "utf8");
      expect(html).toContain('from "../dist/index.js"');

      const used = new Set<string>();
      for (const m of html.matchAll(/\bloop\.(\w+)/g)) used.add(m[1]);
      for (const name of used) {
        expect(apiNames.has(name), `${file} uses loop.${name} which is not exported`).toBe(true);
      }
    });
  }
});
