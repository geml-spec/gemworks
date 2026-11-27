// The project's shared session record: every session working on a project —
// Claude Code, Codex, Gemini CLI, DeepSeek Harness, on whichever branch or
// worktree — keeps one log in the main working tree's `.geml/sessions/`, which
// no branch tracks. Each log is a GEML document whose `=== data {#events
// format=jsonl}` block holds one JSON event a line, written by its own session
// alone and read by all of them (an earlier log, plain JSON lines in a .jsonl
// file, still reads): what was asked, what was answered,
// the conclusions and decisions the model recorded, the files and commits the
// session made. Pure: the hosts read and write the files.
/** The directory under the project's shared `.geml/` that holds the logs, and the ignore file that keeps them out of git. */
export const SESSIONS_DIR = "sessions";
export const SESSIONS_GITIGNORE = "*\n";
const isSeenRun = (v) => {
    if (typeof v !== "object" || v === null)
        return false;
    const r = v;
    return typeof r["command"] === "string" && typeof r["exit"] === "number" && typeof r["at"] === "string";
};
const isMetStep = (v) => {
    if (typeof v !== "object" || v === null)
        return false;
    const m = v;
    const text = (k) => m[k] === undefined || typeof m[k] === "string";
    return typeof m["step"] === "string" && typeof m["at"] === "string" && typeof m["turn"] === "number"
        && text("said") && (m["pressed"] === undefined || typeof m["pressed"] === "boolean") && text("evidence") && (m["seen"] === undefined || isSeenRun(m["seen"]));
};
const safe = (s) => s.replace(/[^A-Za-z0-9._-]+/g, "-");
/** A log's file name: the host and the session's id, neither able to leave the directory. */
export function logName(host, id) {
    return `${safe(host)}-${safe(id)}.geml`;
}
/** The name an earlier log had (plain JSON lines): read, and carried into the GEML one when the session writes next. */
export function legacyLogName(host, id) {
    return `${safe(host)}-${safe(id)}.jsonl`;
}
/** Whether a directory entry is a log: a GEML one, or an earlier .jsonl one with no GEML one beside it. */
export function isLogName(name, names) {
    if (name.endsWith(".geml"))
        return true;
    return name.endsWith(".jsonl") && !names.includes(`${name.slice(0, -".jsonl".length)}.geml`);
}
/** The fence that opens a log's events. */
const EVENTS_OPEN = "=== data {#events format=jsonl}";
function isEvent(v) {
    if (typeof v !== "object" || v === null)
        return false;
    const e = v;
    if (typeof e["at"] !== "string")
        return false;
    switch (e["t"]) {
        case "session": return typeof e["id"] === "string" && typeof e["host"] === "string";
        case "prompt":
        case "answer": return typeof e["turn"] === "number" && typeof e["text"] === "string";
        case "decision": return typeof e["turn"] === "number" && typeof e["text"] === "string"
            && (e["by"] === undefined || e["by"] === "person" || e["by"] === "model") && (e["said"] === undefined || typeof e["said"] === "string")
            && (e["pressed"] === undefined || typeof e["pressed"] === "boolean");
        case "file": return typeof e["turn"] === "number" && typeof e["path"] === "string";
        case "commit": return typeof e["turn"] === "number" && typeof e["sha"] === "string" && typeof e["subject"] === "string";
        case "ask": return typeof e["turn"] === "number" && typeof e["question"] === "string" && Array.isArray(e["options"]) && e["options"].every((o) => typeof o === "string")
            && (e["recommended"] === undefined || typeof e["recommended"] === "string") && (e["item"] === undefined || typeof e["item"] === "string");
        case "item": return typeof e["turn"] === "number" && ["id", "flow", "title", "state", "needs", "goal"].every((k) => typeof e[k] === "string")
            && (e["status"] === "open" || e["status"] === "held" || e["status"] === "done" || e["status"] === "dropped")
            && (e["met"] === undefined || (Array.isArray(e["met"]) && e["met"].every(isMetStep))) && (e["next"] === undefined || typeof e["next"] === "string");
        default: return false;
    }
}
/** The events of a log (its events block, or every line of an earlier log); a line that is no event (one cut short while its session wrote it) is left out. */
export function parseLog(text) {
    const out = [];
    let lines = text.split(/\r?\n/);
    const open = lines.findIndex((l) => l.trim() === EVENTS_OPEN);
    if (open >= 0) {
        const close = lines.findIndex((l, i) => i > open && l.trim() === "===");
        lines = lines.slice(open + 1, close < 0 ? undefined : close);
    }
    for (const line of lines) {
        if (line.trim() === "")
            continue;
        try {
            const v = JSON.parse(line);
            if (isEvent(v))
                out.push(v);
        }
        catch { /* not an event */ }
    }
    return out;
}
/** A log document holding `events`, one JSON event a line in its events block. */
export function formatLog(events) {
    return `${EVENTS_OPEN}\n${events.map((e) => `${JSON.stringify(e)}\n`).join("")}===\n`;
}
/** The log with `events` added at the end of its events (an earlier log comes out as a GEML one). */
export function appendEvents(text, events) {
    return formatLog([...parseLog(text), ...events]);
}
/** The turn the next prompt opens: one past the last one the log holds. */
export function nextTurn(events) {
    return events.reduce((n, e) => ("turn" in e && e.turn >= n ? e.turn + 1 : n), 1);
}
/** The turn now under way: the last prompt's. */
export function currentTurn(events) {
    for (let i = events.length - 1; i >= 0; i--) {
        const e = events[i];
        if (e.t === "prompt")
            return e.turn;
    }
    return 0;
}
/**
 * A prompt the person pressed (an option the plugin said into the conversation as theirs), as it entered: the next turn,
 * and the decisions the press made, theirs, under it. Words already the last prompt, seconds before (the same prompt
 * recorded by its hook as well), add only the decisions.
 */
export function pressedPrompt(events, text, at, decisions = [], uuid) {
    let last;
    for (let i = events.length - 1; i >= 0 && last === undefined; i--) {
        const e = events[i];
        if (e.t === "prompt")
            last = e;
    }
    const again = last !== undefined && last.text === text && Math.abs(Date.parse(last.at) - Date.parse(at)) < SAME_PROMPT_MS;
    const turn = again && last !== undefined ? last.turn : nextTurn(events);
    const prompt = again ? [] : [{ t: "prompt", turn, at, text, ...(uuid !== undefined ? { uuid } : {}) }];
    return [...prompt, ...decisions.map((d) => ({ t: "decision", turn, at, text: d, by: "person", pressed: true }))];
}
/** A log read as one session; undefined for a log with no session line. */
export function summarize(events) {
    const head = events.find((e) => e.t === "session");
    if (head === undefined)
        return undefined;
    const s = {
        id: head.id, host: head.host, ...(head.branch !== undefined ? { branch: head.branch } : {}), ...(head.checkout !== undefined ? { checkout: head.checkout } : {}),
        ...(head.backfilled === true ? { backfilled: true } : {}), ...(head.scheduled !== undefined ? { scheduled: head.scheduled } : {}),
        started: head.at, last: head.at, turns: [], decisions: [], files: [], commits: [],
    };
    const turn = (n, at) => {
        let found = s.turns.find((x) => x.turn === n);
        if (found === undefined) {
            found = { turn: n, at, prompt: "", decisions: [] };
            s.turns.push(found);
        }
        return found;
    };
    /** The decisions whose events do not say whose they are: written before `by` was. */
    const unsaid = new Set();
    for (const e of events) {
        if (e.at > s.last)
            s.last = e.at;
        switch (e.t) {
            case "session": break;
            case "prompt": {
                // A new prompt answers the questions the last turn ended with, or leaves them for the model to ask again.
                delete s.asks;
                const tn = turn(e.turn, e.at);
                tn.prompt = e.text;
                if (e.uuid !== undefined)
                    tn.uuid = e.uuid;
                if (e.backfilled === true)
                    tn.backfilled = true;
                if (e.kind !== undefined)
                    tn.kind = e.kind;
                break;
            }
            case "answer":
                turn(e.turn, e.at).answer = e.text;
                break;
            case "decision": {
                turn(e.turn, e.at).decisions.push(e.text);
                // Whose it is when the event does not say: settled below, once every prompt of the session is read.
                s.decisions.push({ turn: e.turn, at: e.at, text: e.text, by: e.by ?? "model", ...(e.said !== undefined ? { said: e.said } : {}), ...(e.pressed === true ? { pressed: true } : {}) });
                if (e.by === undefined)
                    unsaid.add(s.decisions.length - 1);
                break;
            }
            case "file":
                if (!s.files.some((f) => f.path === e.path))
                    s.files.push({ path: e.path, at: e.at, ...(e.branch !== undefined ? { branch: e.branch } : {}) });
                break;
            case "commit":
                if (!s.commits.some((c) => c.sha === e.sha))
                    s.commits.push({ sha: e.sha, subject: e.subject, at: e.at, ...(e.branch !== undefined ? { branch: e.branch } : {}) });
                break;
            case "ask":
                s.asks = [...(s.asks ?? []).filter((q) => q.question !== e.question), e];
                break;
            case "item": {
                s.items = [...(s.items ?? []).filter((x) => x.id !== e.id), e];
                // The turn that moved it: the steps met in that turn, its latest event of the turn standing for it.
                const tn = turn(e.turn, e.at);
                const move = { id: e.id, title: e.title, flow: e.flow, state: e.state, met: (e.met ?? []).filter((m) => m.turn === e.turn), status: e.status, at: e.at };
                tn.moved = [...(tn.moved ?? []).filter((x) => x.id !== e.id), move];
                break;
            }
        }
    }
    // An earlier decision is the person's press when its words are one of their prompts; a model's note otherwise.
    if (unsaid.size > 0) {
        const prompts = new Set(personPrompts(events).map((p) => p.trim()));
        for (const n of unsaid) {
            const d = s.decisions[n];
            if (prompts.has(d.text.trim())) {
                d.by = "person";
                d.pressed = true;
            }
        }
    }
    for (const d of s.decisions) {
        if (d.by !== "person")
            continue;
        const tn = turn(d.turn, d.at);
        tn.byPerson = [...(tn.byPerson ?? []), d.text];
    }
    s.turns.sort((a, b) => a.turn - b.turn);
    return s;
}
/** The prompts the person gave in a session: the ones they typed or pressed, not a scheduled task's or another session's. */
export function personPrompts(events) {
    return events.flatMap((e) => (e.t === "prompt" && e.kind === undefined ? [e.text] : []));
}
/** Words as they are compared with a prompt: full-width forms folded, quotes left out, spaces collapsed, ASCII case ignored. */
const loose = (s) => s.normalize("NFKC").replace(/[「」『』“”‘’"'`]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
/** Whether `said` is the person's own words: found in one of the prompts they gave. */
export function saidByPerson(said, prompts) {
    const words = loose(said);
    return words !== "" && prompts.some((p) => loose(p).includes(words));
}
/**
 * The note tool's arguments read against the person's prompts in this session: `decisions` are the model's, `theirs`
 * the person's when their words (`said`) are found in one of those prompts, the model's otherwise. A line that records
 * status rather than a decision is left out.
 */
export function readNote(args, prompts) {
    const a = typeof args === "object" && args !== null && !Array.isArray(args) ? args : {};
    const out = { decided: [], status: [], unfound: [] };
    const take = (text, by, said) => {
        if (isStatusLine(text)) {
            out.status.push(text);
            return;
        }
        out.decided.push({ text, by, ...(said !== undefined ? { said } : {}) });
    };
    for (const x of Array.isArray(a["decisions"]) ? a["decisions"] : []) {
        if (typeof x === "string" && x.trim() !== "")
            take(x.trim(), "model");
    }
    for (const x of Array.isArray(a["theirs"]) ? a["theirs"] : []) {
        if (typeof x !== "object" || x === null)
            continue;
        const r = x;
        const text = typeof r["text"] === "string" ? r["text"].trim() : "";
        const said = typeof r["said"] === "string" ? r["said"].trim() : "";
        if (text === "")
            continue;
        if (said !== "" && saidByPerson(said, prompts))
            take(text, "person", said);
        else {
            const before = out.decided.length;
            take(text, "model");
            if (out.decided.length > before)
                out.unfound.push(text);
        }
    }
    return out;
}
/** What the note tool answers, on every host alike. */
export function noteReply(r) {
    const leftOut = r.status.length === 0 ? "" : ` ${r.status.length} left out as status, which git, the board and the journal hold: ${r.status.map((x) => `"${x.slice(0, 60)}"`).join(", ")}.`;
    const n = r.decided.length;
    if (n === 0)
        return `Nothing recorded:${leftOut} \`decisions\` is a list of short sentences, \`theirs\` the person's choices, each with their own words in \`said\`.`;
    const unfound = r.unfound.length === 0 ? "" : ` ${r.unfound.length} recorded as yours, not the person's: their words were not found in a prompt they gave in this session (${r.unfound.map((x) => `"${x.slice(0, 60)}"`).join(", ")}).`;
    return `Recorded ${n} decision${n === 1 ? "" : "s"}; the project's other sessions will see ${n === 1 ? "it" : "them"}.${unfound}${leftOut}`;
}
/** How close in time two prompts with the same words are one prompt recorded twice (live, and read back from the transcript): the same moment, seconds apart; a person repeats a sentence minutes apart. */
export const SAME_PROMPT_MS = 30_000;
/**
 * A session's events with turns read from its transcript put before the ones
 * it recorded live: the earlier turns, numbered from 1, go after the session
 * line, and every turn recorded live moves up by as many. An earlier turn
 * whose prompt is already there (the same words within five minutes) is left
 * out, so reading the transcript again adds nothing.
 */
export function withEarlierTurns(events, earlier) {
    const prompts = events.filter((e) => e.t === "prompt");
    const there = (p) => prompts.some((x) => x.text === p.text && Math.abs(Date.parse(x.at) - Date.parse(p.at)) < SAME_PROMPT_MS);
    const renumbered = new Map();
    for (const e of earlier)
        if (e.t === "prompt" && !there(e))
            renumbered.set(e.turn, renumbered.size + 1);
    const k = renumbered.size;
    if (k === 0)
        return [...events];
    const kept = earlier.flatMap((e) => ("turn" in e && renumbered.has(e.turn) ? [{ ...e, turn: renumbered.get(e.turn) }] : []));
    const shifted = events.map((e) => ("turn" in e ? { ...e, turn: e.turn + k } : e));
    const head = shifted.findIndex((e) => e.t === "session");
    return head < 0 ? [...kept, ...shifted] : [...shifted.slice(0, head + 1), ...kept, ...shifted.slice(head + 1)];
}
/** The other sessions' decisions recorded after `since` (all of them when null), oldest first, at most `limit` (the newest kept). */
export function decisionsSince(sessions, ownId, since, limit = 12) {
    const out = [];
    for (const s of sessions) {
        if (s.id === ownId)
            continue;
        for (const d of s.decisions) {
            if (since !== null && d.at <= since)
                continue;
            out.push({
                text: d.text, at: d.at, session: s.id, host: s.host, ...(s.branch !== undefined ? { branch: s.branch } : {}),
                by: d.by === "person" ? "person" : "model", ...(d.said !== undefined ? { said: d.said } : {}), ...(d.pressed === true ? { pressed: true } : {}),
            });
        }
    }
    out.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
    return out.slice(-limit);
}
/** The files the sessions changed, each with the sessions that changed it; more than one is a clash to settle before merging. Newest first. */
export function filesBySession(sessions) {
    const by = new Map();
    for (const s of sessions) {
        for (const f of s.files) {
            const was = by.get(f.path);
            if (was === undefined)
                by.set(f.path, { path: f.path, at: f.at, sessions: [s.id] });
            else {
                if (!was.sessions.includes(s.id))
                    was.sessions.push(s.id);
                if (f.at > was.at)
                    was.at = f.at;
            }
        }
    }
    return [...by.values()].sort((a, b) => (a.sessions.length !== b.sessions.length ? b.sessions.length - a.sessions.length : a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}
/** The tool every host lists for the model to record a turn's conclusions and decisions in its session's log. */
export const NOTE_TOOL = {
    name: "note",
    description: "Record this turn's decisions in the project's shared session record, so the project's other sessions (on other branches, worktrees and tools) know them. A decision is a choice that changes what comes next, or a finding the other sessions would otherwise discover again. A choice the person made goes in `theirs`, with their own words for it in `said` as they gave them in a prompt of this session: it is recorded as the person's only when those words are found there, and as yours otherwise. Your own conclusions, findings and the choices you made for them go in `decisions`. Never status (what was pushed, synced, committed, merged, built, or what a version does), progress or plans: git, the board and the journal hold those. Call it once before the turn ends, each decision a short sentence that stands on its own.",
    inputSchema: {
        type: "object",
        properties: {
            decisions: { type: "array", items: { type: "string" }, description: "Your own conclusions, findings and the choices you made for the person, one short sentence each." },
            theirs: {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        text: { type: "string", description: "The choice, one short sentence." },
                        said: { type: "string", description: "The person's own words for it, as they gave them in a prompt of this session." },
                    },
                    required: ["text", "said"],
                    additionalProperties: false,
                },
                description: "The choices the person made, each with their own words.",
            },
        },
        additionalProperties: false,
    },
};
/** What the model is told once, in the system prompt, about the project's other sessions. */
export const SESSIONS_PROMPT = "Gemworks: this project is worked on in several sessions at once, on other branches, worktrees and tools. When a turn reaches a decision the other sessions should know — a choice the person made that changes what comes next, or a finding they would otherwise discover again — record it with the gemworks `note` tool before the turn ends, one short sentence each: the person's choices with their own words, yours and your findings apart; never status (pushed, synced, committed, what a version does) or plans. Decisions the other sessions recorded arrive beside the person's prompts, marked [gemworks]: the person's own apart from the ones only a model recorded, which are for reference and not the person's word.";
/**
 * Whether a line records status rather than a decision: a version and what
 * it does, something pushed, synced, committed, merged, released or built, a
 * test count. Git, the board and the journal hold those; the record does not.
 */
export function isStatusLine(text) {
    const s = text.trim();
    return /^(gemworks\s+)?v?\d+\.\d+\.\d+\b/i.test(s)
        || /^(pushed|synced|committed|merged|released|deployed|rebuilt|fast-forwarded|reinstalled)\b/i.test(s)
        || /\b(is|are|was|were|been|now)\s+(pushed|synced|committed|merged|released|deployed|rebuilt|on origin|verified running)\b/i.test(s)
        || /已(推送|同步|提交|合并|发布|部署)(到|至|了|，|。|；|$)/.test(s)
        || /\b\d+\s*(tests?|pass(ed)?)\b.*\b(pass(ed)?|fail(ed)?)\b|\b(suite|tests?)\b[^.]*\b\d+\s*pass\b/i.test(s)
        // A version named with what it does, draws, loads or runs: what a version is, not what was decided.
        || /\b(from|since|with)\s+(gemworks\s+)?v?\d+\.\d+\.\d+\b|\bv?\d+\.\d+\.\d+'s\b|\b(has run|have run|loads?|runs?|ran)\s+(gemworks\s+)?v?\d+\.\d+\.\d+\b/i.test(s)
        // A plan is not a decision either.
        || /^(plan\b|计划[:：])/i.test(s);
}
/** Whether an answer puts a question off rather than answering it (暂不, later): no decision to record. */
export function isDeferral(label) {
    return /^(暂不|先不|稍后|以后|回头|不急|改天|later|not now|skip|defer)/i.test(label.trim());
}
/**
 * The other sessions' decisions as the line beside a prompt says them: the person's first, with how they gave each; then
 * the ones only a model recorded, marked as reference — a model's note is never passed on as the person's word.
 */
export function decisionsContext(decisions, label) {
    const theirs = decisions.filter((d) => d.by === "person");
    const models = decisions.filter((d) => d.by !== "person");
    // How the person gave it: their press, or their words, cut short.
    const how = (d) => (d.pressed === true ? "用户按的 · " : d.said !== undefined ? `用户说「${[...d.said].length > 24 ? `${[...d.said].slice(0, 24).join("")}…` : d.said}」· ` : "");
    return [
        ...(theirs.length > 0 ? ["[gemworks] 本项目其他会话里用户定的：", ...theirs.map((d) => `- ${d.text}（${how(d)}${label(d)}）`)] : []),
        ...(models.length > 0 ? ["[gemworks] 本项目其他会话的模型记下的，用户没说过，只作参考：", ...models.map((d) => `- ${d.text}（${label(d)}）`)] : []),
    ].join("\n");
}
