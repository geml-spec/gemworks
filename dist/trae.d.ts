import type { CallFacts } from "./hosts/claude-code/fastpath.js";
export declare const TRAE_HOST = "trae";
/** TRAE's shell tool. */
export declare const SHELL = "RunCommand";
/** The call as the gate and the dictionary read it: TRAE's names are Claude Code's but for the shell, a written file's path in `file_path`. */
export declare function callOf(tool: string, input: Readonly<Record<string, unknown>>): CallFacts;
/** The project: the workspace root holding a `.geml/`, else `TRAE_PROJECT_DIR`, else the event's `cwd`. */
export declare function projectOf(roots: readonly string[], env: NodeJS.ProcessEnv, cwd: string | undefined): string | undefined;
export interface TraeRun {
    stdout: string;
}
export interface TraeOptions {
    home?: string;
    platform?: string;
    now?: string;
}
export declare function runTrae(text: string, env: NodeJS.ProcessEnv, o?: TraeOptions): Promise<TraeRun>;
/** The hooks file with this adapter's hooks put in, every other hook kept; a group left with no hook goes. */
export declare function hooksWith(file: Record<string, unknown>, command: string): Record<string, unknown>;
/** The MCP server's entry, to add under TRAE's Settings → MCP. */
export declare const mcpEntry: (bundle: string) => Record<string, unknown>;
/** `gemworks trae install`: the hooks into the TRAE builds' user hooks files, running `bundle`. Returns the files written. */
export declare function installTrae(bundle: string, home?: string): string[];
