// Where a project keeps its workflows, its tool dictionary and its project
// document: in its home — the main working tree's copy of the project
// (journalBaseOf), which every checkout of the repository shares, and which
// git is told to leave alone. One file per workflow,
// `.geml/workflows/<name>.geml`, its stages' texts in it; one dictionary,
// `.geml/tools.geml`, for all of them; `.geml/project.geml` naming the
// default. The earlier layout — a directory per workflow (flow.geml, guide.geml,
// tools.geml), in the checkout, often in git — is still read, and
// `migrateLayout` moves it into the home.
import { cpSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { unitSpans } from "@geml/geml";
import { exists, readText, withLock, writeAtomic } from "./host-fs.js";
import { journalBaseOf, trackedUnder } from "./host-git.js";
import { TOOLS_FILE } from "./core/dictionary.js";
import { readDictionary, withToolsTable } from "./core/dictionary-file.js";
import { FLOW_FILE, GEML_DIR, PROJECT_DOC, TOOLS_DOC, WORKFLOWS_DIR } from "./core/layout.js";
const slashed = (p) => p.split(sep).join("/");
const lf = (s) => s.replace(/\r\n?/g, "\n");
/** Whether `path` lies inside `dir` (or is it). */
function inside(dir, path) {
    const rel = relative(dir, path);
    return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}
/** The project's home: where its workflows, dictionary, journals and session records are — the main working tree's copy of `root`, else `root`. */
export const homeOf = (root) => journalBaseOf(root);
/** What git is told to leave alone in a `.geml/` directory: gemworks's own files, local and never committed, this list among them. */
export const GITIGNORE = ["# gemworks's own files: local, never committed", ".gitignore", "artifacts.geml", "artifacts/", "context.geml", "exports/", "journals/", "project.geml", "sessions/", "tools.geml", "workflows/", "*.lock", ""].join("\n");
/** The lists gemworks wrote before: replaced where one is as it was written and git does not track it. */
const EARLIER_GITIGNORES = [
    "journals/\ncontext.geml\n*.lock\n",
    ["# gemworks's own files: local, never committed", ".gitignore", "context.geml", "exports/", "journals/", "project.geml", "sessions/", "tools.geml", "workflows/", "*.lock", ""].join("\n"),
];
/** Give a `.geml/` directory its .gitignore when it has none, and the current list where it has one gemworks wrote before. */
export function ensureGitignore(gemlDir) {
    const path = join(gemlDir, ".gitignore");
    if (exists(path)) {
        if (!EARLIER_GITIGNORES.includes(lf(readText(path))))
            return;
        // A list git tracks is the person's to change, and so is one where git cannot say.
        const tracked = trackedUnder(gemlDir);
        if (tracked === undefined || tracked.has(resolve(path)))
            return;
    }
    else
        mkdirSync(gemlDir, { recursive: true });
    writeAtomic(path, GITIGNORE);
}
/** The workflow files of a directory (`<name>.geml`), a link to one among them. */
function workflowFiles(dir) {
    if (!exists(dir))
        return [];
    return readdirSync(dir, { withFileTypes: true })
        .filter((e) => (e.isFile() || e.isSymbolicLink()) && /\.geml$/i.test(e.name) && !e.name.startsWith("."))
        .map((e) => ({ name: e.name.replace(/\.geml$/i, ""), path: join(dir, e.name) }));
}
/** The workflow directories of the earlier layout in a directory, a link to one among them: those holding a flow file. */
function workflowDirs(dir) {
    if (!exists(dir))
        return [];
    return readdirSync(dir, { withFileTypes: true })
        .filter((e) => (e.isDirectory() || e.isSymbolicLink()) && exists(join(dir, e.name, FLOW_FILE)))
        .map((e) => ({ name: e.name, path: join(dir, e.name, FLOW_FILE) }));
}
/**
 * The workflows a project has, by name: the home's files, then the earlier
 * layout's directories — the checkout's, then the home's — for a name the
 * home has no file of.
 */
export function installedWorkflows(root, home = homeOf(root)) {
    const found = new Map();
    const earlier = home === root ? [root] : [root, home];
    for (const w of [...workflowFiles(join(home, WORKFLOWS_DIR)), ...earlier.flatMap((b) => workflowDirs(join(b, WORKFLOWS_DIR)))]) {
        if (!found.has(w.name))
            found.set(w.name, w);
    }
    return [...found.values()].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}
/** The project document, the home's; undefined when there is none. */
export function projectDocOf(root, home = homeOf(root)) {
    const doc = join(home, PROJECT_DOC);
    return exists(doc) ? doc : undefined;
}
/** How a journal names a workflow file: relative to the home when it lies there, else to the checkout; `/`-separated. */
export function recordedPath(root, home, path) {
    const abs = resolve(root, path);
    return slashed(relative(inside(home, abs) ? home : root, abs));
}
const EARLIER_FLOW = /^\.geml\/workflows\/([^/]+)\/flow\.geml$/;
/**
 * The workflow file a journal names: the home's; a name of the earlier layout
 * (`.geml/workflows/<name>/flow.geml`) is the home's `<name>.geml` once that
 * is there, wherever the directory still is; else the checkout's. Undefined
 * when none is there.
 */
export function workflowAt(root, home, recorded) {
    if (recorded === "")
        return undefined;
    const there = resolve(home, recorded);
    if (exists(there))
        return there;
    const m = EARLIER_FLOW.exec(recorded.split("\\").join("/"));
    if (m !== null && exists(join(home, WORKFLOWS_DIR, `${m[1]}.geml`)))
        return join(home, WORKFLOWS_DIR, `${m[1]}.geml`);
    const own = resolve(root, recorded);
    return exists(own) ? own : undefined;
}
/** Whether a path is a workflow file of a project's own `.geml/workflows/` (not a directory's flow file). */
function isWorkflowsFile(path) {
    const dir = dirname(path);
    return basename(path).toLowerCase() !== FLOW_FILE && basename(dir) === "workflows" && basename(dirname(dir)) === GEML_DIR;
}
/**
 * A workflow's name as the project calls it: its file's under
 * `.geml/workflows/`, its directory's in the earlier layout, else its
 * directory relative to the checkout.
 */
export function workflowNameOf(root, path) {
    const abs = resolve(root, path);
    const dir = dirname(abs);
    if (isWorkflowsFile(abs))
        return basename(abs).replace(/\.geml$/i, "");
    if (basename(abs).toLowerCase() === FLOW_FILE && basename(dirname(dir)) === "workflows" && basename(dirname(dirname(dir))) === GEML_DIR)
        return basename(dir);
    return slashed(relative(root, dir)) || ".";
}
/**
 * Where a workflow's tool dictionary is (spec §5.3): the project's one,
 * `.geml/tools.geml`, for a workflow file of the project's; beside the flow
 * file for any other (a directory of the earlier layout, a bundled workflow).
 * Works on relative paths too.
 */
export function dictionaryPathOf(workflowFile) {
    const dir = dirname(workflowFile);
    return isWorkflowsFile(workflowFile) ? join(dirname(dir), TOOLS_FILE) : join(dir, TOOLS_FILE);
}
/** A state's `"./file"` or `"./file#id"` in a statechart's JSON. */
const LOCAL_REF = /"\.\/([^"#]+)(#[^"]*)?"/g;
const GUIDE = "guide.geml";
const idsOf = (text) => new Set([...text.matchAll(/\{#([^\s}]+)/g)].map((m) => m[1]));
/** A document without its meta block (and the blank lines after it). */
function withoutMeta(text) {
    const meta = unitSpans(text).find((u) => u.kind === "block" && u.type === "meta");
    if (meta === undefined)
        return text;
    const lines = text.split("\n");
    return [...lines.slice(0, meta.span.start), ...lines.slice(meta.span.end)].join("\n").replace(/^\n+/, "");
}
/**
 * A workflow directory's flow as one file (`name` is the workflow's): its
 * guide's sections after the statechart, each `./guide.geml#id` now `#id`. A
 * guide that cannot be taken in — named whole, or with an id the flow file
 * has too — stays a document of its own, as does any other a state names
 * with `./`: those are `extra`, to go in `<name>/` beside the file, and their
 * references name them there. `read` reads a file of the directory.
 */
export function mergedWorkflow(name, flow, read) {
    const source = lf(flow);
    const refs = [...source.matchAll(LOCAL_REF)].map((m) => ({ file: m[1], id: m[2] }));
    const guideText = refs.some((r) => r.file === GUIDE) ? read(GUIDE) : undefined;
    const guide = guideText === undefined ? undefined : lf(guideText);
    const flowIds = idsOf(source);
    const takesGuide = guide !== undefined && refs.every((r) => r.file !== GUIDE || (r.id !== undefined && r.id.length > 1)) && ![...idsOf(guide)].some((id) => flowIds.has(id));
    const extra = new Map();
    for (const r of refs) {
        if (extra.has(r.file) || (r.file === GUIDE && takesGuide))
            continue;
        const text = read(r.file);
        if (text !== undefined)
            extra.set(r.file, /\.(geml|md)$/i.test(r.file) ? lf(text) : text);
    }
    const rewritten = source.replace(LOCAL_REF, (_m, file, id) => file === GUIDE && takesGuide ? `"${id}"` : `"./${name}/${file}${id ?? ""}"`);
    const text = takesGuide ? `${rewritten.replace(/\n*$/, "\n\n")}${withoutMeta(guide).replace(/\n*$/, "\n")}` : rewritten;
    return { text, extra };
}
/**
 * Rows of another dictionary added to the project's, under its lock: a key
 * the project's has stays as it is, and a second default for a use is no
 * default. With `uses`, only the rows bound to one of them. A project
 * dictionary that does not read is left alone. Answers how many were added.
 */
export function mergeTools(home, source, uses) {
    const path = join(home, TOOLS_DOC);
    const incoming = readDictionary(source).rows.filter((r) => uses === undefined || (r.for !== undefined && uses.has(r.for)));
    if (incoming.length === 0)
        return 0;
    mkdirSync(dirname(path), { recursive: true });
    return withLock(path, () => {
        const text = exists(path) ? readText(path) : null;
        const read = text === null ? null : readDictionary(text);
        if (read !== null && read.diagnostics.some((d) => d.severity === "error"))
            return 0;
        const have = read?.rows ?? [];
        const keys = new Set(have.map((r) => r.tool));
        const defaults = new Set(have.flatMap((r) => (r.default && r.for !== undefined ? [r.for] : [])));
        const added = [];
        for (const r of incoming) {
            if (keys.has(r.tool))
                continue;
            keys.add(r.tool);
            const isDefault = r.default && r.for !== undefined && !defaults.has(r.for);
            if (isDefault)
                defaults.add(r.for);
            added.push({ ...r, default: isDefault });
        }
        if (added.length > 0)
            writeAtomic(path, withToolsTable(text, [...have, ...added]));
        return added.length;
    });
}
/** Write a workflow into the home as `<name>.geml`, with the documents it keeps beside it in `<name>/`. */
export function writeWorkflow(home, name, merged) {
    const to = join(home, WORKFLOWS_DIR, `${name}.geml`);
    for (const [file, text] of merged.extra) {
        const at = join(home, WORKFLOWS_DIR, name, file);
        mkdirSync(dirname(at), { recursive: true });
        writeAtomic(at, text);
    }
    mkdirSync(dirname(to), { recursive: true });
    writeAtomic(to, merged.text);
    return to;
}
/** A file of a workflow directory, if there is one there (and it lies inside it). */
export function readIn(dir, file) {
    const path = resolve(dir, file);
    if (!inside(dir, path) || !exists(path))
        return undefined;
    try {
        return readText(path);
    }
    catch {
        return undefined;
    }
}
/** Move a file or directory into `trash`, under `label`. */
function toTrash(path, trash, label) {
    const to = join(trash, label);
    mkdirSync(dirname(to), { recursive: true });
    try {
        renameSync(path, to);
    }
    catch {
        cpSync(path, to, { recursive: true });
        rmSync(path, { recursive: true, force: true });
    }
    return to;
}
/**
 * Move the earlier layout into the home (the checkout's, then the home's own):
 * each workflow directory becomes `.geml/workflows/<name>.geml`, its guide
 * taken in; its dictionary's rows join `.geml/tools.geml`. A file the home has
 * already is kept, never overwritten. What git tracks is copied and stays; the rest goes to `trash`.
 * The home's `.geml/` gets its .gitignore. Answers what moved; nothing when
 * there is nothing of the earlier layout.
 */
export function migrateLayout(root, trash, home = homeOf(root)) {
    const out = [];
    const dictionaries = [];
    for (const base of home === root ? [root] : [root, home]) {
        const geml = join(base, GEML_DIR);
        if (!exists(geml))
            continue;
        let tracked = null;
        // A path is kept when git tracks it or anything under it, and when git cannot say.
        const kept = (path) => {
            if (tracked === null)
                tracked = trackedUnder(geml);
            if (tracked === undefined)
                return true;
            const p = resolve(path);
            for (const t of tracked)
                if (t === p || t.startsWith(`${p}${sep}`))
                    return true;
            return false;
        };
        const label = (path) => join(basename(base), relative(base, path));
        for (const w of workflowDirs(join(base, WORKFLOWS_DIR))) {
            const from = dirname(w.path);
            const to = join(home, WORKFLOWS_DIR, `${w.name}.geml`);
            if (!exists(to))
                writeWorkflow(home, w.name, mergedWorkflow(w.name, readText(w.path), (f) => readIn(from, f)));
            const tools = readIn(from, TOOLS_FILE);
            if (tools !== undefined)
                dictionaries.push({ text: tools, at: statSync(join(from, TOOLS_FILE)).mtimeMs });
            const keep = kept(from);
            out.push({ from, to, kept: keep, ...(keep ? {} : { trashed: toTrash(from, trash, label(from)) }) });
        }
        if (exists(join(geml, ".gitignore")))
            ensureGitignore(geml);
    }
    // The dictionaries the person taught last come first: where two say otherwise (which tool a use prefers), theirs stands.
    for (const d of dictionaries.sort((a, b) => b.at - a.at))
        mergeTools(home, d.text);
    if (exists(join(home, GEML_DIR)))
        ensureGitignore(join(home, GEML_DIR));
    return out;
}
