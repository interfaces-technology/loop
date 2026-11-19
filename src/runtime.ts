import type { Pipeline } from "./pipe.js";
import { runPipeline } from "./pipe.js";
import type { Handle } from "./handle.js";

export interface TickInfo {
  /** Monotonic time in milliseconds (performance.now / Date.now). */
  readonly time: number;
  /** Milliseconds elapsed since the previous tick; 0 on the first tick. */
  readonly delta: number;
}

export type TickFn = (info: TickInfo) => void;

function now(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

function scheduleFrame(cb: (time: number) => void): number {
  if (typeof requestAnimationFrame !== "undefined") {
    return requestAnimationFrame(cb);
  }
  const id = setTimeout(() => cb(now()), 16);
  // In Node, don't let an idle frame timer keep the process alive.
  (id as { unref?: () => void }).unref?.();
  return id as unknown as number;
}

function cancelFrame(id: number): void {
  if (typeof cancelAnimationFrame !== "undefined") {
    cancelAnimationFrame(id);
  } else {
    clearTimeout(id);
  }
}

function reportTickError(scope: string, err: unknown): void {
  console.error(`[loop] ${scope} threw during tick`, err);
}

class Runtime {
  private pipelines: Set<Pipeline> = new Set();
  private tickFns: Set<TickFn> = new Set();
  private handles: Set<Handle<unknown>> = new Set();
  private rafId: number | null = null;
  private running = false;
  private lastTime = 0;

  get isRunning(): boolean {
    return this.running;
  }

  registerPipeline(pipeline: Pipeline): void {
    this.pipelines.add(pipeline);
    this.ensureRunning();
  }

  unregisterPipeline(pipeline: Pipeline): void {
    this.pipelines.delete(pipeline);
    this.maybeStop();
  }

  addTick(fn: TickFn): () => void {
    this.tickFns.add(fn);
    this.ensureRunning();
    return () => {
      this.tickFns.delete(fn);
      this.maybeStop();
    };
  }

  registerHandle(handle: Handle<unknown>): void {
    this.handles.add(handle);
    this.ensureRunning();
  }

  unregisterHandle(handle: Handle<unknown>): void {
    this.handles.delete(handle);
    this.maybeStop();
  }

  private hasWork(): boolean {
    return this.pipelines.size > 0 || this.tickFns.size > 0 || this.handles.size > 0;
  }

  private ensureRunning(): void {
    if (this.running || !this.hasWork()) return;
    this.running = true;
    this.lastTime = 0;
    this.rafId = scheduleFrame(this.tick);
  }

  private maybeStop(): void {
    if (this.running && !this.hasWork()) {
      this.stop();
    }
  }

  private tick = (): void => {
    const time = now();
    const delta = this.lastTime === 0 ? 0 : time - this.lastTime;
    this.lastTime = time;
    const info: TickInfo = { time, delta };

    for (const handle of this.handles) {
      try {
        handle._tick(info);
      } catch (err) {
        reportTickError("handle", err);
      }
    }

    for (const pipeline of this.pipelines) {
      try {
        runPipeline(pipeline.stages);
      } catch (err) {
        reportTickError(`pipeline "${pipeline.stages.map((s) => s.name).join(" → ")}"`, err);
      }
    }

    for (const fn of this.tickFns) {
      try {
        fn(info);
      } catch (err) {
        reportTickError("tick callback", err);
      }
    }

    if (!this.hasWork()) {
      this.stop();
      return;
    }

    this.rafId = scheduleFrame(this.tick);
  };

  stop(): void {
    if (this.rafId !== null) {
      cancelFrame(this.rafId);
      this.rafId = null;
    }
    this.running = false;
    this.lastTime = 0;
  }
}

let runtime: Runtime | null = null;

export function getRuntime(): Runtime {
  if (!runtime) {
    runtime = new Runtime();
  }
  return runtime;
}

export function resetRuntime(): void {
  runtime?.stop();
  runtime = null;
}

export function tick(fn: TickFn): () => void {
  return getRuntime().addTick(fn);
}
