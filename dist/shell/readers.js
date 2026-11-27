// Reading Claude Code's tool calls and results, and the context document,
// without Node: the hooks module imports this file.
const RESERVED = new Set(["tool", "tool_use_id", "agentId", "requestMeta", "consent"]);
/** A tool call's own arguments: the event's input without the keys the engine reserves. */
export function toolArgs(e) {
    const out = {};
    for (const [k, v] of Object.entries(e))
        if (!RESERVED.has(k) && v !== undefined)
            out[k] = v;
    return out;
}
const SENT = ["command", "file_path", "notebook_path"];
/** The part of a call's arguments the CLI reads — the command and the path, never file contents. */
export function bridgeInput(input) {
    const out = {};
    for (const k of SENT)
        if (typeof input[k] === "string")
            out[k] = input[k];
    return out;
}
/**
 * The exit status of a finished Bash call (spec §5.2): `Exit code <n>` on an
 * errored result (its text, else its result when that is a string); 0 for a
 * clean one; non-zero (1) for a clean result Claude Code interpreted
 * (`returnCodeInterpretation`: grep's "No matches found", diff's "Files
 * differ"); null when there is none — the call went to the background, was
 * interrupted, or never ran.
 */
export function bashExitCode(ran) {
    if (ran.deny !== undefined)
        return null;
    if (ran.isError === true) {
        const text = typeof ran.text === "string" ? ran.text : typeof ran.result === "string" ? ran.result : "";
        const m = text.match(/^Exit code (\d+)/);
        return m ? Number(m[1]) : null;
    }
    const r = (ran.result ?? {});
    if (typeof r.backgroundTaskId === "string" || r.interrupted === true)
        return null;
    if (typeof r.returnCodeInterpretation === "string")
        return 1;
    return 0;
}
/** Whether a clean Bash result classified a git or gh operation (commit, push, merge, rebase, PR). */
export function hasGitOperation(ran) {
    if (ran.isError === true || ran.deny !== undefined)
        return false;
    const r = ran.result;
    return typeof r === "object" && r !== null && typeof r.gitOperation === "object" && r.gitOperation !== null;
}
const PATH_FIELD = { Edit: "file_path", Write: "file_path", NotebookEdit: "notebook_path" };
/** The path a file-writing tool (Edit, Write, NotebookEdit) names, as given; undefined for another tool or no path. */
export function writtenPath(tool, input) {
    const field = PATH_FIELD[tool];
    const raw = field === undefined ? undefined : input[field];
    return typeof raw === "string" && raw !== "" ? raw : undefined;
}
/** A path with `/` separators, its `.` and `..` segments resolved and its drive letter upper-cased; undefined when a `..` climbs above where it starts. */
export function normalised(path) {
    const slashed = path.split("\\").join("/").replace(/^([a-z]):/, (_, d) => `${d.toUpperCase()}:`);
    const lead = slashed.match(/^(?:[A-Z]:)?\/*/)?.[0] ?? "";
    const out = [];
    for (const part of slashed.slice(lead.length).split("/")) {
        if (part === "" || part === ".")
            continue;
        if (part !== "..")
            out.push(part);
        else if (out.pop() === undefined)
            return undefined;
    }
    return `${lead}${out.join("/")}`;
}
/**
 * The project-relative, `/`-separated path a write-capability call touched;
 * undefined for another tool, or a path outside the project once `.` and `..`
 * are resolved (a drive letter is compared in any case).
 */
export function touchedPath(tool, input, root) {
    const raw = writtenPath(tool, input);
    if (raw === undefined)
        return undefined;
    const path = normalised(raw);
    const base = normalised(root)?.replace(/\/+$/, "");
    if (path === undefined || base === undefined)
        return undefined;
    if (path.startsWith(`${base}/`))
        return path.slice(base.length + 1);
    if (path.startsWith("/") || /^[A-Z]:/.test(path))
        return undefined;
    return path === "" ? undefined : path;
}
/** Whether a block's attribute text names `#id`. */
const hasId = (attrs, id) => new RegExp(`(?:^|\\s)#${id}(?:\\s|$)`).test(attrs);
/**
 * .geml/context.geml as the hooks module reads it (spec §5.4): the stage text
 * of `text {#current}`, and the item, state and rev of `data {#stage}`. A
 * block whose fence never closes, or a stage block that is not JSON, is no
 * context at all.
 */
export function contextOf(doc) {
    const lines = doc.replace(/\r\n?/g, "\n").split("\n");
    let text;
    let stage;
    for (let i = 0; i < lines.length; i++) {
        const open = lines[i].match(/^(={3,})[ \t]*(text|data)[ \t]*\{(.*)\}[ \t]*$/);
        if (!open)
            continue;
        const fence = open[1];
        let end = i + 1;
        while (end < lines.length && lines[end] !== fence)
            end++;
        if (end >= lines.length)
            return undefined;
        const body = lines.slice(i + 1, end).join("\n");
        if (open[2] === "text" && hasId(open[3], "current"))
            text = body;
        else if (open[2] === "data" && hasId(open[3], "stage")) {
            try {
                const v = JSON.parse(body);
                if (typeof v !== "object" || v === null || Array.isArray(v))
                    return undefined;
                stage = v;
            }
            catch {
                return undefined;
            }
        }
        i = end;
    }
    if (text === undefined || stage === undefined)
        return undefined;
    const rev = stage["rev"];
    if (typeof rev !== "number" || !Number.isInteger(rev))
        return undefined;
    const item = typeof stage["item"] === "string" ? stage["item"] : "";
    const state = typeof stage["state"] === "string" ? stage["state"] : "";
    return { key: `${item}@${rev}`, item, state, rev, text };
}
/** The major version in `node --version`'s output. */
export function nodeMajor(text) {
    const m = text.trim().match(/^v?(\d+)\./);
    return m ? Number(m[1]) : undefined;
}
