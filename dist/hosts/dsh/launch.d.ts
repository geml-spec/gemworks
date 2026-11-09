import { spawnSync } from "node:child_process";
/** How `dsh` will be invoked, and whether that route needs a shell. */
export interface Launcher {
    command: string;
    /** Arguments that precede dsh's own (the `npx` route carries two). */
    prefix: string[];
    /**
     * True only for a Windows `.cmd` / `.bat` shim, which Node refuses to spawn
     * without one. See `warnAboutPercent`.
     */
    shell: boolean;
    /** How the launcher was found, for the message when something goes wrong. */
    how: "PATH" | "npx";
}
/**
 * Find an executable on PATH, honouring PATHEXT on Windows.
 *
 * Node has no `which`, and guessing wrong here is the difference between a
 * clear message and a confusing ENOENT from deep inside a spawn.
 */
export declare function resolveOnPath(name: string, env?: NodeJS.ProcessEnv): string | undefined;
/** Decide how to invoke dsh: the one on PATH, else `npx -y @deepseek-ai/dsh`. */
export declare function launcherFor(env?: NodeJS.ProcessEnv): Launcher;
/**
 * Whether a task will survive the Windows shell unchanged.
 *
 * Only `%` is at issue: quoting protects `&`, `|` and friends, but `cmd.exe`
 * expands `%NAME%` even inside quotes, and there is no escape for it on a
 * command line. The model would then be handed text the user did not write, so
 * this is said out loud rather than silently tolerated.
 */
export declare function warnAboutPercent(task: string, shell: boolean): string | undefined;
export interface RunOptions {
    profile: string;
    task: string;
    /** Substituted by tests; defaults to a real spawn. */
    spawn?: typeof spawnSync;
    env?: NodeJS.ProcessEnv;
    note?: (line: string) => void;
}
/**
 * Add the bundle to the profile, then run the task under it.
 *
 * @returns dsh's own exit code, or 1 when dsh could not be reached at all.
 */
export declare function run(options: RunOptions): number;
