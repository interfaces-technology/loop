import { transform, type Stage } from "../component.js";
import type { PacketOf } from "../types.js";

export interface SmilePrintTransformOptions {
  threshold?: number;
  cooldownMs?: number;
}

export function createSmilePrintTransform(options?: SmilePrintTransformOptions): Stage {
  const threshold = options?.threshold ?? 0.7;
  const cooldownMs = options?.cooldownMs ?? 2000;
  let wasAbove = false;
  let lastPrintAt = -Infinity;

  return transform({
    accepts: "value",
    emits: "data",
    dataType: "text",
    process(packet: PacketOf<"value">): PacketOf<"data"> {
      if (typeof packet.value !== "number") {
        return { kind: "data", type: "text", value: "" };
      }

      const value = packet.value;
      const above = value >= threshold;
      const now = Date.now();
      const cooledDown = now - lastPrintAt >= cooldownMs;

      if (above && !wasAbove && cooledDown) {
        wasAbove = above;
        lastPrintAt = now;
        return {
          kind: "data",
          type: "text",
          value: `Smile detected! (${value.toFixed(2)})`,
        };
      }

      wasAbove = above;
      return { kind: "data", type: "text", value: "" };
    },
  });
}
