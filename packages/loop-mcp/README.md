# @theinterfaces-lab/loop-mcp

Docs-only MCP server for [Loop](https://github.com/interfaces-technology/loop). AI assistants can read the spec, README, and examples.

## Install

Add this to your MCP config (`~/.cursor/mcp.json`, Claude Desktop, Windsurf, etc.):

```json
{
  "mcpServers": {
    "loop-docs": {
      "command": "npx",
      "args": ["-y", "@theinterfaces-lab/loop-mcp"]
    }
  }
}
```

VS Code uses `"servers"` as the root key instead of `"mcpServers"`.

No global install is required. `npx -y` downloads the package on first run.

## What it exposes

Resources: `loop://spec`, `loop://readme`, `loop://examples/*`

Tool: `search_docs` — keyword search across all bundled docs.

## Develop

From the Loop repo root:

```bash
npm run build:mcp
```

This repo already registers the local server via [`.cursor/mcp.json`](../../.cursor/mcp.json).

## License

MIT
