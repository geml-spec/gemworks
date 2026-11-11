import { type DictRow } from "../../core/dictionary.js";
import type { Status } from "../../workspace.js";
import type { BoardAction, BoardTab, JournalFilter, Pressable } from "./actions.js";
import type { MemoryList } from "../../memory-store.js";
import { type Tone } from "./band.js";
import { type InboxItem } from "./inbox.js";
import type { BoardData, MadeAll, Artifacts, ShellStatus, TimelineEntry } from "./protocol.js";
import { type MadeView } from "./made.js";
import { type PromptRecord } from "./sessions.js";
import type { SessionSummary } from "../../core/session-log.js";
import { type CoachFlow, type CoachFocus, type Doing, type GoneOn, type ManualOptions, type WorkGroup, type WorkItem } from "./coach.js";
import type { Cell, Judge } from "../../core/progress.js";
import type { Practice } from "../../core/practices.js";
import type { Proposal, Rule } from "./growth.js";
import type { Asked } from "../../core/ask-tool.js";
import type { AheadFact, PrFact } from "./attention.js";
import { type T } from "./text.js";
export declare const BOARD_ID = "gemworks-board";
export declare const DIALOG_ID = "gemworks-dialog";
export declare const TAB_IDS: readonly BoardTab[];
/** The tab the board opens on: the work items, what waits on the person on top. */
export declare const HOME_TAB: BoardTab;
/** The tabs in order, labelled. */
export declare function tabs(t?: T, ids?: readonly BoardTab[]): {
    id: BoardTab;
    label: string;
}[];
/** What a field's text means when submitted. */
export type InputField = "add-tool" | "import-workflow" | "tool-search" | "new-use" | "memory-hook" | "import-reference";
export type BoardRow = {
    kind: "text";
    text: string;
    tone: Tone;
}
/** Who judges a step, each word as a chip with what it means beside it (the flow tab's first line). */
 | {
    kind: "judges";
    lead: string;
    items: {
        judge: Judge;
        word: string;
        means: string;
    }[];
}
/** Words, then presses after them on the same line (没有在走的：优化 ▸). */
 | {
    kind: "presses";
    key: string;
    lead: string;
    items: Pressable[];
} | {
    kind: "button";
    key: string;
    label: string;
    action: BoardAction;
    primary?: boolean;
}
/** Several buttons on one line. */
 | {
    kind: "buttons";
    items: Pressable[];
    end?: true;
}
/**
 * A dialog's parts, drawn as the 2026-10-13 dialogs are: a small grey label over a group; a switch (a box, its words,
 * a dim note under them) and one of several (a round mark, the same) whose whole row takes the press; a pick from a
 * list (a Select where the surface has one, else its options as buttons, `actions` by option); facts in two
 * columns; a shaded panel with a press at its end; links on one line; a thin rule.
 */
 | {
    kind: "label";
    key: string;
    text: string;
} | {
    kind: "check";
    key: string;
    label: string;
    note?: string;
    on: boolean;
    action: BoardAction;
} | {
    kind: "radio";
    key: string;
    label: string;
    note?: string;
    on: boolean;
    action: BoardAction;
} | {
    kind: "select";
    key: string;
    label: string;
    options: {
        value: string;
        label: string;
    }[];
    value: string;
    actions: Record<string, BoardAction>;
} | {
    kind: "facts";
    key: string;
    rows: [string, string][];
} | {
    kind: "panel";
    key: string;
    lines: {
        text: string;
        tone: Tone;
        bold?: true;
    }[];
    action?: Pressable;
} | {
    kind: "linkrow";
    key: string;
    items: {
        href: string;
        label: string;
    }[];
} | {
    kind: "rule";
    key: string;
} | {
    kind: "link";
    key: string;
    href: string;
    label: string;
}
/** A field: what it is for, the key it acts on (a tool, for a new use), and for a search its text so far, read as typed. */
 | {
    kind: "input";
    key: string;
    placeholder: string;
    field: InputField;
    target?: string;
    value?: string;
}
/**
 * The flow picture (spec §8.2): the states by rank, each with what the
 * runtime knows of it, and every way out with its words — one a person may
 * take now carries its number on the picture and its press. `svg` is the
 * same picture as markup, for a surface that inlines it.
 */
 | {
    kind: "flow";
    key: string;
    ranks: FlowStateRow[][];
    edges: FlowEdgeRow[];
    svg: string;
}
/**
 * A group's heading: its words, how many it holds when that is worth saying, and a press that lists or folds it.
 * `tucked`: its note runs on after the words, wrapped, and its presses show under the pointer where a surface has
 * one (a flow's heading on the flow tab, as its design has it: the heading reads as a heading).
 */
 | {
    kind: "section";
    key: string;
    text: string;
    count?: number;
    fold?: Pressable;
    note?: string;
    actions?: Pressable[];
    tucked?: true;
}
/**
 * One thing waiting on the person (the work items tab's top group): the icon
 * for what it asks, its verb and name, a tag (what the work made, or the
 * stage it waits in), its detail, and its options.
 */
 | {
    kind: "card";
    key: string;
    icon: Icon;
    verb: string;
    title: string;
    tag?: string;
    detail: string[];
    actions: Pressable[];
}
/** A picture where the surface draws one (the about dialog's lockup); its words elsewhere. */
 | {
    kind: "image";
    key: string;
    svg: string;
    alt: string;
    width?: number;
}
/** A page's own heading: its words, a dim word beside them, and a press at its end. */
 | {
    kind: "heading";
    key: string;
    text: string;
    sub: string;
    action?: Pressable;
}
/** A work item in a list: its name, a tag, and the press that makes it the current one, when it can be; `link` what it opens, at its end in place of the tag. */
/** `extra`: a button at the row's right end, after the tag (a session's export). */
 | {
    kind: "entry";
    key: string;
    title: string;
    tag: string;
    tone: Tone;
    action?: BoardAction;
    detail?: string;
    current?: boolean;
    link?: {
        href: string;
        label: string;
    };
    extra?: Pressable;
    open?: boolean;
}
/** A sentence shown whole, wrapped into `lines`, its tag beneath; the whole row takes the press (a decision). */
 | {
    kind: "note";
    key: string;
    lines: string[];
    tag: string;
    action: BoardAction;
}
/** An artifact's menu (the work items tab): what it opens — the file, a version's copy, its history, the copies' folder — and what it shows. */
 | {
    kind: "links";
    key: string;
    items: {
        key: string;
        label: string;
        href?: string;
        action?: BoardAction;
    }[];
}
/**
 * Something that happened to the work item (the journal tab): its time, what
 * kind (产物, 凭据, 阶段变更, 被拦, 开始), what, why, which turn caused it, and
 * the press that opens its menu; `detail` is its evidence, shown when `open`.
 */
 | {
    kind: "event";
    key: string;
    at: string;
    glyph: Glyph;
    label: string;
    text: string;
    why: string;
    turn: string;
    tone: Tone;
    detail: string[];
    open: boolean;
    action: BoardAction;
}
/** A tool of the dictionary or one that ran (the tools tab): its name, its use, what it looks like when it has none, how often it ran, and the press that opens its menu. */
 | {
    kind: "tool";
    key: string;
    name: string;
    use: string;
    guess: string;
    count: string;
    tone: Tone;
    action?: BoardAction;
}
/** A work item's way through its flow: each state in order, passed or not, the current one marked. */
 | {
    kind: "steps";
    key: string;
    steps: {
        title: string;
        passed: boolean;
        current: boolean;
    }[];
}
/** A prompt of the session (the sessions tab): its time, its first line, what its turn did, and the press that opens or closes its menu. */
/** `open`: unfolded under it; `fold`: it folds and unfolds on its press, which a triangle before the time says; `icons`: the presses at its right end, each a glyph (the scroll to it, where the conversation scrolls). */
 | {
    kind: "turn";
    key: string;
    at: string;
    text: string;
    did: string;
    open: boolean;
    action: BoardAction;
    fold?: true;
    icons?: {
        glyph: Glyph;
        button: Pressable;
    }[];
    check?: boolean | null;
    checkLabel?: string;
}
/** A row's menu, opened by a press on it: a short column of entries under it. */
 | {
    kind: "menu";
    key: string;
    items: Pressable[];
}
/** Running text shown whole: a turn's prompt, its answer (Markdown, where the surface draws it). */
 | {
    kind: "prose";
    key: string;
    text: string;
    markdown?: boolean;
}
/** A work item on the way (coach.ts): its flow (`flow` the file name, `tag` its words), its name, its steps as cells, what it needs or what comes next, the presses that are the person's, and the arrow to its flow. */
/** `made`: the press to what it made (产物 n ›, the 产物 tab with its own alone), beside the arrow; none when it made none. */
 | {
    kind: "work";
    key: string;
    flow: string;
    tag: string;
    title: string;
    cells: {
        title: string;
        cell: Cell;
    }[];
    detail: string;
    actions: Pressable[];
    go: Pressable;
    open?: Pressable;
    made?: Pressable;
}
/**
 * A flow's step in the manual (coach.ts manualRows): its title, the requirement to leave it, who judges it (`judge`
 * in words), what it prevents; `here` the step the focused item stands at. The practice rows after it are its own,
 * drawn in its block; `more`, on a flow whose practices are folded, the press that lists them (2 条做法 ▾).
 */
 | {
    kind: "step";
    key: string;
    title: string;
    need: string;
    judge: string;
    judgeKind: Judge;
    prevents: string;
    here: boolean;
    final: boolean;
    rules?: string[];
    more?: Pressable;
}
/**
 * A practice on a step: what to do, where it came from, its tag (做法, 新学到, 从记忆搬来, 团队), the presses on it:
 * × and 改成规定 beside its words, its layer and sharing under the pointer where a surface has one.
 */
/** `count`: the corrections of its themes before it was written and since (纠正 2 → 0), green while none came since, amber once one did. */
 | {
    kind: "practice";
    key: string;
    text: string;
    why: string;
    tag: string;
    fresh: boolean;
    actions: Pressable[];
    count?: {
        text: string;
        held: boolean;
    };
};
/** What a card asks of the person: to decide, to accept the work, or to see why something is blocked. */
export type Icon = "ask" | "done" | "warn";
export declare const ICON_TONE: Readonly<Record<Icon, Tone>>;
/** The icons as characters, for a surface that draws no pictures. */
export declare const ICON_CHAR: Readonly<Record<Icon, string>>;
/** The icons as line drawings: a circle and its mark, in a colour that reads on a light and a dark ground alike. */
export declare const ICON_SVG: Readonly<Record<Icon, string>>;
/**
 * The pane's line icons, drawn as the design draws them (docs/design/ui/2026-10-13-gemworks-ui): a tab's, a dialog's,
 * and each kind of journal entry's. Only where the surface draws pictures; elsewhere the words stand alone.
 */
export type Glyph = BoardTab | "share" | "settings" | "upgrade" | "about" | "radio" | "radioon" | "artifact" | "evidence" | "move" | "refused" | "start" | "waits" | "done" | "board" | "capture" | "split" | "delete" | "locate" | "unfold" | "fold" | "box" | "boxon" | "go";
/** A glyph as a line drawing in its tone's colour. */
export declare function glyphSvg(g: Glyph, tone?: Tone | "active"): string;
/** The glyph of a journal entry, by what made it. */
export declare function entryGlyph(e: TimelineEntry): Glyph;
export interface FlowStateRow {
    id: string;
    title: string;
    initial: boolean;
    final: boolean;
    current: boolean;
    /** The work items standing here, when worth a badge: none for the current state's one item. */
    count: number;
    uses: string[];
}
export interface FlowEdgeRow {
    name: string;
    from: string;
    to: string;
    /** To the next rank; over or back across ranks; or to its own state. */
    kind: "forward" | "lane" | "self";
    /** A lane that goes back to an earlier rank, as against over one. */
    back: boolean;
    /** The way out in words: who takes it, and its condition. */
    text: string;
    /** Whether a machine-judged condition holds now; absent for a person's sentence or no condition. */
    holds?: boolean;
    approval: boolean;
    /** The transition last taken. */
    taken: boolean;
    /** A way out a person may take now: its number on the picture (the hotkey), and the press. */
    press?: {
        n: number;
        action: BoardAction;
    };
}
/**
 * What a field's text does: a search narrows the tools tab (empty, to all);
 * a new use is a `use` lesson for its tool; `tool | use` a `use` lesson and
 * `tool` alone an allow everywhere; a path imports a workflow. Empty, nothing.
 */
export declare function inputAction(field: InputField, typed: string, target?: string): BoardAction | undefined;
export interface PaneInput {
    board: BoardData | null;
    /** Why the board could not be read again; null when it could. */
    problem: string | null;
    shell: ShellStatus | null;
    tab: BoardTab;
    columns: number;
    maxRows: number;
    t: T;
    now: string;
    /** The project root, for the links to the workflow's files. */
    root: string;
    /** Where this session runs (env.ts): the machine, the checkout, the branch, Remote Control when in play; said after 本会话. */
    env?: readonly string[];
    inbox: readonly InboxItem[];
    filter: JournalFilter;
    /** The journal entry whose menu is open (its row key), or null. */
    expanded: string | null;
    /** The journal entry whose evidence shows (its row key), or null. */
    evidence: string | null;
    prompts: readonly PromptRecord[];
    /** The project's sessions as their shared logs hold them (session-log.ts), this one's id, and the other one unfolded (its id). */
    project?: {
        sessions: readonly SessionSummary[];
        own: string;
        open: string | null;
        all?: boolean;
        decisionsShown?: number;
    };
    /** Whether the surface can scroll the conversation to a prompt (the terminal); elsewhere a turn unfolds in place. */
    scrolls?: boolean;
    /** The turn unfolded on the session tab: its prompt's id and its answer as the log holds it. */
    unfolded?: {
        id: string;
        answer: string | null;
    } | null;
    /** The file the last export wrote: a link to it under the export buttons; on the sessions tab, under the session it was of (`exportedFor`: `own` or its id). */
    exported?: string | null;
    exportedFor?: string | null;
    /** The work item the sessions tab shows the prompts of (its id), or null for all; the runs of another item's turns unfolded (their first prompt's id). */
    sessionItem: string | null;
    /** What each of this session's prompts moved, decided and learned (coach.ts turnWords), as the record holds it. */
    moved?: (p: PromptRecord) => TurnMoved;
    /** How many of this session's turns the sessions tab draws, the newest; the rest behind a count. */
    sessionLimit?: number;
    /** The sessions tab: this session's turns checked, by prompt id. */
    picked?: readonly string[];
    /** The sessions tab: whether turns are being picked to split or delete (整理). */
    tidying?: boolean;
    /** The sessions tab: the project's Claude Code memory, the group unfolded, the memory whose card is open, the one whose hook is being edited, and whether the group lists all. */
    memory?: {
        list: MemoryList | null;
        group: string | null;
        menu: string | null;
        edit: string | null;
        shown: number;
    };
    sessionRuns: readonly string[];
    /** Whether the work items tab lists the closed work items, or only counts them; the same for the dropped ones. */
    doneOpen: boolean;
    droppedOpen?: boolean;
    /** The artifact whose menu is open on the work items tab, or null; whether every document it changed is listed. */
    artifactMenu?: string | null;
    docsOpen?: boolean;
    /** Every artifact the project's work made (the work items tab's 全部产物), and how the list stands; none before it was read. */
    madeAll?: MadeAll | null;
    madeView?: MadeView;
    /** The state the flow tab shows below its picture, or null for the current one. */
    flowState: string | null;
    /** The coach (coach.ts): the work items the sessions reported, the light flows, and the item whose arrow was pressed. */
    coach?: {
        items: readonly WorkItem[];
        flows: readonly CoachFlow[];
        focus: CoachFocus | null;
        asks?: readonly Asked[];
        own?: string;
        open?: readonly WorkGroup[];
        practices?: readonly Practice[];
        expanded?: readonly string[] | null;
        menu?: string | null;
        unfolded?: string | null;
        sessions?: readonly SessionSummary[];
        proposals?: readonly Proposal[];
        rules?: readonly Rule[];
        skipped?: readonly {
            flow: string;
            step: string;
            skipped: number;
        }[];
        gone?: readonly GoneOn[];
        doing?: Doing | null;
        ledger?: ManualOptions["ledger"];
    };
    /** Whether the flow tab lists the workflows to switch to; and those workflows, once read. */
    switching: boolean;
    workflows: {
        bundled: string[];
        installed: string[];
    } | null;
    /** How often each key ran these two days; the suggestions put away; the tools tab's search, open menu, new-use field and listed groups. */
    usage: Readonly<Record<string, number>>;
    dismissed: readonly string[];
    toolQuery: string;
    toolMenu: string | null;
    toolNaming: string | null;
    toolsOpen: readonly string[];
}
/**
 * The pane's rows under its tabs: the tab's rows, under the reason the board
 * could not be read again when it could not (the last board stays); the
 * reason alone when there is no board yet, and a wait line before the first.
 * The sessions tab needs no board, and the work items tab shows what waits on
 * the person before it has one.
 */
export declare function paneRows(o: PaneInput): BoardRow[];
/** A session's export on the sessions tab: the button on its heading, and what stands under the heading (the file written). */
interface ExportsOf {
    button: (session: string) => Pressable;
    under: (session: string) => BoardRow[];
}
export declare const useWords: (use: string, t?: T) => string;
export interface FlowInput {
    board: BoardData;
    status: Status | null;
    columns: number;
    t: T;
    now?: string;
    /** The state shown below the picture; null, the current one (else the first). */
    selected: string | null;
    switching: boolean;
    workflows: {
        bundled: string[];
        installed: string[];
    } | null;
}
/**
 * The flow tab: the work item's workflow by its title, with the workflows to
 * switch to on a press (the installed ones to use, the bundled ones to add,
 * a path to import); the suggestions about it waiting on the person; the
 * picture; a row of its states; and the one picked — its description, the
 * uses it declares with the tools bound to them, the ones it does not, what
 * runs everywhere, and on the current state what the person may tick.
 */
export declare function flowRows(o: FlowInput): BoardRow[];
/** A project-relative path made absolute against `root`, or an absolute one as it is (an export outside the project), in forward slashes. */
export declare function projectPath(root: string, rel: string): string;
/** The current work item's way through its flow: the states in the picture's order, the ones its journal entered passed, the one it is in marked. */
export declare function stepsOf(board: BoardData, current: string): {
    title: string;
    passed: boolean;
    current: boolean;
}[];
/** What the work made, in a word: its one commit, how many commits, or how many files it wrote; nothing when it made none yet. */
export declare function artifactsTag(p: Artifacts | undefined, t?: T): string | undefined;
export interface ItemsInput {
    board: BoardData | null;
    status: Status | null;
    inbox: readonly InboxItem[];
    columns: number;
    t: T;
    now?: string;
    doneOpen: boolean;
    droppedOpen?: boolean;
    /** The cards put away (`close-<id>` for a merged work item left as it is). */
    dismissed?: readonly string[];
    /** The suggestions about the tools waiting on the person (toolSuggestions). */
    suggestions?: readonly InboxItem[];
    /** The artifact whose menu is open (`<kind>:<name>`), or null; whether every document the work item changed is listed. */
    artifactMenu?: string | null;
    docsOpen?: boolean;
}
/**
 * 已暂缓, under 此刻: what the person holds back (heldSteps), counted
 * together and folded like 放下; unfolded, the pull requests first (each with
 * its branch and where its checks stand), then the branches (each with its
 * commits and age), and on each a press that brings its card back. Nothing
 * when none is held.
 */
export declare function heldRows(held: {
    branches: readonly AheadFact[];
    prs: readonly PrFact[];
}, open: boolean, t?: T, now?: string): BoardRow[];
/**
 * The work items tab: what waits on the person on top, one card each with its
 * options — the current work item's things as the inbox has them, then every
 * other work item whose way out is theirs to take, then each merged one whose
 * worktree and branch are still there, to close; then the work items by where
 * they ended up (the outline): being worked on, the current one first; merged;
 * closed and dropped, counted, listed on a press; then the backlog when the
 * project keeps one.
 */
export declare function itemRows(o: ItemsInput): BoardRow[];
/** A size in words: bytes, KB, MB. */
export declare function sizeText(bytes: number | null): string;
/** Where a file sits, in short: its folder in the project, or an outside one's own folder name after an ellipsis; nothing at the top. */
export declare function folderLabel(name: string): string;
/**
 * The current work item's artifacts (the work items tab, under what waits on
 * the person): its links, each opened at a press; the documents its commits
 * changed in git, the newest two listed; the files git does not keep and the
 * pictures, each with a menu of its copies; and what its commits changed in
 * all, one line that shows them. Nothing when it made nothing yet.
 */
export declare function artifactRows(p: Artifacts | undefined, current: string | undefined, o: {
    t: T;
    columns: number;
    now?: string;
    menu: string | null;
    docsOpen: boolean;
}): BoardRow[];
/** The row that takes a key: of exactly that key, else the one whose pattern (`*` any text) matches it whole, the longest literal first. */
/** The last segment of a path, `/`-separated (a worktree's directory name). */
export declare const lastSegment: (path: string) => string;
export declare function rowFor(key: string, rows: readonly DictRow[]): DictRow | undefined;
/**
 * A suggestion to note CI that failed on the branch's head as a matter, when
 * a flow beside takes matters (a file unit `<dir>/*.geml`): one per head, not
 * once it is noted or put away.
 */
export declare function ciSuggestions(board: BoardData, units: readonly string[], dismissed: readonly string[], t?: T): InboxItem[];
/**
 * The suggestions about the tools (the work items tab's 待处理, with the
 * tools tab's own): a command that ran these two days with no row to take it,
 * looking like the flow's test or check use — counting it as that is the
 * person's to say; one put away is not asked again.
 */
export declare function toolSuggestions(board: BoardData, usage: Readonly<Record<string, number>>, dismissed: readonly string[], t?: T): InboxItem[];
export interface ToolsInput {
    board: BoardData;
    columns: number;
    t: T;
    usage: Readonly<Record<string, number>>;
    suggestions: readonly InboxItem[];
    query: string;
    menu: string | null;
    naming: string | null;
    open: readonly string[];
}
/**
 * The tools tab: a search, the suggestions about the tools, then every tool
 * the dictionary names or that ran these two days, by kind — command line,
 * files, MCP, skills, web requests, model services — each with its use (or
 * none, and the use it looks like), how often it ran, the ones that ran
 * first; the ones that did not, folded. A press opens a row's menu: classify
 * it as a use (a new one by name), make it its use's preferred tool, or take
 * its row out of the dictionary.
 */
export declare function toolRows(o: ToolsInput): BoardRow[];
/** The lines under an entry whose evidence shows: on what, which call, on which content, whether it still counts. */
export declare function entryDetail(e: TimelineEntry, board: BoardData, t?: T): string[];
/** Where a variable's value came from, in words: a use's result, git or gh, a file, the person, the clock. */
export declare function sourceWords(source: string | undefined, t?: T): string;
/** What a journal entry says: its kind, what happened, and why — in the flow's words. */
export declare function entryWords(e: TimelineEntry, board: BoardData, sources: Readonly<Record<string, string>>, t?: T): {
    label: string;
    text: string;
    why: string;
    tone: Tone;
};
export interface JournalInput {
    board: BoardData;
    status: Status | null;
    filter: JournalFilter;
    /** The entry whose menu is open, and the one whose evidence shows. */
    menu: string | null;
    evidence: string | null;
    prompts: readonly PromptRecord[];
    columns: number;
    maxRows: number;
    t: T;
    now?: string;
}
/**
 * The journal tab: the filters (all, artifacts, blocks, and what it waits for
 * once it waits for anything); the work item and its flow; then what
 * happened, newest first under its day — each commit of the work (an
 * artifact, grouped by the turn that made it), each refusal, each wait —
 * saying what, why, and which turn caused it. A press opens an entry's menu:
 * go to its turn, see its details. The stage's own revisions (evidence, stage
 * changes) are the journal file's, not the tab's.
 */
export declare function journalRows(o: JournalInput): BoardRow[];
/** What a prompt's turn moved, as the record holds it (coach.ts turnWords): its words, and the one work item it moved, if one. */
export interface TurnMoved {
    words: string[];
    item?: {
        id: string;
        title: string;
    };
}
export declare function sessionRows(prompts: readonly PromptRecord[], commits: readonly {
    sha: string;
    at: string;
}[], t: T | undefined, columns: number, now?: string, by?: {
    item?: string | null;
    runs: readonly string[];
    moved?: (p: PromptRecord) => TurnMoved;
    scrolls?: boolean;
    expanded?: {
        id: string;
        answer: string | null;
    } | null;
    limit?: number;
    picked?: readonly string[];
    tidying?: boolean;
}): BoardRow[];
/** A host's name for people. */
export declare function hostName(host: string): string;
/** A session as the session tab names it: this one, or the tool and where it works. */
export declare function sessionLabel(s: SessionSummary, own: string, t?: T): string;
/** What the sessions tab shows across the project: every session's record (session-log.ts), this one's id, the other one unfolded (its id), and whether every other session is listed. */
export interface ProjectSessions {
    sessions: readonly SessionSummary[];
    own: string;
    open: string | null;
    all?: boolean;
    decisionsShown?: number;
}
/**
 * The sessions tab's last section, after the other sessions: every session's decisions, newest
 * first, the newest twenty shown whole (the person reads them whole to judge
 * which are worth keeping), the rest behind a count; a press puts one in the
 * prompt box. Nothing when nothing was decided.
 */
export declare function decisionRows(p: ProjectSessions | undefined, t: T | undefined, columns: number, now?: string): BoardRow[];
/**
 * The project's Claude Code memory, on the journal tab after the work item's
 * events: its count, a filter row (全部 and each type there is), then the
 * newest ten of what it picks, each unfolding to open its file, edit its hook,
 * or delete it. Nothing when there is none.
 */
export declare function memoryRows(m: PaneInput["memory"], t: T | undefined, columns: number, now?: string): BoardRow[];
/**
 * The other sessions, after this session's own turns: each with when it
 * last spoke and its export, unfolding to its turns on a press; beyond the
 * first few the rest fold behind a count. Nothing when this session is alone.
 */
export declare function othersRows(p: ProjectSessions | undefined, t: T | undefined, columns: number, now?: string, exports?: ExportsOf): BoardRow[];
export {};
