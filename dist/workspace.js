// One project's Gemworks, one operation at a time. Every call that can change
// the workflow takes the journal's lock, reads the journal and the tool
// dictionary fresh, acts through the Supervisor, appends what it produced, and
// releases; it then brings .geml/context.geml in line with the journal under
// that document's own lock — so the CLI, an MCP server and a host's hooks can
// share a project without sharing memory, and a document another work item
// left (a branch switch, file items taking turns) or a write that failed is
// put right by the next operation. Nothing slow happens under a lock: git, gh
// and the walks of the project are asked before it is taken, and the stage's
// prompt is read after the journal's lock is released. The journals (and their
// locks) live in the main working tree's .geml/journals/, which every checkout
// of the repository shares; the context document is each checkout's own; the
// dictionary is the workflow's, beside its flow file.
import { readdirSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { isMarkdownPath, parse } from "@geml/geml";
import { appendOrCreate, exists, globExists, readText, realPath, withLock, writeAtomic } from "./host-fs.js";
import { ghFacts as realGh, isLocalBranch, journalBaseOf, repoFacts as realRepo, treeFingerprint } from "./host-git.js";
import { learnInFile, readDictionaryFile } from "./dictionary-io.js";
import { blockText } from "./core/blocks.js";
import { commandOf } from "./core/command-line.js";
import { bindingOf, normalizedCommand } from "./core/dictionary.js";
import { readJournal } from "./core/journal.js";
import { CONTEXT_DOC, GEML_DIR, JOURNALS_DIR, PROJECT_DOC, WORKFLOWS_DIR } from "./core/layout.js";
import { ensureGitignore, homeOf, installedWorkflows, projectDocOf, recordedPath, workflowAt, workflowNameOf } from "./project-home.js";
export { workflowNameOf };
import { fileSignals, gitSignals, readsGit, runsGitOrGh } from "./core/signals.js";
import { policyOf } from "./core/policy.js";
import { statusOf } from "./core/status.js";
import { canonical, stageEntryRev } from "./core/snapshot.js";
import { buildStageContext, readContextDoc, renderContextDoc } from "./core/stagehand.js";
import { itemState, withItemState, withoutItemState } from "./core/item-state.js";
import { hasErrors, hashText, loadStatechart, varsBySource } from "./core/statechart.js";
import { metaFor, openRun, Supervisor } from "./core/supervisor.js";
import { globToRegExp, hiddenDir, isSafeItemId, journalPathFor, resolveItem } from "./core/unit.js";
const slashed = (p) => p.split(sep).join("/");
const lf = (s) => s.replace(/\r\n?/g, "\n");
/** Whether `path` lies inside `root` (or is it). */
function inside(root, path) {
    const rel = relative(root, path);
    return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}
/**
 * Resolve a state's `prompt` — a section (`#id` of the workflow file,
 * `doc.geml#id`) or a whole document (`./guide.geml`) — `./` from the
 * workflow's directory, anything else from the project root — the one way
 * Stagehand and `gemworks check` both read it. Symbolic links are resolved
 * before the path is judged: a file that then lies outside the project is
 * `outside`, never read; a `./` reference may also lie in the workflow
 * directory's own real place, so a workflow linked in from elsewhere still
 * reads its own documents.
 */
export function resolvePromptRef(ref, workflowFile, root) {
    const workflowDir = dirname(workflowFile);
    const hash = ref.indexOf("#");
    const rel = hash < 0 ? ref : ref.slice(0, hash);
    const id = hash < 0 ? undefined : ref.slice(hash + 1);
    if (id === "" || (rel === "" && id === undefined))
        return { kind: "missing" };
    const local = rel === "" || rel.startsWith("./");
    const file = rel === "" ? workflowFile : local ? join(workflowDir, rel.slice(2)) : join(root, rel);
    const real = realPath(file);
    if (!inside(realPath(root), real) && !(local && inside(realPath(workflowDir), real)))
        return { kind: "outside" };
    if (!exists(real))
        return { kind: "missing" };
    try {
        const source = lf(readText(real));
        if (id === undefined)
            return { kind: "found", text: source };
        const text = blockText(source, id, { markdown: isMarkdownPath(file) });
        return text === undefined ? { kind: "missing" } : { kind: "found", text };
    }
    catch {
        return { kind: "missing" }; // a directory, or a file that cannot be read: not found
    }
}
function defaultGetPrompt(ref, workflowFile, root) {
    const found = resolvePromptRef(ref, workflowFile, root);
    return found.kind === "found" ? found.text : undefined;
}
/** Another document a statechart refers to (a guard's `doc.geml#id`), relative to the workflow's directory and inside the project; null when there is none. */
export function docReader(workflowDir, root) {
    return (rel) => {
        const real = realPath(resolve(workflowDir, rel));
        if (!inside(realPath(root), real) && !inside(realPath(workflowDir), real))
            return null;
        try {
            return exists(real) ? readText(real) : null;
        }
        catch {
            return null;
        }
    };
}
function metaValue(source, key) {
    const meta = parse(source).children.find((b) => b.kind === "block" && b.type === "meta");
    return meta && meta.kind === "block" && meta.data ? meta.data[key] : undefined;
}
/** Which workflow is active: GEMWORKS_STATECHART, else the one the project document names, else the only workflow (the home's files, then the earlier layout's directories). */
export function resolveWorkflow(root, env = process.env) {
    const named = env["GEMWORKS_STATECHART"];
    if (named) {
        const path = resolve(root, named);
        if (!exists(path))
            return { error: `GEMWORKS_STATECHART names ${named}, which does not exist`, kind: "invalid" };
        return { name: slashed(relative(root, dirname(path))) || ".", path };
    }
    const home = homeOf(root);
    const installed = installedWorkflows(root, home);
    const doc = projectDocOf(root, home);
    if (doc !== undefined) {
        const name = metaValue(readText(doc), "flow-workflow");
        if (typeof name === "string" && name !== "") {
            // A workflow is one of the project's: the name may not reach anywhere else.
            if (name.includes("/") || !isSafeItemId(name))
                return { error: `${PROJECT_DOC} names workflow "${name}", which is not the name of a workflow in ${WORKFLOWS_DIR}`, kind: "invalid" };
            const named = installed.find((w) => w.name === name);
            return named !== undefined ? { name, path: named.path } : { error: `${PROJECT_DOC} names workflow "${name}", but ${WORKFLOWS_DIR} has no ${name}.geml`, kind: "invalid" };
        }
    }
    const names = installed.map((w) => w.name);
    if (installed.length === 1)
        return installed[0];
    // Several: the one whose work item is not a file is the default, when it is the only one; the others run beside it.
    const whole = installed.filter((w) => fileUnitOf(w.path) === undefined);
    if (installed.length > 1 && whole.length === 1)
        return whole[0];
    return names.length === 0
        ? { error: "no workflow here: run `gemworks init`", kind: "none" }
        : { error: `several workflows (${names.join(", ")}): choose one with \`gemworks use <name>\``, kind: "ambiguous" };
}
/** The glob of a workflow whose work item is a file (its meta `flow-unit = "file:<glob>"`), read without loading it; undefined for any other. */
export function fileUnitOf(path) {
    let unit;
    try {
        unit = metaValue(readText(path), "flow-unit");
    }
    catch {
        return undefined;
    }
    const m = typeof unit === "string" ? unit.trim().match(/^file:(.+)$/) : null;
    return m ? m[1].trim() : undefined;
}
/**
 * The workflows that run beside the default (spec: several flows side by
 * side): every other installed workflow whose work item is a file, with its
 * glob. A file one of them takes is that workflow's work item.
 */
export function sideFlows(root, defaultPath) {
    const def = resolve(defaultPath);
    return installedWorkflows(root).flatMap(({ name, path }) => {
        if (resolve(path) === def)
            return [];
        const glob = fileUnitOf(path);
        return glob === undefined ? [] : [{ name, path, glob }];
    });
}
/** Another work item's progress, from its journal (under `journalBase`) and its file; undefined while it has no journal. */
export function itemProgress(root, journalBase, id, flows, defaultFile = "") {
    if (!isSafeItemId(id))
        return undefined;
    const path = join(journalBase, journalPathFor(id));
    if (!exists(path))
        return undefined;
    const journal = readJournal(readText(path));
    const first = journal.snapshots[0];
    const last = journal.snapshots.at(-1);
    if (first === undefined || last === undefined)
        return undefined;
    const wf = journal.meta.workflow !== "" ? journal.meta.workflow : defaultFile;
    let flow = flows.get(wf);
    if (flow === undefined) {
        const at = workflowAt(root, journalBase, wf);
        const loaded = at !== undefined ? loadFlow(root, at) : { error: "no workflow" };
        flow = "error" in loaded ? null : { sc: loaded.sc, title: loaded.title ?? workflowNameOf(root, wf) };
        flows.set(wf, flow);
    }
    let title;
    try {
        if (exists(join(root, `${id}.geml`)))
            title = itemState(readText(join(root, `${id}.geml`)), "title");
    }
    catch {
        title = undefined;
    }
    const latest = new Map();
    for (const w of journal.writes) {
        latest.delete(w.path);
        latest.set(w.path, true);
    }
    return {
        id, ...(title !== undefined && title !== "" ? { title } : {}), ...(flow !== null ? { flow: flow.title } : {}),
        state: last.state, ...(flow?.sc.states.get(last.state) !== undefined ? { stateTitle: flow.sc.states.get(last.state).title } : {}),
        final: flow?.sc.states.get(last.state)?.final === true, since: first.at, at: last.at, wrote: [...latest.keys()].reverse(),
    };
}
/** The work items an item file waits for: its meta `depends`, ids apart by spaces or commas. */
export function dependsOf(source) {
    const raw = itemState(source, "depends");
    return raw === undefined ? [] : raw.split(/[\s,]+/).filter((x) => x !== "");
}
/** The workflow file at `path`, loaded and checked: its statechart and title, or why it does not check out. */
function loadFlow(root, path) {
    const file = slashed(relative(root, path));
    const source = readText(path);
    const loaded = loadStatechart(source, file, { readDoc: docReader(dirname(path), root) });
    if (!loaded.statechart || hasErrors(loaded.diagnostics)) {
        return { error: `${file}: ${loaded.diagnostics.filter((d) => d.severity === "error").map((d) => `${d.code}: ${d.message}`).join("; ")}` };
    }
    const title = metaValue(source, "title");
    return { sc: loaded.statechart, ...(typeof title === "string" ? { title } : {}) };
}
/**
 * A workspace that has started nothing: the item's journal is neither created
 * nor appended to, and the context document is left as it is — for looking
 * before acting. Its operations work as on any workspace: the first one starts
 * the journal if there is none. The work item is resolved by the project's
 * default workflow (its unit); an item whose journal was started under another
 * workflow file goes on under that one, and a new item starts under the
 * default. A journal whose workflow file is gone does not open: restore the
 * file, or move the journal aside to start over under the default.
 */
export function loadWorkspace(o) {
    const wf = resolveWorkflow(o.root);
    if ("error" in wf)
        return { ok: false, reason: wf.error, kind: wf.kind };
    const getPrompt = o.getPrompt ?? defaultGetPrompt;
    // A file one of the workflows beside the default takes is that workflow's work item.
    if (o.lastFile !== undefined) {
        const rel = slashed(relative(o.root, resolve(o.root, o.lastFile)));
        const side = sideFlows(o.root, wf.path).find((f) => globToRegExp(f.glob).test(rel));
        if (side !== undefined) {
            const own = loadFlow(o.root, side.path);
            if ("error" in own)
                return { ok: false, reason: own.error, kind: "invalid" };
            return { ok: true, ws: new Workspace(o, side.name, side.path, own.sc, getPrompt, own.title ?? side.name, undefined, wf.name) };
        }
    }
    const def = loadFlow(o.root, wf.path);
    if ("error" in def)
        return { ok: false, reason: def.error, kind: "invalid" };
    const ws = new Workspace(o, wf.name, wf.path, def.sc, getPrompt, def.title ?? wf.name);
    const under = ws.journalWorkflow();
    if (under === undefined || ws.item.kind !== "item")
        return { ok: true, ws };
    const item = ws.item.id;
    const path = workflowAt(o.root, ws.journalBase, under);
    if (path === undefined) {
        return { ok: false, kind: "journal", reason: `${slashed(journalPathFor(item))} was started under ${under}, which is not there: restore that file, or move the journal aside (rename or delete it) to start ${item} over under ${wf.name}.` };
    }
    const own = loadFlow(o.root, path);
    if ("error" in own)
        return { ok: false, reason: own.error, kind: "invalid" };
    const name = workflowNameOf(o.root, path);
    const resolved = { item: ws.item, ...(ws.itemFile !== undefined ? { file: ws.itemFile } : {}) };
    return { ok: true, ws: new Workspace(o, name, path, own.sc, getPrompt, own.title ?? name, resolved, wf.name) };
}
/** The project's workspace, its work item's journal started (or checked that it can be resumed) and the context document in line with it. */
export function openWorkspace(o) {
    const loaded = loadWorkspace(o);
    if (!loaded.ok)
        return loaded;
    const problem = loaded.ws.ensureStarted();
    return problem === undefined ? loaded : { ok: false, reason: problem, kind: "journal" };
}
/** A journal that will not resume: cut short or edited, or in a state the workflow no longer has. `reason` names it and the way out. */
class Unresumable extends Error {
    reason;
    constructor(reason) {
        super(`gemworks: ${reason}`);
        this.reason = reason;
    }
}
export class Workspace {
    o;
    workflowName;
    workflowPath;
    sc;
    getPrompt;
    title;
    defaultName;
    item;
    /** Under `flow-unit = "file:…"`, the work item's file: project-relative, `/`-separated. Undefined under a branch unit or with no work item. */
    itemFile;
    /** The workflow's directory: its flow file, its prompt documents and its dictionary. */
    workflowDir;
    now;
    /** The project root with its links resolved: every path is judged inside this. */
    realRoot;
    /** git's facts once read; see `repo`. */
    repoFacts;
    /** The branch's content fingerprint, once read. */
    tree;
    /** The workflow file as the journal head names it: relative to the home when it lies there (else to the root), `/`-separated. */
    workflowFile;
    /** See `journalBase`. */
    base;
    /** Whether an operation of this workspace started the work item's journal. */
    startedHere = false;
    constructor(o, workflowName, workflowPath, sc, getPrompt, title, 
    /** The work item as the default workflow's unit resolved it, for a workspace on the workflow the item's journal names; absent, resolved here. */
    given, 
    /** The project's default workflow, when this workspace is on another (the item's own). */
    defaultName) {
        this.o = o;
        this.workflowName = workflowName;
        this.workflowPath = workflowPath;
        this.sc = sc;
        this.getPrompt = getPrompt;
        this.title = title;
        this.defaultName = defaultName;
        this.now = o.now ?? (() => new Date().toISOString());
        this.workflowDir = dirname(workflowPath);
        this.workflowFile = recordedPath(o.root, this.journalBase, workflowPath);
        this.realRoot = realPath(o.root);
        const resolved = given ?? this.resolveItem();
        this.item = resolved.item;
        this.itemFile = resolved.file;
    }
    /** git's facts, read the first time they are needed: at once for a branch unit, otherwise only when a git variable (or gh) asks; `refresh` reads them again. */
    get repo() {
        return this.repoFacts ??= (this.o.git ?? realRepo)(this.o.root);
    }
    resolveItem() {
        const unit = this.sc.unit;
        if (unit.kind === "branch") {
            // A git that did not answer says which branch this is no more than that it has none: the reason says so, and nothing is judged on it.
            if (this.repo.unanswered === true)
                return { item: { kind: "inactive", reason: "git did not answer (a busy machine?); nothing is judged until it does" } };
            if (this.repo.noCommits)
                return { item: { kind: "inactive", reason: "no commits yet" } };
            return { item: resolveItem(unit, this.repo) };
        }
        const given = this.o.lastFile === undefined ? undefined : this.projectPath(this.o.lastFile, unit.glob);
        const lastFile = given !== undefined && globToRegExp(unit.glob).test(given) ? given : this.rememberedFile(unit.glob);
        const item = resolveItem(unit, lastFile === undefined ? {} : { lastFile });
        return item.kind === "item" && lastFile !== undefined ? { item, file: lastFile } : { item };
    }
    /**
     * A path as the project names it — relative to the root, `/`-separated — or
     * undefined outside the project or under a directory that keeps it from
     * `glob` (hiddenDir: .git, node_modules, and .geml unless the glob names it). Links
     * are resolved on both sides, so a root reached through a link and a path
     * reported through the real one (or the other way round) agree; the path's
     * own name is kept, so a link to a file is named as itself, as the project
     * walk names it.
     */
    projectPath(path, glob = "") {
        const given = resolve(this.o.root, path.replace(/\\/g, "/"));
        const real = join(realPath(dirname(given)), basename(given));
        const rel = slashed(relative(this.realRoot, real));
        if (rel === "" || rel === ".." || rel.startsWith("../") || isAbsolute(rel))
            return undefined;
        return hiddenDir(glob, rel) === undefined ? rel : undefined;
    }
    /**
     * The file of this workflow's `file:` unit a path names — relative to the
     * root or absolute, either separator — as the project names it; undefined
     * for any other path, and under a branch unit.
     */
    itemFileOf(path) {
        const unit = this.sc.unit;
        if (unit.kind !== "file")
            return undefined;
        const rel = this.projectPath(path, unit.glob);
        return rel !== undefined && globToRegExp(unit.glob).test(rel) ? rel : undefined;
    }
    /** The file of the work item the context document names, while it exists and is a file of the unit. */
    rememberedFile(glob) {
        const id = this.readContext()?.item;
        return id ? this.fileOfItem(id, glob) : undefined;
    }
    /**
     * The file a `file:` unit's work item is — its id is the file's project
     * path without the extension — while the file exists and matches the unit's
     * glob; undefined under a branch unit, or when the file is gone.
     */
    fileOfItem(id, glob = this.sc.unit.kind === "file" ? this.sc.unit.glob : "") {
        if (glob === "" || !isSafeItemId(id))
            return undefined;
        const slash = id.lastIndexOf("/");
        const dir = id.slice(0, Math.max(0, slash));
        const base = id.slice(slash + 1);
        const pattern = globToRegExp(glob);
        let entries;
        try {
            entries = readdirSync(join(this.o.root, dir), { withFileTypes: true });
        }
        catch {
            return undefined;
        }
        for (const e of entries) {
            const path = dir ? `${dir}/${e.name}` : e.name;
            if (e.isFile() && e.name.replace(/\.[^./]+$/, "") === base && pattern.test(path) && this.projectPath(path, glob) === path)
                return path;
        }
        return undefined;
    }
    /** Whether this workspace started the work item's journal: the item is new. */
    get startedJournal() {
        return this.startedHere;
    }
    /** The project root this workspace was opened on, as given. */
    get root() {
        return this.o.root;
    }
    /** The directory whose `.geml/journals/` holds the journals (WorkspaceOptions.journalBase), found the first time it is needed. */
    get journalBase() {
        return this.base ??= this.o.journalBase ?? journalBaseOf(this.o.root);
    }
    /** Where every work item's journal lives. */
    get journalsDir() {
        return join(this.journalBase, JOURNALS_DIR);
    }
    /** The work item's content fingerprint as it stands now (the one `tool` evidence is stamped with); undefined when none applies. */
    contentTree() {
        return this.fingerprint();
    }
    /** The work item's journal; undefined with no work item. */
    get journalPath() {
        return this.item.kind === "item" ? join(this.journalBase, journalPathFor(this.item.id)) : undefined;
    }
    /** The workflow's tool dictionary as it stands on disk (spec §5.3), read afresh: another process may have learned since. */
    dictionary() {
        return readDictionaryFile(this.workflowPath, this.sc);
    }
    /** A person answered (spec §5.3 step 6): write the lessons into the dictionary, under its lock. */
    learn(lessons) {
        learnInFile(this.workflowPath, lessons, this.sc);
    }
    /** Whether one simple command, as a key, is bound to a use some `tool` variable reads: its exit status is evidence somewhere in the workflow. */
    commandSpeaks(head) {
        const row = bindingOf(this.dictionary(), `Bash(${normalizedCommand(head)})`);
        return row?.for !== undefined && varsBySource(this.sc, "tool").some((v) => v.source.use === row.for);
    }
    /** A path for a message: relative to the root when it lies inside, else whole. */
    shown(path) {
        return slashed(inside(this.o.root, path) ? relative(this.o.root, path) : path);
    }
    /** The context document as it stands; undefined when there is none, or it is not a file that can be read. */
    readContext() {
        let text;
        try {
            text = readText(join(this.o.root, CONTEXT_DOC));
        }
        catch {
            return undefined;
        }
        return readContextDoc(text);
    }
    inactiveReason() {
        return this.item.kind === "inactive" ? this.item.reason : "no work item";
    }
    /**
     * Start this item's journal (and so its context document) if it has none;
     * otherwise check the journal can be resumed, and bring the context document
     * in line with it. Returns why the journal cannot be resumed, or undefined.
     */
    ensureStarted() {
        try {
            this.act(() => undefined);
        }
        catch (e) {
            if (e instanceof Unresumable)
                return e.reason;
            throw e;
        }
        return undefined;
    }
    /**
     * The work item's content as one hash, for the `tool` evidence that expires
     * on a change (none, no fingerprint): the checkout's HEAD and status under a
     * branch unit, the episode file's text under a `file:` unit. Read before an
     * operation takes the journal's lock.
     */
    fingerprint() {
        if (this.item.kind !== "item" || varsBySource(this.sc, "tool").length === 0)
            return undefined;
        // A branch's tree costs four git runs: read once per workspace, which lives for one request.
        if (this.sc.unit.kind === "branch")
            return (this.tree ??= { value: (this.o.tree ?? treeFingerprint)(this.o.root) }).value;
        if (this.itemFile === undefined)
            return undefined;
        // Where the item stands is kept in its own meta; writing it back is no change of what the item holds.
        const key = this.sc.unit.stateKey;
        try {
            const source = readText(join(this.o.root, this.itemFile));
            return hashText(key === undefined ? source : withoutItemState(source, key));
        }
        catch {
            return "missing";
        }
    }
    /**
     * Read the journal (or start one) and put a Supervisor over it; its appends
     * are collected, not written. A journal that goes on first expires the
     * evidence its work item's content no longer bears (`tree`, Supervisor.expire).
     */
    begin(path, item) {
        const text = exists(path) ? readText(path) : null;
        const startAt = text === null ? this.itemStateOnDisk() : undefined;
        const opened = openRun({ sc: this.sc, item, workflowFile: this.workflowFile, journalText: text, source: "resume", now: this.now(), ...(startAt !== undefined ? { startAt } : {}) });
        if (!opened.ok) {
            throw new Unresumable(`${this.shown(path)} cannot be resumed: ${opened.reason.replace(/\.$/, "")}. Move it aside (rename or delete it) to start ${item} over.`);
        }
        const out = text === null ? [opened.head, ...opened.blocks] : [...opened.blocks];
        // The content's fingerprint costs git runs: read when evidence is written or may expire, once for the workspace.
        const fingerprint = () => this.fingerprint();
        const sup = new Supervisor(this.sc, opened.run, {
            append: (b) => out.push(b),
            now: () => this.now(),
            tools: this.o.tools,
            dictionary: this.dictionary(),
            get tree() { return fingerprint(); },
            isBranch: (name) => isLocalBranch(this.o.root, name),
        });
        const begun = { text, sup, out, ...(text === null ? {} : { stateBefore: opened.run.snapshot.state }), historyLength: opened.run.history.length };
        if (text !== null) {
            sup.expire(metaFor(this.now()));
            sup.elapse(metaFor(this.now()));
        }
        return begun;
    }
    /** Append what the operation produced, and say what it did to the stage. Called under the journal's lock. */
    finish(path, b) {
        if (b.out.length)
            appendOrCreate(path, "", b.out.join(""));
        const snapshot = b.sup.snapshot;
        const entered = b.sup.run.history.slice(b.historyLength).filter((s) => s.cause === "transition").map((s) => s.state);
        const changed = b.text === null || entered.length > 0 || snapshot.state !== b.stateBefore;
        return { change: { entered }, snapshot, entry: stageEntryRev(b.sup.run.history), changed, fresh: b.text === null };
    }
    /**
     * After the journal's lock is released: bring the context document in line
     * with the journal, and say what the operation did to the stage — with the
     * stage text when it changed the stage. The operation is recorded by now, so
     * a document that cannot be written never fails it: its result goes without
     * the text, and the next operation writes the document.
     */
    staged(f, item) {
        if (f.fresh)
            this.startedHere = true;
        let text;
        try {
            if (this.o.writesContext === false)
                text = f.changed ? this.stageText(f.snapshot) : undefined;
            else
                text = this.reconcile(f, item);
        }
        catch {
            text = undefined;
        }
        return f.changed && text !== undefined ? { ...f.change, context: text } : f.change;
    }
    /** The stage text of `snap`, built and not written. */
    stageText(snap) {
        return buildStageContext(this.sc, snap, (ref) => this.getPrompt(ref, this.workflowPath, this.o.root), this.dictionary()).text;
    }
    /**
     * Make the context document speak for this item's current stage unless it
     * already does — it names the item and the state, and was written during
     * this entry of the stage (a revision from the entry to now: evidence or a
     * patch inside the stage leaves the stage text as it is, and only the
     * `#vars` view beside it is rewritten). Returns the stage text it then holds.
     */
    reconcile(f, item) {
        const was = this.readContext();
        const snap = f.snapshot;
        if (was !== undefined && was.item === item && was.state === snap.state && was.rev >= f.entry && was.rev <= snap.rev) {
            if (was.vars === undefined || canonical(was.vars) !== canonical(snap.vars))
                this.writeVars(was, item, snap.vars);
            return was.text;
        }
        return this.writeContext(snap, item, f.fresh);
    }
    /** Rewrite the document's `#vars` view, its stage block as it was, while the document still speaks for `was`. */
    writeVars(was, item, vars) {
        const path = join(this.o.root, CONTEXT_DOC);
        withLock(path, () => {
            const now = exists(path) ? readContextDoc(readText(path)) : undefined;
            if (now === undefined || now.item !== item || now.state !== was.state || now.rev !== was.rev)
                return;
            writeAtomic(path, renderContextDoc({ state: was.state, rev: was.rev, text: was.text, included: [], truncated: [] }, { at: was.at, item, vars }));
        });
    }
    /**
     * Lock, read the journal, build a Supervisor over it, run `fn`, append what
     * it produced, release; then bring the context document in line. A lazy
     * workspace whose operation recorded nothing in a journal that is not there
     * yet writes nothing at all.
     */
    act(fn) {
        const path = this.journalPath;
        if (path === undefined || this.item.kind !== "item")
            return undefined;
        const item = this.item.id;
        const done = withLock(path, () => {
            const b = this.begin(path, item);
            const opening = b.out.length;
            const value = fn(b.sup);
            const idle = this.o.lazy === true && b.text === null && b.out.length === opening;
            return { value, finished: idle ? undefined : this.finish(path, b) };
        });
        if (done.finished === undefined)
            return { value: done.value, change: { entered: [] } };
        const change = this.staged(done.finished, item);
        this.keepItemState(done.finished.snapshot.state);
        return { value: done.value, change };
    }
    /** The state the item file says the item stands in, for a workflow that keeps it there (`flow-state-key`); undefined otherwise. */
    itemStateOnDisk() {
        const key = this.sc.unit.kind === "file" ? this.sc.unit.stateKey : undefined;
        if (key === undefined || this.itemFile === undefined)
            return undefined;
        try {
            return itemState(readText(join(this.o.root, this.itemFile)), key);
        }
        catch {
            return undefined;
        }
    }
    /**
     * Keep a file unit's item file saying where the item stands — the meta key
     * the workflow names (`flow-state-key`) — so the state travels with the file. Written only when it says
     * otherwise; a file that is gone, or a meta that cannot take the value, is
     * left as it is: the operation is recorded, and the next one tries again.
     */
    keepItemState(state) {
        const key = this.sc.unit.kind === "file" ? this.sc.unit.stateKey : undefined;
        if (key === undefined || this.itemFile === undefined)
            return;
        const path = join(this.o.root, this.itemFile);
        try {
            if (!exists(path))
                return;
            const source = readText(path);
            if (itemState(source, key) === state)
                return;
            const next = withItemState(source, key, state);
            if (next !== undefined)
                writeAtomic(path, next);
        }
        catch { /* the next operation writes it */ }
    }
    /**
     * Write the context document for `snap` under the document's own lock (it
     * is shared by every work item) and return the stage text it now holds.
     * A document another process wrote for a later revision of the same item
     * stands, and its text is returned; a new journal's document always wins.
     */
    writeContext(snap, item, fresh) {
        const ctx = buildStageContext(this.sc, snap, (ref) => this.getPrompt(ref, this.workflowPath, this.o.root), this.dictionary());
        const doc = renderContextDoc(ctx, { at: this.now(), item, vars: snap.vars });
        const path = join(this.o.root, CONTEXT_DOC);
        return withLock(path, () => {
            const current = exists(path) ? readText(path) : undefined;
            const was = current === undefined ? undefined : readContextDoc(current);
            if (!fresh && was !== undefined && was.item === item && was.rev > snap.rev)
                return was.text;
            if (current === undefined || lf(current) !== lf(doc)) {
                // A checkout's .geml/ holds the stage document; git leaves it alone.
                if (current === undefined)
                    ensureGitignore(join(this.o.root, GEML_DIR));
                writeAtomic(path, doc);
            }
            return ctx.text;
        });
    }
    status() {
        return this.view().status;
    }
    /** What a host shell's fast path decides from: see core/policy.ts. */
    policy() {
        return this.view().policy;
    }
    /** The status and the policy together, from one read of the journal: what a host shell keeps after every request. */
    view() {
        return this.viewWith(() => undefined).view;
    }
    /**
     * `before` for a host shell: the gate's answer (spec §5.3) — a refusal,
     * recorded, or nothing — and the status and policy after it, from one read
     * of the journal.
     */
    beforeView(tool, callId, input, waived) {
        const r = this.viewWith((sup) => sup.gate(tool, callId, input, waived));
        const g = r.value;
        if (g === undefined || g.kind === "allow")
            return { ...r.view, recorded: false };
        return { ...r.view, refusal: g.reason, recorded: true };
    }
    /** Run `fn` under the journal's lock, then read the status and the policy from the same Supervisor. gh is asked before the lock is taken. */
    viewWith(fn) {
        const gh = this.readsGh() ? this.ghFacts() : undefined;
        const dict = this.dictionary();
        const r = this.act((sup) => {
            const value = fn(sup);
            return { value, view: { status: this.statusFrom(sup, gh), policy: policyOf(this.sc, dict, sup.run) } };
        });
        if (!r)
            return { value: undefined, view: { status: this.statusFrom(undefined, gh), policy: policyOf(this.sc, dict, undefined) } };
        return r.value;
    }
    /** The status as a Supervisor over this item's journal sees it; no Supervisor, no work item. */
    statusFrom(sup, gh) {
        return statusOf(this.sc, {
            workflow: {
                name: this.workflowName, path: this.workflowFile, title: this.title,
                ...(this.defaultName !== undefined && this.defaultName !== this.workflowName ? { default: this.defaultName } : {}),
            },
            item: this.item,
            ...(this.itemTitle() !== undefined ? { title: this.itemTitle() } : {}),
            ...(this.dependencies().length > 0 ? { depends: this.dependencies() } : {}),
            ...(gh === undefined ? {} : { gh: gh.available ? { available: true } : { available: false, reason: gh.reason } }),
        }, sup?.run);
    }
    dependsRead;
    /** The work items this one waits for (its item file's meta `depends`), each with how far it is; read once per request. */
    dependencies() {
        if (this.dependsRead !== undefined)
            return this.dependsRead;
        let ids = [];
        if (this.item.kind === "item" && this.itemFile !== undefined) {
            try {
                ids = dependsOf(readText(join(this.o.root, this.itemFile)));
            }
            catch {
                ids = [];
            }
        }
        const flows = new Map([[this.workflowFile, { sc: this.sc, title: this.title }]]);
        this.dependsRead = ids.map((id) => {
            const p = itemProgress(this.o.root, this.journalBase, id, flows, this.workflowFile);
            return p === undefined ? { id, done: false, wrote: [] } : {
                id, ...(p.title !== undefined ? { title: p.title } : {}), ...(p.flow !== undefined ? { flow: p.flow } : {}), done: p.final, since: p.since, at: p.at, wrote: p.wrote,
            };
        });
        return this.dependsRead;
    }
    /** Why the work item may not move to `to` yet: a work item it waits for is not done. Back to the start is always open. */
    waitingReason(to) {
        if (to === this.sc.initial)
            return undefined;
        const open = this.dependencies().filter((d) => !d.done);
        if (open.length === 0)
            return undefined;
        const names = open.map((d) => (d.title !== undefined ? `"${d.title}" (${d.id})` : d.id)).join(", ");
        return `${this.item.kind === "item" ? this.item.id : "the work item"} waits for ${names}, which is not done yet: until then it only goes back to #${this.sc.initial}`;
    }
    titleRead;
    /** What the work item is called: its item file's meta `title`, read once per request; a branch has none. */
    itemTitle() {
        if (this.titleRead !== undefined)
            return this.titleRead.title;
        let title;
        if (this.item.kind === "item" && this.itemFile !== undefined) {
            try {
                title = itemState(readText(join(this.o.root, this.itemFile)), "title");
            }
            catch {
                title = undefined;
            }
        }
        this.titleRead = { title };
        return title;
    }
    /** Before a tool call: the reason to refuse it, or undefined. */
    before(tool, callId, input) {
        return this.act((sup) => sup.deny(tool, callId, input))?.value;
    }
    /**
     * After a tool call: the evidence it is for — `tool`, from its exit status
     * or its error; `file`, from a walk of the project; git's facts when it ran
     * git or gh — and what the stage became. git's facts are the ones this
     * workspace read (when it opened, for a branch unit); a workspace that lives
     * across operations calls `refresh` to read them again.
     */
    after(ev) {
        if (this.item.kind !== "item")
            return { entered: [] };
        const run = this.o.tools.run.includes(ev.tool);
        const write = this.o.tools.write.includes(ev.tool);
        const command = commandOf(ev.input);
        const whole = ev.commandsOnly !== true;
        // Facts first, outside the lock: a walk of the project and gh can take a
        // while. A run tool makes files as surely as a write does (a render, a
        // build), so either re-reads the file variables.
        const touched = whole && (run || (write && (ev.wrotePath === undefined || this.projectPath(ev.wrotePath) !== undefined)));
        const files = touched ? this.fileValues() : [];
        const git = whole && run && command !== undefined && runsGitOrGh(command) ? this.gitValues() : [];
        // What the work made: a file it wrote, by its project path. The item file is the item's record, not one of its artifacts.
        const written = write && ev.wrotePath !== undefined ? this.projectPath(ev.wrotePath) : undefined;
        const artifact = written !== undefined && written !== this.itemFile ? written : undefined;
        const r = this.act((sup) => {
            const meta = metaFor(this.now(), ev.callId);
            // `before` ran as another operation, so this Supervisor never saw its
            // refusals; the journal did. A call gemworks refused never ran: its exit
            // status is no command's. Only a refusal since the stage was entered
            // counts: a host that numbers its calls afresh each session (`call_1`)
            // uses an id again.
            const since = stageEntryRev(sup.run.history);
            const refused = ev.callId !== undefined && sup.run.refusalLog.some((x) => x.call === ev.callId && x.rev >= since);
            if (!refused) {
                if (run && command !== undefined) {
                    if (ev.exitCode !== undefined)
                        sup.observeCommand({ command, exitCode: ev.exitCode, ...(ev.commands !== undefined ? { commands: ev.commands } : {}) }, meta);
                }
                else if (whole)
                    sup.observeCall(ev.tool, ev.input, !ev.isError, meta);
                if (artifact !== undefined && !ev.isError)
                    sup.recordWrite(ev.tool, artifact, ev.callId);
            }
            if (files.length > 0)
                sup.applySignals(files, meta);
            if (git.length > 0)
                sup.applySignals(git, meta);
        });
        return r?.change ?? { entered: [] };
    }
    /** Read git's facts again, as they are now, then gh's and the file variables' (session start, board refresh, after a git operation). */
    /** Read git's and the files' facts again and take what they say. `reread: false`, for a workspace that has just opened: git's facts it read then are this moment's. */
    refresh(o = {}) {
        if (this.item.kind !== "item")
            return { entered: [] };
        if (readsGit(this.sc).git && (this.repoFacts === undefined || o.reread !== false))
            this.repoFacts = (this.o.git ?? realRepo)(this.o.root);
        const values = [...this.gitValues(), ...this.fileValues()];
        return this.act((sup) => { sup.applySignals(values, metaFor(this.now())); })?.change ?? { entered: [] };
    }
    /** A model verb (move, set); an accepted one that changed the stage carries the new stage text. A move waits for the work items this one depends on. */
    verb(name, args, callId) {
        const waiting = name === "move" && typeof args["to"] === "string" ? this.waitingReason(args["to"]) : undefined;
        if (waiting !== undefined)
            return { ok: false, reason: waiting };
        const r = this.act((sup) => sup.invoke(name, args, metaFor(this.now(), callId)));
        if (!r)
            return { ok: false, reason: this.inactiveReason() };
        return r.value.ok && r.change.context !== undefined ? { ...r.value, context: r.change.context } : r.value;
    }
    /** A person moves the workflow. */
    advance(to) {
        const waiting = this.waitingReason(to);
        if (waiting !== undefined)
            return { ok: false, reason: waiting };
        const r = this.act((sup) => sup.humanTransition(to, metaFor(this.now())));
        if (!r)
            return { ok: false, reason: this.inactiveReason() };
        return { ...r.value, ...(r.change.context !== undefined ? { context: r.change.context } : {}) };
    }
    /** A person ticks or clears a variable whose source is a person. */
    mark(name, checked) {
        const r = this.act((sup) => sup.mark(name, checked, metaFor(this.now())));
        if (!r)
            return { ok: false, reason: this.inactiveReason() };
        const v = r.value;
        return v.ok ? { ok: true, entered: v.entered, ...(r.change.context !== undefined ? { context: r.change.context } : {}) } : v;
    }
    /** A person holds the work item (spec §5.5): evidence is still recorded, no transition is taken until they resume it. */
    pause() {
        const r = this.act((sup) => sup.pause(metaFor(this.now())));
        return r ? r.value : { ok: false, reason: this.inactiveReason() };
    }
    /** A person lets the work item go; a machine-judged transition that holds by now is taken, as theirs. */
    resume() {
        const r = this.act((sup) => sup.resume(metaFor(this.now())));
        if (!r)
            return { ok: false, reason: this.inactiveReason() };
        return { ...r.value, ...(r.change.context !== undefined ? { context: r.change.context } : {}) };
    }
    /** A person's rollback: the recorded state only. */
    rollback(target) {
        const r = this.act((sup) => sup.rollback(target, metaFor(this.now())));
        if (!r)
            return { ok: false, reason: this.inactiveReason() };
        return { ...r.value, ...(r.change.context !== undefined ? { context: r.change.context } : {}) };
    }
    /**
     * The current stage text from .geml/context.geml, for this work item: a
     * document that speaks for another item (or none at all) is first rewritten
     * from this item's journal. Undefined with no work item, or when the
     * document cannot be written.
     */
    context() {
        if (this.item.kind !== "item")
            return undefined;
        const id = this.item.id;
        const doc = this.readContext();
        if (doc?.item === id)
            return doc.text;
        this.act(() => undefined);
        const now = this.readContext();
        return now?.item === id ? now.text : undefined;
    }
    /**
     * The workflow file this item's journal head names (project-relative), when
     * it is another than this workspace's. Reads the journal's `#journal`
     * block; writes nothing.
     */
    journalWorkflow() {
        const path = this.journalPath;
        if (path === undefined)
            return undefined;
        let text;
        try {
            text = readText(path);
        }
        catch {
            return undefined;
        }
        const at = text.indexOf("{#journal");
        const end = at < 0 ? -1 : text.indexOf("\n===", at);
        const under = readJournal(end < 0 ? text : text.slice(0, end + 4)).meta.workflow;
        if (under === "" || under === this.workflowFile)
            return undefined;
        // The earlier layout's name of this very workflow, since moved into the home, is this one.
        const file = workflowAt(this.o.root, this.journalBase, under);
        return file !== undefined && resolve(file) === resolve(this.workflowPath) ? undefined : under;
    }
    /** The file variables' values, from a walk of the project. */
    fileValues() {
        return fileSignals(this.sc, (glob) => globExists(this.o.root, glob));
    }
    /** Whether a variable reads gh: a git fact other than `committed`. */
    readsGh() {
        return readsGit(this.sc).gh;
    }
    /** The git variables' values; gh is asked only when a variable reads it. */
    gitValues() {
        if (!readsGit(this.sc).git)
            return [];
        const repo = this.repo;
        // git's facts are HEAD's: once HEAD is on another branch than this item's, they say nothing about it.
        if (this.sc.unit.kind === "branch" && this.item.kind === "item" && repo.branch !== this.item.id)
            return [];
        const facts = repo.committed !== undefined ? { committed: repo.committed } : {};
        if (this.readsGh()) {
            const gh = this.ghFacts();
            if (gh.available) {
                if (gh.prOpen !== undefined)
                    facts.prOpen = gh.prOpen;
                if (gh.prMerged !== undefined)
                    facts.prMerged = gh.prMerged;
                if (gh.ci !== undefined)
                    facts.ci = gh.ci;
            }
        }
        return gitSignals(this.sc, facts);
    }
    /** The CI workflows that finished failing on this branch's head, and the head; undefined when gh is not read, or says nothing failed. */
    ciFailures() {
        if (!this.readsGh() || this.sc.unit.kind !== "branch" || this.item.kind !== "item" || this.repo.branch !== this.item.id)
            return undefined;
        const gh = this.ghFacts();
        if (!gh.available || gh.head === undefined)
            return undefined;
        const workflows = (gh.ci ?? []).filter((r) => r.failed === true).map((r) => r.workflow);
        return workflows.length > 0 ? { head: gh.head, workflows } : undefined;
    }
    /** What gh says about this branch; not asked off a branch (no repository, no commits yet, a detached HEAD). */
    ghFacts() {
        const repo = this.repo;
        if (repo.noCommits)
            return { available: false, reason: "no commits yet" };
        const branch = repo.branch;
        if (branch === undefined)
            return { available: false, reason: "not a git repository" };
        if (branch === "HEAD")
            return { available: false, reason: "detached HEAD" };
        return (this.o.gh ?? realGh)(this.o.root, branch);
    }
}
