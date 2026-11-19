import { cpSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const docsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "docs");

mkdirSync(docsDir, { recursive: true });

for (const file of ["SPEC.md", "README.md"]) {
  cpSync(join(root, file), join(docsDir, file));
}

const examplesSrc = join(root, "examples");
const examplesDest = join(docsDir, "examples");
mkdirSync(examplesDest, { recursive: true });

if (existsSync(examplesSrc)) {
  for (const file of readdirSync(examplesSrc)) {
    if (file.endsWith(".html")) {
      cpSync(join(examplesSrc, file), join(examplesDest, file));
    }
  }
}

console.log("Copied Loop docs to packages/loop-mcp/docs/");
