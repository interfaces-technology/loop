import { sink, type SinkDef, type Stage } from "./component.js";
import type { Packet } from "./types.js";

export interface RegisteredSink extends SinkDef {
  connect?: () => void | Promise<void>;
  disconnect?: () => void;
}

const registry = new Map<string, RegisteredSink>();
const outputCache = new Map<string, Stage>();
const connectedFor = new Set<string>();

export function registerSink(name: string, def: RegisteredSink): () => void {
  if (!name.trim()) throw new Error("registerSink requires a name");
  if (!def.draw) throw new Error(`registerSink("${name}") requires a draw function`);
  registry.set(name, def);
  outputCache.delete(name);
  return () => registry.delete(name);
}

export function hasSink(name: string): boolean {
  return registry.has(name);
}

export function listSinks(): string[] {
  return [...registry.keys()];
}

export function ensureConnected(name: string): void {
  if (connectedFor.has(name)) return;
  const def = registry.get(name);
  if (!def?.connect) {
    connectedFor.add(name);
    return;
  }
  connectedFor.add(name);
  Promise.resolve(def.connect()).catch((err) => {
    console.error(`loop: sink "${name}" failed to connect`, err);
  });
}

export function output(name: string): Stage {
  const cached = outputCache.get(name);
  if (cached) return cached;

  const def = registry.get(name);
  if (!def) {
    const known = listSinks().length > 0 ? listSinks().join(", ") : "(none registered)";
    throw new Error(
      `Output "${name}" has no sink adapter. Register one with loop.registerSink(` +
        `"${name}", { in, draw }). Registered sinks: ${known}`,
    );
  }

  const stage = sink({
    to: name,
    in: def.in,
    dataType: def.dataType,
    draw(packet: Packet) {
      ensureConnected(name);
      def.draw(packet);
    },
  });

  outputCache.set(name, stage);
  return stage;
}

registerSink("log", {
  to: "log",
  in: ["value", "frame", "data"],
  draw(packet) {
    switch (packet.kind) {
      case "value":
        console.log("loop.log", packet.v);
        break;
      case "data":
        console.log("loop.log", `[${packet.type}]`, packet.value);
        break;
      case "frame":
        console.log("loop.log", `[frame ${packet.frame.width}x${packet.frame.height}]`);
        break;
    }
  },
});