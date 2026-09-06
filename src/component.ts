import type { Kind, Packet } from "./types.js";

export interface SourceDef {
  from: string;
  emits: Kind;
  dataType?: string;
  read: () => Packet | null;
}

export interface TransformDef {
  accepts: Kind | Kind[];
  emits: Kind;
  dataType?: string;
  process: (input: Packet) => Packet;
}

export interface SinkDef {
  to: string;
  accepts: Kind | Kind[];
  dataType?: string;
  render: (input: Packet) => void;
}

export type ComponentDef = SourceDef | TransformDef | SinkDef;

export interface Stage {
  role: "source" | "transform" | "sink";
  name: string;
  emits?: Kind;
  accepts?: Kind | Kind[];
  dataType?: string;
  read?: () => Packet | null;
  process?: (input: Packet) => Packet;
  render?: (input: Packet) => void;
}

function acceptsList(accepts: Kind | Kind[]): Kind[] {
  return Array.isArray(accepts) ? accepts : [accepts];
}

export function source(def: SourceDef): Stage {
  return {
    role: "source",
    name: def.from,
    emits: def.emits,
    dataType: def.dataType,
    read: def.read,
  };
}

export function transform(def: TransformDef): Stage {
  return {
    role: "transform",
    name: "transform",
    accepts: def.accepts,
    emits: def.emits,
    dataType: def.dataType,
    process: def.process,
  };
}

export function sink(def: SinkDef): Stage {
  return {
    role: "sink",
    name: def.to,
    accepts: def.accepts,
    dataType: def.dataType,
    render: def.render,
  };
}

export function component(def: ComponentDef): Stage {
  if ("read" in def) {
    return source(def as SourceDef);
  }
  if ("process" in def) {
    return transform(def as TransformDef);
  }
  if ("render" in def) {
    return sink(def as SinkDef);
  }
  throw new Error("component def must have read, process, or render");
}

export function stageAccepts(stage: Stage): Kind[] {
  if (stage.accepts === undefined) return [];
  return acceptsList(stage.accepts);
}

export function stageEmits(stage: Stage): Kind | undefined {
  return stage.emits;
}

export function checkAdjacent(a: Stage, b: Stage): void {
  const aEmits = stageEmits(a);
  const bAccepts = stageAccepts(b);

  if (aEmits === undefined) {
    throw new Error(`Stage "${a.name}" does not emit`);
  }
  if (bAccepts.length === 0) {
    throw new Error(`Stage "${b.name}" does not accept`);
  }
  if (!bAccepts.includes(aEmits)) {
    throw new Error(
      `Type mismatch: "${a.name}" emits "${aEmits}" but "${b.name}" accepts [${bAccepts.join(", ")}]`,
    );
  }

  if (aEmits === "data" && a.dataType && b.dataType && a.dataType !== b.dataType) {
    throw new Error(
      `Data type mismatch: "${a.name}" emits data:"${a.dataType}" but "${b.name}" expects data:"${b.dataType}"`,
    );
  }
}
