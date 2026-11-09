import type { Guard, JsonValue, StatechartModel } from "@geml/geml/dist/statechart.js";
import type { Schema } from "./schema.js";
export type { Guard };
export interface State {
    id: string;
    /** `title`, or the id. */
    title: string;
    /** `description`: the one line people and the model both read. */
    description: string;
    line: number;
    /** The prompt loaded on entry: a section (`#id`, `doc.geml#id`) or a whole document (`./guide.geml`). */
    prompt?: string;
    /** Skill names, handed to the host. */
    skills: string[];
    /** The uses this state declares: `edit`, `test`, `deploy-prod`… The dictionary binds them to tools. */
    uses: string[];
    /** The uses this state declares as rules (`rules`): each is fenced to the states that declare it; the rest run anywhere. */
    rules: string[];
    /** No outgoing transition. */
    final: boolean;
}
/** Three guards, three judges (spec §4.2). */
export type Judge = "machine" | "model" | "none";
export interface Transition {
    index: number;
    /** `from→to`, numbered when the pair has several transitions — the name messages and the journal use. */
    name: string;
    line: number;
    from: string;
    to: string;
    guard?: Guard;
    /** Who judges the guard: a schema (object or reference) the machine, a sentence the model, none when there is no guard. */
    judge: Judge;
    /** The variables a machine guard reads. */
    reads: string[];
    /** Taken only by a person; a guard written beside it must hold too. */
    approval: boolean;
    /** Variables returned to their default when the transition is taken, by anyone. */
    resets: string[];
    /** What the model is told about the transition; empty when none. */
    note: string;
    /** The words on a person's button for it ("通过", "要改"); absent, the target state's title. */
    label?: string;
}
export type GitFact = "committed" | "pr-open" | "pr-merged" | "ci-success";
export declare const GIT_FACTS: readonly GitFact[];
/** Where a variable's value comes from (spec §4.2). A variable without one is the model's to `set`. */
export type Source = {
    kind: "tool";
    use: string;
} | {
    kind: "file";
    glob: string;
} | {
    kind: "git";
    fact: GitFact;
} | {
    kind: "human";
}
/** The clock: true once the current state has been held at least `ms` (spec §3.6). `iso` is the duration as written. */
 | {
    kind: "elapsed";
    iso: string;
    ms: number;
};
export interface Var {
    name: string;
    default: JsonValue;
    source?: Source;
    note: string;
}
/** `stateKey`: the meta key a file unit's item file keeps its state under (`flow-state-key`); absent, the file is not written. */
export type Unit = {
    kind: "branch";
} | {
    kind: "file";
    glob: string;
    stateKey?: string;
};
export declare const DEFAULT_CONTEXT_BUDGET = 16384;
export interface Statechart {
    file: string;
    hash: string;
    initial: string;
    states: Map<string, State>;
    transitions: Transition[];
    vars: Map<string, Var>;
    /** The variables as one object schema, for `validate` and `defaultsOf`: each typed by its default. */
    varsSchema: Schema;
    /** The variables with a `source`: evidence the model cannot write. */
    signalVars: Set<string>;
    /** The uses some state declares as a rule: only these are refused outside the states that declare them. */
    rules: Set<string>;
    unit: Unit;
    contextBudget: number;
    /** The parser's model, for the renderer and the board. */
    model: StatechartModel;
}
export type FlowCode = "flow-statechart" | "flow-attr" | "flow-source" | "flow-dup-edge" | "flow-auto-ambiguous" | "flow-auto-cycle" | "flow-unit" | "flow-tools";
export interface FlowDiagnostic {
    severity: "error" | "warning" | "info";
    code: string;
    message: string;
    line: number;
}
export declare function hashText(text: string): string;
export declare function hasErrors(diagnostics: readonly FlowDiagnostic[]): boolean;
/**
 * An ISO 8601 duration of days, hours, minutes and seconds (`PT2H`, `P1DT12H`,
 * `PT30M`), in milliseconds; undefined for any other text, and for zero.
 * Months and years are not durations a clock can add, so they are not read.
 */
export declare function parseDuration(text: string): number | undefined;
export interface LoadOptions {
    /** Whether a state's `prompt` resolves (a section or a whole document); absent, prompts are not checked. */
    resolveRef?: (ref: string) => boolean;
    /** Another document the statechart refers to (a guard's `doc.geml#id`), relative to the workflow's directory; null when there is none. */
    readDoc?: (rel: string) => string | null;
}
export declare function loadStatechart(source: string, file: string, opts?: LoadOptions): {
    statechart?: Statechart;
    diagnostics: FlowDiagnostic[];
};
export declare function outgoing(sc: Statechart, stateId: string): Transition[];
/** The variables the model may `set`: those without a source. */
export declare function modelVars(sc: Statechart): string[];
/** The variables whose source is `kind`. */
export declare function varsBySource<K extends Source["kind"]>(sc: Statechart, kind: K): (Var & {
    source: Extract<Source, {
        kind: K;
    }>;
})[];
/** A source as the status and the board name it: `tool:test`, `file:out/*.mp4`, `git:pr-open`, `human`, `elapsed:PT2H`. */
export declare function sourceLabel(s: Source): string;
/** The states that declare `use`; a use declared anywhere is usable only in them (spec §4.2). */
export declare function statesDeclaring(sc: Statechart, use: string): string[];
/** Every use some state declares. */
export declare function declaredUses(sc: Statechart): Set<string>;
