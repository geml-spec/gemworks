import type { JsonValue } from "./schema.js";
import type { Statechart } from "./statechart.js";
import { type Meta, type Refusal, type Snapshot } from "./snapshot.js";
import { type JournalMeta } from "./journal.js";
/**
 * What one action produced. `block` is present either way: an accepted action
 * appends a revision, a refused one a refusal, and the caller appends
 * whichever it gets — a refusal that went unrecorded is the one the audit
 * would never see.
 */
export type Advance = {
    ok: true;
    snapshot: Snapshot;
    block: string;
} | {
    ok: false;
    refusal: Refusal;
    block: string;
};
/** What the run remembers of a recorded refusal: its number, the revision it happened at, and the call it turned away. */
export interface RefusalEntry {
    n: number;
    rev: number;
    call?: string;
    key?: string;
}
export interface Run {
    readonly sc: Statechart;
    /** The current revision — the last one on the chain. */
    readonly snapshot: Snapshot;
    /** Every revision, oldest first. Rollback needs all of it. */
    readonly history: readonly Snapshot[];
    /** How many refusals have been recorded, so `#refused-N` keeps counting. */
    readonly refusals: number;
    /** Every recorded refusal, read from the journal and extended as refusals are made. */
    readonly refusalLog: readonly RefusalEntry[];
    /** Every file recorded as written, read from the journal and extended as files are written. */
    readonly writeLog: readonly WroteEntry[];
    /** Whether a person holds the work item (spec §5.5): evidence is still recorded, no transition is taken. */
    readonly paused: boolean;
    /** Evidence observed on content `tree` (when known); null when the variable already held it. */
    signal(name: string, value: boolean, meta: Meta, tree?: string): Advance | null;
    /** The `tool` variables whose content changed since their evidence was written return to their defaults; null when none did. */
    expire(tree: string, meta: Meta): {
        snapshot: Snapshot;
        block: string;
    } | null;
    transition(to: string, meta: Meta): Advance;
    set(patch: Record<string, JsonValue>, meta: Meta): Advance;
    rollback(target: number | "checkpoint", meta: Meta): Advance;
    /** A person holds the work item (`true`) or lets it go (`false`). */
    hold(paused: boolean, meta: Meta): Advance;
    /** The session was cleared: start over at the initial state, on the same chain. */
    reenter(at: string): {
        snapshot: Snapshot;
        block: string;
    };
    /**
     * Record a refusal that did not come from one of the actions above — a
     * tool call a gate turned away. The numbering lives here so `#refused-N`
     * counts once across every source.
     */
    refuse(refusal: Refusal, meta: Meta): string;
    /**
     * Record that the work wrote `path` (a project path): the block to append,
     * or null when the path is already recorded since the stage was entered —
     * one record per file per stage entry.
     */
    wrote(tool: string, path: string, meta: Meta): string | null;
}
/** A file recorded as written: its number, the revision it was written at, and its path. */
export interface WroteEntry {
    n: number;
    rev: number;
    path: string;
}
/** Open a fresh run: the journal head plus revision 0, in the initial state or in `state`. */
export declare function startRun(sc: Statechart, meta: JournalMeta, at: string, state?: string): {
    run: Run;
    head: string;
    block: string;
};
/** Either a resumed run — with a note when the workflow has changed — or why not. */
export type Resumed = {
    ok: true;
    run: Run;
    note?: string;
} | {
    ok: false;
    reason: string;
};
/**
 * Reopen a run from its journal. The chain is verified BEFORE it is trusted:
 * a self-contradicting journal is more dangerous than no journal at all.
 * Verification runs without the statechart so that a chain problem and a
 * statechart problem report separately.
 */
export declare function resumeRun(sc: Statechart, journalSource: string): Resumed;
