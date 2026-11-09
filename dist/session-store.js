// The project's shared session record on disk, for the hosts whose Gemworks
// runs in Node (Codex's hooks and MCP server, DeepSeek Harness's plugin): the
// logs live in the main working tree's `.geml/sessions/` (session-log.ts), so
// every checkout of the repository reads and writes the same ones. A session
// writes its own log only. The Claude Code module does the same through its
// engine's file calls.
import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { GEML_DIR } from "./core/layout.js";
import { appendEvents, currentTurn, decisionsSince, isLogName, legacyLogName, logName, nextTurn, parseLog, SESSIONS_DIR, SESSIONS_GITIGNORE, summarize } from "./core/session-log.js";
import { commitsOf, journalBaseOf, repoFacts } from "./host-git.js";
/** The directory of a project's session logs, for any of its checkouts. */
export function sessionsDirOf(root) {
    return join(journalBaseOf(root), GEML_DIR, SESSIONS_DIR);
}
/**
 * A session's log with the events `make` adds at its end (given the events
 * so far, a session line first when there was none); returns every event.
 * The directory and its ignore file are made the first time.
 */
export function appendSession(root, host, id, make, now = new Date().toISOString()) {
    const dir = sessionsDirOf(root);
    const path = join(dir, logName(host, id));
    let text = "";
    try {
        text = readFileSync(path, "utf8");
    }
    catch {
        // An earlier log of this session, plain JSON lines: its events come along into the GEML one.
        try {
            text = readFileSync(join(dir, legacyLogName(host, id)), "utf8");
        }
        catch {
            text = "";
        }
    }
    const events = parseLog(text);
    const head = [];
    if (!events.some((e) => e.t === "session")) {
        const branch = repoFacts(root).branch;
        head.push({ t: "session", id, host, at: now, ...(branch !== undefined ? { branch } : {}), checkout: root });
        mkdirSync(dir, { recursive: true });
        const ignore = join(dir, ".gitignore");
        if (!existsSync(ignore))
            writeFileSync(ignore, SESSIONS_GITIGNORE, "utf8");
    }
    const added = [...head, ...make([...events, ...head])];
    if (added.length > 0)
        writeFileSync(path, appendEvents(text, added), "utf8");
    return [...events, ...added];
}
/** Every session in the project's record. */
export function readSessions(root) {
    const dir = sessionsDirOf(root);
    let names;
    try {
        const all = readdirSync(dir);
        names = all.filter((n) => isLogName(n, all));
    }
    catch {
        return [];
    }
    const out = [];
    for (const n of names) {
        try {
            const s = summarize(parseLog(readFileSync(join(dir, n), "utf8")));
            if (s !== undefined)
                out.push(s);
        }
        catch { /* a log being written */ }
    }
    return out;
}
/** Two directories as the file system tells them apart (Windows ignores case). */
function samePath(a, b) {
    const x = resolve(a), y = resolve(b);
    return process.platform === "win32" ? x.toLowerCase() === y.toLowerCase() : x === y;
}
/** The session of `host` that asked last, in this checkout when it has one: what an MCP server, which is told no session, writes for. */
export function latestSessionOf(root, host) {
    const byLast = (a, b) => (a.last < b.last ? 1 : a.last > b.last ? -1 : 0);
    const theirs = readSessions(root).filter((s) => s.host === host).sort(byLast);
    return (theirs.find((s) => s.checkout !== undefined && samePath(s.checkout, root)) ?? theirs[0])?.id;
}
/** A person's prompt into the log, as the next turn. */
export function recordPrompt(root, host, id, text, now = new Date().toISOString()) {
    appendSession(root, host, id, (events) => [{ t: "prompt", turn: nextTurn(events), at: now, text }], now);
}
/** The model's decisions into the log, under the turn under way. */
export function recordDecisions(root, host, id, decisions, now = new Date().toISOString()) {
    const given = decisions.map((d) => d.trim()).filter((d) => d !== "");
    if (given.length > 0)
        appendSession(root, host, id, (events) => given.map((text) => ({ t: "decision", turn: currentTurn(events), at: now, text })), now);
    return given.length;
}
/** A file the session wrote, once. */
export function recordFile(root, host, id, path, now = new Date().toISOString()) {
    const branch = repoFacts(root).branch;
    appendSession(root, host, id, (events) => (events.some((e) => e.t === "file" && e.path === path) ? [] : [{ t: "file", turn: currentTurn(events), at: now, path, ...(branch !== undefined ? { branch } : {}) }]), now);
}
/** A turn's end: its answer, and when a command in it committed, the commits made since its prompt. */
export function recordAnswer(root, host, id, answer, committed, now = new Date().toISOString()) {
    const events = appendSession(root, host, id, (so) => (answer.trim() === "" ? [] : [{ t: "answer", turn: currentTurn(so), at: now, text: answer }]), now);
    if (!committed)
        return;
    const asked = [...events].reverse().find((e) => e.t === "prompt");
    if (asked === undefined)
        return;
    const branch = repoFacts(root).branch;
    const commits = commitsOf(root, { since: asked.at });
    appendSession(root, host, id, (so) => commits.filter((c) => !so.some((e) => e.t === "commit" && e.sha === c.sha)).map((c) => ({ t: "commit", turn: currentTurn(so), at: c.at, sha: c.sha, subject: c.subject, ...(branch !== undefined ? { branch } : {}) })), now);
}
/** The other sessions' decisions after `since` (the last three days when null). */
export function decisionsFor(root, id, since, now = new Date().toISOString()) {
    const from = since ?? new Date(Date.parse(now) - 3 * 24 * 60 * 60 * 1000).toISOString();
    return decisionsSince(readSessions(root), id, from);
}
/** How long a session's mark of being open holds: one that marks every two minutes and has not for this long is closed. */
export const OPEN_MS = 5 * 60_000;
/** A mark this old is a session long closed: taken away when the marks are read. */
const OPEN_KEPT_MS = 24 * 60 * 60_000;
/**
 * Mark session `id` of `host` open now, in `root` on the checkout's branch (a file of its own under the logs' `open/`);
 * answer the other sessions marked open within OPEN_MS, newest first.
 */
export function markOpen(root, host, id, now = new Date()) {
    const logs = sessionsDirOf(root);
    const dir = join(logs, "open");
    const mine = `${logName(host, id).replace(/\.geml$/, "")}.json`;
    const branch = repoFacts(root).branch;
    try {
        mkdirSync(dir, { recursive: true });
        if (!existsSync(join(logs, ".gitignore")))
            writeFileSync(join(logs, ".gitignore"), SESSIONS_GITIGNORE, "utf8");
        writeFileSync(join(dir, mine), JSON.stringify({ id, host, checkout: root, ...(branch !== undefined ? { branch } : {}), at: now.toISOString() }), "utf8");
    }
    catch { /* the others are still read */ }
    let names;
    try {
        names = readdirSync(dir).filter((n) => n.endsWith(".json") && n !== mine);
    }
    catch {
        return [];
    }
    const out = [];
    for (const n of names) {
        let s;
        // A mark being written reads as nothing this time: the next read has it.
        try {
            s = JSON.parse(readFileSync(join(dir, n), "utf8"));
        }
        catch {
            continue;
        }
        const age = now.getTime() - Date.parse(s.at);
        if (age > OPEN_KEPT_MS) {
            try {
                unlinkSync(join(dir, n));
            }
            catch { /* the next read */ }
            continue;
        }
        if (age <= OPEN_MS && typeof s.id === "string" && s.id !== id && typeof s.checkout === "string")
            out.push(s);
    }
    return out.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}
/** The branches the other open sessions work on and this one (on `own`) does not: each once, with the folder its newest session works in. */
export function branchesElsewhere(open, own) {
    const out = [];
    for (const s of open) {
        if (s.branch === undefined || s.branch === own || out.some((x) => x.branch === s.branch))
            continue;
        out.push({ branch: s.branch, where: basename(s.checkout) || s.checkout });
    }
    return out;
}
/** A host's name for the line beside a prompt. */
export function hostLabel(host) {
    return { "claude-code": "Claude", codex: "Codex", gemini: "Gemini", dsh: "DeepSeek", pi: "pi" }[host] ?? host;
}
/** Whether a shell command makes a commit. */
export function commits(command) {
    return /\bgit\b[^\n|;&]*\bcommit\b/.test(command);
}
