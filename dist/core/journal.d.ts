import { type Snapshot } from "./snapshot.js";
import { type Statechart } from "./statechart.js";
export interface JournalMeta {
    item: string;
    workflow: string;
    workflowHash: string;
    created: string;
}
export interface Refused {
    n: number;
    rev: number;
    at: string;
    tool: string;
    call?: string;
    reason: string;
    diagnostics: string[];
    key?: string;
}
/** A file the work item's work wrote, by its project path: what it made, for the board's artifacts. Outside the hash chain, as refusals are. */
export interface Wrote {
    n: number;
    rev: number;
    at: string;
    tool: string;
    call?: string;
    path: string;
}
export interface Journal {
    meta: JournalMeta;
    snapshots: Snapshot[];
    refusals: Refused[];
    writes: Wrote[];
    diagnostics: string[];
}
export declare function renderJournalHead(meta: JournalMeta): string;
/** A revision as its block: every field, in the canonical form. */
export declare function renderSnapshotBlock(s: Snapshot): string;
export declare function renderRefusedBlock(r: Refused): string;
export declare function renderWroteBlock(w: Wrote): string;
export declare function readJournal(source: string): Journal;
/** The journal as a Markdown revision table with per-step diffs, then its refusals and the files written (`gemworks export --to md`, the board's export). */
export declare function renderJournalMarkdown(journal: Journal): string;
/** The chain, each revision's hash and claims, and — given the statechart — that every transition is one of its transitions. */
export declare function verifyJournal(journal: Journal, sc?: Statechart): string[];
