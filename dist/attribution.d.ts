import { type Checkout } from "./host-git.js";
import type { Lesson } from "./core/dictionary.js";
import type { HostTools } from "./core/host-tools.js";
import { type BeforeView, type ShellView, type StageChange, type Workspace } from "./workspace.js";
/**
 * Where a directory lies for the session: its own checkout; another checkout
 * whose project has a workflow (`root`, that project's directory there);
 * elsewhere — another repository with no workflow, or no repository and
 * outside the project; or not known (a directory the command line does not
 * say, or a call whose commands run in different places).
 */
export type Place = {
    kind: "session";
} | {
    kind: "other";
    root: string;
} | {
    kind: "elsewhere";
} | {
    kind: "unknown";
};
/** Where the directories of one session's calls lie, each asked of git at most once. */
export declare class Places {
    private readonly root;
    private readonly find;
    private readonly realRoot;
    /** The session's own checkout: undefined until asked, null when the root is in none. */
    private sessionCheckout;
    private readonly seen;
    constructor(root: string, find?: (dir: string) => Checkout | undefined);
    of(dir: string | undefined): Place;
    private locate;
}
/**
 * Where a call as a whole acts — what judges it before it runs, and what its
 * outcome, the files it made and the git it ran are read against after it: a
 * file-writing tool's file's directory; for a command line, the place every
 * simple command but a directory change runs in, unknown when they differ or
 * the line moves the shell where it cannot be followed; otherwise the
 * directory the call starts in.
 */
export declare function callPlace(tool: string, input: Record<string, unknown>, start: string, places: Places): Place;
/** A finished call as the hooks module reports it to `after`. */
export interface AfterCall {
    tool: string;
    callId: string;
    input: Record<string, unknown>;
    isError: boolean;
    exitCode?: number | null;
    /** The written path, relative to the session's root (readers.ts's touchedPath). */
    wrotePath?: string;
    gitOperation: boolean;
}
/** What a call did: the session item's stage change, and the new stage text of another work item it was attributed to. */
export interface Attributed extends StageChange {
    routed?: {
        item: string;
        context: string;
    };
}
/** What `before` answers for a call: the gate's refusal, whether it was recorded, and the session's view after it. */
export type Before = Pick<BeforeView, "refusal" | "recorded"> & {
    view?: ShellView;
};
/** Opens the workspace of a work item a call was attributed to: the session's options on another root, or for another file of the unit. */
export type OpenAttributed = (o: {
    root: string;
    journalBase: string;
    lastFile?: string;
    writesContext?: boolean;
}) => Workspace | undefined;
export declare class Attribution {
    private readonly session;
    private readonly open;
    private readonly tools;
    readonly places: Places;
    private readonly opened;
    constructor(session: Workspace, open: OpenAttributed, tools: HostTools, find?: (dir: string) => Checkout | undefined);
    /** Where the call as a whole acts (callPlace). */
    placeOf(tool: string, input: Record<string, unknown>, start: string): Place;
    /**
     * `before` for a call. In the session's checkout, or where the line does not
     * say, the session's work item judges it as it always has, and `view` is the
     * session's after it, from the same read. In another checkout that
     * checkout's work item judges it and records it there; anywhere else only
     * the person-only refusal holds, recorded nowhere. A work item elsewhere
     * that cannot judge (its journal will not resume) lets the call through.
     */
    before(tool: string, callId: string, input: Record<string, unknown>, start: string, waived?: readonly string[]): Before;
    /**
     * A person's answer about a call (spec §5.3 step 6) goes into the dictionary
     * of the work item that judges the call: the session's, or another
     * checkout's. False when no work item takes it (the call acts elsewhere).
     */
    learn(lessons: readonly Lesson[], tool: string, input: Record<string, unknown>, start: string): boolean;
    /**
     * `after` on every work item the call was attributed to. The work item where
     * the call as a whole acted takes its outcome as evidence, the file
     * variables and the git it ran; each simple command's evidence goes to the
     * work item of the directory it ran in (under a `file:` unit, the file it
     * names). A work item reached elsewhere that fails never fails the
     * session's answer.
     */
    after(call: AfterCall, start: string): Attributed;
    /** The file a file-writing tool names, absolute. */
    private written;
    /**
     * The current work item's workspace of a place a call reached: the
     * session's own, or another checkout's — opened for `lastFile`, a written
     * file, which under a `file:` unit is the work item.
     */
    private current;
    /**
     * The work item one simple command's evidence goes to: under a `file:` unit
     * the file it names, relative to the directory it runs in — none when it
     * names more than one, or a glob that may match several — and the current
     * work item when it names none; under a branch unit, the current work item.
     */
    private itemFor;
    private cached;
}
