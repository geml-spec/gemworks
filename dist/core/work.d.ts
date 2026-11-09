import { type Judge, type Progress } from "./progress.js";
import type { ItemStatus, MetStep, SessionEvent, SessionSummary } from "./session-log.js";
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
/** The work item a turn of this session is about: its last on the way (the one whose step's practices go beside the prompt). */
export declare function turnItem(items: readonly WorkItem[], session: string): WorkItem | undefined;
