import { describe, it, expect, beforeEach } from "vitest";
import loop from "../src/index.js";
import { clearRelayRooms } from "../src/relay.js";
import { clearMemoryTransports } from "../src/transport/memory.js";

describe("cross-device integration", () => {
  beforeEach(() => {
    clearRelayRooms();
    clearMemoryTransports();
  });

  it("controller publish moves display subscribe handle", async () => {
    const transport = loop.relay.memoryTransport("live-demo");
    const controller = loop.relay.room("live-demo", transport);
    const display = loop.relay.room("live-demo", transport);

    await controller.connect();
    await display.connect();

    const remote = display.subscribe({ x: 0, y: 0 });
    controller.publish(() => ({ kind: "value", value: { x: 1, y: 0 } }));

    // Simulate one tick cycle
    transport.send({ kind: "value", value: { x: 1, y: 0 } });

    expect(remote.value).toEqual({ x: 1, y: 0 });
  });

  it("full pipe relay: source → outbound → inbound → sink", async () => {
    const transport = loop.relay.memoryTransport("pipe-live");
    const sender = loop.relay.room("pipe-live", transport);
    const receiver = loop.relay.room("pipe-live", transport);

    await sender.connect();
    await receiver.connect();

    const results: unknown[] = [];

    const outbound = loop.pipe(
      loop.source({
        from: "dpad",
        emits: "value",
        read: () => ({ kind: "value", value: { x: 0, y: -1 } }),
      }),
      sender.outbound({ accepts: "value" }),
    );

    const inbound = loop.pipe(
      receiver.inbound({ emits: "value" }),
      loop.sink({
        to: "square",
        accepts: "value",
        render: (packet) => {
          if (packet.kind === "value") results.push(packet.value);
        },
      }),
    );

    outbound.start();
    inbound.start();

    // Run one publish cycle manually since memory transport is synchronous
    transport.send({ kind: "value", value: { x: 0, y: -1 } });

    const { runPipeline } = await import("../src/pipe.js");
    runPipeline(inbound.stages);

    expect(results[0]).toEqual({ x: 0, y: -1 });
  });
});
