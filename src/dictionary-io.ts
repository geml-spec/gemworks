// The tool dictionary on disk: the project's `.geml/tools.geml` for a workflow
// of the project's own (beside the flow file for any other), read afresh for
// every decision and rewritten under its own lock when a person answers (spec
// §5.3). The workspace, the dsh plugin and the pi extension all read and learn
// through here.
import { join } from "node:path";
import { exists, readText, withLock, writeAtomic } from "./host-fs.js";
import { EMPTY_DICTIONARY, learn, TOOLS_FILE, type Dictionary, type Lesson } from "./core/dictionary.js";
import { readDictionary, withToolsTable } from "./core/dictionary-file.js";
import { GEML_DIR } from "./core/layout.js";
import type { Statechart } from "./core/statechart.js";
import { journalBaseOf } from "./host-git.js";
import { dictionaryPathOf } from "./project-home.js";

export { dictionaryPathOf };

/** The dictionary of the workflow at `workflowFile` as it stands; empty when there is no file yet, or it cannot be read. */
export function readDictionaryFile(workflowFile: string, sc?: Statechart): Dictionary {
  const path = dictionaryPathOf(workflowFile);
  if (!exists(path)) return EMPTY_DICTIONARY;
  try {
    return readDictionary(readText(path), sc);
  } catch {
    return EMPTY_DICTIONARY;
  }
}

/** Write `lessons` into the dictionary of the workflow at `workflowFile`, under the file's lock: only the `#tools` table is rewritten. */
export function learnInFile(workflowFile: string, lessons: readonly Lesson[], sc?: Statechart): void {
  learnAt(dictionaryPathOf(workflowFile), lessons, sc);
}

function learnAt(path: string, lessons: readonly Lesson[], sc?: Statechart): void {
  withLock(path, () => {
    const source = exists(path) ? readText(path) : null;
    let dict = source === null ? EMPTY_DICTIONARY : readDictionary(source, sc);
    for (const l of lessons) dict = learn(dict, l);
    writeAtomic(path, withToolsTable(source, dict.rows));
  });
}

/** The project's own dictionary, `.geml/tools.geml` in the main working tree: where the answers about outward actions go, with a workflow or none. */
export function projectDictionaryPath(root: string): string {
  return join(journalBaseOf(root), GEML_DIR, TOOLS_FILE);
}

/**
 * The project dictionary's keys that let a call through in every state — what lets an outward action run unasked
 * (core/outward.ts) — after `allow` keys are written in so and `forget` ones taken out. Empty when there is no file
 * or it cannot be read.
 */
export function outwardAllowed(root: string, change: { allow?: readonly string[]; forget?: readonly string[] } = {}): string[] {
  const path = projectDictionaryPath(root);
  const lessons: Lesson[] = [...(change.allow ?? []).map((key): Lesson => ({ kind: "allow", key, where: "*" })), ...(change.forget ?? []).map((key): Lesson => ({ kind: "forget", key }))];
  if (lessons.length > 0) learnAt(path, lessons);
  if (!exists(path)) return [];
  try {
    return readDictionary(readText(path)).rows.filter((r) => r.allow.includes("*")).map((r) => r.tool);
  } catch {
    return [];
  }
}
