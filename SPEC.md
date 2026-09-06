# Loop — Core Library Spec (v0.1)

**Build status:** Slices 1–3 implemented (live text, d-pad square, sliders cube). Slices 4–5 (receipt printer, smile recipe) deferred.

Scope: the core function library only — the wire, the component model, inputs, outputs, and binding. Cross-device relay, the marketplace, the AI composer, and the visual canvas are platform concerns, out of scope here (§11). Written precisely enough for an AI coding agent to build from.

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
| `data` | text, events, JSON, coordinates | tagged by `type`; shape by convention |

## 4. Component model

```typescript
type Kind = "value" | "frame" | "data";

interface SourceDef    { from: string; emits: Kind; read: (raw: unknown) => any; }
interface TransformDef { accepts: Kind | Kind[]; emits: Kind; process: (input: Packet) => Packet; }
interface SinkDef      { to: string; accepts: Kind | Kind[]; render: (input: Packet) => void; }

loop.source(def)  loop.transform(def)  loop.sink(def)
loop.component(def)   // dispatches on read/process/render
```

## 5. Pipe and type-checking

```typescript
loop.pipe(...stages)
loop.connect(a, b)   // == 2-item pipe
```

At wiring time Loop checks each adjacent pair: `emits(N)` must be in `accepts(N+1)`; for `data`, an optional `type` match. Mismatch throws at `pipe()` time, not runtime.

## 6. Value handles and binding (bind-first)

```typescript
interface Handle<T = number | Vec> {
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

## 9. Public API surface (v0.1)

```
loop.source  loop.transform  loop.sink  loop.component
loop.pipe    loop.connect
loop.input   loop.output     loop.tick
handle.value  handle.on  handle.bind
loop.layout  loop.filter  loop.capture  // stubs until slice 4+
```

ES module + TS types. Plain `<script>` tag, no build step. Offline by default.

## 10. Vertical slice (build order)

1. Live text input — `data` path via keyboard
2. D-pad moves square — `value` Vec, keyboard or gamepad
3. Sliders move/rotate cube — `value` scalars, gamepad/MIDI/on-screen fallback
4. One hardware sink — `layout("receipt")` → ESC/POS → Web Serial *(deferred)*
5. One recipe — smile → receipt prints *(deferred)*

## 11. Out of scope (non-goals for v0.1)

Cross-device relay; marketplace/publishing; AI composer; visual canvas; accounts/hosting.

## 12. Package & repo

`@interfaces-lab/loop` · repo `interfaces-technology/loop` (Interfaces Lab) · ES module + TS types, no build step, offline by default.

## 13. Open questions (resolved for v0.1)

- **Frame type:** `ImageData` for v0.1; swap to `VideoFrame` later for zero-copy.
- **`data` type registry:** convention strings (`"text"`, `"event"`); optional match at `pipe()` time.
- **Vec home:** vectors live under `value`, not `data`.
- **Default tick rate:** `requestAnimationFrame`; push via `on("change")` for discrete events.
