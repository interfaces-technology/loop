import { createReceiptLayout, type ReceiptLayout } from "./sinks/receipt.js";

export type LayoutFactory = () => ReceiptLayout;

const layoutInstances = new Map<string, ReceiptLayout>();
const layoutFactories = new Map<string, LayoutFactory>();

layoutFactories.set("receipt", createReceiptLayout);

/** Register a layout (a packaged sink) by name. */
export function registerLayout(name: string, factory: LayoutFactory): void {
  layoutFactories.set(name, factory);
  layoutInstances.delete(name);
}

export function layout(name: string): ReceiptLayout {
  const existing = layoutInstances.get(name);
  if (existing) return existing;

  const factory = layoutFactories.get(name);
  if (!factory) {
    throw new Error(
      `Unknown layout: "${name}". Registered layouts: ${[...layoutFactories.keys()].join(", ")}`,
    );
  }

  const created = factory();
  layoutInstances.set(name, created);
  return created;
}

export function clearLayouts(): void {
  for (const receipt of layoutInstances.values()) {
    receipt.disconnect();
  }
  layoutInstances.clear();
}
