/** What a tool is, as the tools tab groups it. */
export type ToolGroup = "cli" | "file" | "mcp" | "skill" | "web" | "model" | "other";
/** Day (`YYYY-MM-DD`, local) → key → how many calls. */
export type UsageBook = Record<string, Record<string, number>>;
/** A command line's commands, as the dictionary keys them: `Bash(node --test)`, `Bash(git commit)`, `Bash(npm run build)`; one per simple command. */
export declare function commandHeads(command: string): string[];
/** The keys a tool call counts under: a shell's commands, an MCP server, a skill by name, else the tool's own name. */
export declare function usageKeys(tool: string, input: Record<string, unknown>): string[];
/** Which group a key belongs to. */
export declare function groupOf(key: string): ToolGroup;
/** A key as the tab shows it: a command as the command, an MCP server by its name, a skill by its name. */
export declare function keyWords(key: string): string;
/** A local day as the book keys it. */
export declare function dayKey(iso: string): string;
/** The book with one call noted under its day. */
export declare function noteUse(book: UsageBook, day: string, keys: readonly string[]): UsageBook;
/** Two books as one: each day's counts added. */
export declare function mergeBooks(a: UsageBook, b: UsageBook): UsageBook;
/** The book keeping only its last `days` days. */
export declare function pruneBook(book: UsageBook, days: number): UsageBook;
/** How many times each key ran in the last `days` days up to `now`. */
export declare function usesSince(book: UsageBook, nowIso: string, days: number): Record<string, number>;
/** The use an unclassified key looks like, among the flow's uses: a test runner as `test`, else `check`; nothing for anything else. */
export declare function guessUse(key: string, uses: readonly string[]): string | undefined;
