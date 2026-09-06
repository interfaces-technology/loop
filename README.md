# @interfaces-lab/loop

**Loop is the wire.** You author the two ends; Loop carries a normalized packet between them and never renders anything itself.

By [Interfaces Lab](https://github.com/interfaces-technology).

## Install

```bash
npm install @interfaces-lab/loop
```

Or use directly in the browser — no build step required:

```html
<script type="module">
  import loop from "./dist/index.js";
</script>
```

## Quick start

```javascript
import loop from "@interfaces-lab/loop";

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

## API

```javascript
loop.source(def)    loop.transform(def)    loop.sink(def)    loop.component(def)
loop.pipe(...stages)    loop.connect(a, b)
loop.input(name)    loop.output(name)    loop.tick(fn)
```

See [SPEC.md](SPEC.md) for the full v0.1 specification.

## Develop

```bash
npm install
npm run build
npm run validate
```

## License

MIT
