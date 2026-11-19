# Loop — Core Library Spec (v0.1)

**Build status:** Slices 1–5 implemented (live text, d-pad square, sliders cube, receipt printer, smile recipe), plus device-separated inputs (§8a), the ESC/POS receipt sink, the smile recipe transform, and opt-in cross-device relay transports (`loop.relay.*`, example 04).

Scope: the core function library — the wire, the component model, inputs, outputs, binding, and the relay transport primitives. The marketplace, the AI composer, a hosted relay service, and the visual canvas remain platform concerns, out of scope here (§11). Written precisely enough for an AI coding agent to build from.

**One line:** Loop is the best wire. You author the two ends; Loop carries a normalized packet between them and never renders anything itself.

## 1. Design principles (binding constraints)

- Loop only owns the wire. Never renders, never owns your framework, never looks inside your function. It samples sources, carries packets, hands values to sinks or your own code.
- Everything is a component. Source, transform, sink are the same primitive with a different method (`read`/`process`/`render`). Symmetric, composes infinitely.
- One contract on the wire. Every packet is one of three kinds — `value`, `frame`, or `data` (§3). Nothing else crosses.
- Bind-first. For software outputs, the default is a live value handle the author attaches to their own element. Sink adapters exist only for hardware (§7).
- Same-device first. v0.1 runs in one browser tab against browser + gateway APIs. No server, no accounts, offline by default. Cross-device is later a transport swap behind the same `pipe()`.
- The one-liner and the platform are the same system.

## 2. Runtime model

A single `requestAnimationFrame`-driven tick loop. Each tick: (1) sample every active source (`read` → packet); (2) flow packets through transforms (`process`); (3) deliver to sinks (`render`) and to bound value handles. Sources may also push via events. Pull is the default for render loops; push is for discrete events.

Tick callbacks and handle samplers receive a `TickInfo` of `{ time, delta }` (`delta` in ms, `0` on the first tick) so author animations are framerate-independent. The loop starts on first work and **stops itself** when there are no live pipelines, tick callbacks, or handles. A throwing stage or tick callback is reported via `console.error` and skipped — one bad component cannot kill the frame loop. Each produced packet's `kind` is checked against the stage's declared `emits`; mismatches warn once and the packet is dropped.

## 3. The wire contract

```typescript
type Vec = { x: number; y: number; z?: number };

// Structurally compatible with DOM ImageData, but not coupled to the DOM.
interface Frame { readonly width: number; readonly height: number; readonly data: Uint8ClampedArray; }

type Kind = "value" | "frame" | "data";

// PacketOf<K> maps a kind to its packet — used to type source/transform/sink payloads.
type PacketOf<K extends Kind> =
  | { kind: "value"; value: number | Vec }
  | { kind: "frame"; frame: Frame }
  | { kind: "data"; type: DataType; value: unknown };

type Packet = PacketOf<Kind>;
```

| Kind | Carries | Normalization rule |
|------|---------|-------------------|
| `value` | scalar or vector signal | scalars `0–1`; bipolar axes `−1–1`; vectors per-axis |
| `frame` | pixel buffer | resolution-independent; consumers scale/fit |
| `data` | text, events, JSON, coordinates | tagged by `type`; shape by convention |

**Wire safety.** Anything relayed across a transport is validated on receipt and capped at `MAX_WIRE_BYTES` (64 KiB). Malformed or oversized packets are dropped rather than trusted; `frame` packets are not relayed in v0.1. On the send path, unsupported/oversized/unserializable packets are dropped with a warning instead of throwing. Each transport isolates listener exceptions so one consumer cannot block delivery to the rest.

## 4. Component model

```typescript
type Kind = "value" | "frame" | "data";

// Defs are generic over their kind(s) so read/process/render payloads are typed.
interface SourceDef<E extends Kind = Kind>     { from: string; emits: E; read: () => PacketOf<E> | null; }
interface TransformDef<A extends Kind = Kind, E extends Kind = Kind> {
  accepts: A | A[]; emits: E; process: (input: PacketOf<A>) => PacketOf<E>;
}
interface SinkDef<A extends Kind = Kind>        { to: string; accepts: A | A[]; render: (input: PacketOf<A>) => void; }

loop.source(def)  loop.transform(def)  loop.sink(def)
loop.component(def)   // dispatches on read/process/render
```

## 5. Pipe and type-checking

```typescript
loop.pipe(...stages)
loop.connect(a, b)   // == 2-item pipe
```

At wiring time Loop checks each adjacent pair: `emits(N)` must be in `accepts(N+1)`; for `data`, an optional `type` match. Mismatch throws at `pipe()` time, not runtime. `pipe()` also warns when a pipeline has no `source` or no `sink` stage, since packets can never flow through it. Transforms accept an optional `name` used in diagnostics (default `"transform"`).

## 6. Value handles and binding (bind-first)

```typescript
interface Handle<T = number | Vec> {
  readonly value: T;
  on(event: "change", fn: (v: T) => void): () => void;
  bind(el: unknown, apply: (v: T, el: unknown) => void): () => void;
  dispose(): void;   // release listeners/bindings and detach from the loop
}

loop.input(name): Handle
loop.output(name): Sink
loop.tick(fn): () => void   // fn receives { time, delta }
```

## 7. Outputs: two styles, one value

- Software → bind. DOM, canvas, WebGL/three.js, p5, SVG, React state, WebAudio. You own the element; Loop feeds it a value. No adapter.
- Hardware → sink adapter. Printer, lights, motors, BLE. No existing element, so Loop provides a sink that turns a packet into device bytes.

## 8. Inputs: catalog + normalization conventions

| Input family | Emits | Convention |
|-------------|-------|------------|
| Directional/axis (stick, D-pad, WASD) | `value` (Vec) | `−1–1` per axis |
| Continuous scalar (mic, tilt, light, smile) | `value` (num) | `0–1` |
| Positional (mouse) | `value` (Vec) | `0–1`, viewport-normalized |
| Buttons/triggers | `value` (num) | `0–1` |
| Text/speech/API/events | `data` | tagged by `type` |
| Camera/tracking | `frame` (+ optional `data`) | resolution-independent |

### 8a. Device identity (separating values)

A source may be fed by more than one physical device at once — two controllers, a controller plus the keyboard. `loop.input(name)` blends every contributor into one handle and is the right default for a single operator. When contributors must stay apart, `loop.inputs(name)` returns a **`DeviceSet`**: one handle per device, addressed by a stable id.

```typescript
interface Device { id: string; kind: string; index: number; label: string; }

interface DeviceSet<T> {
  name: string;
  devices(): Device[];
  get(id: string): T | undefined;       // "gamepad:1"
  at(index: number): T | undefined;     // ordinal within its family
  values(): T[];
  entries(): Array<{ device: Device; value: T }>;
  each(fn: (value: T, device: Device) => void): void;
  on(event: "change", fn: (devices: Device[]) => void): () => void;
}

loop.inputs("dpad" | "sliders" | "keyboard" | "smile"): DeviceSet<T>
loop.devices(kind?: string): Device[]
loop.onDevices(fn: (devices: Device[]) => void): () => void
```

- Device ids are stable while connected: `gamepad:0`, `gamepad:1`, `keyboard`, `midi`, `on-screen`.
- One owner per family keeps identity honest: a hub polls gamepads, syncs the registry's connected set, and notifies lane owners on arrival/removal, so every preset agrees on which physical pad is `gamepad:1`.
- Separation is additive, not a merge policy — Loop never decides how two devices combine. That choice belongs to the application (sum, priority, last-wins).

## 9. Public API surface (v0.1)

```
loop.source  loop.transform  loop.sink  loop.component
loop.pipe    loop.connect
loop.input   loop.inputs     loop.output     loop.tick     loop.initMidi
loop.devices  loop.onDevices
handle.value  handle.on  handle.bind  handle.dispose
loop.layout  loop.filter  loop.capture
loop.registerInput  loop.registerOutput  loop.registerLayout
loop.reset
```

Advanced surface (exported for recipes, tests, and embeds):

```
loop.getSlidersInput  loop.resolveInput
loop.getDpadActiveDevice  loop.getSlidersActiveDevice  loop.setSlidersActiveDevice
loop.setSmileSampler  loop.createSmilePrintTransform
loop.relay.room  loop.relay.broadcastTransport  loop.relay.websocketTransport
loop.relay.memoryTransport  loop.relay.clear
getDeviceRegistry            // named export
```

- `loop.filter(fn)` — a `value` → `value` transform for clamp/scale/remap.
- `loop.capture(handle)` — bridge an existing `Handle` into a pipeline as a `value` source.
- `loop.register*` — extend inputs, outputs, and layouts without forking; custom names also work through `loop.inputs(name)` as a single-device `DeviceSet`.
- `loop.inputs(name)` / `loop.devices()` — read inputs separated by device identity (§8a).
- `loop.initMidi()` — explicit MIDI activation; reading `input("sliders")` never triggers the permission prompt.
- `loop.reset()` — tear down every singleton (relay rooms, layouts, inputs, devices, frame loop); used by tests and embeds.
- `loop.relay.*` — cross-device pub/sub rooms over BroadcastChannel, WebSocket, or in-memory transports (§11 note: relay ships in v0.1 as an opt-in transport, not a platform service).

ES module + TS types. Plain `<script>` tag, no build step. Offline by default.

## 10. Vertical slice (build order)

1. Live text input — `data` path via keyboard
2. D-pad moves square — `value` Vec, keyboard or gamepad
3. Sliders move/rotate cube — `value` scalars, gamepad/MIDI/on-screen fallback
4. One hardware sink — `layout("receipt")` → ESC/POS → Web Serial
5. One recipe — smile → receipt prints

## 11. Out of scope (non-goals)

Marketplace/publishing; AI composer; visual canvas; accounts/hosting; a hosted relay service. Cross-device relay itself ships in the library (`loop.relay.*` + BroadcastChannel/WebSocket/in-memory transports, `scripts/relay-server.mjs` for demos) — only the managed service is out of scope.

## 12. Package & repo

`@theinterfaces-lab/loop` · repo `interfaces-technology/loop` (Interfaces Lab) · ES module + TS types, no build step, offline by default.

## 13. Open questions (resolved for v0.1)

- **Frame type:** structural `Frame` (`width`/`height`/`data`), assignable from `ImageData`; swap to `VideoFrame` later for zero-copy.
- **`data` type registry:** convention strings (`"text"`, `"event"`, custom strings allowed); optional match at `pipe()` time.
- **Vec home:** vectors live under `value`, not `data`.
- **Default tick rate:** `requestAnimationFrame` (with `{ time, delta }`); push via `on("change")` for discrete events.
- **Transport reliability:** the WebSocket transport buffers the newest packet while offline and reconnects with capped exponential backoff.
- **Unresolved:** a `createLoop()` instance factory (isolated runtimes) — v0.1 remains a single shared runtime with `loop.reset()`.
