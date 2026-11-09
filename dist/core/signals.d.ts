import { type Dictionary } from "./dictionary.js";
import { type Snapshot } from "./snapshot.js";
import { type Statechart } from "./statechart.js";
export { MAX_SIGNAL_COMMAND_LENGTH, personOnlyReason, personOnlyRefusal, runsGitOrGh, signalHeads, simpleCommands } from "./command-line.js";
/** A variable and the value its evidence now reads. */
export interface SignalValue {
    id: string;
    value: boolean;
}
/**
 * One finished call that ran a command line. `exitCode` null: no exit status
 * (the call went to the background). `commands`: which of the line's simple
 * commands (signalHeads' order) this work item takes — the others ran for
 * another one, or nowhere a work item is — absent, every one.
 */
export interface CommandOutcome {
    command: string;
    exitCode: number | null;
    commands?: readonly number[];
}
/** What git and gh say about the current branch. An absent field is a fact nobody could establish. */
export interface GitFacts {
    committed?: boolean;
    prOpen?: boolean;
    prMerged?: boolean;
    /** CI runs on the branch head; `success` is false for a run still going or one that failed, `failed` marks one that finished failing. */
    ci?: readonly {
        workflow: string;
        success: boolean;
        failed?: true;
    }[];
    /** The commit the runs are on: the branch's head. */
    head?: string;
}
/**
 * The keys of a finished command line that may speak for evidence: one
 * `Bash(<command>)` per simple command this work item takes, and only when
 * the line is a plain `&&` chain — otherwise its exit status says nothing
 * about the command that matched. Null when the line speaks for none.
 */
export declare function commandKeys(o: CommandOutcome): string[] | null;
/** The `tool` evidence a finished call speaks for: the variables whose use one of its keys is bound to, in the current state, reading `ok`. */
export declare function toolSignals(sc: Statechart, dict: Dictionary, stateId: string, keys: readonly string[], ok: boolean): SignalValue[];
/** The `tool` evidence of a finished command line: its keys (evidenceKeys), reading the exit status. */
export declare function commandSignals(sc: Statechart, dict: Dictionary, stateId: string, o: CommandOutcome): SignalValue[];
/** `exists` answers undefined when the host could not establish it (a walk that gave up): that variable is left as it was. */
export declare function fileSignals(sc: Statechart, exists: (glob: string) => boolean | undefined): SignalValue[];
export declare function gitSignals(sc: Statechart, f: GitFacts): SignalValue[];
/** Whether any variable reads git, and whether one reads gh (a git fact other than `committed`). */
export declare function readsGit(sc: Statechart): {
    git: boolean;
    gh: boolean;
};
/**
 * The clock's evidence (spec §3.6): each `elapsed` variable is true once the
 * current state has been held at least its duration — from the revision that
 * entered the state (checkpointRev) to `now`. Every such variable is returned;
 * writing one that holds its value already adds no revision.
 */
export declare function elapsedSignals(sc: Statechart, history: readonly Snapshot[], now: string): SignalValue[];
