/**
 * The project path a write tool's call names: its file under `root`, with
 * forward slashes; a relative path as given; undefined for a path outside
 * the root, or a call that names none. With `real` (a host's resolver of
 * links), an absolute path that is not under the root as written is compared
 * as both resolve: a root reached through a link (macOS's /var is
 * /private/var) still holds the files written in it.
 */
export declare function writtenProjectPath(input: Readonly<Record<string, unknown>> | undefined, root: string, real?: (path: string) => string): string | undefined;
