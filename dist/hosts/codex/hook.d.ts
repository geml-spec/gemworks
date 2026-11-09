import type { CallFacts } from "../claude-code/fastpath.js";
export interface CodexEvent {
    hook_event_name: string;
    session_id?: string;
    cwd?: string;
    tool_name?: string;
    tool_use_id?: string;
    tool_input?: Record<string, unknown>;
    tool_response?: unknown;
    prompt?: string;
    /** Stop: the turn's last answer. */
    last_assistant_message?: string;
}
/** The event Codex wrote to stdin; undefined when it is not one. */
export declare function readEvent(text: string): CodexEvent | undefined;
/**
 * A shell command that ends by printing its own exit status on a line of its
 * own and exits with it: the command runs in a subshell, so an `exit` inside
 * it ends only that; the status the host sees is the command's own.
 */
export declare function wrapCommand(command: string): string;
export declare const isWrapped: (command: string) => boolean;
/** The command a wrapped one ran: what the gate and the dictionary judge, and what the journal records. A command that was not wrapped is itself. */
export declare function unwrapCommand(command: string): string;
/** The last `[gemworks exit N]` in a tool's response, whatever shape Codex gives it (a string, or strings under any keys); null when there is none. */
export declare function exitCodeIn(response: unknown): number | null;
/** The files an `apply_patch` patch adds, updates or deletes, in order, as the patch spells them. */
export declare function patchPaths(patch: string): string[];
/**
 * The call as the gate and the dictionary read it: `apply_patch` names its
 * files and no command line, so a patch's text is never scanned for fenced
 * or person-only commands; every other tool's input goes as it is.
 */
export declare function callOf(tool: string, input: Record<string, unknown>): CallFacts;
export type HookEventName = "SessionStart" | "UserPromptSubmit" | "PreToolUse" | "PostToolUse";
export interface HookOutput {
    hookSpecificOutput: {
        hookEventName: HookEventName;
        permissionDecision?: "allow" | "deny";
        permissionDecisionReason?: string;
        updatedInput?: Record<string, unknown>;
        additionalContext?: string;
    };
}
export declare const denyCall: (reason: string) => HookOutput;
/** The call goes on: rewritten when `updatedInput` is given, with a note for the model when `context` is. */
export declare function allowCall(updatedInput?: Record<string, unknown>, context?: string): HookOutput | undefined;
export declare const contextFor: (event: Exclude<HookEventName, "PreToolUse">, text: string) => HookOutput;
