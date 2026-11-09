import type { Run } from "./run.js";
import type { DictRow, Dictionary, Scope } from "./dictionary.js";
import { type Statechart, type Unit } from "./statechart.js";
export interface FlowPolicy {
    /** False when there is no work item (the default branch, no matching file yet): nothing is recorded or refused. */
    active: boolean;
    unit: Unit;
    state: string;
    /** The uses the current state declares. */
    uses: string[];
    /** Every use some state declares, with those states. */
    fences: Record<string, string[]>;
    /** The uses some state declares as a rule: only these are refused outside their states. */
    rules: string[];
    /** The dictionary's rows, as read. */
    rows: DictRow[];
    /** The globs of the `file` variables. */
    files: string[];
    /** Whether a variable reads git. */
    git: boolean;
    /** The variables a guard of the current state's outgoing transitions reads. */
    relevant: string[];
    /** The uses a `tool` variable reads: a finished call bound to one of them is evidence. */
    evidence: string[];
    /** The project paths recorded as written since the stage was entered: writing one again records nothing. */
    written: string[];
}
/** The variables a machine guard on one of the state's outgoing transitions reads. */
export declare function relevantVars(sc: Statechart, stateId: string): string[];
export declare function policyOf(sc: Statechart, dict: Dictionary, run: Run | undefined): FlowPolicy;
/** The policy as the dictionary's decisions read it. */
export declare function scopeOf(p: FlowPolicy): Scope;
/** The statechart as the dictionary's decisions read it, in `stateId`. */
export declare function scopeIn(sc: Statechart, stateId: string): Scope;
