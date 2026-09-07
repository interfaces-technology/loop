import assert from "node:assert/strict";
import { test } from "node:test";
import { listResources, readResource } from "../dist/docs.js";

test("bundles spec, readme, and examples", async () => {
  const resources = listResources();
  const uris = resources.map((resource) => resource.uri);

  assert.ok(uris.includes("loop://spec"));
  assert.ok(uris.includes("loop://readme"));
  assert.ok(uris.some((uri) => uri.startsWith("loop://examples/")));

  const spec = await readResource("SPEC.md");
  assert.ok(spec.includes("Loop"));
});
