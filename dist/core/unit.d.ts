import type { Unit } from "./statechart.js";
export interface ItemFacts {
    branch?: string;
    defaultBranch?: string;
    lastFile?: string;
}
export type Item = {
    kind: "item";
    id: string;
} | {
    kind: "inactive";
    reason: string;
};
/** A glob as a whole-path regular expression: `*` within a segment, `**` across segments, `?` one character. */
export declare function globToRegExp(glob: string): RegExp;
/**
 * Whether an item id can name a journal on every file system the project may
 * live on. An id is a branch name or a file path without its extension, so it
 * is whatever someone typed: a safe one is `/`-separated, with no empty, `.` or
 * `..` segment, no leading `/`, no control or Windows-reserved character, no
 * segment ending in `.` or a space, and no Windows device name. The journal
 * path is built from it, so this is what keeps a journal under `.geml/journals/`.
 */
export declare function isSafeItemId(id: string): boolean;
/**
 * Directories whose files are never a work item and never a file signal's:
 * the runtime's own (`.geml` holds the journals), git's, and installed packages.
 * The project walk (`globExists`) skips them at any depth, and so does a path here.
 */
export declare const IGNORED_DIRS: ReadonlySet<string>;
/**
 * The ignored directory that keeps `path` out of `glob`'s reach, or undefined
 * when none does. `.git` and `node_modules` always do. The project's `.geml`
 * does unless the glob names it outright as its first segment
 * (`.geml/matters/*.geml`): the author pointed inside it on purpose — though
 * never at its journals, the runtime's own record.
 */
export declare function hiddenDir(glob: string, path: string): string | undefined;
export declare function resolveItem(unit: Unit, f: ItemFacts): Item;
/** The journal of a work item, relative to the project root: its `/` become subdirectories. Throws on an id that is not safe. */
export declare function journalPathFor(itemId: string): string;
