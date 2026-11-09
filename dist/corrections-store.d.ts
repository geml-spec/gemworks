import { type LabelledPrompt, type Ledger } from "./core/corrections.js";
export declare const CORRECTIONS_FILE = "corrections.geml";
/** The ledger's file. */
export declare const correctionsPath: (home?: string) => string;
/** The ledger as its file holds it; none yet, an empty one. */
export declare function readLedger(home?: string): Ledger;
/** The ledger changed under its lock and written back; what it became. */
export declare function updateLedger(change: (l: Ledger) => Ledger, home?: string): Ledger;
/** Labelled prompts given by an agent or a file (`gemworks corrections label`), checked; what was wrong with the rest. */
export declare function labelledRows(given: readonly unknown[], by: LabelledPrompt["by"]): {
    rows: LabelledPrompt[];
    errors: string[];
};
/** Labelled prompts added to the ledger; how many were new. */
export declare function addLabelled(rows: readonly LabelledPrompt[], home?: string): number;
/** A prompt the person typed that the ledger has no label for: where and when, its words, the end of the reply before it. */
export interface Unlabelled {
    id: string;
    at: string;
    session: string;
    project: string;
    text: string;
    before: string;
}
/**
 * The prompts the person typed in one transcript, each with the last reply they had seen: a user record the host
 * marks as the person's (`turnOrigin` or `origin` human; a record of an older host, with neither, by its words), its
 * reminders stripped; and the lines typed while a turn ran. A brief another session started this one with is not the
 * person's, nor a notice.
 */
export declare function typedPrompts(text: string): {
    at: string;
    session: string;
    cwd: string;
    text: string;
    before: string;
}[];
/**
 * The prompts the person typed in the host's transcripts since `since` (an ISO time; by default the ledger's newest
 * prompt, or thirty days back) that the ledger has no label for, oldest first, at most `limit`. A transcript not
 * written since is not read.
 */
export declare function unlabelledPrompts(ledger: Ledger, transcripts: string, o?: {
    since?: string;
    limit?: number;
    now?: string;
}): Unlabelled[];
