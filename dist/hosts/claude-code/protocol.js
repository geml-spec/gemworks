export const PROTOCOL_VERSION = 1;
/** How long one bridge call may take before the hooks module lets the tool call through. */
export const BRIDGE_TIMEOUT_MS = 15_000;
/** Calls that ask git and gh, or copy files: refresh, board, use, add. */
export const SLOW_TIMEOUT_MS = 45_000;
/** The most to-do items the band counts; past it the band shows `999+` (spec §7.2). */
export const TODO_CAP = 999;
export function encodeRequest(req) {
    return `${JSON.stringify(req)}\n`;
}
/** The last line of the CLI's stdout that parses as an answer of this version. */
export function decodeResponse(stdout) {
    const lines = stdout.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
    for (let i = lines.length - 1; i >= 0; i--) {
        try {
            const v = JSON.parse(lines[i]);
            if (v !== null && typeof v === "object" && v.v === PROTOCOL_VERSION && typeof v.ok === "boolean")
                return v;
        }
        catch {
            // not this line
        }
    }
    return undefined;
}
/**
 * The band's words for a bridge whose stdout held no answer. stderr's error
 * line says what went wrong (`Error: …`, `TypeError: …`, else its first line);
 * a module or package Node could not find means the plugin's bundle was never
 * built, so the words lead with the build to run.
 */
export function unreadableText(exitCode, stderr, pluginRoot) {
    const lines = stderr.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
    const said = lines.find((l) => /^[A-Za-z]*Error\b[^:]*:/.test(l)) ?? lines[0] ?? "";
    if (/Cannot find (?:module|package)/.test(said))
        return `gemworks：桥接没有构建 — 在 ${pluginRoot} 运行 npm run build（${said}）`;
    return `gemworks：桥接的应答无法解析（退出码 ${exitCode}${said ? `：${said}` : ""}）`;
}
const OPS = new Set(["status", "refresh", "before", "after", "verb", "learn", "mark", "advance", "pause", "resume", "rollback", "new-item", "bind", "use", "add", "import", "board", "made", "attention", "export", "artifacts", "artifact", "backfill-list", "backfill-one", "signoff", "turn-ids", "memory", "memory-set", "memory-delete", "practices", "practice-add", "practice-set", "practice-share", "corrections", "corrections-add", "corrections-themes", "corrections-dismiss", "corrections-check"]);
const EXPORT_KINDS = new Set(["journal", "workflow", "text"]);
const EXPORT_FORMATS = new Set(["geml", "md", "json"]);
const VERBS = new Set(["status", "move", "set"]);
/** One lesson as the hooks module sends it: its kind, its key, and the field that kind carries. */
export function isLesson(v) {
    if (typeof v !== "object" || v === null || Array.isArray(v))
        return false;
    const l = v;
    if (typeof l["key"] !== "string" || l["key"] === "")
        return false;
    switch (l["kind"]) {
        case "allow":
        case "deny": return typeof l["where"] === "string" && l["where"] !== "";
        case "use":
        case "default": return typeof l["use"] === "string" && l["use"] !== "";
        case "params": return typeof l["params"] === "object" && l["params"] !== null && !Array.isArray(l["params"]);
        case "forget": return true;
        default: return false;
    }
}
/** One request, checked, a before, after or learn without `cwd` starting at the root; what the CLI cannot run is an error it answers with. */
export function decodeRequest(text) {
    let v;
    try {
        v = JSON.parse(text);
    }
    catch {
        return { error: "the request is not JSON" };
    }
    if (v === null || typeof v !== "object" || Array.isArray(v))
        return { error: "the request is not an object" };
    if (v["v"] !== PROTOCOL_VERSION)
        return { error: `protocol version ${String(v["v"])}; this CLI speaks ${PROTOCOL_VERSION}` };
    if (typeof v["root"] !== "string" || v["root"] === "")
        return { error: "root is required" };
    const op = v["op"];
    if (typeof op !== "string" || !OPS.has(op))
        return { error: `unknown op ${String(op)}` };
    const str = (k) => typeof v[k] === "string";
    const isRecord = (x) => typeof x === "object" && x !== null && !Array.isArray(x);
    const obj = (k) => isRecord(v[k]);
    const cwd = () => v["cwd"] === undefined || (str("cwd") && v["cwd"] !== "");
    const fields = {
        before: () => str("tool") && str("callId") && obj("input") && cwd() && (v["waived"] === undefined || (Array.isArray(v["waived"]) && v["waived"].every((k) => typeof k === "string"))),
        after: () => str("tool") && str("callId") && obj("input") && typeof v["isError"] === "boolean" && typeof v["gitOperation"] === "boolean" && cwd(),
        verb: () => str("name") && VERBS.has(v["name"]) && obj("args"),
        learn: () => Array.isArray(v["lessons"]) && v["lessons"].every(isLesson) && str("tool") && obj("input") && cwd(),
        mark: () => str("variable") && typeof v["checked"] === "boolean",
        advance: () => str("to"),
        rollback: () => Number.isInteger(v["rev"]) && v["rev"] >= 0,
        "new-item": () => str("path") && v["path"] !== "" && str("title") && str("text"),
        bind: () => str("id"),
        use: () => str("workflow"),
        import: () => str("path") && v["path"] !== "",
        export: () => EXPORT_KINDS.has(v["kind"]) && EXPORT_FORMATS.has(v["format"])
            && (v["name"] === undefined || str("name")) && (v["text"] === undefined || str("text")) && (v["strip"] === undefined || typeof v["strip"] === "boolean")
            && (v["to"] === undefined || (str("to") && v["to"] !== "")) && (v["kind"] !== "text" || str("text")),
        artifact: () => (v["kind"] === "link" || v["kind"] === "image" || v["kind"] === "file") && str("where")
            && (v["name"] === undefined || str("name")) && (v["version"] === undefined || str("version")) && (v["page"] === undefined || str("page"))
            && (v["data"] === undefined || str("data")) && (v["mediaType"] === undefined || str("mediaType")),
        artifacts: () => (v["elsewhere"] === undefined || (Array.isArray(v["elsewhere"]) && v["elsewhere"].every((p) => typeof p === "string")))
            && (v["notMade"] === undefined || (Array.isArray(v["notMade"]) && v["notMade"].every((p) => typeof p === "string"))),
        attention: () => v["session"] === undefined || (str("session") && v["session"] !== ""),
        "backfill-list": () => v["transcripts"] === undefined || str("transcripts"),
        "backfill-one": () => str("file") && v["file"] !== "" && (v["own"] === undefined || typeof v["own"] === "boolean") && (v["transcripts"] === undefined || str("transcripts")),
        signoff: () => Array.isArray(v["ids"]) && v["ids"].every((x) => typeof x === "string") && (v["lang"] === undefined || v["lang"] === "zh" || v["lang"] === "en" || v["lang"] === "ja"),
        "turn-ids": () => str("session") && v["session"] !== "" && (v["transcripts"] === undefined || str("transcripts")),
        memory: () => v["transcripts"] === undefined || str("transcripts"),
        "memory-set": () => str("file") && v["file"] !== "" && str("hook") && (v["transcripts"] === undefined || str("transcripts")),
        "memory-delete": () => str("file") && v["file"] !== "" && (v["transcripts"] === undefined || str("transcripts")),
        "practice-add": () => Array.isArray(v["practices"]) && v["practices"].every((x) => typeof x === "object" && x !== null && !Array.isArray(x)) && (v["memory"] === undefined || typeof v["memory"] === "boolean"),
        "practice-share": () => Array.isArray(v["ids"]) && v["ids"].every((x) => typeof x === "string"),
        "practice-set": () => str("id") && v["id"] !== "" && (v["deleted"] === undefined || typeof v["deleted"] === "boolean") && (v["layer"] === undefined || v["layer"] === "personal" || v["layer"] === "project") && (v["everywhere"] === undefined || typeof v["everywhere"] === "boolean"),
        corrections: () => (v["toTheme"] === undefined || typeof v["toTheme"] === "boolean") && (v["session"] === undefined || str("session")),
        "corrections-add": () => Array.isArray(v["prompts"]) && v["prompts"].every(isRecord),
        "corrections-themes": () => obj("answer") && Array.isArray(v["answer"]["assign"]) && Array.isArray(v["answer"]["links"]) && str("linked"),
        "corrections-dismiss": () => str("key") && v["key"] !== "" && Number.isInteger(v["n"]),
        "corrections-check": () => Array.isArray(v["verdicts"]) && v["verdicts"].every((x) => isRecord(x) && typeof x["id"] === "string" && typeof x["practice"] === "string" && typeof x["holds"] === "boolean"),
    };
    const check = fields[op];
    if (check !== undefined && !check())
        return { error: `op ${op}: missing or mistyped fields` };
    if ((op === "before" || op === "after" || op === "learn") && v["cwd"] === undefined)
        return { ...v, cwd: v["root"] };
    return v;
}
