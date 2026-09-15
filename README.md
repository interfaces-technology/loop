# @theinterfaces-lab/loop

**Loop is the wire.** You author the two ends — an input, an output, or the whole experience — and Loop carries one normalized packet between them. It never renders anything itself, which means the same wire works on a div, a canvas, a phone on the other side of the internet, or a receipt printer.

By [Interfaces Lab](https://github.com/interfaces-technology).

## Install

```bash
npm install @theinterfaces-lab/loop
```

Or directly in the browser — no build step required:

```html
<script type="module">
  import loop from "./dist/index.js";
  import { dial } from "./dist/kit/index.js";
</script>
```

## What Loop is

Three primitives, one packet.

| Primitive | Role |
|-----------|------|
| `loop.source(def)` | produces packets (`read`) |
| `loop.transform(def)` | reshapes packets (`process`) |
| `loop.sink(def)` | consumes packets (`render`) |

Every packet on the wire is one of three kinds — and that's all that ever crosses:

- `value` — a **number** (0–1, bipolar −1–1) or a vector `{x, y, z?}`
- `data` — tagged **text, numbers, booleans, JSON** (`{ kind, type, value }`), e.g. `{ kind: "data", type: "text", value: "hello" }`
- `frame` — a pixel buffer

Wiring them together is `loop.pipe(...)`. Types are checked at wiring time, not at runtime. Transforms that convert between data types declare what they accept too (`acceptsType`) so the check stays symmetric:

```js
import loop from "@theinterfaces-lab/loop";

loop.pipe(
  loop.source({
    from: "temperature",
    emits: "value",
    read: () => ({ kind: "value", value: 0.6 }),
  }),
  loop.sink({
    to: "element",
    accepts: "value",
    render: ({ value }) => (bar.style.width = `${value * 100}%`),
  }),
).start();
```

## Bind a value to your UI

The fastest path is a `Handle` — a live value you can read, listen to, and bind:

```js
const dpad = loop.input("dpad"); // keyboard (arrows/WASD) or gamepad
const rot = loop.input("sliders").rotation; // gamepad trigger / MIDI CC

loop.tick(() => {
  el.style.transform = `translate(${dpad.value.x * 40}px, ${dpad.value.y * 40}px)
                        rotate(${rot.value * 360}deg)`;
});
```

API: `loop.input(name)`, `loop.output(name)`, `loop.tick(fn)`, and on every handle: `.value`, `.on("change", fn)`, `.bind(el, apply)`.

## The kit — beautiful controls you can grab and pipe

`@theinterfaces-lab/loop/kit` ships a small set of pretty, dependency-free DOM controls — visual vectors made of divs. Take them as-is for a prototype, or copy one into your project and redesign it. Every control returns `{ el, value }`, where `value` is a wire `Handle` — so a dial's output pipes exactly like a gamepad's.

```js
import { dial, dpad, slider, button, keypad } from "@theinterfaces-lab/loop/kit";

const d = dial(); // a rotary dial
const pad = dpad(); // an on-screen cross, keyboard-mirroring works too
const s = slider({ axis: "y" }); // or "x"
const b = button({ label: "print", toggle: true });
const k = keypad(); // tap-to-enter numbers, like a phone
```

`d.value` is a live 0–1 number. Move the dial and watch it happen:

```js
d.value.bind(el, (v, el) => (el.style.rotate = `${v * 270}deg`));
```

Drop them into a pipe, same as anything else:

```js
loop.pipe(
  loop.source({ from: "dial", emits: "value", read: () => ({ kind: "value", value: d.value.value }) }),
  loop.sink({ to: "log", accepts: "value", render: (p) => console.log(p.value) }),
);
```

### Make *your* elements controllable

Each control adopts an existing element when you pass it as the first argument — `dial(yourDiv)` makes that div a dial, `slider(yourMeter, { axis: "y" })` the same. And when you want an element to *move*, grab `rotate`:

```js
const rot = rotate(gearEl);        // drag to spin the gear; it spins live, emits degrees
rot.value.bind(needleEl, (deg, el) => (el.style.rotate = `${deg}deg`));

const volume = dial(volumeKnob);   // your div IS the knob, emits 0–1
```

The kit is meant to be swappable — design your own interface, then hand Loop the same `Handle`:

```js
const myDial = dial(document.getElementById("my-knob"));
loop.pipe(myDialAsSource, ...); // whatever you build
```

### Kit reference

| Control | Emits | Interaction |
|---------|-------|-------------|
| `dial({ size, initial })` | `number` 0–1 | pointer drag (270° sweep), scroll wheel, arrow keys |
| `dpad({ cell, keyboard })` | `Vec` {x,y} −1–1 | on-screen touch + optional keyboard mirror |
| `slider({ axis, size, initial })` | `number` 0–1 | drag/click, arrow keys |
| `button({ label, toggle, initial })` | `number` 0/1 | momentary or sticky toggle |
| `keypad({ digits })` | `string` | tap digits; `.clear()`, `.backspace()` |
| `rotate(el, { min, max, steps })` | `number` degrees | drag any element around its center; snap with `steps` |

Every control: `control.el` (the DOM node), `control.value` (the `Handle`), `control.destroy()`. All five stamped controls accept a raw element as the first argument (e.g. `dial(div)`, `slider(div, opts)`).

## Move packets across the internet

The same packets travel anywhere. Local devices use broadcast; the world uses WebSocket. Either way the API is identical — a room code.

```js
const room = loop.relay.room("my-experience"); // BroadcastChannel (local)

// or over the internet:
const room = loop.relay.room("my-experience", loop.relay.websocketTransport("wss://my-relay.example.com", "my-experience"));
await room.connect();

// one side publishes the latest packet every tick
room.publish(() => ({ kind: "value", value: { x: 1, y: 0 } }));

// another side subscribes and binds
const remote = room.subscribe({ x: 0, y: 0 });
remote.bind(el, (v, el) => (el.style.translate = `${v.x * 50}px ${v.y * 50}px`));
```

Run the included relay to bridge the internet:

```bash
npm run relay        # ws://localhost:8787/ROOM_CODE
```

Two one-liners make a remote experience. A phone controls, a desktop displays:

```js
// phone side — pipe the dial straight out to the room code
const room = loop.relay.online("wss://my-relay.example.com", "solar-panel");
await room.connect();
room.broadcast(dial.value);          // streams the dial's changes out as value packets

// desktop side — bind what arrives to the UI
const meter = room.subscribe(0);
meter.bind(needleEl, (v, el) => (el.style.rotate = `${v * 270}deg`));
```

`room.broadcast(handle)` pushes a local handle's changes to the room (strings become `data:"text"` packets); `room.subscribe(initial)` streams the latest value back. Both sides speak the same packet, so the phone's dial and the kitchen's keypad can drive the same display.

OK, take stock: phone + laptop join `"solar-panel"`. The dial on the phone travels as a value packet over the WebSocket, the laptop binds it to a needle — and with the receipt printer below, that number can print.

## Recipes — turning text into numbers (and back)

Half of "type a number, bind to a UI" is parsing. `loop.recipes` ships ready-made transforms so you don't hand-roll `Number(value)` in a `process`:

```js
const n = loop.recipes.toNumber();  // data:"text" -> data:"number" (drops non-numeric)
const t = loop.recipes.toText();    // data:"number" -> data:"text" ("3.75")
const v = loop.recipes.clamp(0, 1); // value -> value, clamped to a range
```

They drop (null) packets they can't convert, pass other kinds through untouched, and type-check in a pipe:

```js
loop.pipe(
  keypadSource,                  // emits data:"text"
  loop.recipes.toNumber(),       // text -> number; acceptsType/text, dataType/number
  loop.output("receipt"),
).start();
```

## Devices — the receipt printer

The end goal, done: type a number, tap it on a phone, bind to a UI, *print the UI.* The `"receipt"` sink is built in and works out of the box.

```js
loop.pipe(
  keypadSource,                // "12345" as data:"text"
  loop.recipes.toNumber(),     // -> 12345
  loop.output("receipt"),      // buffers lines; flushes a job on a cut packet
).start();
```

Lines arrive, a document ends. Send `{ kind: "data", type: "cut", value: "" }` to close the receipt — the adapter flushes the job and advances the paper:

```js
loop.pipe(
  loop.source({ from: "tick", emits: "data", dataType: "text",
                read: () => ({ kind: "data", type: "cut", value: "" }) }),
  loop.output("receipt"),       // closes the current receipt (browser-side timer, button, etc.)
).start();
```

Captured jobs are readable right in the docs-dev experience:

```js
const printer = loop.devices.receipt();   // the shared instance behind "receipt"
printer.jobs;                             // [["hello", "world"], ...] — every finished receipt
printer.clear();

// or build your own adapter instance:
const myPrinter = loop.devices.receipt({
  transport: "serial",                    // requires Web Serial (browser, user gesture)
  onJob: (bytes, lines) => writeToMyThing(bytes),  // ESC/POS bytes; always called
});
loop.registerSink("receipt", myPrinter.sink);      // re-register to swap in hardware
```

Wired up to real hardware, `transport: "serial"` opens a `navigator.serial` port at 9600 baud and streams ESC/POS bytes. Without a browser it degrades to capture, keeping receipts in `jobs` so the whole pipeline stays testable. The ESC/POS encoder (`encodeReceipt`, `escposText`, …) is exported too, so you can stream bytes to any serial device yourself.

## One packet, every device

Values are numbers, vectors, text, and booleans. The wire doesn't care who's holding it:

- keyboards, gamepads, MIDI → `loop.input("keyboard" | "dpad" | "sliders")`
- screens, DOM, canvas, WebAudio → bind a handle
- **printers, displays, serial devices** → `loop.output("receipt")` is built in; register anything else with `loop.registerSink`

That's the end goal — *type a number on a keyboard, tap it on a phone, bind to a UI, print the UI.* Every hop is the same packet.

## Plug anything in — the sink registry

A sink turns packets into real-world effects. The registry is how anyone wires Loop to anything — a screen, a light strip, a robot, a receipt printer. Register an adapter, then `loop.output(name)` returns a regular pipe stage:

```js
loop.registerSink("receipt", loop.devices.receipt().sink);

loop.pipe(
  keypadSource,                 // taps travel as data:"text"
  loop.recipes.toNumber(),      // "1234" -> a number
  loop.output("receipt"),
).start();
```

`loop.listSinks()` lists registered adapters; `loop.hasSink(name)` checks one. Everything already importing `loop.output("log")` (the built-in logger) works out of the box. Because `output()` is just a `sink`, registered hardware behaves identically locally and over the wire.

## API surface

```
Wire:        loop.source  loop.transform  loop.sink  loop.component
             loop.pipe    loop.connect
Handles:     loop.input   loop.output   loop.tick
             handle.value  handle.on  handle.bind
Sinks:       loop.registerSink  loop.hasSink  loop.listSinks
Recipes:     loop.recipes.toNumber  loop.recipes.toText  loop.recipes.clamp
Devices:     loop.devices.receipt({ transport, onJob })
             loop.output("receipt")  loop.output("log")
Inputs:      loop.input("keyboard")  loop.input("dpad")
             loop.input("sliders").x/.y/.rotation
Network:     loop.relay.room  loop.relay.online(url, code)
             loop.relay.websocketTransport  loop.relay.broadcastTransport
             loop.relay.memoryTransport
Relay room:  room.connect  room.disconnect  room.subscribe  room.publish
             room.broadcast(handle)  room.onStatus
Kit:         import { dial, dpad, slider, button, keypad, rotate }
             from "@theinterfaces-lab/loop/kit"
```

See [SPEC.md](SPEC.md) for the full spec and roadmap.

## Develop

```bash
npm install
npm run build
npm run validate
```

## License

MIT