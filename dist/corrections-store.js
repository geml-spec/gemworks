/**
 * Where the ledger of corrections is kept (core/corrections.ts): the person's own ~/.gemworks/corrections.geml, for
 * every project they work in, never in a repository — it holds their words. Written under a lock, as several sessions
 * label at once. The prompts not labelled yet are read from the host's transcripts (~/.claude/projects).
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { withLock, writeAtomic } from "./host-fs.js";
import { addPrompts, EMPTY_LEDGER, hasPrompt, KINDS, ledgerText, parseLedger, promptId, SUBS, typedWords, WORKS } from "./core/corrections.js";
const isObj = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
export const CORRECTIONS_FILE = "corrections.geml";
/** The ledger's file. */
export const correctionsPath = (home = homedir()) => join(home, ".gemworks", CORRECTIONS_FILE);
/** The ledger as its file holds it; none yet, an empty one. */
export function readLedger(home) {
    const path = correctionsPath(home);
    if (!existsSync(path))
        return EMPTY_LEDGER;
    try {
        return parseLedger(readFileSync(path, "utf8"));
    }
    catch {
        return EMPTY_LEDGER;
    }
}
/** The ledger changed under its lock and written back; what it became. */
export function updateLedger(change, home) {
    const path = correctionsPath(home);
    return withLock(path, () => {
        const next = change(readLedger(home));
        writeAtomic(path, ledgerText(next));
        return next;
    });
}
/** Labelled prompts given by an agent or a file (`gemworks corrections label`), checked; what was wrong with the rest. */
export function labelledRows(given, by) {
    const rows = [];
    const errors = [];
    given.forEach((v, n) => {
        if (!isObj(v)) {
            errors.push(`line ${n + 1} is not an object`);
            return;
        }
        const s = (k) => (typeof v[k] === "string" && v[k] !== "" ? v[k] : undefined);
        const [id, at, session, text] = [s("id"), s("at"), s("session"), s("text")];
        if (id === undefined || at === undefined || session === undefined || text === undefined || !Number.isFinite(Date.parse(at))) {
            errors.push(`line ${n + 1} needs id, at, session and text`);
            return;
        }
        const kind = v["kind"];
        if (!KINDS.includes(kind)) {
            errors.push(`line ${n + 1}: kind must be one of ${KINDS.join(", ")}`);
            return;
        }
        const sub = v["sub"];
        if (kind === "correct" && !SUBS.includes(sub)) {
            errors.push(`line ${n + 1}: a correction's sub must be one of ${SUBS.join(", ")}`);
            return;
        }
        const work = v["work"];
        if (work !== undefined && work !== null && !WORKS.includes(work)) {
            errors.push(`line ${n + 1}: work must be one of ${WORKS.join(", ")}`);
            return;
        }
        rows.push({
            id, at, session, text, kind: kind, by,
            ...(kind === "correct" ? { sub: sub } : {}), ...(typeof work === "string" ? { work: work } : {}),
            ...(s("project") !== undefined ? { project: s("project") } : {}), ...(s("flow") !== undefined ? { flow: s("flow") } : {}), ...(s("step") !== undefined ? { step: s("step") } : {}),
        });
    });
    return { rows, errors };
}
/** Labelled prompts added to the ledger; how many were new. */
export function addLabelled(rows, home) {
    let added = 0;
    updateLedger((l) => { const r = addPrompts(l, rows); added = r.added; return r.ledger; }, home);
    return added;
}
const textOf = (content) => {
    if (typeof content === "string")
        return { text: content, results: false };
    const blocks = Array.isArray(content) ? content.filter((b) => typeof b === "object" && b !== null) : [];
    return { text: blocks.filter((b) => b.type === "text").map((b) => (typeof b.text === "string" ? b.text : "")).join("\n"), results: blocks.some((b) => b.type === "tool_result") };
};
/**
 * The prompts the person typed in one transcript, each with the last reply they had seen: a user record the host
 * marks as the person's (`turnOrigin` or `origin` human; a record of an older host, with neither, by its words), its
 * reminders stripped; and the lines typed while a turn ran. A brief another session started this one with is not the
 * person's, nor a notice.
 */
export function typedPrompts(text) {
    const out = [];
    let answer = "";
    for (const line of text.split(/\r?\n/)) {
        if (line.trim() === "")
            continue;
        let o;
        try {
            o = JSON.parse(line);
        }
        catch {
            continue;
        }
        if (typeof o !== "object" || o === null || o.isSidechain === true)
            continue;
        const at = typeof o.timestamp === "string" ? o.timestamp : "";
        const session = typeof o.sessionId === "string" ? o.sessionId : "";
        const cwd = typeof o.cwd === "string" ? o.cwd : "";
        if (o.type === "assistant") {
            const said = textOf(o.message?.content).text.trim();
            if (said !== "")
                answer = said;
            continue;
        }
        if (o.type === "attachment" && o.attachment?.type === "queued_command" && typeof o.attachment.prompt === "string" && (o.attachment.origin?.kind === undefined || o.attachment.origin.kind === "human")) {
            const words = typedWords(o.attachment.prompt);
            const when = typeof o.attachment.timestamp === "string" ? o.attachment.timestamp : at;
            if (words !== undefined && when !== "")
                out.push({ at: when, session, cwd, text: words, before: answer });
            continue;
        }
        if (o.type !== "user" || o.isMeta === true || o.isCompactSummary === true)
            continue;
        if (typeof o.turnOrigin === "string" && o.turnOrigin !== "human")
            continue;
        if (o.origin?.kind !== undefined && o.origin.kind !== "human")
            continue;
        const { text: raw, results } = textOf(o.message?.content);
        if (results)
            continue;
        const words = typedWords(raw);
        if (words === undefined || at === "")
            continue;
        out.push({ at, session, cwd, text: words, before: answer });
    }
    return out;
}
/**
 * The prompts the person typed in the host's transcripts since `since` (an ISO time; by default the ledger's newest
 * prompt, or thirty days back) that the ledger has no label for, oldest first, at most `limit`. A transcript not
 * written since is not read.
 */
export function unlabelledPrompts(ledger, transcripts, o = {}) {
    const now = o.now ?? new Date().toISOString();
    const since = o.since ?? ledger.prompts[ledger.prompts.length - 1]?.at ?? new Date(Date.parse(now) - 30 * 86_400_000).toISOString();
    const from = Date.parse(since);
    const out = [];
    const taken = new Set(ledger.prompts.map((p) => p.id));
    const list = (dir) => { try {
        return readdirSync(dir);
    }
    catch {
        return [];
    } };
    for (const folder of list(transcripts)) {
        const dir = join(transcripts, folder);
        for (const name of list(dir).filter((n) => n.endsWith(".jsonl"))) {
            const file = join(dir, name);
            try {
                if (statSync(file).mtimeMs < from)
                    continue;
            }
            catch {
                continue;
            }
            let text;
            try {
                text = readFileSync(file, "utf8");
            }
            catch {
                continue;
            }
            for (const t of typedPrompts(text).sort((a, b) => (a.at < b.at ? -1 : 1))) {
                if (Date.parse(t.at) <= from)
                    continue;
                const session = t.session !== "" ? t.session : basename(name, ".jsonl");
                const id = promptId(session, t.at, taken);
                const row = { id, at: t.at, session, text: t.text };
                if (hasPrompt(ledger, row) || hasPrompt({ prompts: out }, row))
                    continue;
                taken.add(id);
                out.push({ ...row, project: t.cwd, before: t.before.slice(-600) });
            }
        }
    }
    return out.sort((a, b) => (a.at < b.at ? -1 : 1)).slice(0, o.limit ?? Infinity);
}
/**
 * The prompts the project's other hosts recorded in its shared record (session-store.ts: Codex, Antigravity, Cursor, Qwen Code, OpenCode, Devin, TRAE, Kiro,
 * DeepSeek Harness, Pi, an MCP-only host), with no label yet: what their sessions could not label themselves, for `gemworks
 * corrections pending` and whatever labels later. Claude Code's own are its transcripts' (unlabelledPrompts); a turn
 * read back from a transcript, or a prompt that was not the person's, is none. `before` is the answer of the turn before.
 */
export function recordedUnlabelled(ledger, sessions, o = {}) {
    const now = o.now ?? new Date().toISOString();
    const since = o.since ?? ledger.prompts[ledger.prompts.length - 1]?.at ?? new Date(Date.parse(now) - 30 * 86_400_000).toISOString();
    const taken = new Set(ledger.prompts.map((p) => p.id));
    const out = [];
    for (const s of sessions) {
        if (s.host === "claude-code" || s.backfilled === true)
            continue;
        s.turns.forEach((t, i) => {
            const text = typedWords(t.prompt);
            if (text === undefined || t.backfilled === true || t.kind !== undefined || t.at <= since)
                return;
            const row = { id: promptId(s.id, t.at, taken), at: t.at, session: s.id, text };
            if (hasPrompt(ledger, row) || hasPrompt({ prompts: out }, row))
                return;
            taken.add(row.id);
            out.push({ ...row, project: s.checkout ?? "", before: (s.turns[i - 1]?.answer ?? "").slice(-600) });
        });
    }
    return out.sort((a, b) => (a.at < b.at ? -1 : 1)).slice(0, o.limit ?? Infinity);
}
