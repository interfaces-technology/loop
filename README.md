# @theinterfaces-lab/loop

**Loop is the wire.** You author the two ends; Loop carries a normalized packet between them and never renders anything itself.

By [Interfaces Lab](https://github.com/interfaces-technology).

## Install

```bash
npm install @theinterfaces-lab/loop
```

Or use directly in the browser — no build step required:

```html
<script type="module">
  import loop from "./dist/index.js";
</script>
```

## Quick start

```javascript
import loop from "@theinterfaces-lab/loop";

const dpad = loop.input("dpad");

loop.tick(() => {
  el.style.transform = `translate(${dpad.value.x * 100}px, ${dpad.value.y * 100}px)`;
});
```

## Examples

Open with a local static server (`npx serve examples`):

| Example | What it shows |
|---------|---------------|
| [01-live-text.html](examples/01-live-text.html) | Keyboard text → live mirror (`data` path) |
| [02-dpad-square.html](examples/02-dpad-square.html) | D-pad moves a square — keyboard or gamepad (`value` Vec) |
| [03-sliders-cube.html](examples/03-sliders-cube.html) | Sliders rotate a 3D cube — gamepad, MIDI, or on-screen (`value` scalars) |
| [04-cross-device-dpad.html](examples/04-cross-device-dpad.html) | Cross-device D-pad relay over WebSocket or BroadcastChannel |

## API

```javascript
loop.source(def)    loop.transform(def)    loop.sink(def)    loop.component(def)
loop.pipe(...stages)    loop.connect(a, b)
loop.input(name)    loop.output(name)    loop.tick(fn)
```

See [SPEC.md](SPEC.md) for the full v0.1 specification.

## MCP (AI docs)

Loop ships a docs-only MCP server so AI assistants can read the spec, README, and examples.

Install in Cursor, Claude Desktop, VS Code, Windsurf, and other MCP clients:

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

This repo is already configured via [`.cursor/mcp.json`](.cursor/mcp.json). From a clone, run `npm run build:mcp` and reload MCP in Cursor.

Resources exposed: `loop://spec`, `loop://readme`, `loop://examples/*`. Tool: `search_docs`.

## Develop

```bash
npm install
npm run build
npm run validate
```

## License

MIT
