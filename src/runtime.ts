import type { Pipeline } from "./pipe.js";
import { runPipeline } from "./pipe.js";
import type { Handle } from "./handle.js";

type TickFn = () => void;

function scheduleFrame(cb: FrameRequestCallback): number {
  if (typeof requestAnimationFrame !== "undefined") {
    return requestAnimationFrame(cb);
  }
  return setTimeout(() => cb(performance?.now() ?? Date.now()), 16) as unknown as number;
}

function cancelFrame(id: number): void {
  if (typeof cancelAnimationFrame !== "undefined") {
    cancelAnimationFrame(id);
  } else {
    clearTimeout(id);
  }
}

class Runtime {
  private pipelines: Set<Pipeline> = new Set();
  private tickFns: Set<TickFn> = new Set();
  private handles: Set<Handle<unknown>> = new Set();
  private rafId: number | null = null;
  private running = false;

  registerPipeline(pipeline: Pipeline): void {
    this.pipelines.add(pipeline);
    this.ensureRunning();
  }

  unregisterPipeline(pipeline: Pipeline): void {
    this.pipelines.delete(pipeline);
  }

  addTick(fn: TickFn): () => void {
    this.tickFns.add(fn);
    this.ensureRunning();
    return () => {
      this.tickFns.delete(fn);
    };
  }

  registerHandle(handle: Handle<unknown>): void {
    this.handles.add(handle);
    this.ensureRunning();
  }

  unregisterHandle(handle: Handle<unknown>): void {
    this.handles.delete(handle);
  }

  private ensureRunning(): void {
    if (!this.running && (this.pipelines.size > 0 || this.tickFns.size > 0 || this.handles.size > 0)) {
      this.running = true;
      this.tick();
    }
  }

  private tick = (): void => {
    for (const handle of this.handles) {
      handle._tick();
    }

    for (const pipeline of this.pipelines) {
      runPipeline(pipeline.stages);
    }

    for (const fn of this.tickFns) {
      fn();
    }

    this.rafId = scheduleFrame(this.tick);
  };

  stop(): void {
    if (this.rafId !== null) {
      cancelFrame(this.rafId);
      this.rafId = null;
    }
    this.running = false;
  }
}

let runtime: Runtime | null = null;

export function getRuntime(): Runtime {
  if (!runtime) {
    runtime = new Runtime();
  }
  return runtime;
}

export function tick(fn: TickFn): () => void {
  return getRuntime().addTick(fn);
}
