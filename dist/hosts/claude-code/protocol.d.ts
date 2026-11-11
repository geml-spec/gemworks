import type { Flow, Overlay } from "@geml/geml/dist/statechart-svg.js";
import type { DictRow, Lesson } from "../../core/dictionary.js";
import type { FlowPolicy } from "../../core/policy.js";
import type { JsonValue } from "../../core/schema.js";
import type { Judge } from "../../core/statechart.js";
import type { VerbName } from "../../core/verb-specs.js";
import type { Status } from "../../workspace.js";
import type { Suggestion } from "../../project.js";
import type { AttentionFacts } from "./attention.js";
import type { HostInfo } from "./env.js";
import type { MemoryList } from "../../memory-store.js";
import type { Practice } from "../../core/practices.js";
import type { LabelledPrompt, LedgerCard, PracticeCount, Theme, ThemeAnswer, ToCheck, WorkKind } from "../../core/corrections.js";
import type { QueuedMessage } from "../../core/transcript.js";
import type { Transcript } from "../../core/transcript.js";
export type { VerbName } from "../../core/verb-specs.js";
export declare const PROTOCOL_VERSION = 1;
/** How long one bridge call may take before the hooks module lets the tool call through. */
export declare const BRIDGE_TIMEOUT_MS = 15000;
/** Calls that ask git and gh, or copy files: refresh, board, use, add. */
export declare const SLOW_TIMEOUT_MS = 45000;
/** gh's availability as the last answer reported it; a request carries it back so cheap ops need not ask gh. */
export type GhSeen = NonNullable<Status["gh"]>;
/**
 * `cwd` on before, after and learn: the absolute directory the call starts in —
 * the directory of the loop that makes it (the main loop's shell, a subagent's
 * worktree), read as the call begins. The call is attributed to the checkout
 * and work item it acts in. The CLI reads a request that has none (a test's,
 * another client's) as starting at the root. `delivered` on after and verb,
 * for a call of the main loop only: `<item>@<rev>` of the stage text the main
 * loop last read; an answer on another work item hands that item over
 * (`handoff`).
 */
export type BridgeOp = 
/** `migrate`: a session's first status, which moves the earlier layout into the project's home first. */
{
    op: "status";
    migrate?: boolean;
} | {
    op: "refresh";
}
/** `waived`: keys (dictionary keys, command patterns) a person let through for this one call (the board's "allow once"); nothing is learned. */
 | {
    op: "before";
    tool: string;
    callId: string;
    input: Record<string, unknown>;
    cwd: string;
    waived?: string[];
} | {
    op: "after";
    tool: string;
    callId: string;
    input: Record<string, unknown>;
    isError: boolean;
    exitCode?: number | null;
    wrotePath?: string;
    gitOperation: boolean;
    cwd: string;
    delivered?: string;
} | {
    op: "verb";
    name: VerbName;
    args: Record<string, unknown>;
    callId?: string;
    delivered?: string;
}
/** A person's answer about a call (spec §5.3 step 6), written into the dictionary of the work item the call is attributed to. */
 | {
    op: "learn";
    lessons: Lesson[];
    tool: string;
    input: Record<string, unknown>;
    cwd: string;
} | {
    op: "mark";
    variable: string;
    checked: boolean;
} | {
    op: "advance";
    to: string;
}
/** A person holds the work item, or lets it go (spec §5.5). */
 | {
    op: "pause";
} | {
    op: "resume";
}
/** A new work item's file, made at a person's word: its meta `title` and `by`, then its text. The path must be one a flow's file unit takes, and not there yet. */
 | {
    op: "new-item";
    path: string;
    title: string;
    text: string;
}
/** A person restores an earlier revision's state and variables (`gemworks rollback <rev>`). */
 | {
    op: "rollback";
    rev: number;
} | {
    op: "bind";
    id: string;
} | {
    op: "use";
    workflow: string;
} | {
    op: "add";
    workflow?: string;
}
/** Write a workflow from a path (a directory with flow.geml, or a .geml file) into the project's .geml/workflows/; answers `added`. */
 | {
    op: "import";
    path: string;
} | {
    op: "board";
}
/** Every artifact the project's work made, under any work item, workflow or none: answers `made` (MadeAll). */
 | {
    op: "made";
}
/**
 * What the repository says for the band (attention.ts): branches ahead of their upstream, open pull requests and their
 * checks; with `session`, that session is marked open and the branches other open sessions work on come back.
 */
 | {
    op: "attention";
    session?: string;
}
/**
 * A turn's end: a version of each file the current work item wrote that git does not keep, when its content changed
 * (artifacts-store.ts). With no workflow work item, `item` is the work item the turn is on (the coach's) and `written`
 * the project paths the turn wrote: no journal has them.
 */
 | {
    op: "artifacts";
    elsewhere?: string[];
    notMade?: string[];
    item?: string;
    written?: string[];
}
/**
 * An artifact of the current work item gemworks did not see made: a link (a
 * publish tool's result; `page` the published file, whose title names it)
 * or a file's version (a generated picture). Answers `text`. With no
 * workflow work item, it goes under `item`, the one the turn is on.
 */
 | {
    op: "artifact";
    kind: "link" | "image" | "file";
    where: string;
    name?: string;
    version?: string;
    page?: string;
    data?: string;
    mediaType?: string;
    item?: string;
}
/**
 * Write a file under `.geml/exports/`, or `to` where the person said (a
 * folder, or a file ending in the format's extension; `~` the home, a
 * relative path the project's), and answer its path and text: the work
 * item's journal (as GEML, a Markdown revision table, or JSON), a copy of the
 * work item's workflow directory, or `text` the shell built (the share
 * dialog, a session export). `strip` takes the project's and the home
 * directory's absolute paths out of the text first.
 */
 | {
    op: "export";
    kind: "journal" | "workflow" | "text";
    format: "geml" | "md" | "json";
    name?: string;
    text?: string;
    strip?: boolean;
    to?: string;
}
/** The host's transcripts of this project's checkouts (transcript.ts), newest first; `transcripts` is the folder they are under (a test's), else ~/.claude/projects. */
 | {
    op: "backfill-list";
    transcripts?: string;
}
/**
 * One transcript into the shared session record and the work items'
 * artifacts. `own`: the session asking, whose log the hooks module alone
 * writes — the turns come back for it to put before the log's own.
 */
 | {
    op: "backfill-one";
    file: string;
    own?: boolean;
    transcripts?: string;
}
/** The sign-off sheets of these work items, written again from the record; a done one's goes among its artifacts. */
 | {
    op: "signoff";
    ids: string[];
    lang?: string;
}
/** The prompt rows the host's transcript of `session` still holds, by uuid: what the sessions tab and the record keep after turns were removed or split away. */
 | {
    op: "turn-ids";
    session: string;
    transcripts?: string;
}
/** The project's Claude Code memory (memory-store.ts), as the sessions tab shows it. */
 | {
    op: "memory";
    transcripts?: string;
}
/** One memory's index line given a new hook. */
 | {
    op: "memory-set";
    file: string;
    hook: string;
    transcripts?: string;
}
/** One memory moved into gemworks's trash, its index line dropped. */
 | {
    op: "memory-delete";
    file: string;
    transcripts?: string;
}
/** Every layer's practices (practice-store.ts). */
 | {
    op: "practices";
}
/** Practices the hooks module checked (core/practices.ts newPractices), written into their layers; `memory` marks the project's memory moved in. */
 | {
    op: "practice-add";
    practices: Practice[];
    memory?: boolean;
}
/** One practice taken out (a tombstone), moved between the person's and the project's layers, or made one for every flow and step (`everywhere`). */
 | {
    op: "practice-set";
    id: string;
    deleted?: boolean;
    layer?: "personal" | "project";
    everywhere?: boolean;
}
/** Practices moved into the team's layer: the repository's .gemworks/practices.geml. */
 | {
    op: "practice-share";
    ids: string[];
}
/** The ledger of corrections as the flow tab shows it (core/corrections.ts); `toTheme`: what a theme request and a check request read, when `session` holds the claim to put corrections in themes. */
 | {
    op: "corrections";
    toTheme?: boolean;
    session?: string;
}
/** Prompts the hooks module labelled, added to the ledger. */
 | {
    op: "corrections-add";
    prompts: LabelledPrompt[];
}
/** A theme answer the hooks module read (ids, not handles), applied; `linked` the practices it linked against. */
 | {
    op: "corrections-themes";
    answer: ThemeAnswer;
    linked: string;
}
/** A card put away, with what it counted. */
 | {
    op: "corrections-dismiss";
    key: string;
    n: number;
}
/** Corrections read against their theme's rule (core/corrections.ts checkRequest): each holds, or leaves its theme. */
 | {
    op: "corrections-check";
    verdicts: {
        id: string;
        practice: string;
        holds: boolean;
    }[];
};
/** A transcript the host keeps: its file, the session's id (the file's name), its size. */
export interface TranscriptFile {
    file: string;
    id: string;
    size: number;
}
/** backfill-list: the transcripts; backfill-one: what one added (`skipped`: a session still writing its own log); turn-ids: the prompt rows a transcript holds. */
export type Backfill = {
    sessions: TranscriptFile[];
} | {
    uuids: string[];
    messages?: QueuedMessage[];
} | {
    id: string;
    turns: number;
    files: number;
    links: number;
    skipped?: boolean;
    transcript?: Transcript;
};
export type BridgeRequest = {
    v: 1;
    root: string;
    lastFile?: string;
    gh?: GhSeen;
} & BridgeOp;
export interface ShellStatus {
    status: Status | null;
    policy: FlowPolicy | null;
    /** `<item>@<rev>` of .geml/context.geml; null when there is none. */
    contextKey: string | null;
    /** Why there is no status; quiet when the project simply has no workflow. */
    problem?: {
        text: string;
        quiet: boolean;
    };
    /** No workflow yet: the bundled one that fits what the project holds, for the band's offer. */
    suggest?: Suggestion;
    /** The CLI's locale (`Intl`), for a shell that follows the system's language. */
    locale?: string;
    /** The plugin's and the parser's versions, as the CLI runs them. */
    versions?: {
        gemworks: string;
        parser: string;
    };
    /** The globs of the workflows whose work items are files, the default's and those beside it: a file one takes is a work item. */
    units?: string[];
}
/** The most to-do items the band counts; past it the band shows `999+` (spec §7.2). */
export declare const TODO_CAP = 999;
/**
 * The work item's to-do count when its file is a geml-media entry (spec §7.2):
 * display only. `state` is the stage it was read in, and the band shows it only
 * while the work item is still in that stage. `count` stops at TODO_CAP + 1,
 * which reads "more than TODO_CAP".
 */
export interface TodoCount {
    item: string;
    state: string;
    count: number;
}
export type TimelineEntry = 
/** `changed`: the variables this revision changed, with their new values; `tree`: the content fingerprint `tool` evidence was stamped with. */
{
    kind: "snapshot";
    rev: number;
    at: string;
    state: string;
    cause: string;
    by?: string;
    signal?: string;
    from?: string;
    restores?: number;
    call?: string;
    tree?: string;
    changed?: Record<string, JsonValue>;
}
/** `key`: the dictionary key or command pattern the gate judged, when it judged one. */
 | {
    kind: "refused";
    n: number;
    rev: number;
    at: string;
    tool: string;
    reason: string;
    call?: string;
    key?: string;
};
export interface BoardData {
    /** What one work item is: a branch, a file (`file:` unit), or a session (dsh). */
    unit: "branch" | "file" | "session";
    states: {
        id: string;
        title: string;
        description: string;
        initial: boolean;
        final: boolean;
        uses: string[];
    }[];
    /** The `elapsed` variables (spec §3.6): the clocks the flow page shows. */
    clocks: {
        name: string;
        iso: string;
        ms: number;
    }[];
    /** The work item's content fingerprint now: a `tool` evidence entry whose `tree` differs has expired or will. */
    tree?: string;
    transitions: {
        name: string;
        from: string;
        to: string;
        judge: Judge;
        approval: boolean;
        guard?: string;
        note: string;
    }[];
    /** Every use some state declares, with those states: a use is usable only in them. */
    fences: {
        use: string;
        states: string[];
    }[];
    /** The workflow's tool dictionary, as read. */
    tools: DictRow[];
    backlog: {
        key: "branch" | "file";
        items: {
            id: string;
            title: string;
            target: string;
        }[];
    } | null;
    /**
     * Every work item with a journal, the state its journal ends in, when its
     * journal was last written, whether a person holds it, its workflow when
     * that is not the default, and under a `file:` unit the file it is (when
     * still there), that file's meta `title` and its gist. `asks`: under the current
     * work item's workflow, the ways out of its state a person may take now
     * (theirs to take, the condition holding) while nobody holds it — each with
     * its button's words, its note, and whether it closes the work item.
     */
    items: BoardItem[];
    /** The current work item's journal: revisions and refusals, by revision. */
    timeline: TimelineEntry[];
    /** The flow picture (spec §8.2): what every host draws the flow tab from. */
    picture: FlowPicture;
    /** What the current work item's work made; absent when there is no work item or it has no journal yet. */
    artifacts?: Artifacts;
    /** The CI workflows that finished failing on the branch's head, and the head; absent when none did, or gh is not read. */
    ci?: {
        head: string;
        failed: string[];
    };
}
export interface BoardItem {
    id: string;
    state: string;
    rev: number;
    at: string;
    paused: boolean;
    workflow?: string;
    file?: string;
    title?: string;
    /** What the item file says first: its `#result` section's first line, else its text's; headings skipped. */
    gist?: string;
    /** The item file's meta `about`: `flow` or `tools` for a suggestion about the workflow or its dictionary. */
    about?: string;
    /** The item file's meta `by`: `model` for a work item the model raised itself. */
    by?: string;
    /** Its workflow's title; when its journal began; whether its state is final; the files it wrote, newest first. */
    flow?: string;
    /** Its state's title in its own flow. */
    stateTitle?: string;
    since?: string;
    final?: true;
    wrote?: string[];
    /** The work items it waits for (its file's meta `depends`), each done or not, and when it last moved. */
    depends?: {
        id: string;
        title?: string;
        done: boolean;
        at?: string;
    }[];
    asks?: {
        to: string;
        label: string;
        note: string;
        final: boolean;
    }[];
    /** Where it ended up, by git (the outline): being worked on, merged with its branch still there, closed, dropped. */
    end?: "doing" | "merged" | "closed" | "dropped";
    /** The worktree its branch is checked out in, relative to the main checkout; the commits its branch has of its own; its pull request. */
    worktree?: string;
    commits?: number;
    pr?: {
        number: number;
        state: "open" | "merged" | "closed";
    };
}
/**
 * What a work item's work made: the files its journal records as written,
 * newest first, one line per file; the commits git holds for its window, each
 * marked when it touched one of those files or the item file; and, under a
 * `file:` unit, the item file and its `#result` section.
 */
export interface Artifacts {
    item: string;
    /** Under a `file:` unit: the item file, a project path. */
    file?: string;
    /** The item file's `#result` section without its heading; absent when the file has none. */
    result?: string;
    written: {
        path: string;
        rev: number;
        at: string;
        tool: string;
    }[];
    /**
     * A branch's own commits; under a `file:` unit the ones made from the
     * journal's start until the item reached a final state, and any that
     * touched the item file. Newest first.
     */
    commits: {
        sha: string;
        at: string;
        subject: string;
        files: string[];
        ours: boolean;
    }[];
    /** What it made, by kind (core/artifacts.ts); absent when the artifacts table could not be read. */
    made?: Made;
}
/**
 * An artifact the board lists: a link, a file git does not keep, a picture.
 * `open`: the link, or the file where it is (its newest copy once it is
 * gone). `versions` newest first, each with its copy where there is one; a
 * GEML document's older versions are in `history`, its copy's .gemlhistory.
 * Paths are absolute.
 */
export interface MadeEntry {
    kind: "link" | "file" | "image";
    name: string;
    open: string;
    versions: {
        version: string;
        at: string;
        size: number | null;
        copy?: string;
    }[];
    history?: string; /** The person gave it (an upload); `name` is its file's name. */
    given?: true;
}
/** A work item's artifacts: links, files, pictures; the documents its commits changed (each with how many and when last); what its commits changed in all; the copies' directory. */
export interface Made {
    links: MadeEntry[];
    files: MadeEntry[];
    images: MadeEntry[];
    docs: {
        path: string;
        open: string;
        commits: number;
        at: string;
    }[];
    code: {
        commits: number;
        files: number;
    };
    folder: string;
}
/**
 * One artifact of the project's, whichever work item made it (the work items tab's 全部产物): the item it is under,
 * its kind, its name (a link's title, a file's path), what opens it (a link's address, else the file where it is, else
 * its newest copy), how many versions the table has, and the newest one's version and time.
 */
export interface MadeAllEntry {
    item: string;
    kind: "link" | "doc" | "file" | "image";
    name: string;
    open: string;
    versions: number;
    version: string;
    at: string; /** The person gave it (an upload). */
    given?: true;
}
/** Every artifact the project's work made, newest first: what stays when the work item that made it ends. */
export interface MadeAll {
    entries: MadeAllEntry[];
}
/**
 * The flow picture (spec §8.2): the chart's topology as the parser lays it
 * out (states by rank, edges by kind), what the runtime lays over it (the
 * current state, which ways out hold, the items per state, a hold, the
 * transition last taken, the ways out a person may take), and the same
 * picture as SVG for a surface that inlines markup. A host paints the first
 * two with its own elements, so a way out a person may take is a real button
 * wherever the board is drawn.
 */
export interface FlowPicture {
    flow: Flow;
    overlay: Overlay;
    svg: string;
}
/**
 * The ledger as the flow tab shows it: the cards, each practice's corrections before and after it, the kinds of work
 * corrected often with no flow; how many corrections wait for a theme, and whether the themes were linked against other
 * practices than there are now (`stale`); how many corrections a 失效 card would count wait to be read against the
 * practice (`unchecked`, pairs). `toTheme` and `toCheck` when asked: what a theme request and a check request read.
 */
export interface CorrectionsView {
    cards: LedgerCard[];
    counts: Record<string, PracticeCount>;
    flowless: {
        work: WorkKind;
        n: number;
        judgment: number;
        quotes: {
            at: string;
            text: string;
        }[];
    }[];
    unthemed: number;
    stale: boolean;
    unchecked: number;
    toTheme?: {
        corrections: LabelledPrompt[];
        themes: Theme[];
        practices: Practice[];
    };
    toCheck?: ToCheck[];
}
export type BridgeResponse = {
    v: 1;
    ok: true;
    shell: ShellStatus;
    refusal?: string;
    recorded?: boolean;
    entered?: string[];
    /** The new #current text, when the stage changed during this request, or the work item's stage text it hands over (`handoff`). */
    context?: string;
    /**
     * after and verb: the answer's work item is not the one whose stage the
     * main loop last read (the request's `delivered`). The line that goes
     * before `context`: `[gemworks] now on <item> · #<state> (new work item)`,
     * or `[gemworks] back on <item> · #<state> · rev <n> · <variable ✓|✗>…`.
     */
    handoff?: string;
    /**
     * after: the new stage text of another work item the call was attributed
     * to — another checkout's, or another file of the unit than the current
     * one. The subagent working there reads it; `shell` and `context` stay
     * the session's current work item's.
     */
    routed?: {
        item: string;
        context: string;
    };
    text?: string;
    board?: BoardData;
    /** refresh and board: the work item's to-do count, or null when its file is no geml-media entry; every other answer leaves it out. */
    todo?: TodoCount | null;
    workflows?: string[];
    installed?: string[];
    added?: {
        name: string;
        activated: boolean;
    };
    /** export: where the file went (project-relative inside the project, else absolute; `/`-separated) and what it holds. */
    exported?: {
        path: string;
        text: string;
    };
    /** attention: the repository's facts for the band. */
    attention?: AttentionFacts;
    /** attention: the machine and checkout the session runs on. */
    host?: HostInfo;
    /** The directory of the project's shared session logs (session-log.ts): the main working tree's .geml/sessions/. */
    sessions?: string;
    /** backfill-list and backfill-one: the transcripts, or what one added. */
    backfill?: Backfill;
    /** memory, memory-set and memory-delete: the project's memory as it now stands. */
    memory?: MemoryList;
    /** practices, practice-add and practice-set: every layer's practices as they now stand, and whether the project's memory was moved in. */
    practices?: {
        list: Practice[];
        memoryMoved: boolean;
    };
    /** made: every artifact the project's work made. */
    made?: MadeAll;
    /** corrections and the ops that change the ledger: what the flow tab shows of it. */
    corrections?: CorrectionsView;
}
/** No shell only when the request itself failed — it threw, or did not decode: the hooks module keeps the last shell and shows the error. */
 | {
    v: 1;
    ok: false;
    error: string;
    shell?: ShellStatus;
};
export declare function encodeRequest(req: BridgeRequest): string;
/** The last line of the CLI's stdout that parses as an answer of this version. */
export declare function decodeResponse(stdout: string): BridgeResponse | undefined;
/**
 * The band's words for a bridge whose stdout held no answer. stderr's error
 * line says what went wrong (`Error: …`, `TypeError: …`, else its first line);
 * a module or package Node could not find means the plugin's bundle was never
 * built, so the words lead with the build to run.
 */
export declare function unreadableText(exitCode: number, stderr: string, pluginRoot: string): string;
/** One lesson as the hooks module sends it: its kind, its key, and the field that kind carries. */
export declare function isLesson(v: unknown): v is Lesson;
/** One request, checked, a before, after or learn without `cwd` starting at the root; what the CLI cannot run is an error it answers with. */
export declare function decodeRequest(text: string): BridgeRequest | {
    error: string;
};
