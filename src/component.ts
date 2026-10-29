import type { Kind, Packet } from "./types.js";

export interface SourceDef {
  from: string;
  out: Kind;
  dataType?: string;
  poll: () => Packet | null;
}

export interface TransformDef {
  in: Kind | Kind[];
  out: Kind;
  dataType?: string;
  inType?: string;
  process: (input: Packet) => Packet | null;
}

export interface SinkDef {
  to: string;
  in: Kind | Kind[];
  dataType?: string;
  draw: (input: Packet) => void;
}

export type ComponentDef = SourceDef | TransformDef | SinkDef;

export interface Stage {
  role: "source" | "transform" | "sink";
  name: string;
  out?: Kind;
  in?: Kind | Kind[];
  dataType?: string;
  inType?: string;
  poll?: () => Packet | null;
  process?: (input: Packet) => Packet | null;
  draw?: (input: Packet) => void;
}

function inList(kinds: Kind | Kind[]): Kind[] {
  return Array.isArray(kinds) ? kinds : [kinds];
}

export function source(def: SourceDef): Stage {
  return {
    role: "source",
    name: def.from,
    out: def.out,
    dataType: def.dataType,
    poll: def.poll,
  };
}

export function transform(def: TransformDef): Stage {
  return {
    role: "transform",
    name: "transform",
    in: def.in,
    out: def.out,
    dataType: def.dataType,
    inType: def.inType,
    process: def.process,
  };
}

export function sink(def: SinkDef): Stage {
  return {
    role: "sink",
    name: def.to,
    in: def.in,
    dataType: def.dataType,
    draw: def.draw,
  };
}

export function component(def: ComponentDef): Stage {
  if ("poll" in def) {
    return source(def as SourceDef);
  }
  if ("process" in def) {
    return transform(def as TransformDef);
  }
  if ("draw" in def) {
    return sink(def as SinkDef);
  }
  throw new Error("component def must have poll, process, or draw");
}

export function stageIn(stage: Stage): Kind[] {
  if (stage.in === undefined) return [];
  return inList(stage.in);
}

export function stageOut(stage: Stage): Kind | undefined {
  return stage.out;
}

export function checkAdjacent(a: Stage, b: Stage): void {
  const aEmits = stageOut(a);
  const bAccepts = stageIn(b);

  if (aEmits === undefined) {
    throw new Error(`Stage "${a.name}" does not emit`);
  }
  if (bAccepts.length === 0) {
    throw new Error(`Stage "${b.name}" does not accept`);
  }
  if (!bAccepts.includes(aEmits)) {
    throw new Error(
      `Type mismatch: "${a.name}" out "${aEmits}" but "${b.name}" in [${bAccepts.join(", ")}]`,
    );
  }

  const bType = b.inType ?? b.dataType;
  if (aEmits === "data" && a.dataType && bType && a.dataType !== bType) {
    throw new Error(
      `Data type mismatch: "${a.name}" out data:"${a.dataType}" but "${b.name}" expects data:"${bType}"`,
    );
  }
}
