import type { Dictionary } from "../../core/dictionary.js";
import type { Journal } from "../../core/journal.js";
import { type FlowPolicy } from "../../core/policy.js";
import { type Status } from "../../core/status.js";
import { type Statechart } from "../../core/statechart.js";
import type { Supervisor } from "../../core/supervisor.js";
import type { BoardAction, BoardTab, JournalFilter } from "../claude-code/actions.js";
import { paneRows, type BoardRow, type InputField } from "../claude-code/board.js";
import type { BoardData, ShellStatus } from "../claude-code/protocol.js";
import type { Asked } from "../../core/ask-tool.js";
import type { Proposal } from "../../core/growth.js";
import type { Practice } from "../../core/practices.js";
import type { CoachFlow, WorkItem } from "../../core/work.js";
/** One session under supervision, as the plugin keeps it. */
export interface Supervision {
    sc: Statechart;
    sup: Supervisor;
    dictionary: Dictionary;
    /** The work item the journal names: `session:<id>`. */
    item: string;
    workflow: {
        name: string;
        path: string;
        title: string;
    };
    /** The session's journal as it stands; null before its first block. */
    journal: Journal | null;
    /** The session's working directory: the root the rows' file links are made from. */
    root: string;
}
export interface BoardQuery {
    session: string;
    tab: BoardTab;
    filter: JournalFilter;
    /** The journal entry shown in full, or null. */
    expanded: string | null;
    /** The browser's language, when it said. */
    lang?: string;
}
/** The tabs on this host: every tab but the sessions tab. */
export declare const DSH_TABS: readonly BoardTab[];
/** A press from the browser half: a board action, or what a person typed into a field. */
export type DshAction = BoardAction | {
    op: "input";
    field: InputField;
    value: string;
};
/** The query of a board request: a tab and a filter the board knows, else their defaults. */
export declare function readQuery(params: URLSearchParams): BoardQuery;
export declare function sessionStatus(s: Supervision): Status;
/** What a host shell keeps: the status and the policy; no context document on this host. */
export declare function sessionShell(s: Supervision, locale?: string, versions?: ShellStatus["versions"]): ShellStatus;
/** The board data the tabs are drawn from: the graph, the fences, the dictionary, this one work item, and the journal's timeline. */
export declare function sessionBoard(s: Supervision, status: Status, policy: FlowPolicy): BoardData;
export interface BoardReply {
    tabs: {
        id: BoardTab;
        label: string;
    }[];
    /** What the header draws: the item, its stage and workflow, the hold. */
    header: {
        item: string;
        workflow: string;
        state?: {
            id: string;
            title: string;
            rev: number;
            final: boolean;
        };
        refusals: number;
        paused: boolean;
        version?: string;
    };
    rows: BoardRow[];
    /** How many things only a person can do: the pending tab's count. */
    pending: number;
}
/** One tab's rows, in the browser's language, with the tabs and the header around them. */
export declare function boardReply(s: Supervision, q: BoardQuery, now: string, locale?: string, versions?: ShellStatus["versions"], coach?: CoachData): BoardReply;
/** What a press needs: the session's Supervisor, its statechart, and the workflow file whose dictionary a lesson is written into. */
export interface Acting {
    sup: Supervisor;
    sc: Statechart;
    workflowFile: string;
}
/**
 * A press on the board, on this host: a person's transition, a tick, a hold, a
 * lesson into tools.geml (the Supervisor reads the dictionary afresh for every
 * decision, so the next call sees it), a line typed into the add-tool field;
 * anything the host has no way to do says so.
 */
export declare function actOnSession(s: Acting, action: DshAction, now: string): {
    ok: true;
} | {
    ok: false;
    error: string;
};
/** What the light flows put on a session's board: the work items, their flows, the practices, the proposals, its questions. */
export interface CoachData {
    items: readonly WorkItem[];
    flows: readonly CoachFlow[];
    practices: readonly Practice[];
    proposals: readonly Proposal[];
    asks: readonly Asked[];
    /** The session's own id: its work items lead. */
    own: string;
}
/** The tabs on this host for a session that runs no workflow of its own: the work items and the flows. */
export declare const DSH_COACH_TABS: readonly BoardTab[];
/** The light flows' part of a pane's input: what the work items and flow tabs draw first. */
export declare const coachInput: (c: CoachData) => NonNullable<Parameters<typeof paneRows>[0]["coach"]>;
/**
 * The board of a session with no workflow of its own: the work items it and the project's other sessions reported,
 * the flows with their practices and the proposals. A press this host cannot run is not drawn: the person answers a
 * question, a step or a proposal in the conversation.
 */
export declare function coachBoardReply(c: CoachData, q: BoardQuery, now: string, locale?: string, versions?: ShellStatus["versions"]): BoardReply;
