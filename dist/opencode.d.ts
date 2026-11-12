import { type HookedEvent } from "./hooked.js";
export declare const OPENCODE_HOST = "opencode";
/** The plugin's request; undefined when it is not one. */
export declare function readRequest(text: string): {
    session: string;
    root: string;
    event: HookedEvent;
} | undefined;
export interface OpencodeOptions {
    home?: string;
    platform?: string;
    now?: string;
}
/** One request from the plugin; its answer as one JSON line, or nothing. */
export declare function runOpencode(text: string, o?: OpencodeOptions): Promise<{
    stdout: string;
}>;
/** OpenCode's global plugins folder: `$XDG_CONFIG_HOME/opencode/plugins`, else `~/.config/opencode/plugins`. */
export declare function pluginsDir(env?: NodeJS.ProcessEnv, home?: string): string;
/** The plugin OpenCode loads, running `node` (this Node, by its full path: OpenCode's own PATH may not have one) on `bundle`. */
export declare function pluginSource(node: string, bundle: string): string;
/** `gemworks opencode install`: the plugin into OpenCode's global plugins folder, running `bundle`. Returns the files written. */
export declare function installOpencode(bundle: string, node?: string, env?: NodeJS.ProcessEnv, home?: string): string[];
