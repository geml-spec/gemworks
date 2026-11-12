import { type Active } from "./hooked.js";
export declare const DEVIN_HOST = "devin";
/** The project: `DEVIN_PROJECT_DIR`, else the event's `cwd`, else the folder the hook runs in. */
export declare function projectOf(env: NodeJS.ProcessEnv, cwd: string | undefined, here?: string): string;
/** The session the hooks last saw and its project, and what the MCP server works in: src/hooked.ts keeps them. */
export declare const activeOf: (home?: string) => Active | undefined;
export declare const mcpRootOf: (root: string, home?: string) => Active | undefined;
export interface DevinRun {
    stdout: string;
    stderr: string;
    code: number;
}
export interface DevinOptions {
    home?: string;
    platform?: string;
    now?: string;
    here?: string;
}
export declare function runDevin(text: string, env: NodeJS.ProcessEnv, o?: DevinOptions): Promise<DevinRun>;
/** The config's hooks with this adapter's put in, every other hook kept; a group left with no hook goes. */
export declare function hooksWith(config: Record<string, unknown>, command: string): Record<string, unknown>;
/** Devin's user config folder: `%APPDATA%\devin` on Windows, `~/.config/devin` elsewhere. */
export declare function configDir(home?: string, env?: NodeJS.ProcessEnv, platform?: string): string;
/** `gemworks devin install`: the hooks into Devin's user config and the MCP server into its MCP config, both running `bundle`. Returns the files written. */
export declare function installDevin(bundle: string, home?: string, env?: NodeJS.ProcessEnv, platform?: string): string[];
