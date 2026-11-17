import type { Kind, DataType, Packet, PacketOf } from "./types.js";

export interface SourceDef<E extends Kind = Kind> {
  from: string;
  emits: E;
  dataType?: DataType;
  read: () => PacketOf<E> | null;
}

export interface TransformDef<A extends Kind = Kind, E extends Kind = Kind> {
  accepts: A | A[];
  emits: E;
  dataType?: DataType;
  process: (input: PacketOf<A>) => PacketOf<E>;
}

export interface SinkDef<A extends Kind = Kind> {
  to: string;
  accepts: A | A[];
  dataType?: DataType;
  render: (input: PacketOf<A>) => void;
}

export type ComponentDef = SourceDef | TransformDef | SinkDef;

export interface Stage {
  role: "source" | "transform" | "sink";
  name: string;
  emits?: Kind;
  accepts?: Kind | Kind[];
  dataType?: DataType;
  read?: () => Packet | null;
  process?: (input: Packet) => Packet;
  render?: (input: Packet) => void;
}

function acceptsList(accepts: Kind | Kind[]): Kind[] {
  return Array.isArray(accepts) ? accepts : [accepts];
}

export function source<E extends Kind = Kind>(def: SourceDef<E>): Stage {
  return {
    role: "source",
    name: def.from,
    emits: def.emits,
    dataType: def.dataType,
    read: def.read as () => Packet | null,
  };
}

export function transform<A extends Kind = Kind, E extends Kind = Kind>(
  def: TransformDef<A, E>,
): Stage {
  return {
    role: "transform",
    name: "transform",
    accepts: def.accepts,
    emits: def.emits,
    dataType: def.dataType,
    process: def.process as unknown as (input: Packet) => Packet,
  };
}

export function sink<A extends Kind = Kind>(def: SinkDef<A>): Stage {
  return {
    role: "sink",
    name: def.to,
    accepts: def.accepts,
    dataType: def.dataType,
    render: def.render as (input: Packet) => void,
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
