import { type ItemFacts, type OutlineRow, type PrFact } from "./core/outline.js";
/** A work item as the outline takes it: its journal's facts, the kind of its unit, and its flow's say on it. */
export interface OutlineEntry extends ItemFacts {
    kind: "branch" | "file";
    final: boolean;
    state: string;
}
/**
 * The outline's rows for `entries`, every other row the table had kept, the
 * table written back when it changed. `prs` is gh's word on the branches'
 * pull requests, when it was asked; without it a row keeps the one it had.
 * Answers the rows by item.
 */
export declare function updateOutline(root: string, home: string, entries: readonly OutlineEntry[], prs?: ReadonlyMap<string, PrFact>): Map<string, OutlineRow>;
