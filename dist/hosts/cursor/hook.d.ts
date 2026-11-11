import type { CallFacts } from "../claude-code/fastpath.js";
export interface CursorEvent {
    hook_event_name: string;
    conversation_id?: string;
    session_id?: string;
    workspace_roots?: string[];
    tool_name?: string;
    tool_use_id?: string;
    tool_input?: Record<string, unknown>;
    /** postToolUse: the tool's result, as Cursor gives it (a JSON string). */
    tool_output?: unknown;
    /** postToolUseFailure: why the call failed. */
    error_message?: string;
    prompt?: string;
    /** afterFileEdit: the file the agent edited. */
    file_path?: string;
    /** afterAgentResponse: the model's words. */
    text?: string;
    /** stop: completed, aborted or error. */
    status?: string;
    /** stop: how many follow-ups the hooks sent this turn already. */
    loop_count?: number;
    cwd?: string;
}
/** The event Cursor wrote to stdin; undefined when it is not one. */
export declare function readEvent(text: string): CursorEvent | undefined;
/** Cursor's shell tool. */
export declare const SHELL = "Shell";
export declare const writesFiles: (tool: string) => boolean;
/** An MCP tool's own name, without Cursor's `MCP:` prefix. */
export declare const bareTool: (tool: string) => string;
/** Where a Cursor tool names its file. */
export declare function pathOf(input: Readonly<Record<string, unknown>>): string | undefined;
/**
 * The call as the gate and the dictionary read it: Claude Code's tool names, a
 * shell call's command line in `command`, a written file's path in `file_path`.
 */
export declare function callOf(tool: string, input: Readonly<Record<string, unknown>>): CallFacts;
/**
 * A shell call's exit status from its result: a number Cursor's JSON names
 * (`exitCode`, `exit_code`, `returnCode`), else the `[gemworks exit N]` a
 * wrapped command printed last; null when there is neither.
 */
export declare function exitCodeOf(output: unknown): number | null;
/** preToolUse's answers: a refusal the person and the model both read; a rewritten call; nothing — `{}`, since Cursor blocks a permission hook whose output is no JSON. */
export declare const denyCall: (reason: string) => Record<string, unknown>;
export declare const rewriteCall: (updated: Record<string, unknown> | undefined) => Record<string, unknown>;
