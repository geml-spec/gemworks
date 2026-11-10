import type { ArtifactRow } from "./artifacts.js";
import { type Say } from "./board-page.js";
import { type CoachFlow, type WorkItem } from "./work.js";
/** A commit made in the turns that worked on the item. */
export interface SignoffCommit {
    sha: string;
    subject: string;
    at: string;
}
export interface SignoffInput {
    /** The item as it stands now. */
    item: WorkItem;
    /** Its flow, in the person's words. */
    flow: CoachFlow;
    /** When it was first reported. */
    opened: string;
    commits: readonly SignoffCommit[];
    artifacts: readonly ArtifactRow[];
    /** A time as the person reads it (`11-09 19:03`). */
    clock: (iso: string) => string;
    /** A day and time for the page's head (`2026-11-09 19:03`). */
    day: (iso: string) => string;
    t?: Say;
    /** The artifact name the sheet itself is kept under: left out of its own list. */
    self?: string;
}
/** The page. */
export declare function signoffPage(i: SignoffInput): string;
