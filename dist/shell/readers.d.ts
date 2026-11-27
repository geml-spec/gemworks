/** What a `tool.call` result carries that these readers look at. */
export interface RanLike {
    deny?: string;
    isError?: boolean;
    text?: string;
    result?: unknown;
}
/** A tool call's own arguments: the event's input without the keys the engine reserves. */
export declare function toolArgs(e: Record<string, unknown>): Record<string, unknown>;
/** The part of a call's arguments the CLI reads — the command and the path, never file contents. */
export declare function bridgeInput(input: Record<string, unknown>): Record<string, unknown>;
/**
 * The exit status of a finished Bash call (spec §5.2): `Exit code <n>` on an
 * errored result (its text, else its result when that is a string); 0 for a
 * clean one; non-zero (1) for a clean result Claude Code interpreted
 * (`returnCodeInterpretation`: grep's "No matches found", diff's "Files
 * differ"); null when there is none — the call went to the background, was
 * interrupted, or never ran.
 */
export declare function bashExitCode(ran: RanLike): number | null;
/** Whether a clean Bash result classified a git or gh operation (commit, push, merge, rebase, PR). */
export declare function hasGitOperation(ran: RanLike): boolean;
/** The path a file-writing tool (Edit, Write, NotebookEdit) names, as given; undefined for another tool or no path. */
export declare function writtenPath(tool: string, input: Record<string, unknown>): string | undefined;
/** A path with `/` separators, its `.` and `..` segments resolved and its drive letter upper-cased; undefined when a `..` climbs above where it starts. */
export declare function normalised(path: string): string | undefined;
/**
 * The project-relative, `/`-separated path a write-capability call touched;
 * undefined for another tool, or a path outside the project once `.` and `..`
 * are resolved (a drive letter is compared in any case).
 */
export declare function touchedPath(tool: string, input: Record<string, unknown>, root: string): string | undefined;
export interface ContextSeen {
    key: string;
    item: string;
    state: string;
    rev: number;
    text: string;
}
/**
 * .geml/context.geml as the hooks module reads it (spec §5.4): the stage text
 * of `text {#current}`, and the item, state and rev of `data {#stage}`. A
 * block whose fence never closes, or a stage block that is not JSON, is no
 * context at all.
 */
export declare function contextOf(doc: string): ContextSeen | undefined;
/** The major version in `node --version`'s output. */
export declare function nodeMajor(text: string): number | undefined;
