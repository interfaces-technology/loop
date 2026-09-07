import { readFile } from "node:fs/promises";
import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export interface DocResource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
  relativePath: string;
}

function getDocsRoot(): string {
  if (process.env.LOOP_DOCS_ROOT) {
    return process.env.LOOP_DOCS_ROOT;
  }

  const bundled = join(dirname(fileURLToPath(import.meta.url)), "..", "docs");
  if (existsSync(join(bundled, "SPEC.md"))) {
    return bundled;
  }

  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
  if (existsSync(join(repoRoot, "SPEC.md"))) {
    return repoRoot;
  }

  return bundled;
}

function discoverExamples(docsRoot: string): DocResource[] {
  const examplesDir = join(docsRoot, "examples");
  if (!existsSync(examplesDir)) {
    return [];
  }

  return readdirSync(examplesDir)
    .filter((file) => file.endsWith(".html"))
    .sort()
    .map((file) => {
      const slug = file.replace(/\.html$/, "");
      return {
        uri: `loop://examples/${slug}`,
        name: `Example: ${slug}`,
        description: `Loop example HTML — ${file}`,
        mimeType: "text/html",
        relativePath: join("examples", file),
      };
    });
}

export function listResources(): DocResource[] {
  const docsRoot = getDocsRoot();

  const core: DocResource[] = [
    {
      uri: "loop://spec",
      name: "Loop Spec",
      description: "Full Loop v0.1 specification — API, packet types, component model",
      mimeType: "text/markdown",
      relativePath: "SPEC.md",
    },
    {
      uri: "loop://readme",
      name: "Loop README",
      description: "Install, quick start, and examples overview",
      mimeType: "text/markdown",
      relativePath: "README.md",
    },
  ];

  return [...core, ...discoverExamples(docsRoot)];
}

export async function readResource(relativePath: string): Promise<string> {
  const docsRoot = getDocsRoot();
  const fullPath = join(docsRoot, relativePath);

  if (!existsSync(fullPath)) {
    throw new Error(`Document not found: ${relativePath}`);
  }

  return readFile(fullPath, "utf8");
}
