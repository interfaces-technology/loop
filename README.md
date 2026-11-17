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
| [05-receipt-print.html](examples/05-receipt-print.html) | Keyboard text → ESC/POS receipt printer via Web Serial (`layout("receipt")`) |
| [06-smile-receipt.html](examples/06-smile-receipt.html) | Smile scalar → threshold transform → receipt print (slider or camera) |
| [07-multi-controller.html](examples/07-multi-controller.html) | Multiple controllers organized by device identity (`loop.inputs`) |

## API

```javascript
loop.source(def)    loop.transform(def)    loop.sink(def)    loop.component(def)
loop.pipe(...stages)    loop.connect(a, b)
loop.input(name)    loop.inputs(name)    loop.output(name)    loop.layout(name)
loop.tick(fn)       // fn({ time, delta }) — delta is ms since the last tick
loop.filter(fn)     loop.capture(handle)
loop.devices(kind?)    loop.onDevices(fn)
loop.registerInput(name, factory)    loop.registerOutput(name, factory)    loop.registerLayout(name, factory)
loop.reset()
```

`loop.pipe(...).start()` returns the pipeline for chaining. Handles expose `.value`, `.on("change", fn)`, `.bind(el, apply)`, and `.dispose()`.

## Devices

When several devices feed one control — two controllers, a controller plus the keyboard — `loop.input(name)` blends them into a single value. To keep values **separated by device identity**, use `loop.inputs(name)`:

```javascript
const pads = loop.inputs("sliders");        // one bundle per device
pads.devices();                             // [{ id: "gamepad:0", ... }, { id: "gamepad:1", ... }]
pads.get("gamepad:1").rotation.value;       // Pad B's right trigger
pads.at(0).x.value;                         // first device's x

pads.each((slider, device) => {
  console.log(device.id, slider.x.value, slider.y.value);
});

loop.onDevices((devices) => console.log("devices", devices.map((d) => d.id)));
```

Device ids are stable while connected: `gamepad:0`, `gamepad:1`, `keyboard`, `midi`, `on-screen`. `loop.inputs` works for `"dpad"`, `"sliders"`, `"keyboard"`, and `"smile"`. `loop.devices(kind?)` lists connected devices across families.

See [SPEC.md](SPEC.md) for the full v0.1 specification.

## MCP (AI docs)

Loop ships a docs-only MCP server so AI assistants can read the spec, README, and examples.

**Cursor** — already configured via [`.cursor/mcp.json`](.cursor/mcp.json). Build once, then reload MCP in Cursor settings:

```bash
npm run build:mcp
```

**Other clients** (Claude Desktop, VS Code, Windsurf, etc.):

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

Resources exposed: `loop://spec`, `loop://readme`, `loop://examples/*`. Tool: `search_docs`.

## Develop

```bash
npm install
npm run build       # compile src → dist
npm run validate    # typecheck + tests
npm run dev         # build, then serve examples/
npm run watch       # rebuild on change
npm run relay       # local WebSocket relay for cross-device demos
```

## License

MIT
