// What the hooks module cannot work without in Claude Code's plugin API, and what it says when an engine lacks some of
// it. The API is early access and may change between releases. An event the engine no longer has loads (the engine
// refuses a module only for how it spells $, not for what it calls) and throws where it is called: "$.process.run is
// not a function". Each hook catches its own failure and lets the session go on, so without this the person would see
// a plugin that does nothing. The module cannot ask the engine beforehand which calls it has: the engine refuses a
// module that reads $.noun.event as a value or by a computed name. So the failures are read where they are caught, and
// a needed call gone has the band say so while the module lets every call through. Calls whose absence costs one
// feature (a toast, a notification, the small model) are not needed here: the module already does without them.
// Pure and Node-free.
import type { T } from "../../shell/text.js";

/**
 * The calls the module needs: the bridge, the session record, the settings, its tools, its timers, its redraws. Each a
 * noun and a verb (written apart: hooks-purity reads the module's text for the Node globals it may not reach for).
 */
const NEEDED: readonly (readonly [string, string])[] = [["process", "run"], ["fs", "read"], ["fs", "write"], ["store", "get"], ["store", "set"], ["tool", "register"], ["clock", "after"], ["ui", "invalidate"]];
export const REQUIRED_CALLS: readonly string[] = NEEDED.map(([noun, verb]) => `${noun}.${verb}`);

/** What a caught failure says: an Error's name and message, a hook failure's message (next.error), or the value. */
export function failureText(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  const message = (err as { message?: unknown } | null | undefined)?.message;
  return typeof message === "string" ? message : String(err);
}

/** The engine call a failure says is not there ("$.fs.write is not a function"): `fs.write`, or null for any other. */
export function goneCallOf(err: unknown): string | null {
  const m = /\$\.([A-Za-z]+)\.([A-Za-z]+) is not a function/.exec(failureText(err));
  return m === null ? null : `${m[1]}.${m[2]}`;
}

/** Whether the module needs `call` to work at all. */
export function isNeeded(call: string): boolean {
  return REQUIRED_CALLS.includes(call);
}

/** The engine's version from `$.session.version()`'s answer: its full `version`, or null when there is none. */
export function engineVersionOf(answer: unknown): string | null {
  const v = (answer as { version?: unknown } | null | undefined)?.version;
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

/** The band's words for an engine that lacks calls the module needs: its version when known, and what is gone. */
export function engineGapText(t: T, version: string | null, missing: readonly string[]): string {
  const gone = missing.join(", ");
  return version !== null ? t("Claude Code {0} 改了插件接口，gemworks 暂停：缺 {1}", version, gone) : t("Claude Code 改了插件接口，gemworks 暂停：缺 {0}", gone);
}
