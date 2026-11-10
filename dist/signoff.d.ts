import { type Lang } from "./hosts/claude-code/text.js";
export declare const SIGNOFF_DIR = "signoffs";
/** Where a work item's sign-off sheet is. */
export declare const signoffPath: (root: string, id: string) => string;
/**
 * The sheets of the items named, written again from the record as it stands; a finished one's sheet also goes among
 * its artifacts when it says something new. Answers the paths written.
 */
export declare function writeSignoffs(root: string, ids: readonly string[], lang?: Lang): string[];
