export declare const QWEN_HOST = "qwen";
/** Where the adapter keeps a session's state. */
export declare const stateDir: (home?: string) => string;
/** The project: `QWEN_PROJECT_DIR`, else the event's `cwd`. */
export declare function projectOf(env: NodeJS.ProcessEnv, cwd: string | undefined): string | undefined;
export interface QwenRun {
    stdout: string;
}
export interface QwenOptions {
    home?: string;
    platform?: string;
    now?: string;
}
export declare function runQwen(text: string, env: NodeJS.ProcessEnv, o?: QwenOptions): Promise<QwenRun>;
/** The settings' hooks with this adapter's put in, every other hook kept; a group left with no hook goes. */
export declare function hooksWith(settings: Record<string, unknown>, command: string): Record<string, unknown>;
/** `gemworks qwen install`: the adapter's hooks and the MCP server into Qwen Code's user settings, both running `bundle`. Returns the file written. */
export declare function installQwen(bundle: string, home?: string): string[];
