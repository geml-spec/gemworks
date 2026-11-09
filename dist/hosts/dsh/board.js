import { learnInFile } from "../../dictionary-io.js";
import { flowPicture } from "../../core/picture.js";
import { policyOf } from "../../core/policy.js";
import { statusOf } from "../../core/status.js";
import { varsBySource } from "../../core/statechart.js";
import { timelineOf } from "../../timeline.js";
import { HOME_TAB, ICON_CHAR, inputAction, paneRows, tabs } from "../claude-code/board.js";
import { inboxItems } from "../claude-code/inbox.js";
import { langOf, wordsFor } from "../claude-code/text.js";
const FILTERS = ["all", "artifacts", "evidence", "moves", "refusals", "depends"];
/** The tabs on this host: every tab but the sessions tab. */
// No sessions tab on this host: its journal is where what happened shows, so it keeps 记录.
export const DSH_TABS = ["items", "journal", "flow", "tools"];
/** The presses this host runs; a button for any other op is not drawn. */
const HOST_OPS = new Set(["advance", "mark", "pause", "resume", "learn", "tab", "filter", "expand", "refresh"]);
/**
 * The rows the browser half draws, for the kinds it has no drawing of: a
 * heading as a line, a card as its line, its detail and its options, a list
 * entry as a line or its press.
 */
function inRowsOfThisHost(row) {
    switch (row.kind) {
        case "section": return [{ kind: "text", text: `${row.text}${row.count !== undefined ? ` · ${row.count}` : ""}`, tone: "dim" }];
        case "card": return [
            { kind: "text", text: [ICON_CHAR[row.icon], row.verb, row.title, row.tag ?? ""].filter((x) => x !== "").join(" "), tone: "normal" },
            ...row.detail.map((d) => ({ kind: "text", text: `  ${d}`, tone: "dim" })),
            ...(row.actions.length > 0 ? [{ kind: "buttons", items: row.actions }] : []),
        ];
        case "event": return [
            { kind: "text", text: [row.at, row.label, row.text, row.why, row.turn].filter((x) => x !== "").join("  "), tone: row.tone },
            ...(row.open ? row.detail.map((d) => ({ kind: "text", text: `    ${d}`, tone: "dim" })) : []),
        ];
        case "tool": return [{ kind: "text", text: [row.name, row.use, row.guess].filter((x) => x !== "").join("  "), tone: row.tone }];
        case "image": return [{ kind: "text", text: row.alt, tone: "normal" }];
        case "steps": return [{ kind: "text", text: row.steps.map((s) => `${s.title}${s.passed ? " ✓" : ""}${s.current ? " ●" : ""}`).join(" → "), tone: "normal" }];
        case "heading": return [{ kind: "text", text: [row.text, row.sub].filter((x) => x !== "").join("  "), tone: "normal" }];
        case "entry": return [row.action !== undefined
                ? { kind: "button", key: row.key, label: `${row.title}  ${row.tag}`, action: row.action }
                : { kind: "text", text: `  ${row.title}  ${row.tag}`, tone: row.tone },
            ...(row.detail !== undefined ? [{ kind: "text", text: `    ${row.detail}`, tone: "dim" }] : [])];
        default: return [row];
    }
}
/** A row as this host can draw it: buttons it cannot press are dropped, and a row left with none goes with them. */
function onThisHost(row) {
    switch (row.kind) {
        case "button": return HOST_OPS.has(row.action.op) ? row : null;
        case "buttons": {
            const items = row.items.filter((b) => HOST_OPS.has(b.action.op));
            return items.length === 0 ? null : items.length === row.items.length ? row : { ...row, items };
        }
        case "input": return row.field === "add-tool" ? row : null;
        default: return row;
    }
}
/** The query of a board request: a tab and a filter the board knows, else their defaults. */
export function readQuery(params) {
    const tab = params.get("tab") ?? "";
    const filter = params.get("filter") ?? "";
    const expanded = params.get("expanded");
    const lang = params.get("lang");
    return {
        session: params.get("session") ?? "",
        tab: DSH_TABS.includes(tab) ? tab : HOME_TAB,
        filter: FILTERS.includes(filter) ? filter : "all",
        expanded: expanded !== null && expanded !== "" ? expanded : null,
        ...(lang !== null && lang !== "" ? { lang } : {}),
    };
}
export function sessionStatus(s) {
    return statusOf(s.sc, { workflow: s.workflow, item: { kind: "item", id: s.item } }, s.sup.run);
}
/** What a host shell keeps: the status and the policy; no context document on this host. */
export function sessionShell(s, locale, versions) {
    return {
        status: sessionStatus(s), policy: policyOf(s.sc, s.dictionary, s.sup.run), contextKey: null,
        ...(locale !== undefined ? { locale } : {}), ...(versions !== undefined ? { versions } : {}),
    };
}
/** The board data the tabs are drawn from: the graph, the fences, the dictionary, this one work item, and the journal's timeline. */
export function sessionBoard(s, status, policy) {
    const guards = new Map(status.next.map((t) => [t.name, t.guard]));
    const snap = s.sup.snapshot;
    const items = [{ id: s.item, state: snap.state, rev: snap.rev, at: snap.at, paused: s.sup.paused }];
    const timeline = s.journal !== null ? timelineOf(s.journal) : [];
    return {
        unit: "session",
        states: [...s.sc.states.values()].map((st) => ({ id: st.id, title: st.title, description: st.description, initial: st.id === s.sc.initial, final: st.final, uses: st.uses })),
        transitions: s.sc.transitions.map((t) => {
            const guard = guards.get(t.name);
            return { name: t.name, from: t.from, to: t.to, judge: t.judge, approval: t.approval, ...(guard !== undefined ? { guard } : {}), note: t.note };
        }),
        fences: Object.entries(policy.fences).map(([use, states]) => ({ use, states })),
        tools: policy.rows,
        backlog: null,
        items,
        timeline,
        clocks: varsBySource(s.sc, "elapsed").map((v) => ({ name: v.name, iso: v.source.iso, ms: v.source.ms })),
        picture: flowPicture({ sc: s.sc, status, items, timeline }),
    };
}
/** One tab's rows, in the browser's language, with the tabs and the header around them. */
export function boardReply(s, q, now, locale, versions) {
    const shell = sessionShell(s, locale, versions);
    const status = shell.status;
    const policy = shell.policy;
    const t = wordsFor(langOf(q.lang, locale));
    const board = sessionBoard(s, status, policy);
    const inbox = inboxItems({ shell, timeline: board.timeline, problem: null, now, t });
    const rows = paneRows({
        board, problem: null, shell, tab: q.tab, columns: 160, maxRows: 400, t, now, root: s.root, inbox,
        filter: q.filter, expanded: q.expanded, prompts: [], sessionItem: null, sessionRuns: [], evidence: q.expanded, doneOpen: true, flowState: null, switching: false, workflows: null,
        usage: {}, dismissed: [], toolQuery: "", toolMenu: null, toolNaming: null, toolsOpen: ["cli", "file", "mcp", "skill", "web", "model", "other"],
    });
    return {
        tabs: tabs(t, DSH_TABS),
        header: {
            item: s.item, workflow: s.workflow.name,
            ...(status.state !== undefined ? { state: { id: status.state.id, title: status.state.title, rev: status.state.rev, final: status.state.final } } : {}),
            refusals: status.refusals, paused: status.paused, ...(versions !== undefined ? { version: versions.gemworks } : {}),
        },
        // This host classifies a tool by a line typed into the add-tool field: `tool | use`.
        rows: [...rows, ...(q.tab === "tools" ? [{ kind: "input", key: "add-tool", placeholder: t("加一行：工具 | 用途"), field: "add-tool" }] : [])].flatMap(inRowsOfThisHost).map(onThisHost).filter((r) => r !== null),
        pending: inbox.length,
    };
}
/**
 * A press on the board, on this host: a person's transition, a tick, a hold, a
 * lesson into tools.geml (the Supervisor reads the dictionary afresh for every
 * decision, so the next call sees it), a line typed into the add-tool field;
 * anything the host has no way to do says so.
 */
export function actOnSession(s, action, now) {
    const meta = { at: now };
    switch (action.op) {
        case "advance": {
            const r = s.sup.humanTransition(action.to, meta);
            return r.ok ? { ok: true } : { ok: false, error: r.reason };
        }
        case "mark": {
            const r = s.sup.mark(action.variable, action.checked, meta);
            return r.ok ? { ok: true } : { ok: false, error: r.reason };
        }
        case "pause": {
            const r = s.sup.pause(meta);
            return r.ok ? { ok: true } : { ok: false, error: r.reason };
        }
        case "resume": {
            const r = s.sup.resume(meta);
            return r.ok ? { ok: true } : { ok: false, error: r.reason };
        }
        case "learn": {
            learnInFile(s.workflowFile, action.lessons, s.sc);
            return { ok: true };
        }
        case "input": {
            if (action.field !== "add-tool")
                return { ok: false, error: `${action.field} is not on this host` };
            const a = inputAction(action.field, action.value);
            return a === undefined ? { ok: false, error: "nothing to add: a tool, or `tool | use`" } : actOnSession(s, a, now);
        }
        default: return { ok: false, error: `${action.op} is not on this host` };
    }
}
