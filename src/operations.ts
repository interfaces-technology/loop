import { source, transform, type Stage } from "./component.js";
import type { Handle } from "./handle.js";
import type { PacketOf, Vec } from "./types.js";

export type FilterFn = (value: number | Vec) => number | Vec;

/**
 * A `value` → `value` transform. Use it to clamp, scale, deadzone, or remap a
 * signal between a source and a sink.
 */
export function filter(fn: FilterFn): Stage {
  return transform({
    accepts: "value",
    emits: "value",
    process(packet: PacketOf<"value">): PacketOf<"value"> {
      return { kind: "value", value: fn(packet.value) };
    },
  });
}

/**
 * Bridge an existing `Handle` into a pipeline as a `value` source. Handy when
 * you already hold a handle (e.g. from `loop.input`) and want to flow it
 * through transforms and sinks.
 */
export function capture<T extends number | Vec>(handle: Handle<T>): Stage {
  return source({
    from: "capture",
    emits: "value",
    read: (): PacketOf<"value"> => ({ kind: "value", value: handle.value }),
  });
}
