/** How Claude Code lists a tool the gemworks plugin registers: an MCP client's `mcp__<server>__<tool>`, the server being `gemworks`. */
export const OWN_TOOL_PREFIX = "mcp__gemworks__";
const NONE = { type: "object", properties: {}, additionalProperties: false };
export const FLOW_TOOLS = [
    {
        name: "status",
        description: "Where this project's Gemworks workflow stands: the work item, the current state, every variable, each way out with whether its guard holds, and the current stage's text (.geml/context.geml #current). Read-only.",
        inputSchema: NONE,
    },
    {
        name: "move",
        description: "Take a transition out of the current state (status lists them): one whose guard is a sentence you judge, or one with no guard. A machine-judged transition is taken on its own when its guard holds; one that needs a person is theirs — they approve it on the Gemworks board or with `gemworks advance <state>`.",
        inputSchema: {
            type: "object",
            properties: { to: { type: "string", description: "The target state." } },
            required: ["to"],
            additionalProperties: false,
        },
    },
    {
        name: "set",
        description: "Record workflow variables, by name. Variables with a source (test results, PR and CI state, a person's checks) are evidence and not yours to write; a value of the wrong type writes nothing.",
        inputSchema: { type: "object", description: "The variables to record, each under its own name.", additionalProperties: true },
    },
];
const OWN_TOOL_NAMES = new Set(FLOW_TOOLS.flatMap((t) => [t.name, `${OWN_TOOL_PREFIX}${t.name}`, `gemworks_${t.name}`]));
/**
 * Whether gemworks answers this tool itself: one of the three verbs, bare (as
 * `gemworks mcp` names them), as Claude Code lists them (`mcp__gemworks__move`),
 * or as dsh and pi register them (`gemworks_move`).
 */
export function isOwnTool(name) {
    return OWN_TOOL_NAMES.has(name);
}
/** The bare verb of an own tool's name. */
export function verbOf(name) {
    const bare = name.startsWith(OWN_TOOL_PREFIX) ? name.slice(OWN_TOOL_PREFIX.length) : name.startsWith("gemworks_") ? name.slice("gemworks_".length) : name;
    return FLOW_TOOLS.some((t) => t.name === bare) ? bare : undefined;
}
