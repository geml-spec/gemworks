import type { Schema } from "./schema.js";
import type { Snapshot } from "./snapshot.js";
import { type Statechart } from "./statechart.js";
/** One parameter as DSH's parameter spec spells it. */
export interface ParamEntry {
    type: "string" | "number" | "integer" | "boolean" | "object" | "array" | "null";
    required?: true;
    description: string;
    enum?: (string | number | boolean | null)[];
    items?: unknown;
    properties?: unknown;
    additionalProperties?: boolean;
}
export type ParamSpec = Record<string, ParamEntry>;
/** Everything the plugin needs to register one tool. */
export interface ToolSpec {
    name: string;
    description: string;
    parameters: ParamSpec;
    output: {
        schema: Record<string, unknown>;
    };
}
/** One variable's declared schema, projected onto DSH's parameter vocabulary. */
export declare function toParamEntry(name: string, schema: Schema): ParamEntry;
export declare function statusSpec(): ToolSpec;
/**
 * The move tool for one state, or null when the model may take no transition
 * out of it — a machine-judged one is taken on its own, one with approval by
 * a person, and a tool whose enum would be empty is worse than an absent one.
 */
export declare function moveSpec(sc: Statechart, snap: Snapshot): ToolSpec | null;
/** The set tool: one parameter per variable the model may write; null when there is none. */
export declare function setSpec(sc: Statechart, snap: Snapshot): ToolSpec | null;
