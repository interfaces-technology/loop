import { describe, it, expect, beforeEach } from "vitest";
import { source, sink } from "../src/component.js";
import { pipe, runPipeline } from "../src/pipe.js";
import { createHandle } from "../src/handle.js";
import { room, online, clearRelayRooms } from "../src/relay.js";
import { memoryTransport, clearMemoryTransports } from "../src/transport/memory.js";
import { serializePacket, deserializePacket, payloadToJsonText } from "../src/transport/serialize.js";

describe("packet serialization", () => {
  it("round-trips value scalars", () => {
    const packet = { kind: "value" as const, value: 0.75 };
    expect(deserializePacket(serializePacket(packet))).toEqual(packet);
  });

  it("round-trips value vectors", () => {
    const packet = { kind: "value" as const, value: { x: -1, y: 0.5 } };
    expect(deserializePacket(serializePacket(packet))).toEqual(packet);
  });

  it("round-trips data packets", () => {
    const packet = { kind: "data" as const, type: "text", value: "hello" };
    expect(deserializePacket(serializePacket(packet))).toEqual(packet);
  });

  it("rejects frame packets", () => {
    const frame = { width: 1, height: 1, data: new Uint8ClampedArray(4) } as ImageData;
    expect(() => serializePacket({ kind: "frame", frame })).toThrow(/cannot be relayed/);
  });

  it("decodes ArrayBuffer and typed-array payloads as JSON text", () => {
    const packet = { kind: "value" as const, value: { x: 1, y: -0.5 } };
    const json = serializePacket(packet);
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

  it("broadcast() streams a local handle's changes to the room", async () => {
    const transport = memoryTransport("broadcast-demo");
    const control = room("control-end", transport);
    const display = room("display-end", transport);

    await control.connect();
    await display.connect();

    const knob = createHandle(0);
    const seen: number[] = [];

    display.subscribe(0).on("change", (v) => seen.push(v as number));
    const unsubscribe = control.broadcast(knob);

    knob._setValue(0.25);
    knob._setValue(0.5);
    knob._setValue(0.25);

    expect(seen).toEqual([0.25, 0.5, 0.25]);
    unsubscribe();

    knob._setValue(0.9);
    expect(seen).toEqual([0.25, 0.5, 0.25]);
  });

  it("broadcast() sends string handles as text packets", async () => {
    const transport = memoryTransport("text-broadcast");
    const control = room("control-text", transport);
    const display = room("display-text", transport);

    await control.connect();
    await display.connect();

    const seen: string[] = [];
    transport.onPacket((p) => {
      if (p.kind === "data" && p.type === "text") seen.push(typeof p.value === "string" ? p.value : "");
    });

    const field = createHandle("ready");
    control.broadcast(field);
    field._setValue("cook");
    field._setValue("serve");

    expect(seen).toEqual(["ready", "cook", "serve"]);
  });

  it("online() builds a room over a websocket transport", () => {
    const relayRoom = online("ws://localhost:8787/{room}", "kitchen");
    expect(relayRoom.code).toBe("kitchen");
    expect(relayRoom.transport).toBeDefined();
    relayRoom.disconnect();
    clearRelayRooms();
  });
});
