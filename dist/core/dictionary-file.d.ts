import { type DictRow, type Dictionary } from "./dictionary.js";
import type { Statechart } from "./statechart.js";
/**
 * The `#tools` table of `source`, checked (`flow-tools`); against `sc`, its
 * states must be the workflow's and its uses declared somewhere
 * (`flow-source`) — against several (a project's one dictionary), a state or
 * use of any of them.
 */
export declare function readDictionary(source: string, sc?: Statechart | readonly Statechart[]): Dictionary;
/** The `#tools` table block, every row rewritten. */
export declare function renderToolsTable(rows: readonly DictRow[]): string;
/** A whole dictionary document: a title and the table. */
export declare function renderDictionary(rows: readonly DictRow[]): string;
/**
 * `source` with its `#tools` table replaced by `rows` — only that block is
 * rewritten; what a person wrote around it stays. A document without the
 * table gets it appended; no document at all becomes a fresh one.
 */
export declare function withToolsTable(source: string | null, rows: readonly DictRow[]): string;
