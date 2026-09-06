import { checkAdjacent, type Stage } from "./component.js";
import type { Packet } from "./types.js";
import { getRuntime } from "./runtime.js";

export interface Pipeline {
  stages: Stage[];
  start(): void;
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

  const runtime = getRuntime();

  const pipeline: Pipeline = {
    stages,
    start() {
      runtime.registerPipeline(pipeline);
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

export function runPipeline(stages: Stage[]): void {
  let packet: Packet | null = null;

  for (const stage of stages) {
    if (stage.role === "source" && stage.read) {
      packet = stage.read();
      if (packet === null) return;
    } else if (stage.role === "transform" && stage.process && packet !== null) {
      packet = stage.process(packet);
    } else if (stage.role === "sink" && stage.render && packet !== null) {
      stage.render(packet);
    }
  }
}
