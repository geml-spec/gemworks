import { type Practice } from "./practices.js";
import type { ArtifactRow } from "./artifacts.js";
import type { Proposal } from "./growth.js";
import type { SharedDecision } from "./session-log.js";
import { type CoachFlow, type WorkItem } from "./work.js";
/** A question the last turn of a session ended with. */
export interface BoardAsk {
    question: string;
    options: readonly string[];
    item?: string;
}
/** The page's words in the person's language: a key is the Chinese as written, `{0}` its holes. */
export type Say = (key: string, ...args: readonly (string | number)[]) => string;
/** Chinese, the words' own language: each key as written, its holes filled. */
export declare const SAY_ZH: Say;
export interface BoardPageInput {
    /** The project's name: its folder's. */
    project: string;
    /** When the page was written, as the person reads it (`2026-11-09 16:50`). */
    updated: string;
    flows: readonly CoachFlow[];
    /** Every work item, newest first: the open and held ones are shown. */
    items: readonly WorkItem[];
    asks: readonly BoardAsk[];
    proposals: readonly Proposal[];
    practices: readonly Practice[];
    artifacts: readonly ArtifactRow[];
    /** The other sessions' decisions, oldest first. */
    decisions: readonly SharedDecision[];
    /** Where an artifact row's link goes, from the page's own folder; undefined for none. */
    linkOf: (row: ArtifactRow) => string | undefined;
    /** A time as the person reads it (`16:50`). */
    clock: (iso: string) => string;
    /** A host's name as the person reads it. */
    hostName: (host: string) => string;
    /** The page's words; Chinese when none. The flows come already in the person's words. */
    t?: Say;
}
/** Text as GEML reads it literally: markup punctuation escaped, a line break a space. */
export declare function literal(text: string): string;
/**
 * One thing that waits on the person, in plain words: what it is about (a work item, or a label), what they decide,
 * and the answers they can say. The GEML board and Pi's band and board draw the same list.
 */
export interface Waiting {
    item?: Pick<WorkItem, "id" | "title">;
    label?: string;
    ask: string;
    say: readonly string[];
}
/** What waits on the person: the questions the last turn ended with, the steps they judge, the open proposals. */
export declare function waitingOf(flows: readonly CoachFlow[], items: readonly WorkItem[], asks: readonly BoardAsk[], proposals: readonly Proposal[], t?: Say): Waiting[];
/** The page. */
export declare function boardPage(i: BoardPageInput): string;
