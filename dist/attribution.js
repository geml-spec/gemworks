// Which checkout and which work item a tool call acts on. A call starts in the
// directory of the loop that makes it (the hooks module reads it as the call
// begins); each simple command of a plain `&&` chain runs where the directory
// changes before it took the shell (core/command-line.ts's commandDirs); a
// file-writing tool acts in its file's directory. A directory in the session's
// checkout is the session's current work item; one in another checkout whose
// project has a workflow is that checkout's current work item — its branch,
// its workflow; anywhere else is no work item's, and only the person-only
// refusal holds there; a directory the line does not say writes no evidence
// and leaves the gates to the session's work item. Under a `file:` unit a
// command's evidence goes to the file its simple command names. A work item
// reached from elsewhere starts its journal only when something is recorded
// in it, and its stage text is for the subagent working there: the answer's
// shell stays the session's.
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { exists, realPath } from "./host-fs.js";
import { checkoutOf, journalBaseOf } from "./host-git.js";
import { changesDirectory, commandDirs, commandOf, isDirectoryChange, pathWords, personOnlyRefusal, signalHeads, simpleCommands } from "./core/command-line.js";
import { writtenPath } from "./hosts/claude-code/readers.js";
import { resolveWorkflow } from "./workspace.js";
const SESSION = { kind: "session" };
const ELSEWHERE = { kind: "elsewhere" };
const UNKNOWN = { kind: "unknown" };
const samePlace = (a, b) => a.kind === b.kind && (a.kind !== "other" || (b.kind === "other" && a.root === b.root));
/** Whether `path` lies inside `root` (or is it). */
function inside(root, path) {
    const rel = relative(root, path);
    return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}
/** Whether a directory under the root is in a checkout of its own: a `.git` entry in it, or in a directory between it and the root. */
function nestedCheckout(realRoot, real) {
    for (let d = real; d !== realRoot; d = dirname(d)) {
        if (exists(join(d, ".git")))
            return true;
        if (dirname(d) === d)
            return false;
    }
    return false;
}
/** The directory itself when it is there, else its nearest ancestor that is: what git can be asked about a directory a command may be about to make. */
function nearestExisting(real) {
    let d = real;
    while (!exists(d) && dirname(d) !== d)
        d = dirname(d);
    return d;
}
/** Where the directories of one session's calls lie, each asked of git at most once. */
export class Places {
    root;
    find;
    realRoot;
    /** The session's own checkout: undefined until asked, null when the root is in none. */
    sessionCheckout;
    seen = new Map();
    constructor(root, find = checkoutOf) {
        this.root = root;
        this.find = find;
        this.realRoot = realPath(root);
    }
    of(dir) {
        if (dir === undefined)
            return UNKNOWN;
        const real = realPath(resolve(this.root, dir));
        let place = this.seen.get(real);
        if (place === undefined) {
            place = this.locate(real);
            this.seen.set(real, place);
        }
        return place;
    }
    locate(real) {
        const under = inside(this.realRoot, real);
        // Under the root with no checkout of its own on the way up: the session's, and git need not be asked.
        if (under && !nestedCheckout(this.realRoot, real))
            return SESSION;
        const c = this.find(nearestExisting(real));
        if (c === undefined)
            return under ? SESSION : ELSEWHERE;
        const s = (this.sessionCheckout ??= this.find(this.realRoot) ?? null);
        if (s !== null && c.top === s.top)
            return SESSION;
        // Another checkout of the session's repository holds the project at the same place in its tree; another repository's project is its top.
        const root = s !== null && c.common === s.common ? join(c.top, relative(s.top, this.realRoot)) : c.top;
        if (root === this.realRoot)
            return SESSION;
        return exists(root) && !("error" in resolveWorkflow(root)) ? { kind: "other", root } : ELSEWHERE;
    }
}
/**
 * Where a call as a whole acts — what judges it before it runs, and what its
 * outcome, the files it made and the git it ran are read against after it: a
 * file-writing tool's file's directory; for a command line, the place every
 * simple command but a directory change runs in, unknown when they differ or
 * the line moves the shell where it cannot be followed; otherwise the
 * directory the call starts in.
 */
export function callPlace(tool, input, start, places) {
    const written = writtenPath(tool, input);
    if (written !== undefined)
        return places.of(dirname(resolve(start, written)));
    const command = commandOf(input);
    if (command === undefined)
        return places.of(start);
    const dirs = commandDirs(command, start);
    if (dirs === null)
        return changesDirectory(command) ? UNKNOWN : places.of(start);
    const commands = simpleCommands(command) ?? [];
    const ran = dirs.filter((_, i) => !isDirectoryChange(commands[i] ?? ""));
    if (ran.length === 0)
        return places.of(start);
    const [first, ...rest] = ran.map((d) => places.of(d));
    return first !== undefined && rest.every((p) => samePlace(p, first)) ? first : UNKNOWN;
}
/** Two stage changes of one work item, one after the other. */
function joined(a, b) {
    const context = b.context ?? a.context;
    return { entered: [...a.entered, ...b.entered], ...(context !== undefined ? { context } : {}) };
}
export class Attribution {
    session;
    open;
    tools;
    places;
    opened = new Map();
    constructor(session, open, tools, find) {
        this.session = session;
        this.open = open;
        this.tools = tools;
        this.places = new Places(session.root, find);
    }
    /** Where the call as a whole acts (callPlace). */
    placeOf(tool, input, start) {
        return callPlace(tool, input, start, this.places);
    }
    /**
     * `before` for a call. In the session's checkout, or where the line does not
     * say, the session's work item judges it as it always has, and `view` is the
     * session's after it, from the same read. In another checkout that
     * checkout's work item judges it and records it there; anywhere else only
     * the person-only refusal holds, recorded nowhere. A work item elsewhere
     * that cannot judge (its journal will not resume) lets the call through.
     */
    before(tool, callId, input, start, waived) {
        const place = this.placeOf(tool, input, start);
        if (place.kind === "session" || place.kind === "unknown") {
            const { refusal, recorded, ...view } = this.session.beforeView(tool, callId, input, waived);
            return { ...(refusal !== undefined ? { refusal } : {}), recorded, view };
        }
        if (place.kind === "other") {
            const ws = this.current(place, this.written(tool, input, start));
            if (ws === undefined)
                return { recorded: false };
            try {
                const r = ws.beforeView(tool, callId, input, waived);
                return { ...(r.refusal !== undefined ? { refusal: r.refusal } : {}), recorded: r.recorded };
            }
            catch {
                return { recorded: false };
            }
        }
        const command = commandOf(input);
        const refusal = command === undefined ? undefined : personOnlyRefusal(command);
        return { ...(refusal !== undefined ? { refusal } : {}), recorded: false };
    }
    /**
     * A person's answer about a call (spec §5.3 step 6) goes into the dictionary
     * of the work item that judges the call: the session's, or another
     * checkout's. False when no work item takes it (the call acts elsewhere).
     */
    learn(lessons, tool, input, start) {
        const place = this.placeOf(tool, input, start);
        const ws = place.kind === "session" || place.kind === "unknown" ? this.session : this.current(place, this.written(tool, input, start));
        if (ws === undefined)
            return false;
        ws.learn(lessons);
        return true;
    }
    /**
     * `after` on every work item the call was attributed to. The work item where
     * the call as a whole acted takes its outcome as evidence, the file
     * variables and the git it ran; each simple command's evidence goes to the
     * work item of the directory it ran in (under a `file:` unit, the file it
     * names). A work item reached elsewhere that fails never fails the
     * session's answer.
     */
    after(call, start) {
        const targets = [];
        const target = (ws) => {
            let t = targets.find((x) => x.ws === ws);
            if (t === undefined) {
                t = { ws, whole: false, commands: [] };
                targets.push(t);
            }
            return t;
        };
        const written = this.written(call.tool, call.input, start);
        const whole = this.current(this.placeOf(call.tool, call.input, start), written);
        if (whole !== undefined)
            target(whole).whole = true;
        const command = commandOf(call.input);
        if (this.tools.run.includes(call.tool) && command !== undefined && typeof call.exitCode === "number") {
            const heads = signalHeads(command) ?? [];
            const commands = simpleCommands(command) ?? [];
            (commandDirs(command, start) ?? []).forEach((dir, i) => {
                const head = heads[i];
                const current = dir === undefined ? undefined : this.current(this.places.of(dir));
                if (current === undefined || dir === undefined || head === undefined || !current.commandSpeaks(head))
                    return;
                const ws = this.itemFor(current, commands[i] ?? "", dir);
                if (ws !== undefined)
                    target(ws).commands.push(i);
            });
        }
        let own = { entered: [] };
        let routed;
        for (const t of targets) {
            const wrote = t.ws === this.session ? call.wrotePath : written;
            let change;
            try {
                change = t.ws.after({
                    tool: call.tool, callId: call.callId, isError: call.isError, input: call.input,
                    ...(call.exitCode !== undefined ? { exitCode: call.exitCode } : {}),
                    ...(t.whole && wrote !== undefined ? { wrotePath: wrote } : {}),
                    commands: t.commands,
                    commandsOnly: !t.whole,
                });
                // A git operation's facts are read again whatever command made it (a script can commit or open a PR too).
                if (t.whole && call.gitOperation)
                    change = joined(change, t.ws.refresh());
            }
            catch (e) {
                if (t.ws === this.session)
                    throw e;
                continue;
            }
            if (t.ws === this.session)
                own = joined(own, change);
            else if (routed === undefined && change.context !== undefined && t.ws.item.kind === "item")
                routed = { item: t.ws.item.id, context: change.context };
        }
        return { ...own, ...(routed !== undefined ? { routed } : {}) };
    }
    /** The file a file-writing tool names, absolute. */
    written(tool, input, start) {
        const path = writtenPath(tool, input);
        return path === undefined ? undefined : resolve(start, path);
    }
    /**
     * The current work item's workspace of a place a call reached: the
     * session's own, or another checkout's — opened for `lastFile`, a written
     * file, which under a `file:` unit is the work item.
     */
    current(place, lastFile) {
        if (place.kind === "session")
            return this.session;
        if (place.kind !== "other")
            return undefined;
        return this.cached(`${place.root}\n${lastFile ?? ""}`, () => this.open({ root: place.root, journalBase: journalBaseOf(place.root), ...(lastFile !== undefined ? { lastFile } : {}) }));
    }
    /**
     * The work item one simple command's evidence goes to: under a `file:` unit
     * the file it names, relative to the directory it runs in — none when it
     * names more than one, or a glob that may match several — and the current
     * work item when it names none; under a branch unit, the current work item.
     */
    itemFor(current, command, dir) {
        if (current.sc.unit.kind !== "file")
            return current;
        const files = new Set();
        for (const w of pathWords(command)) {
            const file = current.itemFileOf(isAbsolute(w.text) ? w.text : join(dir, w.text));
            if (file === undefined)
                continue;
            if (w.glob)
                return undefined;
            files.add(file);
        }
        const [file, ...more] = files;
        if (file === undefined)
            return current;
        if (more.length > 0)
            return undefined;
        if (current.item.kind === "item" && current.item.id === file.replace(/\.[^./]+$/, ""))
            return current;
        return this.cached(`${current.root}\n${file}\nnamed`, () => this.open({ root: current.root, journalBase: current.journalBase, lastFile: file, writesContext: false }));
    }
    cached(key, make) {
        if (!this.opened.has(key)) {
            let ws;
            try {
                ws = make();
            }
            catch {
                ws = undefined;
            }
            this.opened.set(key, ws);
        }
        return this.opened.get(key);
    }
}
