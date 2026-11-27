export type PracticeLayer = "personal" | "project" | "team";
export declare const PRACTICE_LAYERS: readonly PracticeLayer[];
/** Who wrote a practice: the model at a turn's end, the move from the host's memory, or the person. */
export type PracticeBy = "model" | "memory" | "person";
/**
 * A practice: the step it hangs on (`flow` and `step`, `*` for every one), what to do, why (the incident it came from),
 * when and by whom it was written, its layer; `ref` the address of the text where a file read every turn keeps it
 * (CLAUDE.md#build-and-check), `from` its source (memory:<file>), `deleted` once the person took it out. `replaces`
 * the one a rewrite took the place of; that one, kept as taken out, names it in `replacedBy`: one problem's attempts.
 */
export interface Practice {
    id: string;
    flow: string;
    step: string;
    text: string;
    why: string;
    at: string;
    by: PracticeBy;
    layer: PracticeLayer;
    ref?: string;
    from?: string;
    deleted?: boolean;
    session?: string;
    turn?: number;
    replaces?: string;
    replacedBy?: string;
}
/** A layer's file read: its practices, and whether the host's memory was moved into it. */
export interface PracticeFile {
    practices: Practice[];
    memoryMoved: boolean;
}
/** A layer's file: its practices (a line that is none is left out), each given the layer; empty text, no practices. */
export declare function parsePractices(text: string, layer: PracticeLayer): PracticeFile;
/** A layer's file written: its meta (and whether the memory was moved), then one practice a line, without the layer it is in. */
export declare function practicesText(file: PracticeFile): string;
/**
 * The practices that remind at a step: not taken out, at most `limit`. The step's own come first, then the flow's
 * for every step, then the ones for any time, each the newest first: a practice for any time never crowds out the
 * step's own.
 */
export declare function practicesAt(list: readonly Practice[], flow: string, step: string, limit?: number): Practice[];
/**
 * How alike two practices read, 0 to 1: the share of neighbouring-character pairs they have in common (Dice). Crude,
 * and needs no model: a restatement of a practice in other words scored 0.41 against it, the next of 81 kept 0.07.
 */
export declare function likeness(a: string, b: string): number;
/**
 * The practices kept most like `text`, on any step, the most alike first and the newer among equals: those the person
 * took out as well (an idea tried and dropped), not those a rewrite took the place of (their rewrite stands for them).
 */
export declare function closestPractices(kept: readonly Practice[], text: string, n?: number): Practice[];
/**
 * Practices given (the practice tool, the move from memory) checked against the ones kept: each needs its flow, step
 * and text; one already kept on the same step (or one the person took out) is not added again. The model says of each
 * whether it is new (`new: true`) or rewrites one kept (`replaces`, by id, which it then takes the place of): one that
 * says neither, while practices are kept, is held back in `unreviewed`, so that the closest are shown before it is
 * written. Only the model's are: the move from memory and the person's own say neither. `newId` names a new one. What to write, the ones it replaces, what was
 * held back, and what was wrong with the rest.
 */
export declare function newPractices(given: readonly unknown[], kept: readonly Practice[], at: string, by: PracticeBy, newId: (n: number) => string, flows: readonly {
    name: string;
    steps: readonly string[];
}[], where?: {
    session: string;
    turn: number;
}): {
    added: Practice[];
    errors: string[];
    replaced: {
        id: string;
        by: string;
    }[];
    unreviewed: {
        n: number;
        text: string;
    }[];
};
/** Whether a practice is new: written by the model in the last `days` days (新学到, with its ×). */
export declare function isNew(p: Practice, now: string, days?: number): boolean;
