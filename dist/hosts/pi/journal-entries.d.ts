export declare const SNAPSHOT_ENTRY = "gemworks/snapshot";
/** What one of our entries holds: exactly the bytes that went into the file. */
export interface SnapshotEntryData {
    block: string;
}
/**
 * As much of a session entry as this module needs. Structural on purpose - the
 * real type is Pi's `SessionEntry` union, and matching it by shape keeps this
 * file free of a host import.
 */
export interface BranchEntry {
    type?: string;
    customType?: string;
    data?: unknown;
}
/**
 * The journal this branch describes, or null when the branch carries none.
 *
 * Order is the branch's order, oldest first, which is the order the blocks were
 * appended in. `resumeRun` sorts by revision anyway and `verifyJournal` is what
 * notices if the two ever disagree.
 */
export declare function journalFromEntries(entries: readonly BranchEntry[]): string | null;
