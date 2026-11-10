import { type Lang } from "./hosts/claude-code/text.js";
export declare const BOARD_FILE = "board.geml";
/**
 * The language the page is written in: `GEMWORKS_LANG` (zh, en or ja) when set, else the locale the environment
 * names, else the system's own. A host with no panel has no settings of its own to ask.
 */
export declare function boardLang(env?: Readonly<Record<string, string | undefined>>): Lang;
/** Where a project's GEML board is. */
export declare const boardPath: (root: string) => string;
/** The page as the project's record stands now: what `writeBoard` writes. */
export declare function boardText(root: string, now?: Date, lang?: Lang): string;
/** The board written again when what it says changed; its path, or undefined when it could not be. */
export declare function writeBoard(root: string, now?: Date, lang?: Lang): string | undefined;
/** Whether the board has work on it: a work item on the way. A session starting on a project with none opens no empty page. */
export declare function boardHasWork(root: string): boolean;
/**
 * The board written, and opened the first time a session asks (its hooks at its start, or its MCP server at its first
 * record, whichever comes first: a mark per session in the temp directory says it was). GEMWORKS_OPEN_BOARD=0 never
 * opens it (the tests). Returns the path when it was opened now.
 */
export declare function openBoardOnce(root: string, session: string, platform?: string): string | undefined;
/**
 * The board written and opened on this machine, the way a board's artifact opens (open-file.ts): its first opener,
 * started on its own, not waited for. Returns the path, or undefined when nothing was opened.
 */
export declare function openBoard(root: string, platform?: string): string | undefined;
