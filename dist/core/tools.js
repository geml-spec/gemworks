import { modelVars, outgoing } from "./statechart.js";
import { describeTransitions } from "./prompt.js";
const entered = () => ({ type: "array", items: { type: "string" } });
function outputSchema(properties) {
    return { type: "object", additionalProperties: false, properties };
}
/** One variable's declared schema, projected onto DSH's parameter vocabulary. */
export function toParamEntry(name, schema) {
    const entry = { type: schema.type ?? "string", description: schema.description ?? `the ${name} variable` };
    if (schema.enum)
        entry.enum = [...schema.enum];
    if (schema.items)
        entry.items = schema.items;
    if (schema.type === "object") {
        entry.properties = schema.properties ?? {};
        entry.additionalProperties = schema.additionalProperties ?? false;
    }
    return entry;
}
export function statusSpec() {
    return {
        name: "gemworks_status",
        description: "Where the workflow stands: the state, the variables, the ways out and whether their guards hold. Read-only.",
        parameters: {},
        output: { schema: outputSchema({ text: { type: "string" } }) },
    };
}
/**
 * The move tool for one state, or null when the model may take no transition
 * out of it — a machine-judged one is taken on its own, one with approval by
 * a person, and a tool whose enum would be empty is worse than an absent one.
 */
export function moveSpec(sc, snap) {
    const edges = outgoing(sc, snap.state).filter((t) => !t.approval && t.judge !== "machine");
    if (edges.length === 0)
        return null;
    return {
        name: "gemworks_move",
        description: `Take a transition out of ${snap.state}:\n${describeTransitions(sc, snap.state)}`,
        parameters: { to: { type: "string", required: true, description: "The target state.", enum: edges.map((t) => t.to) } },
        output: { schema: outputSchema({ from: { type: "string" }, to: { type: "string" }, state: { type: "string" }, entered: entered(), rev: { type: "integer" }, hash: { type: "string" } }) },
    };
}
/** The set tool: one parameter per variable the model may write; null when there is none. */
export function setSpec(sc, snap) {
    const names = modelVars(sc);
    if (names.length === 0)
        return null;
    const parameters = {};
    for (const name of names) {
        const schema = sc.varsSchema.properties?.[name];
        if (schema)
            parameters[name] = toParamEntry(name, schema);
    }
    return {
        name: "gemworks_set",
        description: `Record workflow variables in ${snap.state}: ${names.join(", ")}. Variables with a source are evidence and not yours.`,
        parameters,
        output: { schema: outputSchema({ rev: { type: "integer" }, hash: { type: "string" }, state: { type: "string" }, entered: entered(), vars: { type: "object", additionalProperties: true } }) },
    };
}
