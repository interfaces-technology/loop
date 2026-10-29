# Changelog

## 0.4.0 — API cleanup ahead of 1.0

Uniform verbs and a tighter wire vocabulary. All renames; no behavior changes.

- `loop.pipe(...)` → `loop.link(...)` (the implementation moved to `link.ts`)
- SourceDef `read` → `poll`; SinkDef `render` → `draw`
- `emits`/`accepts` → `out`/`in` (`acceptsType` → `inType`)
- Value packet payload `value` → `v` (`{ kind: "value", v: 0.5 }`)
- `./kit` subpath → `./controls`
- `loop.recipes.*` → `@theinterfaces-lab/loop/recipes` subpath
- `loop.devices.*` / `receipt` → `@theinterfaces-lab/loop/devices` subpath
- Named exports `toNumber`, `toText`, `clamp`, `receipt`, `ToTextOptions`, `ReceiptOptions`, `ReceiptPrinter` removed from the root — import from the subpaths
