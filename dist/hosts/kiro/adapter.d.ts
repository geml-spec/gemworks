export declare const KIRO_HOST = "kiro";
export interface KiroRun {
    stdout: string;
    stderr: string;
    code: number;
}
export interface KiroOptions {
    home?: string;
    platform?: string;
    now?: string;
    here?: string;
}
export declare function runKiro(input: string, env: NodeJS.ProcessEnv, o?: KiroOptions): Promise<KiroRun>;
/** The hook file the adapter writes: one hook per trigger, all running `command`. */
export declare function hookFile(command: string): Record<string, unknown>;
/** `gemworks kiro install [dir]`: the hooks into Kiro's global hooks (and `dir`'s, when given) and the MCP server into Kiro's user MCP config, all running `bundle`. Returns the files written. */
export declare function installKiro(bundle: string, project?: string, home?: string): string[];
