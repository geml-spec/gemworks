import type { T } from "../../shell/text.js";
export declare const REQUIRED_CALLS: readonly string[];
/** What a caught failure says: an Error's name and message, a hook failure's message (next.error), or the value. */
export declare function failureText(err: unknown): string;
/** The engine call a failure says is not there ("$.fs.write is not a function"): `fs.write`, or null for any other. */
export declare function goneCallOf(err: unknown): string | null;
/** Whether the module needs `call` to work at all. */
export declare function isNeeded(call: string): boolean;
/** The engine's version from `$.session.version()`'s answer: its full `version`, or null when there is none. */
export declare function engineVersionOf(answer: unknown): string | null;
/** The band's words for an engine that lacks calls the module needs: its version when known, and what is gone. */
export declare function engineGapText(t: T, version: string | null, missing: readonly string[]): string;
