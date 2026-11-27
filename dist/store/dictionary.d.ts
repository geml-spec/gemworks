import { type Dictionary, type Lesson } from "../core/dictionary.js";
import type { Statechart } from "../core/statechart.js";
import { dictionaryPathOf } from "../project-home.js";
export { dictionaryPathOf };
/** The dictionary of the workflow at `workflowFile` as it stands; empty when there is no file yet, or it cannot be read. */
export declare function readDictionaryFile(workflowFile: string, sc?: Statechart): Dictionary;
/** Write `lessons` into the dictionary of the workflow at `workflowFile`, under the file's lock: only the `#tools` table is rewritten. */
export declare function learnInFile(workflowFile: string, lessons: readonly Lesson[], sc?: Statechart): void;
/** The project's own dictionary, `.geml/tools.geml` in the main working tree: where the answers about outward actions go, with a workflow or none. */
export declare function projectDictionaryPath(root: string): string;
/**
 * The project dictionary's keys that let a call through in every state — what lets an outward action run unasked
 * (core/outward.ts) — after `allow` keys are written in so and `forget` ones taken out. Empty when there is no file
 * or it cannot be read.
 */
export declare function outwardAllowed(root: string, change?: {
    allow?: readonly string[];
    forget?: readonly string[];
}): string[];
