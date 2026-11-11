import type { CallFacts } from "../claude-code/fastpath.js";
export interface QwenEvent {
    hook_event_name: string;
    session_id?: string;
    cwd?: string;
    /** The model turn the event belongs to: the same through a turn's tool round trips. */
    prompt_id?: string;
    tool_name?: string;
    tool_use_id?: string;
    tool_input?: Record<string, unknown>;
    tool_response?: unknown;
    /** PostToolUseFailure: why the call failed. */
    error?: string;
    /** UserPromptSubmit: the model-bound text, which on some paths is not the person's. */
    prompt?: string;
    /** UserPromptSubmit: the text the person submitted, when Qwen Code knows it. */
    submitted_prompt?: string;
    /** SessionStart: startup, resume, clear or compact. */
    source?: string;
    /** Stop: the turn's last answer. */
    last_assistant_message?: string;
    /** Stop: whether the turn already went on once because a Stop hook blocked it. */
    stop_hook_active?: boolean;
}
/** The event Qwen Code wrote to stdin; undefined when it is not one. */
export declare function readEvent(text: string): QwenEvent | undefined;
/** Qwen Code's shell tool. */
export declare const SHELL = "run_shell_command";
export declare const writesFiles: (tool: string) => boolean;
/** An MCP tool's own name: Qwen Code lists a server's tools as `mcp__<server>__<tool>`, or bare. */
export declare const bareTool: (tool: string) => string;
/** Where a Qwen Code tool names its file. */
export declare function pathOf(input: Readonly<Record<string, unknown>>): string | undefined;
/**
 * The call as the gate and the dictionary read it: Claude Code's tool names, a
 * shell call's command line in `command`, a written file's path in `file_path`.
 */
export declare function callOf(tool: string, input: Readonly<Record<string, unknown>>): CallFacts;
/**
 * A shell call's exit status from its result, whatever shape Qwen Code gives
 * it: the `[gemworks exit N]` a wrapped command printed last, else the
 * `Exit Code: N` line of the shell tool's own report, else a number its JSON
 * names (`exitCode`, `exit_code`); null when there is none.
 */
export declare function exitCodeOf(response: unknown): number | null;
export type HookEventName = "SessionStart" | "UserPromptSubmit" | "PreToolUse" | "PostToolUse" | "PostToolUseFailure";
/** A refusal, read by the model as the tool's error. */
export declare const denyCall: (reason: string) => Record<string, unknown>;
/**
 * The call goes on, rewritten when `updatedInput` is given (Qwen Code replaces the whole input with it), with a note for
 * the model when `context` is; undefined when there is neither. "allow" skips none of Qwen Code's own approvals.
 */
export declare function allowCall(updatedInput?: Record<string, unknown>, context?: string): Record<string, unknown> | undefined;
export declare const contextFor: (event: Exclude<HookEventName, "PreToolUse">, text: string) => Record<string, unknown>;
