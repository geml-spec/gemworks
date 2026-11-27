import type { Pressable } from "./actions.js";
import type { BoardRow } from "./board.js";
import type { MadeAll, MadeAllEntry } from "./protocol.js";
import type { T } from "./text.js";
/** What the list is narrowed to: every kind but the documents in git (listed on their own press), or one kind. */
export type MadeKind = "all" | MadeAllEntry["kind"];
/** The kinds the list can be narrowed to, in the order their presses stand. */
export declare const MADE_KINDS: readonly MadeKind[];
/** How many entries one more press lists, and the most listed at once: a pane fails past about 1,100 elements. */
export declare const MADE_PAGE = 20;
export declare const MADE_MOST = 60;
/** The list's state: the kind it is narrowed to, how many it lists, and the one work item it shows alone (null: every one). */
export interface MadeView {
    kind: MadeKind;
    shown: number;
    item: string | null;
}
export declare const MADE_VIEW: MadeView;
/** The words for the work item an entry came from; undefined for one no work item names (made before there were any). */
export type ItemWords = (id: string) => string | undefined;
/**
 * One artifact: its name and its kind — a link's kind is its press (链接 ↗), a file opens on a press on the row — and
 * under it the work item it came from (left out when the list shows one item's alone), how many versions, and when.
 */
export declare function madeEntry(e: MadeAllEntry, t: T, o: {
    item?: string;
    when: string;
}): BoardRow;
/**
 * A work item's press to its artifacts (产物 n ›, beside its arrow): the 产物 tab with its own alone, counted as that
 * list shows them — its documents in git only when it has nothing else. None when it made none.
 */
export declare function madePress(all: readonly MadeAllEntry[] | undefined, id: string, t: T): Pressable | undefined;
/**
 * The 产物 tab: a press per kind that has some (the one it is narrowed to marked); when it shows one work item's
 * alone, which, and the press back to every one; then the newest first under each day, a page at a time (never more
 * than MADE_MOST at once: older pages fold the newest away, and a press goes back to them), and a press for the next.
 */
export declare function madeTabRows(all: MadeAll | null | undefined, view: MadeView, words: ItemWords, t: T, now?: string): BoardRow[];
