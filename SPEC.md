# Loop — Spec (v0.3)

**Build status:** v0.1 core wire (slices 1–3) done: live text, d-pad square, sliders cube, cross-device relay. v0.2 re-positions Loop as a public API: static examples removed, a DOM control kit shipped (`dial`, `dpad`, `slider`, `button`, `keypad`, `rotate`), a hardware-sink registry landed (`registerSink`/`output`), subpath exports for wire + kit, relay over the internet documented. v0.3 completes the end-to-end story: ready-made recipes (`toNumber`, `toText`, `clamp`), the `"receipt"` device driver (ESC/POS encoder + Web Serial adapter, capture by default), and online-first relay ergonomics (`room.broadcast`, `loop.relay.online`). Slices 5–9 shipped.

Scope: the library — the wire, the value handles, the on-screen control kit, and network transports. Receipt printers, screens, and other hardware sinks are a registered interface (v0.3). The marketplace, AI composer, and visual canvas remain platform concerns, out of scope.

**One line:** Loop is the wire. You author the two ends; Loop carries a normalized packet between them and never renders anything itself.

## 1. Design principles (binding constraints)

- Loop only owns the wire. Never renders, never owns your framework, never looks inside your function. It samples sources, carries packets, hands values to sinks or your own code.
- Everything is a component. Source, transform, sink are the same primitive with a different method (`read`/`process`/`render`). Symmetric, composes infinitely.
- One contract on the wire. Every packet is one of three kinds — `value`, `frame`, or `data` (§3). Nothing else crosses. Numbers, vectors, text, and booleans all ride these.
- Bind-first. For software outputs, the default is a live value handle the author attaches to their own element. Sink adapters exist only for hardware (§7).
- The kit is optional sugar, not the wire. The on-screen controls live behind `@theinterfaces-lab/loop/kit` and emit ordinary `Handle`s — you can swap them for your own visuals with zero changes downstream.
- Same-device first, internet as a transport swap. A room code is the same abstraction locally (BroadcastChannel) and globally (WebSocket).
- The one-liner and the platform are the same system.

## 2. Runtime model

A single `requestAnimationFrame`-driven tick loop. Each tick: (1) sample every active source (`read` → packet); (2) flow packets through transforms (`process`); (3) deliver to sinks (`render`) and to bound value handles. Sources may also push via events. Pull is the default for render loops; push is for discrete events. Kit controls are event-driven (pointer/keys) and push via `Handle._setValue`.

## 3. The wire contract

```typescript
type Vec = { x: number; y: number; z?: number };

type Packet =
  | { kind: "value"; value: number | Vec }
  | { kind: "frame"; frame: ImageData }
  | { kind: "data"; type: string; value: unknown };
```

| Kind | Carries | Normalization rule |
|------|---------|-------------------|
| `value` | scalar or vector signal | scalars `0–1`; bipolar axes `−1–1`; vectors per-axis |
| `frame` | pixel buffer | resolution-independent; consumers scale/fit |
| `data` | text, numbers, booleans, JSON, events, coordinates | tagged by `type`; shape by convention |

Data type registry (convention strings, matched at `pipe()` time when both sides declare it):

- `"text"` — free-form strings (keyboard, keypad entries)
- `"number"` — numbers that aren't normalized signal values (parsed text→number, API responses)
- `"boolean"` — true/false (toggles, permissions, presence)
- `"json"` — structured payloads
- `"event"` — discrete one-shot events (tap, shake, keypress)

## 4. Component model

```typescript
interface SourceDef    { from: string; emits: Kind; dataType?: string; read: () => Packet | null; }
interface TransformDef { accepts: Kind | Kind[]; emits: Kind; dataType?: string; process: (input: Packet) => Packet; }
interface SinkDef      { to: string; accepts: Kind | Kind[]; dataType?: string; render: (input: Packet) => void; }

loop.source(def)  loop.transform(def)  loop.sink(def)
loop.component(def)   // dispatches on read/process/render
```

## 5. Pipe and type-checking

```typescript
loop.pipe(...stages)
loop.connect(a, b)   // == 2-item pipe
```

At wiring time Loop checks each adjacent pair: `emits(N)` must be in `accepts(N+1)`; for `data`, an optional `type` match. Transforms that convert between data types declare an `acceptsType` (what they consume) alongside `dataType` (what they emit), keeping the check symmetric — a text-emitting source is rejected before a `toNumber()` transform that expects `acceptsType: "text"` and emits `dataType: "number"`. Mismatch throws at `pipe()` time, not runtime.

## 6. Value handles and binding (bind-first)

```typescript
interface Handle<T = number | Vec | string> {
  readonly value: T;
  on(event: "change", fn: (v: T) => void): () => void;
  bind(el: unknown, apply: (v: T, el: unknown) => void): () => void;
}

loop.input(name): Handle
loop.output(name): Sink
loop.tick(fn): () => void
```

## 7. Outputs: two styles, one value

- Software → bind. DOM, canvas, WebGL/three.js, p5, SVG, React state, WebAudio. You own the element; Loop feeds it a value. No adapter.
- Everything else → sink adapter via the **sink registry** (v0.2):

  ```typescript
  interface RegisteredSink extends SinkDef {
    connect?: () => void | Promise<void>;   // open the port / device once
    disconnect?: () => void;
  }

  loop.registerSink(name, def)   // returns an unregister fn
  loop.hasSink(name): boolean
  loop.listSinks(): string[]
  loop.output(name): Stage      // pipe stage; throws a helpful error if unregistered
  ```

  `output()` is a plain `sink`, so registered hardware behaves identically locally and over the wire. `connect()` is called once, lazily, before the first render; adapters buffer until connected. Built-in sinks: `loop.output("log")`, `loop.output("receipt")` — `"receipt"` is registered at index time from the shared capture-mode instance, so it needs zero setup. Anything else a user registers; unregistered names throw a helpful "register one with `loop.registerSink(...)`" error.

## 7a. Declarative element helpers (kit, v0.2)

Beyond building controls, the kit lets the author attach wire handles to *arbitrary* elements:

- `rotate(el, { min?, max?, steps?, initial? })` — makes `el` rotatable by dragging around its center; emits **degrees** (0–360 default) as a `Handle<number>`, live-applies `el.style.rotate`, snaps when `steps` is set, keyboard-nudgeable.
- All stamped controls (`dial`, `slider`, `dpad`, `button`, `keypad`) accept a raw element as their first argument — `dial(div)` is a div that is a dial.

## 7b. Recipes & devices (v0.3)

Ready-made transforms under `loop.recipes` — pure, composable, and type-safe in a pipe:

```typescript
loop.recipes.toNumber(): TransformDef   // data:"text" -> data:"number"; drops non-numeric (null)
loop.recipes.toText({ precision? }):     // data:"number" -> data:"text" ("12.50")
loop.recipes.clamp(min, max):            // value -> value, clamped per axis for Vec
```

Transforms reject what they can't convert by returning `null` (which drops the packet from the pipe) and pass unrelated kinds through untouched.

Devices under `loop.devices` turn packets into real-world effects. `receipt` is a line-buffered receipt printer:

```typescript
loop.devices.receipt({ transport?, onJob? }): ReceiptPrinter
//   { transport: "capture" | "serial", onJob: (bytes, lines) => void }
//   .sink  — a RegisteredSink; the shared instance backs the built-in "receipt" output
//   .jobs  — every completed receipt as string[][] (capture mode / always readable)
//   .clear()

loop.output("receipt"): Stage           // built in, works headlessly in capture mode
```

Loop feeds it lines (`data:"text"` or `data:"number"`); a `data:"cut"` (or `"job-end"`) packet closes the document, flushes the job, and advances the paper. `transport: "serial"` opens a `navigator.serial` port (9600 baud) and streams ESC/POS bytes; without Web Serial it degrades to capture, so the whole pipeline stays testable. The raw ESC/POS encoder (`encodeReceipt`, `escposText`, `escposFeed`, `escposCut`, `escposInit`) is exported for custom serial drivers.

## 8. Inputs: catalog + normalization conventions

| Input family | Emits | Convention |
|-------------|-------|------------|
| Directional/axis (stick, D-pad, WASD) | `value` (Vec) | `−1–1` per axis |
| Continuous scalar (mic, tilt, light, smile) | `value` (num) | `0–1` |
| Positional (mouse) | `value` (Vec) | `0–1`, viewport-normalized |
| Buttons/triggers | `value` (num) | `0–1` |
| Text/speech/API/events | `data` | tagged by `type` (see registry, §3) |
| Camera/tracking | `frame` (+ optional `data`) | resolution-independent |

## 9. The kit — DOM controls (v0.2)

Lives in `src/kit`, exported at `@theinterfaces-lab/loop/kit`. Each control:

```typescript
interface KitControl<T> {
  el: HTMLElement;
  value: Handle<T>;
  destroy(): void;
}
```

| Control | Signature | Emits | Interaction |
|---------|-----------|-------|-------------|
| `dial` | `dial({ size?, initial?, label?, parent? })` | `value` `number` 0–1 | 270° pointer sweep, wheel, arrow keys |
| `dpad` | `dpad({ cell?, keyboard?, parent? })` | `value` `Vec` −1–1 | touch buttons + optional arrow/WASD mirror |
| `slider` | `slider({ axis?, size?, initial?, parent? })` | `value` `number` 0–1 | drag/click, arrow keys |
| `button` | `button({ label?, toggle?, initial?, parent? })` | `value` `number` 0/1 | momentary or sticky |
| `keypad` | `keypad({ digits?, initial?, parent? })` | `data` `text` | tap entry; `.clear()` `.backspace()` |
| `rotate` | `rotate(el, { min?, max?, steps?, initial? })` | `value` `number` degrees | drag element by its center, wheel/keys |

Every control also accepts a raw element as its first argument (e.g. `dial(div)`, `slider(div, { axis: "y" })`) — see §7a.

Design rules for the kit:

- Pure DOM + inline CSS. No dependencies, no stylesheet assets, no SVG required (dials are divs + `conic-gradient`).
- A shared dark palette as CSS-variable-friendly constants. Every control adopts a `parent` element if supplied (so `dial(yourDiv)` makes that div a dial).
- Astronomy for accessibility: `tabIndex`, `role="slider"` + `aria-valuenow` on the dial, `aria-pressed` on buttons, keyboard operability everywhere (wheel, arrows, space/enter).
- The kit is *not* part of the wire. It only ever produces `Handle`s — therefore trivially swappable for custom designs, and usable headlessly (tests run without a real browser).

## 10. Network transports (v0.2)

```typescript
interface Transport {
  readonly status: TransportStatus;           // idle | connecting | connected | disconnected | error
  connect(): Promise<void>;
  disconnect(): void;
  send(packet: Packet): void;
  onPacket(fn: (packet: Packet) => void): () => void;
  onStatus(fn: (status: TransportStatus) => void): () => void;
}

loop.relay.room(code, transport?)                   // BroadcastChannel by default (same device/tabs)
loop.relay.online(url, code)                        // WebSocket room over the internet (v0.3)
loop.relay.websocketTransport(url, code)            // internet relay
loop.relay.broadcastTransport(code)                 // local relay
loop.relay.memoryTransport(code)                    // in-process (tests, one page)
```

Room API: `connect()`, `disconnect()`, `outbound({ accepts })` and `inbound({ emits })` as pipe stages, `subscribe(initial)` → remote `Handle`, `publish(getPacket)` → send the sampled packet each tick, `broadcast(handle)` → stream a local handle's changes out (strings become `data:"text"`), `onStatus(fn)`.

Serialization: packets become compact JSON text (§3 `data` and `value` only; `frame` rejected with a clear error). Text and numbers move unchanged — same bytes locally and globally.

## 11. Vertical slices (build order)

1. ~~Live text input~~ — `data` path via keyboard *(done)*
2. ~~D-pad moves square~~ — `value` Vec, keyboard/gamepad *(done)*
3. ~~Sliders move/rotate cube~~ — `value` scalars *(done)*
4. ~~Cross-device relay~~ — packets across tabs/network *(done, v0.1)*
5. Kit controls — dial, dpad, slider, button, keypad *(done, v0.2)*
6. Element helpers + sink registry — `rotate(el)`, element-overloaded controls, `registerSink`/`output` *(done, v0.2)*
7. End-to-end experience recipe: keyboard + kitchen keypad → number → bound UI → printed output *(done, v0.3 — `loop.recipes.toNumber/toText`, `loop.devices.receipt`, `loop.output("receipt")`)*
8. One hardware driver — `loop.output("receipt")` → ESC/POS → Web Serial *(done, v0.3; serial is browser/capability-gated, capture by default)*
9. Online-first recipe: phone control room + desktop display room over WebSocket relay *(done, v0.3 — `loop.relay.online`, `room.broadcast`)*

## 12. Package & repo

`@theinterfaces-lab/loop` · repo `interfaces-technology/loop` (Interfaces Lab) · ES module + TS types, no build step, offline by default.

Exports:

- `.` — the wire: `loop.source/transform/sink/component/pipe/connect/input/output/tick`,
  `loop.registerSink/hasSink/listSinks`, `loop.recipes.*`, `loop.devices.*`, `loop.relay.*` (named exports too: `toNumber`, `toText`, `clamp`, `receipt`, `online`, …)
- `./kit` — controls (`dial`, `dpad`, `slider`, `button`, `keypad`, `rotate`), math helpers

## 13. Out of scope (non-goals)

Marketplace/publishing; AI composer; visual canvas; accounts/hosting (relay is BYO-server via the included script); frame relay over the network until `VideoFrame` swap.

## 14. Open questions

- **Frame type:** `ImageData` for v0.1/0.2; swap to `VideoFrame` later for zero-copy.
- **Kit theming:** expose the palette as overridable CSS custom properties in v0.4 rather than hardcoded tokens.
- **`rotate` normalization:** emits raw degrees today; revisit emitting normalized turns if it proves harder to pipeline (rectify can be a one-line `transform`).
- **`toText` formatting:** default fixed-precision; consider a locale/units option (`toText({ precision })` covers the printed-receipt path for now).