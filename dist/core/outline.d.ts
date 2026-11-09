export declare const ITEMS_TABLE = "items";
export declare const OUTLINE_COLUMNS: readonly ["item", "state", "flow", "stage", "worktree", "commits", "pr", "tip", "since", "last"];
/** Where a work item stands, apart from its flow: being worked on, merged with its branch still there, closed, dropped. */
export type EndState = "doing" | "merged" | "closed" | "dropped";
export declare const END_STATES: readonly EndState[];
/** A pull request a branch was opened as, as gh says it is. */
export interface PrFact {
    number: number;
    state: "open" | "merged" | "closed";
}
/** One row of the outline. `commits` is null when nobody counted; `pr` is `#<n> <state>` or empty; `tip` a commit id or empty. */
export interface OutlineRow {
    item: string;
    state: EndState;
    flow: string;
    stage: string;
    worktree: string;
    commits: number | null;
    pr: string;
    tip: string;
    since: string;
    last: string;
}
/**
 * What git says of a branch work item now. `inDefault`: the branch's tip is
 * in the default branch. `tipInDefault`: once the branch is gone, whether the
 * tip the row remembered is.
 */
export interface BranchFacts {
    exists: boolean;
    tip?: string;
    ahead?: number;
    inDefault?: boolean;
    worktree?: string;
    tipInDefault?: boolean;
}
export declare const prText: (p: PrFact) => string;
/** The pull request a row remembers. */
export declare function prOf(text: string): PrFact | undefined;
/**
 * Where a branch work item ended up. Merged is a merged pull request, or a
 * branch that had commits of its own and whose tip the default branch now
 * holds; a branch with none of its own is being worked on while it is there,
 * and so is one that went on after its merge. Once the branch is gone it is
 * closed when it was merged, and dropped when it was not, or never had a
 * commit.
 */
export declare function branchState(prev: OutlineRow | undefined, b: BranchFacts, pr: PrFact | undefined): EndState;
/** Where a file work item stands: its flow's final state closes it, a state named `parked` drops it, anything else is being worked on. */
export declare function fileState(final: boolean, state: string): EndState;
/** What the outline knows of a work item from its journal. */
export interface ItemFacts {
    id: string;
    flow: string;
    stage: string;
    since: string;
    last: string;
}
/**
 * A branch item's row now: what git says, and what the row remembered where
 * git says nothing — the commits a merged branch had, the tip of one that is
 * gone, its pull request until gh is asked again.
 */
export declare function branchRow(prev: OutlineRow | undefined, item: ItemFacts, b: BranchFacts, pr: PrFact | undefined): OutlineRow;
/** A file item's row now. */
export declare function fileRow(item: ItemFacts, final: boolean, state: string): OutlineRow;
/** The rows of a document's `#items` table; none when it has no such table, or one without the outline's columns. */
export declare function readOutline(source: string): OutlineRow[];
/** The `#items` table block, the rows in the order given. */
export declare function renderOutline(rows: readonly OutlineRow[]): string;
/** `source` with its `#items` table replaced by `rows`; only that block is rewritten. A document without it gets it appended; none at all becomes one. */
export declare function withOutline(source: string | null, rows: readonly OutlineRow[]): string;
/** The outline's order: the latest activity first. */
export declare const byLast: (a: OutlineRow, b: OutlineRow) => number;
