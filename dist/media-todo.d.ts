/** The vocabulary whose entries have a to-do list. */
export declare const MEDIA_PROFILE = "geml-media/v1";
/** How long one count may take before it gives up and there is none. */
export declare const TODO_BUDGET_MS = 10000;
/** Whether a document's `=== meta` declares the geml-media vocabulary, alone or among others. */
export declare function declaresMedia(source: string): boolean;
/**
 * How many to-do items `geml media todo <file> --root <root>` lists for the
 * project-relative `file`, counted up to TODO_CAP + 1 ("more than TODO_CAP").
 * Undefined when the parser's confined host cannot read the file (missing, not
 * a file, or a link out of the project), the file does not declare geml-media,
 * the count throws, or it runs past `budgetMs`. The budget is checked at every
 * read and hash, and once more at the end.
 */
export declare function mediaTodoCount(root: string, file: string, opts?: {
    budgetMs?: number;
}): number | undefined;
