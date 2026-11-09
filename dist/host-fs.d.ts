export declare function readText(path: string): string;
/**
 * A path with its symbolic links resolved — on Windows its junctions,
 * substituted drives and short names too — so two spellings of one file
 * compare equal. A path that does not exist resolves through its nearest
 * parent that does, its missing names kept as written. Every path compared
 * with a root that went through this must go through it too.
 */
export declare function realPath(path: string): string;
/** Create a file that must not exist yet (flag "wx"), making parent directories. */
export declare function writeNew(path: string, text: string): void;
/** Blind append: one call, no read. */
export declare function appendText(path: string, text: string): void;
/**
 * Append one journal block, writing the head first when the file is new.
 *
 * One `appendFileSync` either way: a journal is written by blind append (the
 * writer never reads the file), so the only question is whether this is the
 * first block. `existsSync` answers it without opening anything.
 */
export declare function appendOrCreate(path: string, head: string, block: string): void;
/** Whether a path is there — the journal asks before deciding to resume. */
export declare function exists(path: string): boolean;
/**
 * Run `fn` holding `<path>.lock` (created with "wx"), so that processes
 * taking the same lock run one at a time. Waits up to `timeoutMs` for another
 * holder and then throws, naming the holder: a write is never silently dropped
 * (spec §5.5). A lock older than `staleMs` is a crashed holder's and is broken
 * — a lock is only ever held for the length of one journal operation, so
 * `staleMs` must be far longer than `fn` takes. The lock is removed however
 * `fn` ends. `fn` is synchronous: the lock is gone when it returns.
 */
export declare function withLock<T>(path: string, fn: () => T, o?: {
    timeoutMs?: number;
    staleMs?: number;
}): T;
/**
 * Replace a file whole: write a sibling temp file, flush it, then rename it
 * over the target, so a reader (or a crash) sees the old text or the new text,
 * never half of one. On Windows the rename waits out a reader that has the
 * target open; a write that cannot be made throws.
 */
export declare function writeAtomic(path: string, text: string): void;
/**
 * Whether any file under `root` matches `glob` (project-relative,
 * `/`-separated, as `globToRegExp` reads it): true at the first match, false
 * when the walk finished without one, undefined when it gave up after `limit`
 * entries - then nobody knows, and a caller must not read it as no. The walk
 * starts below the glob's literal leading directories (`out/final/*.mp4` is
 * looked for under `out/final` only), and meets the same rules from there as
 * from the root: names are case-sensitive, `.git`, `node_modules` and `.geml`
 * are skipped, symbolic links to directories are not followed, and a
 * directory that cannot be read is skipped.
 */
export declare function globExists(root: string, glob: string, limit?: number): boolean | undefined;
