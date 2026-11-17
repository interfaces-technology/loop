import { checkAdjacent, type Stage } from "./component.js";
import type { Packet } from "./types.js";
import { getRuntime } from "./runtime.js";

export interface Pipeline {
  stages: Stage[];
  start(): Pipeline;
  stop(): void;
}

export function pipe(...stages: Stage[]): Pipeline {
  if (stages.length < 1) {
    throw new Error("pipe() requires at least one stage");
  }

  for (let i = 0; i < stages.length - 1; i++) {
    const current = stages[i];
    const next = stages[i + 1];
    if (!current || !next) continue;
    checkAdjacent(current, next);
  }

  const hasSource = stages.some((s) => s?.role === "source");
  const hasSink = stages.some((s) => s?.role === "sink");
  if (!hasSource || !hasSink) {
    console.warn(
      `[loop] pipe() has no ${!hasSource ? "source" : "sink"} stage; packets will never flow through it.`,
    );
  }

  const runtime = getRuntime();

  const pipeline: Pipeline = {
    stages,
    start() {
      runtime.registerPipeline(pipeline);
      return pipeline;
    },
    stop() {
      runtime.unregisterPipeline(pipeline);
    },
  };

  return pipeline;
}

export function connect(a: Stage, b: Stage): Pipeline {
  return pipe(a, b);
}

const kindWarnings = new WeakMap<Stage, Set<string>>();

// A stage can lie about `emits` (JS callers, bad casts). Check the actual
// packet kind at runtime and drop mismatches instead of feeding them on.
function emittedKindOk(stage: Stage, packet: Packet): boolean {
  const emits = stage.emits;
  if (!emits || packet.kind === emits) return true;

  let seen = kindWarnings.get(stage);
  if (!seen) {
    seen = new Set();
    kindWarnings.set(stage, seen);
  }
  if (!seen.has(packet.kind)) {
    seen.add(packet.kind);
    console.warn(
      `[loop] Stage "${stage.name}" declared emits:"${emits}" but produced a "${packet.kind}" packet; dropping it.`,
    );
  }
  return false;
}

export function runPipeline(stages: Stage[]): void {
  let packet: Packet | null = null;

  for (const stage of stages) {
    if (stage.role === "source" && stage.read) {
      packet = stage.read();
      if (packet === null) return;
      if (!emittedKindOk(stage, packet)) return;
    } else if (stage.role === "transform" && stage.process && packet !== null) {
      packet = stage.process(packet);
      if (packet !== null && !emittedKindOk(stage, packet)) return;
    } else if (stage.role === "sink" && stage.render && packet !== null) {
      stage.render(packet);
    }
  }
}
