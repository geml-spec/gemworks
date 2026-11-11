export const KINDS = ["task", "decide", "correct", "status", "nudge", "inform", "interrupt"];
export const SUBS = ["verify", "show", "scope", "irreversible", "process", "visual", "domain", "judgment", "misread", "other"];
export const WORKS = ["ui", "spec", "writing", "business", "other"];
/** The corrections a written check on a step could catch. */
export const FIXED_SUBS = ["verify", "process", "scope", "visual", "show", "irreversible"];
/** The corrections only the person's judgment or knowledge could have made: the control the fixed ones are read against. */
export const PERSON_SUBS = ["judgment", "domain", "misread"];
export const EMPTY_LEDGER = { prompts: [], themes: [], dismissed: [], linked: "", claim: "" };
/** How long a session's claim to put corrections in themes holds once it stops asking. */
export const CLAIM_MS = 5 * 60_000;
/** The ledger claimed for `session` to put corrections in themes, unless another session asked within CLAIM_MS; whether it got it. */
export function claimThemes(l, session, now) {
    const at = l.claim.lastIndexOf("@");
    const holder = at > 0 ? l.claim.slice(0, at) : "";
    const when = at > 0 ? Date.parse(l.claim.slice(at + 1)) : NaN;
    if (holder !== "" && holder !== session && Date.parse(now) - when < CLAIM_MS)
        return { ledger: l, mine: false };
    return { ledger: { ...l, claim: `${session}@${now}` }, mine: true };
}
/** How long a prompt's words are kept: enough to quote, not the whole paste. */
export const TEXT_KEPT = 300;
/** A bare interruption: the host's own words when the person stopped a turn, nothing typed. */
const BARE_INTERRUPT = /^\[Request interrupted by user[^\]]*\]$/;
/** What arrives as a prompt but was not typed: the host's notices, other sessions' messages and reports, commands. */
const NOT_TYPED = /^(<scheduled-task|<local-command|<command-name|<command-message|<command-args|<bash-|<task-notification|<agent-message|<cross-session-message|<side-sessions-event|<user-prompt-submit-hook|<artifact-content|Caveat: |This session is being continued|The summarized conversation|\[SYSTEM NOTIFICATION)/;
/**
 * The words the person typed in a prompt: the host's reminders stripped. Undefined when nothing typed is left — a
 * notice, or another session's report, which arrives as a prompt that is one reminder.
 */
export function typedWords(text) {
    // A reminder cut short (words clipped to be kept) runs to the end.
    const words = text.replace(/<system-reminder>[\s\S]*?(?:<\/system-reminder>|$)/g, "").trim();
    return words === "" || NOT_TYPED.test(words) ? undefined : words;
}
/** Whether a labelled prompt counts as one the person typed: an interruption alone does not. */
export const isTyped = (p) => p.kind !== "interrupt" && !BARE_INTERRUPT.test(p.text.trim());
/** Whether it is a correction, and counts. */
export const isCorrection = (p) => p.kind === "correct" && isTyped(p);
// ---- the file: three GEML data blocks, one record a line ----------------------------------------
const isObj = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
const BY = ["model", "agent", "import"];
function isPrompt(v) {
    if (!isObj(v))
        return false;
    const opt = (k) => v[k] === undefined || typeof v[k] === "string";
    return ["id", "at", "session", "text"].every((k) => typeof v[k] === "string") && KINDS.includes(v["kind"])
        && (v["sub"] === undefined || SUBS.includes(v["sub"])) && (v["work"] === undefined || WORKS.includes(v["work"]))
        && ["project", "flow", "step", "theme"].every(opt) && (v["checked"] === undefined || typeof v["checked"] === "boolean")
        && (v["checks"] === undefined || (typeof v["checks"] === "object" && v["checks"] !== null && !Array.isArray(v["checks"]) && Object.values(v["checks"]).every((x) => typeof x === "boolean")))
        && BY.includes(v["by"]);
}
const isTheme = (v) => isObj(v) && ["id", "rule", "at"].every((k) => typeof v[k] === "string") && Array.isArray(v["practices"]) && v["practices"].every((x) => typeof x === "string");
const isDismissed = (v) => isObj(v) && typeof v["key"] === "string" && typeof v["n"] === "number" && typeof v["at"] === "string";
function block(lines, name, is) {
    const open = lines.findIndex((l) => l.trim() === `=== data {#${name} format=jsonl}`);
    if (open < 0)
        return [];
    const close = lines.findIndex((l, i) => i > open && l.trim() === "===");
    const out = [];
    for (const line of lines.slice(open + 1, close < 0 ? undefined : close)) {
        if (line.trim() === "")
            continue;
        try {
            const v = JSON.parse(line);
            if (is(v))
                out.push(v);
        }
        catch { /* not one */ }
    }
    return out;
}
/** The ledger's file read; a line that is no record is left out, and no file is an empty ledger. */
export function parseLedger(text) {
    const lines = text.split(/\r?\n/);
    const meta = (key) => new RegExp(`^${key}\\s*=\\s*"([^"]*)"\\s*$`, "m").exec(text)?.[1] ?? "";
    return { prompts: block(lines, "prompts", isPrompt), themes: block(lines, "themes", isTheme), dismissed: block(lines, "dismissed", isDismissed), linked: meta("linked"), claim: meta("claim") };
}
/** The ledger as its file holds it. */
export function ledgerText(l) {
    const data = (name, rows) => `=== data {#${name} format=jsonl}\n${rows.map((r) => `${JSON.stringify(r)}\n`).join("")}===\n`;
    const quoted = (s) => s.replace(/["\r\n]/g, "");
    return `=== meta\ntitle = "纠正"\nlinked = "${quoted(l.linked)}"\nclaim = "${quoted(l.claim)}"\n===\n\n${data("prompts", l.prompts)}\n${data("themes", l.themes)}\n${data("dismissed", l.dismissed)}`;
}
// ---- prompts in --------------------------------------------------------------------------------
/** A prompt's id: its session's first eight characters and its second, `#2` and on for a second one in the same second. */
export function promptId(session, at, taken) {
    const base = `${session.slice(0, 8)}@${at.slice(0, 19)}`;
    let id = base;
    for (let n = 2; taken.has(id); n++)
        id = `${base}#${n}`;
    return id;
}
const norm = (s) => s.replace(/\s+/g, " ").trim().slice(0, 200);
/** The same words in the same session within ten minutes are one prompt: a line queued mid-turn and then replayed. */
const SAME_PROMPT_MS = 600_000;
/** A forked session repeats its parent's prompts with their times: the same words within this of each other in two sessions are one prompt. */
const FORKED_MS = 2_000;
/** Whether the ledger has this prompt already: by id, the same words in the same session within ten minutes, or in a fork at the same time. */
export function hasPrompt(l, p) {
    const words = norm(p.text);
    const at = Date.parse(p.at);
    return l.prompts.some((x) => {
        if (x.id === p.id)
            return true;
        if (norm(x.text) !== words)
            return false;
        const apart = Math.abs(Date.parse(x.at) - at);
        return x.session.slice(0, 8) === p.session.slice(0, 8) ? apart < SAME_PROMPT_MS : apart < FORKED_MS;
    });
}
/** Prompts added, a prompt the ledger has already left out, the words clipped; the prompts kept in time order. */
export function addPrompts(l, given) {
    const prompts = [...l.prompts];
    let added = 0;
    for (const p of given) {
        if (hasPrompt({ prompts }, p))
            continue;
        prompts.push({ ...p, text: p.text.slice(0, TEXT_KEPT) });
        added++;
    }
    prompts.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
    return { ledger: { ...l, prompts }, added };
}
// ---- labelling: the guide, the request, the reply -----------------------------------------------
/** The guide every label follows, the same the two months of hand-checked labels followed. */
export const LABEL_GUIDE = [
    "You label messages a person typed to their coding agent (often in Chinese). For each message you get its words and the end of the agent's reply before it.",
    "",
    "kind — one of:",
    "- correct: the person says the agent's work, answer, claim or behaviour is wrong, falls short, missed something, overstepped, or must be done differently (还是不行 / 还是没看到 / 不对 / 不是这样 / 你又… / 别… / 不要… / 为什么还…, aimed at what the agent did or proposed). A new requirement that implies the last output fell short counts. A brand-new request with no fault implied does not (that is task). A plain question (为什么…) is correct only when it challenges something the agent did.",
    "- status: asks where things stand, or whether something is done.",
    "- decide: answers a question the agent asked, or approves or picks among its proposals.",
    "- nudge: tells it to go on or do the next step, unasked.",
    "- inform: shares a fact or update without asking for anything.",
    "- interrupt: the text is \"[Request interrupted by user…]\" alone.",
    "- task: anything else: new work, questions, discussion, pasted material.",
    "",
    "sub — only when kind is correct, else null; the single best fit:",
    "- verify: the agent said or implied something was done, fixed, working or visible and it was not, or it never checked the real result (the real device, the running version, real data) before saying so.",
    "- show: the agent explained, described or listed instead of showing the actual thing (real UI, real output, a mockup with real data), or its mockup or demo was not real.",
    "- scope: the agent did more than asked (turned a hint into a section, touched or deleted things not named) or less than asked (skipped part of the request).",
    "- irreversible: a risky, destructive or hard-to-undo action, or one others can see (delete, overwrite, push, publish, break something working), done or proposed without asking.",
    "- process: how the agent works: wasted or repeated runs, too slow, not watching CI, not saying a long run is coming, wrong reply language, forgetting a standing step (version bump, sync, refresh, tests), needless questions, poor reporting.",
    "- visual: visible layout or style defects: alignment, spacing, overflow, icons, colours not as designed.",
    "- domain: the person supplies facts or knowledge the agent lacked or got wrong (the project, its history, the domain, a tool).",
    "- judgment: product, design, writing or strategy judgment and taste: what matters, priorities, naming, wording, what the user should experience, aesthetics.",
    "- misread: the agent misunderstood what the person meant (wrong referent, wrong goal).",
    "- other.",
    "When unsure between judgment and something more specific, prefer the specific one only if the text clearly names that failure.",
    "",
    "work — what kind of work the message is about, for every message:",
    "- ui: an interface people look at and press: panes, tabs, buttons, dialogs, pages, layout, mockups, icons, colours.",
    "- spec: a format, its spec, parsers and libraries; commands, logic, tests, CI, builds, packaging — code and format work that is not about how an interface looks.",
    "- writing: prose for people: articles, posts, READMEs and docs as writing, release notes, translations, naming and wording of a text.",
    "- business: the person's own business work outside software tools: data pipelines and warehouses, reports, estimates and plans for that business.",
    "- other: none of these.",
].join("\n");
const clip = (s, n) => (s.length > n ? `${s.slice(0, n)}…` : s);
const tail = (s, n) => (s.length > n ? `…${s.slice(-n)}` : s);
/** The request for a batch of prompts, numbered from 1: the guide as the system prompt, each prompt with its context. */
export function labelRequest(items) {
    return {
        system: `${LABEL_GUIDE}\n\nReply with one JSON array and nothing else: one object per message, in order, {"n": <its number>, "kind": "...", "sub": "..." or null, "work": "..."}.`,
        prompt: items.map((x, i) => `${i + 1}. ${JSON.stringify({ before: tail(x.before.replace(/\s+/g, " "), 400), text: clip(x.text, 1200) })}`).join("\n"),
    };
}
/** The model's reply read: a label for each of the `count` prompts, undefined where it gave none that holds. */
export function readLabels(reply, count) {
    const out = Array.from({ length: count }, () => undefined);
    const json = reply.match(/\[[\s\S]*\]/)?.[0];
    if (json === undefined)
        return out;
    let list;
    try {
        list = JSON.parse(json);
    }
    catch {
        return out;
    }
    if (!Array.isArray(list))
        return out;
    list.forEach((v, i) => {
        if (!isObj(v))
            return;
        const n = typeof v["n"] === "number" ? v["n"] - 1 : i;
        if (n < 0 || n >= count)
            return;
        const kind = v["kind"];
        if (!KINDS.includes(kind))
            return;
        const sub = SUBS.includes(v["sub"]) ? v["sub"] : undefined;
        const work = WORKS.includes(v["work"]) ? v["work"] : undefined;
        out[n] = { kind: kind, ...(kind === "correct" ? { sub: sub ?? "other" } : {}), ...(work !== undefined ? { work } : {}) };
    });
    return out;
}
// ---- themes: corrections that say the same thing, and the practices that state it ---------------
/** The most corrections one theme request carries. */
export const THEMES_ASKED = 60;
/**
 * The request that puts corrections into themes and links the themes to the practices that state them. Short handles
 * (c1, t1, p1) stand for the ids. Every theme is listed so a correction joins one when it says the same thing; every
 * practice is listed so a theme names the ones that state its rule, whenever written.
 */
export function themeRequest(corrections, themes, practices) {
    const system = [
        "You keep a ledger of the corrections a person made to their coding agent. A theme is one short rule that several corrections ask for, written as the person would want it on a checklist (in the corrections' own language, at most 24 characters for Chinese or 12 words otherwise), e.g. 交付物落盘并附链接.",
        "1. Put each new correction into the theme that asks for the same thing, or a new theme when none does. Two corrections share a theme only when one rule would have prevented both. A correction that asks for nothing a rule could hold (taste in one text, a fact about one task) gets theme null.",
        "2. For every theme, old and new, list the practices that state its rule (the same thing, maybe in other words). Leave a theme with none when no practice states it.",
        'Reply with one JSON object and nothing else: {"assign": [{"c": "c1", "theme": "t2" or {"new": "<rule>"} or null}], "links": [{"theme": "t2" or "<the new rule>", "practices": ["p1"]}]}. Every new correction appears once in assign; every theme with practices appears in links.',
    ].join("\n");
    const handles = { c: corrections.map((c) => c.id), t: themes.map((t) => t.id), p: practices.map((p) => p.id) };
    const prompt = [
        "Practices:",
        ...practices.map((p, i) => `p${i + 1}. ${p.text}`),
        "",
        "Themes so far:",
        ...(themes.length > 0 ? themes.map((t, i) => `t${i + 1}. ${t.rule}`) : ["(none)"]),
        "",
        "New corrections:",
        ...(corrections.length > 0 ? corrections.map((c, i) => `c${i + 1}. [${c.sub ?? "other"}] ${clip(c.text.replace(/\s+/g, " "), 240)}`) : ["(none: only link the themes to the practices)"]),
    ].join("\n");
    return { system, prompt, handles };
}
/** The model's theme reply read against the handles it was given; what does not hold is left out. */
export function readThemes(reply, handles) {
    const out = { assign: [], links: [] };
    const json = reply.match(/\{[\s\S]*\}/)?.[0];
    if (json === undefined)
        return out;
    let v;
    try {
        v = JSON.parse(json);
    }
    catch {
        return out;
    }
    if (!isObj(v))
        return out;
    const at = (list, h, letter) => {
        const m = typeof h === "string" ? new RegExp(`^${letter}(\\d+)$`).exec(h.trim()) : null;
        return m !== null ? list[Number(m[1]) - 1] : undefined;
    };
    const rule = (x) => {
        const r = isObj(x) && typeof x["new"] === "string" ? x["new"] : typeof x === "string" && !/^t\d+$/.test(x.trim()) ? x : undefined;
        return r !== undefined && r.trim() !== "" ? r.trim().slice(0, 60) : undefined;
    };
    const themeOf = (x) => {
        if (x === null)
            return null;
        const id = at(handles.t, x, "t");
        if (id !== undefined)
            return id;
        const r = rule(x);
        return r !== undefined ? { rule: r } : undefined;
    };
    for (const a of Array.isArray(v["assign"]) ? v["assign"] : []) {
        if (!isObj(a))
            continue;
        const id = at(handles.c, a["c"], "c");
        const theme = themeOf(a["theme"]);
        if (id !== undefined && theme !== undefined && !out.assign.some((x) => x.id === id))
            out.assign.push({ id, theme });
    }
    for (const k of Array.isArray(v["links"]) ? v["links"] : []) {
        if (!isObj(k))
            continue;
        const theme = themeOf(k["theme"]);
        const practices = (Array.isArray(k["practices"]) ? k["practices"] : []).map((p) => at(handles.p, p, "p")).filter((p) => p !== undefined);
        if (theme !== undefined && theme !== null)
            out.links.push({ theme, practices: [...new Set(practices)] });
    }
    return out;
}
const sameRule = (a, b) => a.replace(/\s+/g, "") === b.replace(/\s+/g, "");
/**
 * A theme answer applied: new themes made (a rule already kept joins its theme), each correction given its theme
 * (`""` where it has none, so it is not asked again), the themes' practices set from the links; `linked` the practices
 * these links were made against. `newId` names a new theme.
 */
export function applyThemes(l, answer, at, linked, newId) {
    const themes = l.themes.map((t) => ({ ...t, practices: [...t.practices] }));
    let made = 0;
    const idOf = (x) => {
        if (typeof x === "string")
            return x;
        const kept = themes.find((t) => sameRule(t.rule, x.rule));
        if (kept !== undefined)
            return kept.id;
        const id = newId(made++);
        themes.push({ id, rule: x.rule, at, practices: [] });
        return id;
    };
    const assigned = new Map(answer.assign.map((a) => [a.id, a.theme === null ? "" : idOf(a.theme)]));
    for (const k of answer.links) {
        const t = themes.find((x) => x.id === idOf(k.theme));
        if (t !== undefined)
            t.practices = k.practices;
    }
    return { ...l, themes, linked, prompts: l.prompts.map((p) => (assigned.has(p.id) ? { ...p, theme: assigned.get(p.id) } : p)) };
}
/**
 * The corrections not yet put in a theme (`theme` absent; `""` was asked and has none), the newest `limit` of them in
 * time order: what the cards and counts read first is themed first, a backlog after.
 */
export function unthemed(l, limit = THEMES_ASKED) {
    const waiting = l.prompts.filter((p) => isCorrection(p) && p.theme === undefined);
    return limit >= waiting.length ? waiting : waiting.slice(waiting.length - limit);
}
/** The practices the themes are linked against, as one string: when it changes, the links are made again. */
export const linkKey = (practices) => practices.filter((p) => p.deleted !== true).map((p) => p.id).sort().join(",");
const themesOf = (l, practice) => new Set(l.themes.filter((t) => t.practices.includes(practice)).map((t) => t.id));
/** Whether a practice reminds where a correction was said: its own step, or every one. */
const covers = (p, x) => (p.flow === "*" || p.flow === x.flow) && (p.step === "*" || p.step === x.step);
/**
 * For each practice linked to a theme: how many of the theme's corrections came before it was written (anywhere), how
 * many after where it reminds, read against the practice's own words and found to hold (unchecked). One said after it
 * on another step is not the practice failing: it is a repeat card's.
 */
export function practiceCounts(l, practices) {
    const out = {};
    for (const p of practices) {
        if (p.deleted === true)
            continue;
        const mine = themesOf(l, p.id);
        if (mine.size === 0)
            continue;
        const said = l.prompts.filter((x) => isCorrection(x) && x.theme !== undefined && mine.has(x.theme));
        out[p.id] = { before: said.filter((x) => x.at < p.at).length, after: said.filter((x) => x.at > p.at && covers(p, x) && x.checks?.[p.id] === true).length };
    }
    return out;
}
// ---- a correction read against the practice it would count against -------------------------------
/** The most pairs one check request carries. */
export const CHECKS_ASKED = 30;
/**
 * The pairs a 失效 card would count that nobody has read: of each practice, the corrections of its themes said after
 * it where it reminds, when it has two such at least, each against that practice's own words. Not against the theme's
 * rule: a theme is put together, and linked to practices, in a batch by a model, which may file a message that only
 * resembles the rule (a symptom reported, a bare 没好, a link) or link a theme to a practice its quotes have nothing to
 * do with; the card names the practice, so the practice is what each is read against. The newest `limit`, in time order.
 */
export function unchecked(l, practices, limit = CHECKS_ASKED) {
    const corrections = l.prompts.filter((x) => isCorrection(x) && x.theme !== undefined && x.theme !== "");
    const waiting = [];
    for (const p of practices) {
        if (p.deleted === true)
            continue;
        const mine = themesOf(l, p.id);
        const after = corrections.filter((x) => mine.has(x.theme) && x.at > p.at && covers(p, x));
        if (after.length < 2)
            continue;
        for (const x of after)
            if (x.checks?.[p.id] === undefined)
                waiting.push({ x, p });
    }
    const sorted = waiting.sort((a, b) => (a.x.at < b.x.at ? -1 : a.x.at > b.x.at ? 1 : 0));
    return sorted.slice(Math.max(0, sorted.length - limit)).map(({ x, p }) => ({ id: x.id, practice: p.id, text: x.text, rule: p.text }));
}
/** The request that reads each correction against a practice: do its words hold the agent to that practice? Handles q1, q2… stand for the pairs. */
export function checkRequest(items) {
    const system = [
        "A person's messages to their coding agent, each paired with a practice from their checklist. For each, say whether the message's own words show the agent did not do what that practice says, about the very thing the practice names, or tell the agent to do it.",
        "Answer no when the message only gives a verdict or a result (\"not fixed\", \"没好\", \"still there\"), reports what the person sees, is a link or a path, asks for content to be changed or removed, asks a question, gives new information, or is about something the practice does not name. When unsure, answer no.",
        "Reply with one line per message and nothing else: q1 yes, or q1 no.",
    ].join("\n");
    const prompt = items.map((x, i) => `q${i + 1}. practice: ${x.rule}\n    message: ${clip(x.text.replace(/\s+/g, " "), 240)}`).join("\n");
    return { system, prompt, handles: items.map((x) => ({ id: x.id, practice: x.practice })) };
}
/** A check reply read against its handles: each pair answered yes or no; one that does not read is left out, to be asked again. */
export function readChecks(reply, handles) {
    const out = new Map();
    for (const m of reply.matchAll(/^\W*q(\d+)\W{0,3}(yes|no)\b/gim)) {
        const n = Number(m[1]) - 1;
        const h = handles[n];
        if (h !== undefined && !out.has(n))
            out.set(n, { ...h, holds: m[2].toLowerCase() === "yes" });
    }
    return [...out.values()];
}
/** Checks applied: each correction keeps what it was found to be against each practice, and is not asked about that one again. */
export function applyChecks(l, verdicts) {
    const given = new Map();
    for (const v of verdicts)
        given.set(v.id, { ...(given.get(v.id) ?? {}), [v.practice]: v.holds });
    return { ...l, prompts: l.prompts.map((p) => { const g = given.get(p.id); return g === undefined ? p : { ...p, checks: { ...(p.checks ?? {}), ...g } }; }) };
}
const quotesOf = (xs) => xs.slice(-3).map((x) => ({ at: x.at, text: x.text.replace(/<!--[^>]*-->/g, "").replace(/\s+/g, " ").trim() }));
/** The cards the ledger shows, the failing practices first, then the repeats, the most said first; a card put away stays away until two more are said. */
export function ledgerCards(l, practices, now, o = {}) {
    const days = o.days ?? 30, least = o.least ?? 3, shown = o.shown ?? 3;
    const since = new Date(Date.parse(now) - days * 86_400_000).toISOString();
    const live = practices.filter((p) => p.deleted !== true);
    const corrections = l.prompts.filter((x) => isCorrection(x) && x.theme !== undefined && x.theme !== "");
    const away = (key, n) => l.dismissed.some((d) => d.key === key && n < d.n + 2);
    const cards = [];
    for (const p of live) {
        const mine = themesOf(l, p.id);
        const after = corrections.filter((x) => mine.has(x.theme) && x.at > p.at && covers(p, x) && x.checks?.[p.id] === true);
        if (after.length < 2 || away(`failing:${p.id}`, after.length))
            continue;
        const instead = live.filter((q) => q.id !== p.id && q.at > p.at && [...themesOf(l, q.id)].some((t) => mine.has(t))).sort((a, b) => (a.at < b.at ? 1 : -1))[0];
        cards.push({ kind: "failing", key: `failing:${p.id}`, practice: p, n: after.length, quotes: quotesOf(after), ...(instead !== undefined ? { instead } : {}) });
    }
    for (const t of l.themes) {
        const said = corrections.filter((x) => x.theme === t.id && x.at >= since);
        if (said.length < least || away(`repeat:${t.id}`, said.length))
            continue;
        const stating = live.filter((p) => t.practices.includes(p.id));
        // Said where no practice of the theme reaches: none written, or every one hangs on a step it was not said at.
        const outside = said.filter((x) => !stating.some((p) => covers(p, x)));
        if (outside.length < Math.min(2, least))
            continue;
        const steps = new Map();
        for (const x of said)
            if (x.flow !== undefined && x.step !== undefined)
                steps.set(`${x.flow}\t${x.step}`, (steps.get(`${x.flow}\t${x.step}`) ?? 0) + 1);
        const top = [...steps.entries()].sort((a, b) => b[1] - a[1])[0];
        const where = top !== undefined && top[1] === said.length ? { flow: top[0].split("\t")[0], step: top[0].split("\t")[1] } : undefined;
        cards.push({ kind: "repeat", key: `repeat:${t.id}`, theme: t.id, rule: t.rule, n: said.length, quotes: quotesOf(said), ...(stating[0] !== undefined ? { narrow: stating[0] } : {}), ...(where !== undefined ? { where } : {}) });
    }
    return cards.sort((a, b) => (a.kind === b.kind ? b.n - a.n : a.kind === "failing" ? -1 : 1)).slice(0, shown);
}
/** A card put away: what it counted then. */
export function dismiss(l, key, n, at) {
    return { ...l, dismissed: [...l.dismissed.filter((d) => d.key !== key), { key, n, at }] };
}
/**
 * The kinds of work corrected often in the last `days` with no work item on a flow: how many, how many of them
 * judgment. Only a prompt the plugin labelled as it was typed knows whether a work item stood on a flow; one imported
 * or labelled from a transcript later does not, and is not counted.
 */
export function flowless(l, now, days = 7, least = 10) {
    const since = new Date(Date.parse(now) - days * 86_400_000).toISOString();
    const said = l.prompts.filter((x) => isCorrection(x) && x.by === "model" && x.at >= since && x.flow === undefined && x.work !== undefined && x.work !== "other");
    return WORKS.filter((w) => w !== "other").map((work) => {
        const mine = said.filter((x) => x.work === work);
        return { work, n: mine.length, judgment: mine.filter((x) => x.sub === "judgment").length };
    }).filter((x) => x.n >= least).sort((a, b) => b.n - a.n);
}
/** The request for a flow for a kind of work that has none: its corrections quoted; the reply a title and three to five steps. */
export function flowRequest(work, quotes) {
    return {
        system: [
            "A person keeps correcting their coding agent on one kind of work that follows no flow of steps. Propose a short flow for that kind of work, so that what they keep correcting is checked or asked at the step where it belongs.",
            "Write in the corrections' own language. Each step: an id (ascii, short), a title of at most 4 Chinese characters (or 2 words), what must be true to leave it (need), who judges that (judge: fact — a tool can check it; you — the person says so; model — the agent judges), and the pitfall it prevents.",
            'Reply with one JSON object and nothing else: {"title": "<the kind of work, 2-4 characters>", "steps": [{"id": "...", "title": "...", "need": "...", "judge": "fact|you|model", "prevents": "..."}]}',
        ].join("\n"),
        prompt: [`Kind of work: ${work}`, "Recent corrections:", ...quotes.map((q, i) => `${i + 1}. ${clip(q.text, 200)}`)].join("\n"),
    };
}
/** A flow reply read: its title and steps as the propose tool takes them (growth.ts newProposals checks them); undefined when it is none. */
export function readFlowDraft(reply) {
    const json = reply.match(/\{[\s\S]*\}/)?.[0];
    if (json === undefined)
        return undefined;
    try {
        const v = JSON.parse(json);
        return isObj(v) && typeof v["title"] === "string" && v["title"].trim() !== "" && Array.isArray(v["steps"]) && v["steps"].length > 0 ? { title: v["title"].trim(), steps: v["steps"] } : undefined;
    }
    catch {
        return undefined;
    }
}
export function tally(xs) {
    const typed = xs.filter(isTyped);
    const c = typed.filter((x) => x.kind === "correct");
    const by = Object.fromEntries(SUBS.map((s) => [s, c.filter((x) => (x.sub ?? "other") === s).length]));
    return {
        prompts: typed.length, corrections: c.length, by, sessions: new Set(typed.map((x) => x.session)).size,
        fixed: FIXED_SUBS.reduce((a, s) => a + by[s], 0), person: PERSON_SUBS.reduce((a, s) => a + by[s], 0),
    };
}
/** Per 100 prompts, one decimal; "–" for none. */
export const per100 = (n, of) => (of > 0 ? (Math.round((1000 * n) / of) / 10).toFixed(1) : "–");
/** The local date of a time, at `offset` minutes east of UTC. */
export const localDay = (at, offset) => new Date(Date.parse(at) + offset * 60_000).toISOString().slice(0, 10);
/** The Monday of a local date's week. */
export function mondayOf(day) {
    const d = new Date(`${day}T00:00:00Z`);
    return new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 86_400_000).toISOString().slice(0, 10);
}
const addDays = (day, n) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
/** `2026-08-30..2026-10-25` read as a period; undefined when it is not one. */
export function parsePeriod(s) {
    const m = /^(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/.exec(s.trim());
    return m !== null && m[1] <= m[2] ? { from: m[1], to: m[2] } : undefined;
}
/** The periods compared when none are given: this week so far, against the eight weeks before it. */
export function defaultPeriods(today) {
    const monday = mondayOf(today);
    return { trial: { from: monday, to: today }, baseline: { from: addDays(monday, -56), to: addDays(monday, -1) } };
}
/** The tables over the ledger's prompts since `since` (a local date), at `offset` minutes east of UTC. */
export function report(l, o) {
    const xs = l.prompts.filter(isTyped).filter((x) => o.since === undefined || localDay(x.at, o.offset) >= o.since);
    const within = (p) => xs.filter((x) => { const d = localDay(x.at, o.offset); return d >= p.from && d <= p.to; });
    const first = xs[0] !== undefined ? localDay(xs[0].at, o.offset) : "";
    const last = xs[xs.length - 1] !== undefined ? localDay(xs[xs.length - 1].at, o.offset) : "";
    const weeks = [];
    if (first !== "") {
        for (let w = mondayOf(first); w <= last; w = addDays(w, 7))
            weeks.push({ week: w, ...tally(xs.filter((x) => mondayOf(localDay(x.at, o.offset)) === w)) });
    }
    const b = within(o.baseline), t = within(o.trial);
    return {
        first, last, all: tally(xs), weeks,
        baseline: { ...o.baseline, ...tally(b) }, trial: { ...o.trial, ...tally(t) },
        ...(o.byWork === true ? { byWork: WORKS.map((work) => ({ work, baseline: tally(b.filter((x) => x.work === work)), trial: tally(t.filter((x) => x.work === work)) })) } : {}),
    };
}
export const SUB_NAMES = {
    verify: "说好了但没好", process: "做事方式", scope: "越界或漏做", visual: "视觉", show: "讲解代替展示", irreversible: "不可逆",
    judgment: "判断", domain: "领域知识", misread: "理解偏差", other: "其他",
};
export const WORK_NAMES = { ui: "界面", spec: "解析器与规范", writing: "文档与写作", business: "业务", other: "其他" };
/** The tables as text: a column of names (CJK counted two cells wide) and right-aligned numbers per 100 prompts. */
export function reportText(r, cells, unlabelled = 0) {
    const pad = (s, w) => s + " ".repeat(Math.max(0, w - cells(s)));
    const num = (s, w = 8) => " ".repeat(Math.max(0, w - s.length)) + s;
    const NAME = 18;
    const pair = (name, nb, nt) => `${pad(name, NAME)}${num(per100(nb, r.baseline.prompts))}${num(per100(nt, r.trial.prompts))}`;
    const lines = [
        `纠正 · ${r.first} 至 ${r.last} · ${r.all.sessions} 个会话 · ${r.all.prompts} 句 · 纠正 ${r.all.corrections} 句${unlabelled > 0 ? ` · ${unlabelled} 句未标注` : ""}`,
        "",
        `${pad("每百句", NAME)}${num("基线")}${num("试验期")}`,
        `${pad("", NAME)}${num(r.baseline.from.slice(5))}${num(r.trial.from.slice(5))}`,
        `${pad("", NAME)}${num(r.baseline.to.slice(5))}${num(r.trial.to.slice(5))}`,
        `${pad("句数", NAME)}${num(String(r.baseline.prompts))}${num(String(r.trial.prompts))}`,
        pair("纠正", r.baseline.corrections, r.trial.corrections),
        pair("固定检查", r.baseline.fixed, r.trial.fixed),
        ...FIXED_SUBS.map((s) => pair(`  ${SUB_NAMES[s]}`, r.baseline.by[s], r.trial.by[s])),
        pair("靠人判断（对照）", r.baseline.person, r.trial.person),
        ...PERSON_SUBS.map((s) => pair(`  ${SUB_NAMES[s]}`, r.baseline.by[s], r.trial.by[s])),
    ];
    if (r.byWork !== undefined) {
        lines.push("", `${pad("按工作类型：固定检查", NAME)}${num("基线")}${num("试验期")}${num("句数")}`);
        for (const w of r.byWork) {
            if (w.baseline.prompts === 0 && w.trial.prompts === 0)
                continue;
            lines.push(`${pad(`  ${WORK_NAMES[w.work]}`, NAME)}${num(per100(w.baseline.fixed, w.baseline.prompts))}${num(per100(w.trial.fixed, w.trial.prompts))}${num(`${w.baseline.prompts}/${w.trial.prompts}`, 10)}`);
            lines.push(`${pad("    靠人判断", NAME)}${num(per100(w.baseline.person, w.baseline.prompts))}${num(per100(w.trial.person, w.trial.prompts))}`);
        }
    }
    lines.push("", `${pad("每周", 10)}${num("句数", 6)}${num("纠正")}${num("固定检查")}${num("靠人判断")}`);
    for (const w of r.weeks) {
        lines.push(w.prompts === 0
            ? `${pad(w.week.slice(5), 10)}${num("—", 6)}${num("—")}${num("—")}${num("—")}`
            : `${pad(w.week.slice(5), 10)}${num(String(w.prompts), 6)}${num(per100(w.corrections, w.prompts))}${num(per100(w.fixed, w.prompts))}${num(per100(w.person, w.prompts))}`);
    }
    return lines.join("\n");
}
