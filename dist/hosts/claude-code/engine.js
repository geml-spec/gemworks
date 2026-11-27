/**
 * The calls the module needs: the bridge, the session record, the settings, its tools, its timers, its redraws. Each a
 * noun and a verb (written apart: hooks-purity reads the module's text for the Node globals it may not reach for).
 */
const NEEDED = [["process", "run"], ["fs", "read"], ["fs", "write"], ["store", "get"], ["store", "set"], ["tool", "register"], ["clock", "after"], ["ui", "invalidate"]];
export const REQUIRED_CALLS = NEEDED.map(([noun, verb]) => `${noun}.${verb}`);
/** What a caught failure says: an Error's name and message, a hook failure's message (next.error), or the value. */
export function failureText(err) {
    if (err instanceof Error)
        return `${err.name}: ${err.message}`;
    const message = err?.message;
    return typeof message === "string" ? message : String(err);
}
/** The engine call a failure says is not there ("$.fs.write is not a function"): `fs.write`, or null for any other. */
export function goneCallOf(err) {
    const m = /\$\.([A-Za-z]+)\.([A-Za-z]+) is not a function/.exec(failureText(err));
    return m === null ? null : `${m[1]}.${m[2]}`;
}
/** Whether the module needs `call` to work at all. */
export function isNeeded(call) {
    return REQUIRED_CALLS.includes(call);
}
/** The engine's version from `$.session.version()`'s answer: its full `version`, or null when there is none. */
export function engineVersionOf(answer) {
    const v = answer?.version;
    return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}
/** The band's words for an engine that lacks calls the module needs: its version when known, and what is gone. */
export function engineGapText(t, version, missing) {
    const gone = missing.join(", ");
    return version !== null ? t("Claude Code {0} 改了插件接口，gemworks 暂停：缺 {1}", version, gone) : t("Claude Code 改了插件接口，gemworks 暂停：缺 {0}", gone);
}
