import type { Pressable } from "./actions.js";
import type { BoardData, ShellStatus, TimelineEntry } from "./protocol.js";
import type { T } from "./text.js";
export type InboxKind = "approve" | "resume" | "suggest" | "tick" | "stuck" | "broken";
export interface InboxItem {
    kind: InboxKind;
    key: string;
    /** What the person does with it, drawn before the title: 定, 验收, 勾, 被拦; empty for a broken bridge. */
    verb: string;
    title: string;
    /** A word beside the title: the stage another work item waits in. */
    tag?: string;
    detail: string[];
    /** Its main option closes the work item: the person is to accept the work. */
    closes?: true;
    /** Since when it has waited, ISO; absent when unknown. */
    since?: string;
    actions: Pressable[];
}
export interface InboxInput {
    shell: ShellStatus | null;
    timeline: readonly TimelineEntry[];
    /** Why the bridge is unavailable, when it is. */
    problem: string | null;
    now: string;
    t: T;
    /** Refusals of one key this close together, and this many, are "stuck": default 30 minutes, 2. */
    stuckWindowMs?: number;
    stuckCount?: number;
}
/** The revision at which the current stage was entered, as the timeline shows it: the last entry, a transition, or a rollback into another state. */
export declare function stageEntryOf(timeline: readonly TimelineEntry[]): number;
/** The reason without the way-out tail every refusal carries. */
export declare const shortReason: (reason: string) => string;
export declare function inboxItems(o: InboxInput): InboxItem[];
/**
 * Every other work item whose way on is the person's (the board's `asks`):
 * one item each, 定 or 验收, its options taken on its file and saying what was
 * chosen; one with no file (another checkout's branch) is shown, and taken
 * there.
 */
export declare function othersWaiting(board: BoardData | null, current: string | undefined, t: T): InboxItem[];
/** What a suggestion is about, in words: the workflow, the tools, or as its author wrote it. */
export declare const aboutWords: (about: string, t: T) => string;
/** What waits on the person, in the order they read it: a broken bridge, the current work item's decision, the other work items', a tick, a block. */
export declare function pendingList(inbox: readonly InboxItem[], others: readonly InboxItem[]): InboxItem[];
/** The item the band acts on: the first in the inbox, broken bridge first. */
export declare const urgent: (items: readonly InboxItem[]) => InboxItem | undefined;
