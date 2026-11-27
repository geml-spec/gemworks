export declare const ANTIGRAVITY_HOST = "antigravity";
/** Where the adapter keeps a conversation's state and the pointer to the active one. */
export declare function stateDir(home?: string): string;
/** The conversation the hooks last saw and its project: what the MCP server, started outside any project, writes for. */
export interface Active {
    conversationId: string;
    root: string;
    at: string;
}
export declare function activeOf(home?: string): Active | undefined;
/** A transcript step as Antigravity writes it. */
interface Step {
    step_index?: number;
    type?: string;
    source?: string;
    content?: string;
    tool_calls?: unknown[];
}
/** What the person asked in a `USER_INPUT` step: the text of its `<USER_REQUEST>`, else the whole content. */
export declare function requestOf(content: string): string;
/** The person's prompts after a step, in order, with their step's index. */
export declare function promptsAfter(steps: readonly Step[], after: number): {
    step: number;
    text: string;
}[];
/** The turn's answer: the last model response with words since the last prompt. */
export declare function answerOf(steps: readonly Step[]): string;
export interface AntigravityRun {
    stdout: string;
}
export declare function runAntigravity(event: string, text: string, home?: string, now?: string): AntigravityRun;
/** The hooks file entries for this adapter: `command` runs the bundle, the event its argument. */
export declare function hooksFor(command: string): Record<string, unknown>;
/**
 * `gemworks antigravity install`: the adapter's hooks into Antigravity's global
 * hooks file (under its own name, every other hook kept, the earlier probe
 * taken out) and the MCP server into its MCP config, both running `bundle`.
 * Returns the two files written.
 */
export declare function installAntigravity(bundle: string, home?: string): string[];
export {};
