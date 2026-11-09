import { type Cell, type Judge, type Progress } from "../../core/progress.js";
import type { ItemStatus, MetStep, SessionEvent, SessionSummary, SessionTurn } from "../../core/session-log.js";
import { type Practice } from "../../core/practices.js";
import type { LedgerCard, PracticeCount } from "../../core/corrections.js";
import type { Asked } from "../../core/ask-tool.js";
import type { Pressable } from "./actions.js";
import type { BoardRow } from "./board.js";
import type { T } from "./text.js";
import type { MadeAllEntry } from "./protocol.js";
import type { Proposal, Rule } from "./growth.js";
/** The light flows, by file name: the bundled `coach/<name>.geml`, or the project's own `.geml/coach/<name>.geml`. */
export declare const COACH_FLOWS: readonly ["design", "feature", "bugfix", "optimize"];
/**
 * A state: its words, what it needs to be left (its `description`), who judges that, what the step prevents, and for a
 * step the person judges the two words of its buttons (null: 好了 / 没好).
 */
export interface CoachState {
    id: string;
    title: string;
    need: string;
    final: boolean;
    judge: Judge;
    prevents: string;
    answers: readonly [string, string] | null;
    expires?: boolean;
}
/** A way between states; `back` when it does not go on to the next state in order (a way back, drawn dashed). */
export interface CoachEdge {
    from: string;
    to: string;
    label: string;
    back: boolean;
}
/** A flow: its name (the file's), its title, its states and ways; `diff` how a project's own flow differs from the shipped one, by step titles. */
export interface CoachFlow {
    name: string;
    title: string;
    states: CoachState[];
    edges: CoachEdge[];
    diff?: {
        added: string[];
        removed: string[];
    };
}
export type ItemEvent = Extract<SessionEvent, {
    t: "item";
}>;
/** A work item as it stands: the newest event of its id, from whichever session reported it; `met` the steps met, `next` what the model will do next. */
export interface WorkItem {
    id: string;
    flow: string;
    title: string;
    state: string;
    needs: string;
    goal: string;
    status: ItemStatus;
    at: string;
    session: string;
    met: MetStep[];
    next: string;
}
/** Where the board looks when a work item's arrow is pressed: its flow first, the item marked. */
export interface CoachFocus {
    flow: string;
    id: string;
}
/**
 * A flow file read: its states in their order, its ways; undefined for a file with no statechart diagram in it. A state
 * that does not say who judges it, what it prevents or its buttons' words takes them from `reference`'s state of the
 * same id (a project's own flow, from the one the plugin ships); a state with neither is the model's to judge.
 */
export declare function readCoachFlow(name: string, text: string, reference?: CoachFlow): CoachFlow | undefined;
/**
 * The steps an event has met: the ones it names, or for an event that names only the state it stood in (written before
 * steps were met), every step before that state — every step, when that state is final.
 */
export declare function metOf(e: Pick<ItemEvent, "state" | "met" | "at" | "turn">, flow: CoachFlow | undefined): MetStep[];
/** Where an item stands on its flow (progress.ts); `running` the fact steps a check is under way for. */
export declare function itemProgress(item: Pick<WorkItem, "met">, flow: CoachFlow, running?: ReadonlySet<string>): Progress;
/** The work items the sessions reported, the newest event of each id, newest first; the steps an older event met read from its state. */
export declare function workItemsOf(sessions: readonly SessionSummary[], flows?: readonly CoachFlow[]): WorkItem[];
/** The tool the model reports a turn's work items with. */
export declare const WORK_TOOL: {
    readonly name: "work";
    readonly description: "Report, before the turn ends, the work items this turn was about, so the board shows the person where each stands: each a thing the person wants done (a new design, a new feature, a bugfix, an optimization), the flow that fits it, every step whose leave requirement is met now (where it stands follows from them, so steps may be skipped), what it still needs, what you will do next, and what it should be at the end. Update an item on the way by its id (listed beside the person's prompt); report a new one without an id. One turn may be about several items; a turn about none reports nothing.";
    readonly inputSchema: {
        readonly type: "object";
        readonly properties: {
            readonly items: {
                readonly type: "array";
                readonly items: {
                    readonly type: "object";
                    readonly properties: {
                        readonly id: {
                            readonly type: "string";
                            readonly description: "An item already on the way, by its id; leave it out for a new one.";
                        };
                        readonly title: {
                            readonly type: "string";
                            readonly description: "What the item is, in a few words of the person's language.";
                        };
                        readonly flow: {
                            readonly type: "string";
                            readonly description: "The flow it belongs to, by its name: design 新设计, feature 新功能, bugfix, optimize 优化, or one the project added (the flows are listed once).";
                        };
                        readonly met: {
                            readonly type: "array";
                            readonly items: {
                                readonly type: "string";
                            };
                            readonly description: "Every step whose leave requirement is met now, by the id or title the flow lists; a way back is the same list with the later steps left out. Leave it out on an update to keep what was met.";
                        };
                        readonly said: {
                            readonly type: "string";
                            readonly description: "The person's own words, this turn, that meet a step they judge (marked you), e.g. 「好了」. Needed when met newly names such a step; without their words leave the step for their press.";
                        };
                        readonly next: {
                            readonly type: "string";
                            readonly description: "What you will do next for it: one short sentence in the person's language, as it would follow 「接下来我去」.";
                        };
                        readonly needs: {
                            readonly type: "string";
                            readonly description: "What it still needs to leave the step it stands at: one short phrase, in the person's language.";
                        };
                        readonly goal: {
                            readonly type: "string";
                            readonly description: "What it should be at the end: one short sentence, in the person's language.";
                        };
                        readonly status: {
                            readonly type: "string";
                            readonly enum: readonly ["open", "done", "dropped"];
                            readonly description: "done once the person said it is; dropped when given up. Default open.";
                        };
                    };
                    readonly required: readonly ["title", "flow"];
                    readonly additionalProperties: false;
                };
            };
        };
        readonly required: readonly ["items"];
        readonly additionalProperties: false;
    };
};
/** What the model is told when a turn that changed things ends with no work item reported: once, then the turn ends. */
export declare const WORK_REMINDER = "Gemworks: this turn changed things but reported no work item. Before ending, call the gemworks `work` tool with the work items this turn was about (update one on the way by its id, report a new one without), then end the turn.";
/** What the model is told once about the work tool, with the flows' states. */
export declare function workPrompt(flows: readonly CoachFlow[]): string;
/** The line beside a prompt: the work items on the way, by id, so the model updates them rather than reporting them anew. */
export declare function workContext(items: readonly WorkItem[], flows: readonly CoachFlow[], limit?: number): string[];
/**
 * The tool's items checked against the flows and the items on the way: the
 * events to write and what was wrong with the rest. A step may be named by its
 * id or its title; `met` lists every step met now (left out, an update keeps
 * what was met; an older caller's `state` meets every step before it). A step
 * the person judges, newly met, needs their words in `said`. Every step met, or
 * a final one named, finishes the item; an id must be one on the way. `newId`
 * names a new item.
 */
export declare function workEvents(args: Record<string, unknown>, flows: readonly CoachFlow[], items: readonly WorkItem[], at: string, turn: number, newId: (n: number) => string): {
    events: ItemEvent[];
    errors: string[];
};
/**
 * A press on a step the person judges: `yes` meets it; no takes the item back
 * the way the step's first way back goes (every step from there on unmet), or
 * unmeets the step itself where it has none.
 */
export declare function pressEvent(item: WorkItem, flow: CoachFlow, step: string, yes: boolean, at: string, turn: number): ItemEvent;
/** The person putting an item aside, or taking it up again: the item as it stands, with that status. */
export declare function holdEvent(item: WorkItem, held: boolean, at: string, turn: number): ItemEvent;
/**
 * The person's word on an item, as this session's event: taken over (`open`: the newest event names the session an
 * item is on, so it is this one's from now), closed as done, or dropped — another session's too, and one whose session
 * has ended, which would never close it itself.
 */
export declare function closeEvent(item: WorkItem, status: "open" | "done" | "dropped", at: string, turn: number): ItemEvent;
/** The work items tab's groups: whose turn it is, and the items the person put aside. */
export type WorkGroup = "you" | "me" | "wait" | "held";
/** How many items a group lists before the rest wait behind its heading's press. */
export declare const WORK_SHOWN = 12;
/** A step as one mark and its title, for a surface that draws no chips: ✓ met, ▸ stands here, · ahead, ⚠ skipped. */
export declare function stripText(cells: readonly {
    title: string;
    cell: Cell;
}[]): string;
export interface WorkRowsOptions {
    /** The questions the person has not answered. */
    asks?: readonly Asked[];
    /** This session's id: a step offered for another session's item only says where it is done. */
    own?: string;
    /** The fact steps a check is under way for, by item id. */
    running?: ReadonlyMap<string, ReadonlySet<string>>;
    /** The groups listed whole. */
    open?: readonly WorkGroup[];
    /** The item unfolded under its row, and the sessions its history is read from. */
    unfolded?: string | null;
    sessions?: readonly SessionSummary[];
    /** The 好，做吧 the person pressed, still on their way. */
    gone?: readonly GoneOn[];
    /** The item the person's own turn took up, while that turn runs. */
    doing?: Doing | null;
    /** Every artifact the project's work made: each row's press to its own on the 产物 tab says how many. */
    made?: readonly MadeAllEntry[];
    /** Now: another session's item whose session has been silent past QUIET_MS says so. */
    now?: string;
}
/** How long a session's record stays silent before its items are drawn as left by it (在别的会话里（已结束）). */
export declare const QUIET_MS = 86400000;
/**
 * A 好，做吧 the person pressed: the item, the next step it said and the item's record it was pressed on, the turn ends
 * to wait for before its own turn starts (1 when a turn was running, 0 when the session was idle), and the ends since.
 */
export interface GoneOn {
    id: string;
    next: string;
    at: string;
    wait: number;
    ends: number;
}
/**
 * What a pressed 好，做吧 shows in place of its button while the item stands as it was pressed: 排队中 behind the turn
 * that was running, 进行中 until its own turn ends. Nothing once that turn has ended, or once the item was reported
 * again (its record changed): the button is offered again if a next step still is.
 */
export declare function goneOnNote(i: WorkItem, gone: readonly GoneOn[] | undefined, t: T): string | undefined;
/** The presses still on their way after a turn ended: each counts the end, and leaves once its own turn has ended. */
export declare function goneOnAfterTurn(gone: readonly GoneOn[]): GoneOn[];
/** The work item a turn of this session is about: its last on the way (the one whose step's practices go beside the prompt). */
export declare function turnItem(items: readonly WorkItem[], session: string): WorkItem | undefined;
/** The item the person's own turn took up, as its record stood when the turn started. */
export interface Doing {
    id: string;
    next: string;
    at: string;
}
/**
 * What the item the person's own turn took up shows in place of 好，做吧 while that turn runs: 我在做. Nothing once the
 * item was reported again (its record changed): what it says next is for after this turn.
 */
export declare function doingNote(i: WorkItem, doing: Doing | null | undefined, t: T): string | undefined;
/**
 * The work items tab's rows: the questions waiting on the person that belong to no item on the way (等你定), then the
 * items by whose turn it is — 等你, 我来, 等结果 — and those put aside (已暂缓, folded). Each item's row: its flow, its
 * steps as cells (met, here, ahead, skipped), what it needs or what comes next, the presses that are the person's (a
 * step they judge: its two words; the model's next step: 好，做吧 and 暂缓处理), and the arrow to its flow; the
 * questions about it under it. A group lists its first WORK_SHOWN items until its heading's press lists it whole.
 */
export declare function workRows(items: readonly WorkItem[], flows: readonly CoachFlow[], t: T, o?: WorkRowsOptions): BoardRow[];
/** What a turn did, in words for the sessions tab: each work item it moved and how, each decision, each practice it learned. */
export declare function turnWords(turn: SessionTurn, flows: readonly CoachFlow[], learned: readonly Practice[], t: T): string[];
/** A work item's history, oldest first, across every session: each turn that moved it — how, and what that turn decided. */
export declare function itemHistory(id: string, sessions: readonly SessionSummary[], flows: readonly CoachFlow[], t: T): {
    at: string;
    text: string;
}[];
/** How many entries of a work item's history its row lists when unfolded, the newest. */
export declare const HISTORY_SHOWN = 8;
/** The flow tab's options: the work item whose arrow was pressed, the flows whose practices are listed (null: the first flow's), now. */
export interface ManualOptions {
    focus: CoachFocus | null;
    expanded: readonly string[] | null;
    now?: string;
    proposals?: readonly Proposal[];
    rules?: readonly Rule[];
    skipped?: readonly {
        flow: string;
        step: string;
        skipped: number;
    }[];
    ledger?: {
        cards: readonly LedgerCard[];
        counts: Readonly<Record<string, PracticeCount>>;
    };
}
/**
 * The ledger's cards on top of the flow tab (core/corrections.ts), each with what the person can do about it: a
 * correction said again and again with no practice where it was said (记为做法, or 设为通用做法 for one hung on another
 * step), a practice whose rule was said again since it was written (删除, 保留). 忽略 and 保留 put a card away.
 */
export declare function ledgerCardRows(cards: readonly LedgerCard[], flows: readonly CoachFlow[], t: T): BoardRow[];
/**
 * The flow tab's manual: how each kind of work goes in this project. Each flow with items on the way, the focused one
 * first, else the one moved last, then the ones opened: its heading (how many on the way, how it differs from the one
 * the plugin ships, a press that lists its practices or folds them), then its steps in order — the requirement to leave
 * each, who judges it, what it prevents, the step the focused item stands at marked — the practices on each step (on
 * the flow listed), the ways back. The flows with none on the way in one group, each a press that opens it; then the
 * practices for every flow and every step.
 */
export declare function manualRows(items: readonly WorkItem[], flows: readonly CoachFlow[], practices: readonly Practice[], t: T, o: ManualOptions): BoardRow[];
/** The band's line for a work item: its words, what hovering it shows (its cells, what it ends as), its presses, and how many more wait on the person. */
export interface CoachBandLine {
    verb: string;
    title: string;
    note: string;
    detail: string;
    actions: Pressable[];
    more: {
        count: number;
        detail: string;
    };
}
/**
 * The band's one thing among this session's work items: when the last turn (since `since`) moved several that wait
 * on the person, those together with 逐个定; else the one it moved that waits on the person (等你, the step's two
 * words and 暂缓处理), else this session's last item on the way — what it needs, or what comes next with 好，做吧 and
 * 暂缓处理 (once pressed, 排队中 or 进行中 and no buttons: `gone`; while the person's own turn is on it, 我在做 and
 * no buttons: `doing`). The other items waiting on the person, in any session, are the ones more.
 */
export declare function coachBand(items: readonly WorkItem[], flows: readonly CoachFlow[], session: string, t: T, since?: string, gone?: readonly GoneOn[], doing?: Doing | null): CoachBandLine | undefined;
