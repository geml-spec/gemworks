// The shell's settings (spec §8.7), kept in the plugin's own store across
// sessions: when the desktop is told, whether a new version is announced on
// the board, and the words' language. Pure: parsing a stored value, and the defaults.
export const DEFAULT_SETTINGS = Object.freeze({
    language: "system",
    notify: Object.freeze({ inbox: true, confirm: true, refusal: true, stage: false, update: true }),
    judge: Object.freeze({ enabled: true }),
    learn: Object.freeze({ enabled: true }),
    trace: Object.freeze({ enabled: false }),
});
/** The settings keys a `setting` action names, `group.field`. */
export const SETTING_KEYS = ["language", "notify.inbox", "notify.confirm", "notify.refusal", "notify.stage", "notify.update", "judge.enabled", "learn.enabled", "trace.enabled"];
const LANGUAGES = new Set(["system", "zh", "en", "ja"]);
/** A stored value read as settings: every field as stored when it is of the right type, else its default. */
export function settingsFrom(stored) {
    const v = (typeof stored === "object" && stored !== null ? stored : {});
    const group = (name) => (typeof v[name] === "object" && v[name] !== null ? v[name] : {});
    const bool = (g, k, d) => (typeof g[k] === "boolean" ? g[k] : d);
    const n = group("notify");
    return {
        language: typeof v["language"] === "string" && LANGUAGES.has(v["language"]) ? v["language"] : DEFAULT_SETTINGS.language,
        notify: { inbox: bool(n, "inbox", true), confirm: bool(n, "confirm", true), refusal: bool(n, "refusal", true), stage: bool(n, "stage", false), update: bool(n, "update", true) },
        judge: { enabled: bool(group("judge"), "enabled", true) },
        learn: { enabled: bool(group("learn"), "enabled", true) },
        trace: { enabled: bool(group("trace"), "enabled", false) },
    };
}
/** The settings with one key changed; an unknown key or a value of the wrong type changes nothing. */
export function withSetting(s, key, value) {
    if (key === "language")
        return typeof value === "string" && LANGUAGES.has(value) ? { ...s, language: value } : s;
    const [group, field] = key.split(".");
    if (typeof value !== "boolean" || field === undefined)
        return s;
    if (group === "notify" && field in s.notify)
        return { ...s, notify: { ...s.notify, [field]: value } };
    if (group === "judge" && field in s.judge)
        return { ...s, judge: { ...s.judge, [field]: value } };
    if (group === "learn" && field in s.learn)
        return { ...s, learn: { ...s.learn, [field]: value } };
    if (group === "trace" && field in s.trace)
        return { ...s, trace: { ...s.trace, [field]: value } };
    return s;
}
