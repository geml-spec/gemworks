/** Who judges a step's leave requirement: a fact the plugin can check, the person, or the model. */
export type Judge = "fact" | "you" | "model";
/** What working out where an item stands reads of a step. */
export interface ProgressStep {
    id: string;
    judge: Judge;
    final: boolean;
}
/** A step as the item stands: met, the one it stands at, not reached yet, or passed with its requirement unmet. */
export type Cell = "met" | "here" | "ahead" | "skipped";
/** Whose turn: the person's (a step they judge), the model's (its own, or a fact nothing is checking yet), a check's under way, or none (every step met). */
export type Whose = "you" | "me" | "wait" | "done";
export interface Progress {
    cells: {
        id: string;
        cell: Cell;
    }[];
    here: string | null;
    whose: Whose;
}
/**
 * Where an item stands: `met` the steps whose requirement is met, `running`
 * the fact steps a check is under way for. A final step is met once every
 * other step is; until then it is ahead.
 */
export declare function progressOf(steps: readonly ProgressStep[], met: ReadonlySet<string>, running?: ReadonlySet<string>): Progress;
