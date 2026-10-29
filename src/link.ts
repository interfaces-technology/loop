import { checkAdjacent, type Stage } from "./component.js";
import type { Packet } from "./types.js";
import { getRuntime } from "./runtime.js";

export interface Pipeline {
  stages: Stage[];
  start(): void;
  stop(): void;
}

export function link(...stages: Stage[]): Pipeline {
  if (stages.length < 1) {
    throw new Error("link() requires at least one stage");
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
  return link(a, b);
}

export function runPipeline(stages: Stage[]): void {
  let packet: Packet | null = null;

  for (const stage of stages) {
    if (stage.role === "source" && stage.poll) {
      packet = stage.poll();
      if (packet === null) return;
    } else if (stage.role === "transform" && stage.process && packet !== null) {
      packet = stage.process(packet);
    } else if (stage.role === "sink" && stage.draw && packet !== null) {
      stage.draw(packet);
    }
  }
}
