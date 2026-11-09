export type VerbName = "status" | "move" | "set";
export interface FlowToolSpec {
    name: VerbName;
    description: string;
    inputSchema: Record<string, unknown>;
}
/** How Claude Code lists a tool the gemworks plugin registers: an MCP client's `mcp__<server>__<tool>`, the server being `gemworks`. */
export declare const OWN_TOOL_PREFIX = "mcp__gemworks__";
export declare const FLOW_TOOLS: readonly FlowToolSpec[];
/**
 * Whether gemworks answers this tool itself: one of the three verbs, bare (as
 * `gemworks mcp` names them), as Claude Code lists them (`mcp__gemworks__move`),
 * or as dsh and pi register them (`gemworks_move`).
 */
export declare function isOwnTool(name: string): boolean;
/** The bare verb of an own tool's name. */
export declare function verbOf(name: string): VerbName | undefined;
