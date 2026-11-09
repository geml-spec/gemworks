import type { Asked } from "../../core/ask-tool.js";
import { type CoachFlow, type WorkItem } from "./coach.js";
import type { T } from "./text.js";
export interface Waiting {
    /** Every key that stands now: the next turn's `seen`. */
    keys: string[];
    /** The notification for the questions not said before; absent when there is none. */
    ask?: string;
    /** The notification for the work items newly at the person's step; absent when there is none. */
    confirm?: string;
}
export declare function waitingNotices(asks: readonly Asked[], items: readonly WorkItem[], flows: readonly CoachFlow[], session: string, seen: readonly string[], t: T): Waiting;
