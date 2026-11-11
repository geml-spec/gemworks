import type { Cell } from "../../core/progress.js";
import type { SessionSummary, SessionTurn } from "../../core/session-log.js";
import { type Practice } from "../../core/practices.js";
import type { LedgerCard, PracticeCount } from "../../core/corrections.js";
import type { Asked } from "../../core/ask-tool.js";
import type { Pressable } from "./actions.js";
import type { BoardRow } from "./board.js";
import type { T } from "./text.js";
import type { MadeAllEntry } from "./protocol.js";
import type { Proposal, Rule } from "./growth.js";
import { COACH_FLOWS, readCoachFlow, metOf, itemProgress, workItemsOf, WORK_TOOL, WORK_REMINDER, workPrompt, workContext, workEvents, pressEvent, holdEvent, closeEvent, turnItem, type CoachState, type CoachEdge, type CoachFlow, type ItemEvent, type WorkItem, type CoachFocus } from "../../core/work.js";
export { COACH_FLOWS, readCoachFlow, metOf, itemProgress, workItemsOf, WORK_TOOL, WORK_REMINDER, workPrompt, workContext, workEvents, pressEvent, holdEvent, closeEvent, turnItem };
export type { CoachState, CoachEdge, CoachFlow, ItemEvent, WorkItem, CoachFocus };
/**
 * The flows as the person reads them: each title, need, pitfall and answer
 * through the words of their language. Ids and the rest stay as they are, so
 * every press still names the step it meant; a flow the project grew has no
 * entry in the words and keeps its own wording.
 */
export declare function flowsIn(flows: readonly CoachFlow[], t: T): CoachFlow[];
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
    menu?: string | null;
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
