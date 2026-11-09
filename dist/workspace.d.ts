import { type GhFacts, type RepoFacts } from "./host-git.js";
import { type Dictionary, type Lesson } from "./core/dictionary.js";
import type { HostTools } from "./core/host-tools.js";
import { workflowNameOf } from "./project-home.js";
export { workflowNameOf };
import { type FlowPolicy } from "./core/policy.js";
import { type Dependency, type Status } from "./core/status.js";
import { type Statechart } from "./core/statechart.js";
import { type Invoked } from "./core/supervisor.js";
import { type Item } from "./core/unit.js";
/** git's facts about the project, including whether it is a repository whose HEAD has no commit yet. */
export type RepoInfo = RepoFacts;
export interface WorkspaceOptions {
    root: string;
    /** The tools this host runs commands and writes files with (core/host-tools.ts). */
    tools: HostTools;
    now?: () => string;
    /**
     * For `flow-unit = "file:…"`: the file a write tool touched last, relative
     * to the root or absolute, either separator. Absent (or not a file of the
     * unit), the work item the context document names is kept while its file
     * exists.
     */
    lastFile?: string;
    git?: (root: string) => RepoInfo;
    gh?: (root: string, branch: string) => GhFacts;
    /** A branch unit's content fingerprint (host-git's treeFingerprint unless given): read at the start of each operation when `tool` evidence can expire. */
    tree?: (root: string) => string | undefined;
    /** A state's prompt for Stagehand; defaults to resolving the reference in process (resolvePromptRef). */
    getPrompt?: (ref: string, workflowFile: string, root: string) => string | undefined;
    /**
     * The directory whose `.geml/journals/` holds the journals: unless given,
     * the main working tree's copy of the root, which every checkout of the
     * repository shares, or the root itself outside one (host-git's
     * journalBaseOf). The context document stays the root's own.
     */
    journalBase?: string;
    /**
     * Start the work item's journal only when an operation records something in
     * it — evidence, a refusal: the workspace of a work item a call was
     * attributed to from elsewhere, which may never be worked on here.
     */
    lazy?: boolean;
    /**
     * False for a workspace acting for a work item that is not its checkout's
     * current one (a file a command named): the context document stays the
     * current item's, and a stage change's text is built without writing it.
     */
    writesContext?: boolean;
}
export interface AfterEvent {
    tool: string;
    callId?: string;
    isError: boolean;
    input?: Record<string, unknown>;
    /** A run tool's exit status; null when the call went to the background. */
    exitCode?: number | null;
    /** The path a write tool touched; one under .geml, .git or node_modules is no file variable's. */
    wrotePath?: string;
    /** Which of the command line's simple commands (signalHeads' order) this work item takes the `tool` evidence of; absent, every one. */
    commands?: readonly number[];
    /**
     * Only that evidence: the call as a whole acted for another work item, so
     * the file and git variables are not read again here.
     */
    commandsOnly?: boolean;
}
/** What an operation did to the stage: the states it entered by a transition, and the new stage text when the stage changed and the context document holds it (or, for a workspace that does not write the document, as built). */
export interface StageChange {
    entered: string[];
    context?: string;
}
export type { NextStep, Status } from "./core/status.js";
/** What a host shell keeps after every request: the status, and the policy its fast path decides from (core/policy.ts). */
export interface ShellView {
    status: Status;
    policy: FlowPolicy;
}
/** `before` for a host shell: the gate's answer, whether it was recorded, and the view after it. */
export interface BeforeView extends ShellView {
    refusal?: string;
    recorded: boolean;
}
/** Why no workflow was resolved: there is none, there are several and none is chosen, or the one named is not there (or not a name). */
export type WorkflowProblem = "none" | "ambiguous" | "invalid";
export type ResolvedWorkflow = {
    name: string;
    path: string;
} | {
    error: string;
    kind: WorkflowProblem;
};
/**
 * A workspace, or why there is none: the workflow did not resolve (its
 * `WorkflowProblem`; a workflow that does not check out is `invalid` too), or
 * the work item's journal cannot be resumed (`journal`).
 */
export type Opened = {
    ok: true;
    ws: Workspace;
} | {
    ok: false;
    reason: string;
    kind: WorkflowProblem | "journal";
};
/** What a state's `prompt` finds: the text, nothing (no such file or block), or a path outside the project. */
export type PromptRef = {
    kind: "found";
    text: string;
} | {
    kind: "missing";
} | {
    kind: "outside";
};
/**
 * Resolve a state's `prompt` — a section (`#id` of the workflow file,
 * `doc.geml#id`) or a whole document (`./guide.geml`) — `./` from the
 * workflow's directory, anything else from the project root — the one way
 * Stagehand and `gemworks check` both read it. Symbolic links are resolved
 * before the path is judged: a file that then lies outside the project is
 * `outside`, never read; a `./` reference may also lie in the workflow
 * directory's own real place, so a workflow linked in from elsewhere still
 * reads its own documents.
 */
export declare function resolvePromptRef(ref: string, workflowFile: string, root: string): PromptRef;
/** Another document a statechart refers to (a guard's `doc.geml#id`), relative to the workflow's directory and inside the project; null when there is none. */
export declare function docReader(workflowDir: string, root: string): (rel: string) => string | null;
/** Which workflow is active: GEMWORKS_STATECHART, else the one the project document names, else the only workflow (the home's files, then the earlier layout's directories). */
export declare function resolveWorkflow(root: string, env?: Record<string, string | undefined>): ResolvedWorkflow;
/** The glob of a workflow whose work item is a file (its meta `flow-unit = "file:<glob>"`), read without loading it; undefined for any other. */
export declare function fileUnitOf(path: string): string | undefined;
/**
 * The workflows that run beside the default (spec: several flows side by
 * side): every other installed workflow whose work item is a file, with its
 * glob. A file one of them takes is that workflow's work item.
 */
export declare function sideFlows(root: string, defaultPath: string): {
    name: string;
    path: string;
    glob: string;
}[];
/** What one work item's journal says of it, for another that names it: its state and whether that is final, when it began and last moved, the files it wrote (newest first), its name and its flow's title. */
export interface ItemProgress {
    id: string;
    title?: string;
    flow?: string;
    state: string;
    stateTitle?: string;
    final: boolean;
    since: string;
    at: string;
    wrote: string[];
}
/** The flows read while answering one request, by their file: loaded once each. */
export type FlowCache = Map<string, {
    sc: Statechart;
    title: string;
} | null>;
/** Another work item's progress, from its journal (under `journalBase`) and its file; undefined while it has no journal. */
export declare function itemProgress(root: string, journalBase: string, id: string, flows: FlowCache, defaultFile?: string): ItemProgress | undefined;
/** The work items an item file waits for: its meta `depends`, ids apart by spaces or commas. */
export declare function dependsOf(source: string): string[];
/**
 * A workspace that has started nothing: the item's journal is neither created
 * nor appended to, and the context document is left as it is — for looking
 * before acting. Its operations work as on any workspace: the first one starts
 * the journal if there is none. The work item is resolved by the project's
 * default workflow (its unit); an item whose journal was started under another
 * workflow file goes on under that one, and a new item starts under the
 * default. A journal whose workflow file is gone does not open: restore the
 * file, or move the journal aside to start over under the default.
 */
export declare function loadWorkspace(o: WorkspaceOptions): Opened;
/** The project's workspace, its work item's journal started (or checked that it can be resumed) and the context document in line with it. */
export declare function openWorkspace(o: WorkspaceOptions): Opened;
export declare class Workspace {
    private readonly o;
    readonly workflowName: string;
    readonly workflowPath: string;
    readonly sc: Statechart;
    private readonly getPrompt;
    readonly title: string;
    /** The project's default workflow, when this workspace is on another (the item's own). */
    private readonly defaultName?;
    readonly item: Item;
    /** Under `flow-unit = "file:…"`, the work item's file: project-relative, `/`-separated. Undefined under a branch unit or with no work item. */
    readonly itemFile: string | undefined;
    /** The workflow's directory: its flow file, its prompt documents and its dictionary. */
    readonly workflowDir: string;
    private readonly now;
    /** The project root with its links resolved: every path is judged inside this. */
    private readonly realRoot;
    /** git's facts once read; see `repo`. */
    private repoFacts;
    /** The branch's content fingerprint, once read. */
    private tree;
    /** The workflow file as the journal head names it: relative to the home when it lies there (else to the root), `/`-separated. */
    private readonly workflowFile;
    /** See `journalBase`. */
    private base;
    /** Whether an operation of this workspace started the work item's journal. */
    private startedHere;
    constructor(o: WorkspaceOptions, workflowName: string, workflowPath: string, sc: Statechart, getPrompt: (ref: string, workflowFile: string, root: string) => string | undefined, title: string, 
    /** The work item as the default workflow's unit resolved it, for a workspace on the workflow the item's journal names; absent, resolved here. */
    given?: {
        item: Item;
        file?: string;
    }, 
    /** The project's default workflow, when this workspace is on another (the item's own). */
    defaultName?: string | undefined);
    /** git's facts, read the first time they are needed: at once for a branch unit, otherwise only when a git variable (or gh) asks; `refresh` reads them again. */
    private get repo();
    private resolveItem;
    /**
     * A path as the project names it — relative to the root, `/`-separated — or
     * undefined outside the project or under a directory that keeps it from
     * `glob` (hiddenDir: .git, node_modules, and .geml unless the glob names it). Links
     * are resolved on both sides, so a root reached through a link and a path
     * reported through the real one (or the other way round) agree; the path's
     * own name is kept, so a link to a file is named as itself, as the project
     * walk names it.
     */
    private projectPath;
    /**
     * The file of this workflow's `file:` unit a path names — relative to the
     * root or absolute, either separator — as the project names it; undefined
     * for any other path, and under a branch unit.
     */
    itemFileOf(path: string): string | undefined;
    /** The file of the work item the context document names, while it exists and is a file of the unit. */
    private rememberedFile;
    /**
     * The file a `file:` unit's work item is — its id is the file's project
     * path without the extension — while the file exists and matches the unit's
     * glob; undefined under a branch unit, or when the file is gone.
     */
    fileOfItem(id: string, glob?: string): string | undefined;
    /** Whether this workspace started the work item's journal: the item is new. */
    get startedJournal(): boolean;
    /** The project root this workspace was opened on, as given. */
    get root(): string;
    /** The directory whose `.geml/journals/` holds the journals (WorkspaceOptions.journalBase), found the first time it is needed. */
    get journalBase(): string;
    /** Where every work item's journal lives. */
    get journalsDir(): string;
    /** The work item's content fingerprint as it stands now (the one `tool` evidence is stamped with); undefined when none applies. */
    contentTree(): string | undefined;
    /** The work item's journal; undefined with no work item. */
    get journalPath(): string | undefined;
    /** The workflow's tool dictionary as it stands on disk (spec §5.3), read afresh: another process may have learned since. */
    dictionary(): Dictionary;
    /** A person answered (spec §5.3 step 6): write the lessons into the dictionary, under its lock. */
    learn(lessons: readonly Lesson[]): void;
    /** Whether one simple command, as a key, is bound to a use some `tool` variable reads: its exit status is evidence somewhere in the workflow. */
    commandSpeaks(head: string): boolean;
    /** A path for a message: relative to the root when it lies inside, else whole. */
    private shown;
    /** The context document as it stands; undefined when there is none, or it is not a file that can be read. */
    private readContext;
    private inactiveReason;
    /**
     * Start this item's journal (and so its context document) if it has none;
     * otherwise check the journal can be resumed, and bring the context document
     * in line with it. Returns why the journal cannot be resumed, or undefined.
     */
    ensureStarted(): string | undefined;
    /**
     * The work item's content as one hash, for the `tool` evidence that expires
     * on a change (none, no fingerprint): the checkout's HEAD and status under a
     * branch unit, the episode file's text under a `file:` unit. Read before an
     * operation takes the journal's lock.
     */
    private fingerprint;
    /**
     * Read the journal (or start one) and put a Supervisor over it; its appends
     * are collected, not written. A journal that goes on first expires the
     * evidence its work item's content no longer bears (`tree`, Supervisor.expire).
     */
    private begin;
    /** Append what the operation produced, and say what it did to the stage. Called under the journal's lock. */
    private finish;
    /**
     * After the journal's lock is released: bring the context document in line
     * with the journal, and say what the operation did to the stage — with the
     * stage text when it changed the stage. The operation is recorded by now, so
     * a document that cannot be written never fails it: its result goes without
     * the text, and the next operation writes the document.
     */
    private staged;
    /** The stage text of `snap`, built and not written. */
    private stageText;
    /**
     * Make the context document speak for this item's current stage unless it
     * already does — it names the item and the state, and was written during
     * this entry of the stage (a revision from the entry to now: evidence or a
     * patch inside the stage leaves the stage text as it is, and only the
     * `#vars` view beside it is rewritten). Returns the stage text it then holds.
     */
    private reconcile;
    /** Rewrite the document's `#vars` view, its stage block as it was, while the document still speaks for `was`. */
    private writeVars;
    /**
     * Lock, read the journal, build a Supervisor over it, run `fn`, append what
     * it produced, release; then bring the context document in line. A lazy
     * workspace whose operation recorded nothing in a journal that is not there
     * yet writes nothing at all.
     */
    private act;
    /** The state the item file says the item stands in, for a workflow that keeps it there (`flow-state-key`); undefined otherwise. */
    private itemStateOnDisk;
    /**
     * Keep a file unit's item file saying where the item stands — the meta key
     * the workflow names (`flow-state-key`) — so the state travels with the file. Written only when it says
     * otherwise; a file that is gone, or a meta that cannot take the value, is
     * left as it is: the operation is recorded, and the next one tries again.
     */
    private keepItemState;
    /**
     * Write the context document for `snap` under the document's own lock (it
     * is shared by every work item) and return the stage text it now holds.
     * A document another process wrote for a later revision of the same item
     * stands, and its text is returned; a new journal's document always wins.
     */
    private writeContext;
    status(): Status;
    /** What a host shell's fast path decides from: see core/policy.ts. */
    policy(): FlowPolicy;
    /** The status and the policy together, from one read of the journal: what a host shell keeps after every request. */
    view(): ShellView;
    /**
     * `before` for a host shell: the gate's answer (spec §5.3) — a refusal,
     * recorded, or nothing — and the status and policy after it, from one read
     * of the journal.
     */
    beforeView(tool: string, callId?: string, input?: Record<string, unknown>, waived?: readonly string[]): BeforeView;
    /** Run `fn` under the journal's lock, then read the status and the policy from the same Supervisor. gh is asked before the lock is taken. */
    private viewWith;
    /** The status as a Supervisor over this item's journal sees it; no Supervisor, no work item. */
    private statusFrom;
    private dependsRead;
    /** The work items this one waits for (its item file's meta `depends`), each with how far it is; read once per request. */
    dependencies(): Dependency[];
    /** Why the work item may not move to `to` yet: a work item it waits for is not done. Back to the start is always open. */
    private waitingReason;
    private titleRead;
    /** What the work item is called: its item file's meta `title`, read once per request; a branch has none. */
    private itemTitle;
    /** Before a tool call: the reason to refuse it, or undefined. */
    before(tool: string, callId?: string, input?: Record<string, unknown>): string | undefined;
    /**
     * After a tool call: the evidence it is for — `tool`, from its exit status
     * or its error; `file`, from a walk of the project; git's facts when it ran
     * git or gh — and what the stage became. git's facts are the ones this
     * workspace read (when it opened, for a branch unit); a workspace that lives
     * across operations calls `refresh` to read them again.
     */
    after(ev: AfterEvent): StageChange;
    /** Read git's facts again, as they are now, then gh's and the file variables' (session start, board refresh, after a git operation). */
    /** Read git's and the files' facts again and take what they say. `reread: false`, for a workspace that has just opened: git's facts it read then are this moment's. */
    refresh(o?: {
        reread?: boolean;
    }): StageChange;
    /** A model verb (move, set); an accepted one that changed the stage carries the new stage text. A move waits for the work items this one depends on. */
    verb(name: string, args: Record<string, unknown>, callId?: string): Invoked;
    /** A person moves the workflow. */
    advance(to: string): ({
        ok: true;
        entered: string[];
    } | {
        ok: false;
        reason: string;
    }) & {
        context?: string;
    };
    /** A person ticks or clears a variable whose source is a person. */
    mark(name: string, checked: boolean): ({
        ok: true;
        entered: string[];
    } | {
        ok: false;
        reason: string;
    }) & {
        context?: string;
    };
    /** A person holds the work item (spec §5.5): evidence is still recorded, no transition is taken until they resume it. */
    pause(): {
        ok: true;
    } | {
        ok: false;
        reason: string;
    };
    /** A person lets the work item go; a machine-judged transition that holds by now is taken, as theirs. */
    resume(): ({
        ok: true;
        entered: string[];
    } | {
        ok: false;
        reason: string;
    }) & {
        context?: string;
    };
    /** A person's rollback: the recorded state only. */
    rollback(target: number | "checkpoint"): ({
        ok: true;
        rev: number;
        restores: number;
        state: string;
        entered: string[];
    } | {
        ok: false;
        reason: string;
    }) & {
        context?: string;
    };
    /**
     * The current stage text from .geml/context.geml, for this work item: a
     * document that speaks for another item (or none at all) is first rewritten
     * from this item's journal. Undefined with no work item, or when the
     * document cannot be written.
     */
    context(): string | undefined;
    /**
     * The workflow file this item's journal head names (project-relative), when
     * it is another than this workspace's. Reads the journal's `#journal`
     * block; writes nothing.
     */
    journalWorkflow(): string | undefined;
    /** The file variables' values, from a walk of the project. */
    private fileValues;
    /** Whether a variable reads gh: a git fact other than `committed`. */
    private readsGh;
    /** The git variables' values; gh is asked only when a variable reads it. */
    private gitValues;
    /** The CI workflows that finished failing on this branch's head, and the head; undefined when gh is not read, or says nothing failed. */
    ciFailures(): {
        head: string;
        workflows: string[];
    } | undefined;
    /** What gh says about this branch; not asked off a branch (no repository, no commits yet, a detached HEAD). */
    private ghFacts;
}
