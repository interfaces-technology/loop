import { describe, it, expect, beforeEach, vi } from "vitest";
import { source, sink } from "../src/component.js";
import { pipe, runPipeline } from "../src/pipe.js";
import { room, clearRelayRooms } from "../src/relay.js";
import { memoryTransport } from "../src/transport/memory.js";
import { clearMemoryTransports } from "../src/transport/memory.js";
import { serializePacket, deserializePacket, payloadToJsonText } from "../src/transport/serialize.js";

describe("packet serialization", () => {
  it("round-trips value scalars", () => {
    const packet = { kind: "value" as const, value: 0.75 };
    expect(deserializePacket(serializePacket(packet)!)).toEqual(packet);
  });

  it("round-trips value vectors", () => {
    const packet = { kind: "value" as const, value: { x: -1, y: 0.5 } };
    expect(deserializePacket(serializePacket(packet)!)).toEqual(packet);
  });

  it("round-trips data packets", () => {
    const packet = { kind: "data" as const, type: "text", value: "hello" };
    expect(deserializePacket(serializePacket(packet)!)).toEqual(packet);
  });

  it("drops frame packets", () => {
    const frame = { width: 1, height: 1, data: new Uint8ClampedArray(4) } as ImageData;
    expect(serializePacket({ kind: "frame", frame })).toBeNull();
  });

  it("decodes ArrayBuffer and typed-array payloads as JSON text", () => {
    const packet = { kind: "value" as const, value: { x: 1, y: -0.5 } };
    const json = serializePacket(packet)!;
    const bytes = new TextEncoder().encode(json);

    expect(deserializePacket(payloadToJsonText(bytes.buffer))).toEqual(packet);
    expect(deserializePacket(payloadToJsonText(bytes))).toEqual(packet);
  });
});

describe("cross-device relay", () => {
  beforeEach(() => {
    clearRelayRooms();
    clearMemoryTransports();
  });

  it("relays value packets between rooms on a shared transport", async () => {
    const transport = memoryTransport("demo");
    const sender = room("demo", transport);
    const receiver = room("demo", transport);

    await sender.connect();
    await receiver.connect();

    const results: unknown[] = [];

    const pipeline = pipe(
      source({
        from: "test",
        emits: "value",
        read: () => ({ kind: "value", value: { x: 1, y: -1 } }),
      }),
      sender.outbound({ accepts: "value" }),
    );

    runPipeline(pipeline.stages);

    receiver.subscribe({ x: 0, y: 0 });
    transport.send({ kind: "value", value: { x: 1, y: -1 } });

    const inbound = receiver.inbound({ emits: "value" });
    const packet = inbound.read?.();
    if (packet?.kind === "value") {
      results.push(packet.value);
    }

    expect(results[0]).toEqual({ x: 1, y: -1 });
  });

  it("wires outbound and inbound stages through pipe type-checking", async () => {
    const transport = memoryTransport("pipe-demo");
    const sender = room("pipe-demo", transport);
    const receiver = room("pipe-demo", transport);

    await sender.connect();
    await receiver.connect();

    const outbound = pipe(
      source({
        from: "test",
        emits: "value",
        read: () => ({ kind: "value", value: 0.42 }),
      }),
      sender.outbound({ accepts: "value" }),
    );

    const results: unknown[] = [];
    const inbound = pipe(
      receiver.inbound({ emits: "value" }),
      sink({
        to: "log",
        accepts: "value",
        render: (p) => {
          if (p.kind === "value") results.push(p.value);
        },
      }),
    );

    runPipeline(outbound.stages);
    runPipeline(inbound.stages);

    expect(results).toEqual([0.42]);
  });

  it("stops delivering to a handle after dispose", async () => {
    const transport = memoryTransport("dispose-demo");
    const receiver = room("dispose-demo", transport);
    await receiver.connect();

    const remote = receiver.subscribe({ x: 0, y: 0 });
    transport.send({ kind: "value", value: { x: 1, y: 1 } });
    expect(remote.value).toEqual({ x: 1, y: 1 });

    remote.dispose();
    transport.send({ kind: "value", value: { x: 2, y: 2 } });
    expect(remote.value).toEqual({ x: 1, y: 1 });
  });

  it("emits each inbound packet once instead of every tick", async () => {
    const transport = memoryTransport("dedup-demo");
    const receiver = room("dedup-demo", transport);
    await receiver.connect();

    const inbound = receiver.inbound({ emits: "value" });
    const inbound2 = receiver.inbound({ emits: "value" });

    transport.send({ kind: "value", value: 1 });
    transport.send({ kind: "value", value: 2 });

    // Only the newest packet is delivered; packets between ticks coalesce.
    expect(inbound.read?.()).toEqual({ kind: "value", value: 2 });
    expect(inbound.read?.()).toBeNull();
    expect(inbound.read?.()).toBeNull();

    // A second inbound stage tracks its own position and sees it too.
    expect(inbound2.read?.()).toEqual({ kind: "value", value: 2 });
    expect(inbound2.read?.()).toBeNull();

    transport.send({ kind: "value", value: 3 });
    expect(inbound.read?.()).toEqual({ kind: "value", value: 3 });
    expect(inbound.read?.()).toBeNull();
  });

  it("warns once when room() is called with a different transport", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const t1 = memoryTransport("t1");
    const t2 = memoryTransport("t2");

    const r1 = room("shared", t1);
    expect(room("shared", t1)).toBe(r1);
    expect(warnSpy).not.toHaveBeenCalled();

    expect(room("shared", t2)).toBe(r1);
    expect(room("shared", t2)).toBe(r1);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('"shared"'));
    warnSpy.mockRestore();
  });

  it("isolates packet listener errors so remaining listeners still receive", async () => {
    const transport = memoryTransport("listener-demo");
    await transport.connect();

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const received: unknown[] = [];

    transport.onPacket(() => {
      throw new Error("listener boom");
    });
    transport.onPacket((packet) => received.push(packet));

    transport.send({ kind: "value", value: 1 });

    expect(received).toEqual([{ kind: "value", value: 1 }]);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
