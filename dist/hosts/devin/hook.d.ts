import type { CallFacts } from "../claude-code/fastpath.js";
import { bareTool } from "../qwen/hook.js";
export { bareTool };
/** Devin's shell tool. */
export declare const SHELL = "exec";
/** Where a Devin file tool names its file: Devin's docs do not say, so every key a host uses for it. */
export declare function pathOf(input: Readonly<Record<string, unknown>>): string | undefined;
/** The files a call writes, as it names them: a file tool's path, every file of a patch in any of its text fields. */
export declare function writes(tool: string, input: Readonly<Record<string, unknown>>): string[];
/** The call as the gate and the dictionary read it: Claude Code's tool names, a written file's path in `file_path`. */
export declare function callOf(tool: string, input: Readonly<Record<string, unknown>>): CallFacts;
/** A shell call's exit status: the `[gemworks exit N]` a wrapped command printed last; null otherwise (Devin reports none). */
export declare const exitCodeOf: (response: unknown) => number | null;
/** Whether a call's result says it failed: `success: false`. */
export declare const failedIn: (response: unknown) => boolean;
