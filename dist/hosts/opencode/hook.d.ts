import type { CallFacts } from "../claude-code/fastpath.js";
/** OpenCode's shell tool. */
export declare const SHELL = "shell";
/** An MCP tool's own name: OpenCode lists a server's tools as `<server>.<tool>`. */
export declare const bareTool: (tool: string) => string;
/** The files a call writes, as it names them: `path` for `write` and `edit`, every file of a `patch`. */
export declare function writes(tool: string, input: Readonly<Record<string, unknown>>): string[];
/**
 * The call as the gate and the dictionary read it: Claude Code's tool names, a shell call's command line in `command`,
 * a file's path in `file_path` (a patch's first file).
 */
export declare function callOf(tool: string, input: Readonly<Record<string, unknown>>): CallFacts;
/**
 * A shell call's exit status from its result (`{ output, content, metadata }`): the `[gemworks exit N]` a wrapped
 * command printed last, else the shell tool's own `output.exit`; null when there is none (a background command).
 */
export declare function exitCodeOf(response: unknown): number | null;
