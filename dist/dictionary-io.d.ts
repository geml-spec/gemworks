import { type Dictionary, type Lesson } from "./core/dictionary.js";
import type { Statechart } from "./core/statechart.js";
import { dictionaryPathOf } from "./project-home.js";
export { dictionaryPathOf };
/** The dictionary of the workflow at `workflowFile` as it stands; empty when there is no file yet, or it cannot be read. */
export declare function readDictionaryFile(workflowFile: string, sc?: Statechart): Dictionary;
/** Write `lessons` into the dictionary of the workflow at `workflowFile`, under the file's lock: only the `#tools` table is rewritten. */
export declare function learnInFile(workflowFile: string, lessons: readonly Lesson[], sc?: Statechart): void;
