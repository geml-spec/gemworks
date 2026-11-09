import { type JsonValue } from "./schema.js";
import { type Statechart } from "./statechart.js";
export type By = "model" | "signal" | "human";
/** `pause` and `resume` are a person's hold on the work item (spec §5.5): the same state and variables, by=human. */
export type Cause = "enter" | "transition" | "patch" | "rollback" | "expire" | "pause" | "resume";
/** One revision (spec §5.5): every field goes into the hash but the hash. */
export interface Snapshot {
    rev: number;
    state: string;
    vars: Record<string, JsonValue>;
    cause: Cause;
    /** The previous revision's hash; null for the first. */
    parent: string | null;
    hash: string;
    at: string;
    /** The tool call that caused it. */
    call?: string;
    /** The state a transition or rollback left. */
    from?: string;
    /** The revision a rollback restored. */
    restores?: number;
    by?: By;
    /** The variable whose evidence caused it. */
    signal?: string;
    /** The work item's content fingerprint when `tool` evidence wrote a value other than its default here. */
    tree?: string;
}
/** `tool` is the verb, `signal`, or a host tool a gate turned away; `key`, the dictionary key or command pattern the gate judged, when it judged one. */
export interface Refusal {
    tool: string;
    reason: string;
    diagnostics: string[];
    key?: string;
}
export type Outcome = {
    ok: true;
    next: Snapshot;
} | {
    ok: false;
    refusal: Refusal;
};
export interface Meta {
    at: string;
    call?: string;
    by?: By;
    signal?: string;
}
/** Canonical JSON: keys sorted by code point, no whitespace. The hashed form. */
export declare function canonical(value: JsonValue): string;
/** The hash of a revision: the sha256 of its canonical JSON without `hash` (spec §5.5). */
export declare function hashSnapshot(s: Omit<Snapshot, "hash"> & {
    hash?: string;
}): string;
/** Revision 0: the initial state, or `state` when the run starts where its work item says it stands. */
export declare function initialSnapshot(sc: Statechart, at: string, state?: string): Snapshot;
/** `clear`: a fresh start recorded on the same chain. */
export declare function reenterSnapshot(sc: Statechart, prev: Snapshot, at: string): Snapshot;
/** The model's `set`: only variables without a source, each of its default's type. */
export declare function applyPatch(sc: Statechart, snap: Snapshot, patch: Record<string, JsonValue>, meta: Meta): Outcome;
/**
 * Evidence observed: write the variable. Null when it already holds the
 * value, so repeated observations add no revision. A variable without a
 * source is a refusal (a host passing a bad name gets a journaled refusal)
 * rather than a throw. `by` and `signal` are always set here.
 */
export declare function applySignal(sc: Statechart, snap: Snapshot, name: string, value: boolean, meta: Meta, tree?: string): Outcome | null;
/**
 * Evidence expiry (spec §5.2): every `tool` variable that still holds a value
 * other than its default, written on another content fingerprint than `tree`,
 * returns to its default, all in one revision (`cause=expire by=signal
 * signal=<the first such variable>`). Null when none has expired.
 */
/** Whether any `tool` variable holds a value written on some content: only then can a change of content expire it, and only then is the content read. */
export declare function hasExpirable(sc: Statechart, history: readonly Snapshot[]): boolean;
export declare function applyExpiry(sc: Statechart, history: readonly Snapshot[], tree: string, meta: Meta): Snapshot | null;
/** Whether a machine-judged transition's guard holds for `vars`. A transition judged by the model or by nobody has no guard to hold. */
export declare function guardHolds(sc: Statechart, t: {
    judge: string;
    guard?: {
        kind: string;
        schema?: unknown;
    };
}, vars: Record<string, JsonValue>): boolean;
export declare function applyTransition(sc: Statechart, snap: Snapshot, to: string, meta: Meta): Outcome;
/** The revision at which the current state was entered: the last revision that is neither a patch, an expiry, nor a hold. */
export declare function checkpointRev(history: readonly Snapshot[]): number;
/** Whether a person holds the work item (spec §5.5): the latest pause or resume decides; a fresh entry lifts a hold. */
export declare function isPaused(history: readonly Snapshot[]): boolean;
/**
 * A person holds the work item or lets it go (spec §5.5): a revision in the
 * same state with the same variables, `cause=pause` or `cause=resume`,
 * `by=human`. Holding a held item, or releasing a free one, is a refusal.
 */
export declare function applyHold(sc: Statechart, history: readonly Snapshot[], hold: boolean, meta: Meta): Outcome;
/**
 * The revision at which the current stage was entered: the last `enter` or
 * `transition` (a self-loop is an entry), or the last rollback that restored
 * a state other than the one it left. A patch, and a rollback inside the
 * same state, stay in the stage they were in.
 */
export declare function stageEntryRev(history: readonly Snapshot[]): number;
export declare function applyRollback(sc: Statechart, history: readonly Snapshot[], target: number | "checkpoint", meta: Meta): Outcome;
