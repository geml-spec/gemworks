import type { CallFacts } from "../claude-code/fastpath.js";
/** Whether a tool is Kiro's shell, by any of its names. */
export declare const isShell: (tool: string) => boolean;
/** An MCP tool's own name: Kiro's hook events name it `mcp_<server>_<tool>`, gemworks' own `mcp_gemworks_<tool>`. */
export declare function bareTool(tool: string): string;
/** Where a Kiro file tool names its file. */
export declare function pathOf(input: Readonly<Record<string, unknown>>): string | undefined;
/** The files a call writes, as it names them. */
export declare function writes(tool: string, input: Readonly<Record<string, unknown>>): string[];
/** The call as the gate and the dictionary read it: Claude Code's tool names, a written file's path in `file_path`. */
export declare function callOf(tool: string, input: Readonly<Record<string, unknown>>): CallFacts;
/**
 * A shell call's exit status from its result: the `[gemworks exit N]` a wrapped command printed, else a number the
 * result names (`exit_status`, `exitStatus`, `exit_code`, `exitCode`), else an `Exit Code: N` or `exit status: N` line;
 * null when there is none.
 */
export declare function exitCodeOf(response: unknown): number | null;
