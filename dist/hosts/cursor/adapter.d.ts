export declare const CURSOR_HOST = "cursor";
/** Where the adapter keeps a conversation's state and the pointer to the active one. */
export declare function stateDir(home?: string): string;
/** The conversation the hooks last saw and its project: what the MCP server, started outside any project, writes for. */
export interface Active {
    conversationId: string;
    root: string;
    at: string;
}
export declare function activeOf(home?: string): Active | undefined;
/** The project: the workspace root holding a `.geml/`, else the first root, else `CURSOR_PROJECT_DIR`, else the event's `cwd`. */
export declare function projectOf(roots: readonly string[], env: NodeJS.ProcessEnv, cwd: string | undefined): string | undefined;
/** A path as the record keeps it: project-relative, `/`-separated; undefined outside the project. */
export declare function projectPath(root: string, path: string | undefined): string | undefined;
export interface CursorRun {
    stdout: string;
}
export interface CursorOptions {
    home?: string;
    platform?: string;
    now?: string;
}
export declare function runCursor(text: string, env: NodeJS.ProcessEnv, o?: CursorOptions): Promise<CursorRun>;
/** The hooks file with this adapter's entries put in, every other hook kept. */
export declare function hooksWith(file: Record<string, unknown>, command: string): Record<string, unknown>;
/** A settings file as an object: none when it is not there; an error when it is there and is not a JSON object, since writing it again would lose it. */
export declare function readSettings(file: string): Record<string, unknown>;
/**
 * `gemworks cursor install`: the adapter's hooks into Cursor's user hooks file and the MCP server into its user MCP
 * config, both running `bundle`. Returns the two files written.
 */
export declare function installCursor(bundle: string, home?: string): string[];
