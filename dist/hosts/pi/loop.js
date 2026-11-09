import { waitingOf } from "../../core/board-page.js";
import { PI_TOOLS } from "../../core/host-tools.js";
import { practicesAt } from "../../core/practices.js";
import { currentTurn, decisionsContext, NOTE_TOOL, SESSIONS_PROMPT } from "../../core/session-log.js";
import { itemProgress, turnItem, WORK_REMINDER } from "../../core/work.js";
import { callLoopTool, coachFlowsAt, LOOP_TOOLS, loopContext, loopPrompt, proposalsAt, workItemsAt } from "../../loop.js";
import { readPractices } from "../../practice-store.js";
import { labelPrompt } from "../../ledger-run.js";
import { typedWords } from "../../core/corrections.js";
import { appendSession, decisionsFor, hostLabel, readSessions, recordAnswer, recordDecisions, recordPrompt } from "../../session-store.js";
export const PI_HOST = "pi";
/** A width in terminal cells: the wide East Asian characters take two. */
export function cells(text) {
    let n = 0;
    for (const ch of text)
        n += /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]|[\u{1f300}-\u{1faff}\u{20000}-\u{3fffd}]/u.test(ch) ? 2 : 1;
    return n;
}
/** A line cut to `width` cells, an ellipsis where it was cut. */
export function fit(text, width) {
    if (cells(text) <= width)
        return text;
    let out = "";
    for (const ch of text) {
        if (cells(`${out}${ch}…`) > width)
            break;
        out += ch;
    }
    return `${out}…`;
}
const where = (item, flows) => {
    const flow = flows.find((f) => f.name === item.flow);
    const here = flow !== undefined ? itemProgress(item, flow).here : null;
    return `${flow?.title ?? item.flow} · ${here !== null ? flow?.states.find((s) => s.id === here)?.title ?? here : "完成"}`;
};
/** The steps of an item's flow on one line: met ones ticked, the one it stands at marked. */
function stepsOf(item, flow) {
    const p = itemProgress(item, flow);
    return flow.states.filter((s) => !s.final).map((s) => {
        const cell = p.cells.find((c) => c.id === s.id)?.cell;
        return cell === "here" ? `[${s.title}]` : cell === "met" ? `${s.title} ✓` : s.title;
    }).join(" → ");
}
const sayOf = (w) => w.say.map((s) => `「${s}」`).join("或");
/**
 * The band above the editor, a line or three: this session's work item and where it stands (or that none is on the
 * way), the first thing that waits on the person and how many more, the step's first practice.
 */
export function bandLines(d, session, width = 100) {
    const own = turnItem(d.items, session) ?? d.items.find((i) => i.status === "open");
    const head = own !== undefined ? `gemworks · #${own.id} ${own.title} · ${where(own, d.flows)}` : "gemworks · 没有进行中的工作项";
    const lines = [`${fit(head, Math.max(20, width - 16))}  /gemworks 看板`];
    const first = d.waiting[0];
    if (first !== undefined)
        lines.push(fit(`等你：${first.ask}　在对话里说${sayOf(first)}${d.waiting.length > 1 ? `（还有 ${d.waiting.length - 1} 件）` : ""}`, width));
    const flow = own !== undefined ? d.flows.find((f) => f.name === own.flow) : undefined;
    const here = own !== undefined && flow !== undefined ? itemProgress(own, flow).here : null;
    const practice = flow !== undefined && here !== null ? practicesAt(d.practices, flow.name, here, 1)[0] : undefined;
    if (practice !== undefined)
        lines.push(fit(`这一步：${practice.text}`, width));
    return lines;
}
/** The board the overlay shows: what waits on the person, the work items, their step's practices, the other sessions' decisions. */
export function boardLines(d, width = 100) {
    const out = ["Gemworks 看板　　Esc 关", ""];
    out.push("等你");
    if (d.waiting.length === 0)
        out.push("  没有要你定的事。");
    for (const w of d.waiting)
        out.push(fit(`  ${w.item !== undefined ? `#${w.item.id} ${w.item.title}` : w.label ?? ""}：${w.ask}　在对话里说${sayOf(w)}`, width));
    out.push("", "工作项");
    const open = d.items.filter((i) => i.status === "open" || i.status === "held").slice(0, 12);
    if (open.length === 0)
        out.push("  没有进行中的工作项。");
    for (const item of open) {
        const flow = d.flows.find((f) => f.name === item.flow);
        out.push(fit(`  #${item.id} ${item.title}${item.status === "held" ? "（暂缓）" : ""}`, width));
        if (flow !== undefined)
            out.push(fit(`    ${flow.title}：${stepsOf(item, flow)}`, width));
        if (item.needs !== "")
            out.push(fit(`    还要：${item.needs}`, width));
        if (item.next !== "")
            out.push(fit(`    接下来：${item.next}`, width));
        const here = flow !== undefined && item.status === "open" ? itemProgress(item, flow).here : null;
        for (const [n, p] of (flow !== undefined && here !== null ? practicesAt(d.practices, flow.name, here) : []).entries())
            out.push(fit(`    做法 ${n + 1}：${p.text}`, width));
    }
    const decided = d.decisions.slice(-5).reverse();
    if (decided.length > 0) {
        out.push("", "别的会话的决定");
        for (const x of decided)
            out.push(fit(`  ${x.text}（${hostLabel(x.host)}，${new Date(x.at).toTimeString().slice(0, 5)}）`, width));
    }
    return out;
}
/** The band's and the board's data, read from the project's record now. */
export function piLoopData(cwd, session) {
    const flows = coachFlowsAt(cwd);
    const items = workItemsAt(cwd, flows);
    const sessions = readSessions(cwd);
    const own = sessions.find((s) => s.id === session);
    const asks = (own?.asks ?? []).map((q) => ({ question: q.question, options: q.options }));
    let practices = [];
    try {
        practices = readPractices(cwd).practices;
    }
    catch { /* drawn without them */ }
    let proposals = [];
    try {
        proposals = proposalsAt(cwd);
    }
    catch { /* drawn without them */ }
    return { flows, items, waiting: waitingOf(flows, items, asks, proposals), practices, decisions: decisionsFor(cwd, session, null), asks };
}
/** Pi's words for the tools: the gemworks `work` tool is `gemworks_work` here. */
const piWords = (text) => text.replace(/the gemworks `(\w+)` tool/g, "the `gemworks_$1` tool").replace(/gemworks `(\w+)` tool/g, "`gemworks_$1` tool");
/** The text of an agent's last message with words in it. */
function lastWords(messages) {
    for (let i = messages.length - 1; i >= 0; i--) {
        const m = messages[i];
        if (m?.role !== "assistant")
            continue;
        const text = typeof m.content === "string" ? m.content : Array.isArray(m.content) ? m.content.map((b) => (b?.type === "text" && typeof b.text === "string" ? b.text : "")).join("") : "";
        if (text.trim() !== "")
            return text.trim();
    }
    return "";
}
/**
 * The session's own model, borrowed: Pi's registry completes with the model the person chose and its own credentials.
 * Undefined when the session has none.
 */
export function piComplete(ctx) {
    const model = ctx.model;
    const registry = ctx.modelRegistry;
    if (model === undefined || registry === undefined)
        return undefined;
    return async (system, prompt, maxTokens) => {
        const reply = await registry.complete(model, { systemPrompt: system, messages: [{ role: "user", content: prompt, timestamp: Date.now() }] }, { maxTokens });
        const text = reply.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
        return text === "" ? undefined : text;
    };
}
/** A typed prompt into the person's ledger, labelled behind the run with the step this session's work item stands at. */
function learnFrom(cwd, session, prompt, before, ctx) {
    if (process.env["GEMWORKS_LEARN"] === "0")
        return;
    const words = typedWords(prompt);
    const complete = piComplete(ctx);
    if (words === undefined || complete === undefined)
        return;
    const flows = coachFlowsAt(cwd);
    const item = turnItem(workItemsAt(cwd, flows), session);
    const flow = item !== undefined ? flows.find((f) => f.name === item.flow) : undefined;
    const step = item !== undefined && flow !== undefined ? itemProgress(item, flow).here ?? undefined : undefined;
    let locale;
    try {
        locale = Intl.DateTimeFormat().resolvedOptions().locale;
    }
    catch { /* the default words */ }
    void labelPrompt(cwd, { text: words, before, at: new Date().toISOString(), session, ...(flow !== undefined && step !== undefined ? { flow: flow.name, step } : {}) }, complete, locale).catch(() => false);
}
/** The overlay `/gemworks` opens: the board's lines, Esc or q closes it. */
function boardOverlay(lines, done) {
    return {
        render: (width) => lines().map((l) => fit(l, Math.max(10, width - 2))),
        handleInput: (data) => { if (data === "\u001b" || data === "q" || data === "\r")
            done(undefined); },
        invalidate: () => { },
    };
}
/** The work loop on Pi, for the session in `cwd`: registered once, at load. */
export function attachLoop(pi, cwd) {
    let session;
    let acted = false;
    let reminded = false;
    /** The last run's answer: the reply the person's next prompt answers, for its label. */
    let lastAnswer = "";
    const safe = (f) => { try {
        f();
    }
    catch { /* missed this time */ } };
    const band = (ctx) => {
        if (!ctx.hasUI || session === undefined)
            return;
        const id = session;
        safe(() => ctx.ui.setWidget("gemworks", bandLines(piLoopData(cwd, id), id)));
    };
    pi.on("session_start", (_event, ctx) => {
        session = ctx.sessionManager.getSessionId();
        const id = session;
        safe(() => { appendSession(cwd, PI_HOST, id, () => []); });
        band(ctx);
    });
    // Each run: the person's prompt into the record, and the loop in the system prompt.
    pi.on("before_agent_start", (event, ctx) => {
        if (session === undefined)
            return undefined;
        const id = session;
        if (event.messageType === "user") {
            acted = false;
            reminded = false;
            safe(() => recordPrompt(cwd, PI_HOST, id, event.prompt));
            // The person's ledger: the prompt labelled by the session's own model, behind the run (GEMWORKS_LEARN=0 turns it off).
            safe(() => learnFrom(cwd, id, event.prompt, lastAnswer, ctx));
        }
        const said = [];
        safe(() => said.push(piWords([SESSIONS_PROMPT, ...loopPrompt(coachFlowsAt(cwd))].join("\n\n"))));
        safe(() => {
            const fresh = decisionsFor(cwd, id, null);
            if (fresh.length > 0)
                said.push(decisionsContext(fresh, (d) => `${hostLabel(d.host)}${d.branch !== undefined ? ` · ${d.branch}` : ""}，${new Date(d.at).toTimeString().slice(0, 5)}`));
        });
        safe(() => said.push(...loopContext(cwd, id)));
        band(ctx);
        return said.length === 0 ? undefined : { systemPrompt: `${event.systemPrompt}\n\n# gemworks: work items\n\n${said.join("\n\n")}` };
    });
    pi.on("tool_result", (event, ctx) => {
        if (PI_TOOLS.write.includes(event.toolName) || PI_TOOLS.run.includes(event.toolName))
            acted = true;
        if (event.toolName.startsWith("gemworks_"))
            band(ctx);
    });
    // A run's end: its answer into the record; a run that changed things and reported no work item sent back once; else the
    // first question it registered, asked with its answers to pick (the pick goes in as the person's message).
    pi.on("agent_end", (event, ctx) => {
        if (session === undefined)
            return;
        const id = session;
        const answer = lastWords(event.messages);
        if (answer !== "")
            lastAnswer = answer;
        safe(() => recordAnswer(cwd, PI_HOST, id, answer, false));
        band(ctx);
        if (acted && !reminded) {
            reminded = true;
            let reported = true;
            safe(() => {
                const events = appendSession(cwd, PI_HOST, id, () => []);
                const turn = currentTurn(events);
                reported = events.some((e) => e.t === "item" && e.turn === turn) || coachFlowsAt(cwd).length === 0;
            });
            if (!reported) {
                safe(() => { void pi.sendMessage({ customType: "gemworks", content: WORK_REMINDER, display: false }, { triggerTurn: true }); });
                return;
            }
        }
        if (!ctx.hasUI)
            return;
        let ask;
        safe(() => { ask = piLoopData(cwd, id).asks[0]; });
        if (ask === undefined)
            return;
        const q = ask;
        void ctx.ui.select(q.question, [...q.options]).then((pick) => {
            if (pick !== undefined)
                void pi.sendUserMessage(`${q.question}：${pick}`);
        }).catch(() => undefined);
    });
    for (const tool of [...LOOP_TOOLS, NOTE_TOOL]) {
        pi.registerTool({
            name: `gemworks_${tool.name}`,
            label: `gemworks_${tool.name}`,
            description: piWords(tool.description),
            parameters: tool.inputSchema,
            execute: async (_toolCallId, params, _signal, _onUpdate, ctx) => {
                const id = session ?? ctx.sessionManager.getSessionId();
                const args = (params ?? {});
                let text;
                if (tool.name === NOTE_TOOL.name) {
                    const n = recordDecisions(cwd, PI_HOST, id, Array.isArray(args["decisions"]) ? args["decisions"].filter((x) => typeof x === "string") : []);
                    if (n === 0)
                        throw new Error("Nothing recorded: decisions is a list of short sentences.");
                    text = `Recorded ${n} decision${n === 1 ? "" : "s"}; the project's other sessions will see ${n === 1 ? "it" : "them"}.`;
                }
                else {
                    const r = await callLoopTool(cwd, PI_HOST, id, tool.name, args);
                    if (r === undefined || !r.ok)
                        throw new Error(r?.text ?? "gemworks: no such tool");
                    text = r.text;
                }
                band(ctx);
                return { content: [{ type: "text", text }], details: { text } };
            },
        });
    }
    pi.registerCommand("gemworks", {
        description: "Gemworks 看板：等你定的事、工作项、这一步的做法",
        handler: async (_args, ctx) => {
            const id = session ?? ctx.sessionManager.getSessionId();
            const lines = () => { try {
                return boardLines(piLoopData(cwd, id));
            }
            catch {
                return ["gemworks: 看板读不出来"];
            } };
            if (!ctx.hasUI || ctx.mode !== "tui") {
                ctx.ui.notify(lines().join("\n"), "info");
                return;
            }
            await ctx.ui.custom((_tui, _theme, _keys, done) => boardOverlay(lines, done), { overlay: true });
        },
    });
}
