/** The project's home: where its workflows, dictionary, journals and session records are — the main working tree's copy of `root`, else `root`. */
export declare const homeOf: (root: string) => string;
/** What git is told to leave alone in a `.geml/` directory: gemworks's own files, local and never committed, this list among them. */
export declare const GITIGNORE: string;
/** Give a `.geml/` directory its .gitignore when it has none, and the current list where it has one gemworks wrote before. */
export declare function ensureGitignore(gemlDir: string): void;
/** One workflow the project has: its name and its file. */
export interface InstalledWorkflow {
    name: string;
    path: string;
}
/**
 * The workflows a project has, by name: the home's files, then the earlier
 * layout's directories — the checkout's, then the home's — for a name the
 * home has no file of.
 */
export declare function installedWorkflows(root: string, home?: string): InstalledWorkflow[];
/** The project document, the home's; undefined when there is none. */
export declare function projectDocOf(root: string, home?: string): string | undefined;
/** How a journal names a workflow file: relative to the home when it lies there, else to the checkout; `/`-separated. */
export declare function recordedPath(root: string, home: string, path: string): string;
/**
 * The workflow file a journal names: the home's; a name of the earlier layout
 * (`.geml/workflows/<name>/flow.geml`) is the home's `<name>.geml` once that
 * is there, wherever the directory still is; else the checkout's. Undefined
 * when none is there.
 */
export declare function workflowAt(root: string, home: string, recorded: string): string | undefined;
/**
 * A workflow's name as the project calls it: its file's under
 * `.geml/workflows/`, its directory's in the earlier layout, else its
 * directory relative to the checkout.
 */
export declare function workflowNameOf(root: string, path: string): string;
/**
 * Where a workflow's tool dictionary is (spec §5.3): the project's one,
 * `.geml/tools.geml`, for a workflow file of the project's; beside the flow
 * file for any other (a directory of the earlier layout, a bundled workflow).
 * Works on relative paths too.
 */
export declare function dictionaryPathOf(workflowFile: string): string;
/**
 * A workflow directory's flow as one file (`name` is the workflow's): its
 * guide's sections after the statechart, each `./guide.geml#id` now `#id`. A
 * guide that cannot be taken in — named whole, or with an id the flow file
 * has too — stays a document of its own, as does any other a state names
 * with `./`: those are `extra`, to go in `<name>/` beside the file, and their
 * references name them there. `read` reads a file of the directory.
 */
export declare function mergedWorkflow(name: string, flow: string, read: (file: string) => string | undefined): {
    text: string;
    extra: Map<string, string>;
};
/**
 * Rows of another dictionary added to the project's, under its lock: a key
 * the project's has stays as it is, and a second default for a use is no
 * default. With `uses`, only the rows bound to one of them. A project
 * dictionary that does not read is left alone. Answers how many were added.
 */
export declare function mergeTools(home: string, source: string, uses?: ReadonlySet<string>): number;
/** Write a workflow into the home as `<name>.geml`, with the documents it keeps beside it in `<name>/`. */
export declare function writeWorkflow(home: string, name: string, merged: {
    text: string;
    extra: ReadonlyMap<string, string>;
}): string;
/** A file of a workflow directory, if there is one there (and it lies inside it). */
export declare function readIn(dir: string, file: string): string | undefined;
/** What one step of a move did: `from` is read into `to`; `kept` when git tracks `from`, which stays where it is (removing it is a commit the person makes); else `trashed` is where it went. */
export interface Moved {
    from: string;
    to: string;
    kept: boolean;
    trashed?: string;
}
/**
 * Move the earlier layout into the home (the checkout's, then the home's own):
 * each workflow directory becomes `.geml/workflows/<name>.geml`, its guide
 * taken in; its dictionary's rows join `.geml/tools.geml`. A file the home has
 * already is kept, never overwritten. What git tracks is copied and stays; the rest goes to `trash`.
 * The home's `.geml/` gets its .gitignore. Answers what moved; nothing when
 * there is nothing of the earlier layout.
 */
export declare function migrateLayout(root: string, trash: string, home?: string): Moved[];
