export interface BacklogItem {
    id: string;
    title: string;
    target: string;
}
export type BacklogKey = "branch" | "file";
export declare function readBacklog(source: string): {
    key: BacklogKey;
    items: BacklogItem[];
    diagnostics: string[];
};
export declare function renderBacklog(items: readonly BacklogItem[], key: BacklogKey): string;
export declare function bindItem(items: readonly BacklogItem[], id: string, target: string): {
    ok: true;
    items: BacklogItem[];
} | {
    ok: false;
    reason: string;
};
/**
 * Bind backlog item `id` to `target` in the document text: the one cell of the
 * `target` column (`branch` or `file`) in that row is rewritten and every other
 * byte stays - the other columns and their padding, the other rows, the prose,
 * the meta, the other blocks, the line ends. Returns the new text for the
 * caller to write, under the lock of the backlog file. It refuses what
 * `bindItem` refuses (no such item, an id that is not unique or empty, the row
 * already bound elsewhere; binding to the target it already has returns the
 * text unchanged), and what it cannot write: a table with no such column, one
 * whose rows are not a pipe grid in this document (`format=csv`, `src=`, a
 * computed column), or a target that would not read back as itself. The
 * result is re-read and must differ from the original in that one cell, or
 * nothing is returned.
 */
export declare function bindInDocument(source: string, id: string, target: string): {
    ok: true;
    text: string;
} | {
    ok: false;
    reason: string;
};
/** The item bound to `target`. An empty target is no binding: an unbound row is a to-do, and it matches nothing. */
export declare function itemFor(items: readonly BacklogItem[], target: string): BacklogItem | undefined;
