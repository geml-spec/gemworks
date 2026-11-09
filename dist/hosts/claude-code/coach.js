import { isNew } from "../../core/practices.js";
import { hhmm } from "./time.js";
import { madePress } from "./made.js";
import { COACH_FLOWS, readCoachFlow, metOf, itemProgress, workItemsOf, WORK_TOOL, WORK_REMINDER, workPrompt, workContext, workEvents, pressEvent, holdEvent, closeEvent, turnItem } from "../../core/work.js";
export { COACH_FLOWS, readCoachFlow, metOf, itemProgress, workItemsOf, WORK_TOOL, WORK_REMINDER, workPrompt, workContext, workEvents, pressEvent, holdEvent, closeEvent, turnItem };
/**
 * The flows as the person reads them: each title, need, pitfall and answer
 * through the words of their language. Ids and the rest stay as they are, so
 * every press still names the step it meant; a flow the project grew has no
 * entry in the words and keeps its own wording.
 */
export function flowsIn(flows, t) {
    const say = (s) => (s === "" ? "" : t(s));
    return flows.map((f) => ({
        ...f,
        title: say(f.title),
        states: f.states.map((s) => ({ ...s, title: say(s.title), need: say(s.need), prevents: say(s.prevents), answers: s.answers === null ? null : [say(s.answers[0]), say(s.answers[1])] })),
    }));
}
/**
 * A question the person has not answered, as a card: its answers its buttons, the recommended first; a press says
 * "question：answer", the band's own words for it, so the turn and the record take it as the band's press.
 */
function askCard(q, k, t) {
    const actions = q.options.map((label, i) => ({ key: `ask-${k}-${i}`, label, ...(i === 0 ? { primary: true } : {}), action: { op: "say", text: `${q.question}：${label}`, decisions: [`${q.question}：${label}`] } }));
    return { kind: "card", key: `ask-${k}`, icon: "ask", verb: t("定"), title: q.question, detail: [], actions };
}
/** How many items a group lists before the rest wait behind its heading's press. */
export const WORK_SHOWN = 12;
/** A step as one mark and its title, for a surface that draws no chips: ✓ met, ▸ stands here, · ahead, ⚠ skipped. */
export function stripText(cells) {
    const mark = { met: "✓", here: "▸", ahead: "·", skipped: "⚠" };
    return cells.map((c) => `${mark[c.cell]}${c.title}`).join(" ");
}
/** How long a session's record stays silent before its items are drawn as left by it (在别的会话里（已结束）). */
export const QUIET_MS = 86_400_000;
/**
 * What a pressed 好，做吧 shows in place of its button while the item stands as it was pressed: 排队中 behind the turn
 * that was running, 进行中 until its own turn ends. Nothing once that turn has ended, or once the item was reported
 * again (its record changed): the button is offered again if a next step still is.
 */
export function goneOnNote(i, gone, t) {
    const g = (gone ?? []).find((x) => x.id === i.id && x.next === i.next && x.at === i.at);
    if (g === undefined || g.ends > g.wait)
        return undefined;
    return g.ends < g.wait ? t("排队中 {0}", i.next) : t("进行中 {0}", i.next);
}
/** The presses still on their way after a turn ended: each counts the end, and leaves once its own turn has ended. */
export function goneOnAfterTurn(gone) {
    return gone.map((g) => ({ ...g, ends: g.ends + 1 })).filter((g) => g.ends <= g.wait);
}
/**
 * What the item the person's own turn took up shows in place of 好，做吧 while that turn runs: 我在做. Nothing once the
 * item was reported again (its record changed): what it says next is for after this turn.
 */
export function doingNote(i, doing, t) {
    return doing != null && doing.id === i.id && doing.next === i.next && doing.at === i.at ? t("我在做：{0}", i.next) : undefined;
}
/**
 * The work items tab's rows: the questions waiting on the person that belong to no item on the way (等你定), then the
 * items by whose turn it is — 等你, 我来, 等结果 — and those put aside (已暂缓, folded). Each item's row: its flow, its
 * steps as cells (met, here, ahead, skipped), what it needs or what comes next, the presses that are the person's (a
 * step they judge: its two words; the model's next step: 好，做吧 and 暂缓处理), and the arrow to its flow; the
 * questions about it under it. A group lists its first WORK_SHOWN items until its heading's press lists it whole.
 */
export function workRows(items, flows, t, o = {}) {
    flows = flowsIn(flows, t);
    const asks = o.asks ?? [];
    const shown = items.filter((i) => i.status === "open" || i.status === "held");
    const loose = asks.filter((q) => q.item === undefined || !shown.some((i) => i.id === q.item));
    const rows = loose.length > 0 ? [{ kind: "section", key: "asks", text: t("等你定"), count: loose.length }, ...loose.map((q) => askCard(q, asks.indexOf(q), t))] : [];
    const placed = shown.map((i) => {
        const flow = flows.find((f) => f.name === i.flow);
        const p = flow !== undefined ? itemProgress(i, flow, o.running?.get(i.id)) : undefined;
        const group = i.status === "held" ? "held" : p === undefined || p.whose === "done" ? "me" : p.whose;
        return { i, flow, p, group };
    });
    const heading = { you: t("等你"), me: t("我来"), wait: t("等结果"), held: t("已暂缓") };
    for (const group of ["you", "me", "wait", "held"]) {
        const all = placed.filter((x) => x.group === group);
        if (all.length === 0)
            continue;
        const whole = (o.open ?? []).includes(group);
        const listed = group === "held" && !whole ? [] : whole ? all : all.slice(0, WORK_SHOWN);
        const folds = group === "held" || all.length > WORK_SHOWN;
        rows.push({
            kind: "section", key: `work-${group}`, text: heading[group], count: all.length,
            ...(folds ? { fold: { key: `work-fold-${group}`, label: whole ? t("收起") : t("展开"), action: { op: "work-fold", group, open: !whole } } } : {}),
        });
        for (const { i, flow, p } of listed) {
            const here = flow?.states.find((s) => s.id === p?.here);
            const elsewhere = o.own !== undefined && i.session !== o.own;
            const actions = [];
            let detail = i.needs !== "" ? t("还差：{0}", i.needs) : here !== undefined && here.need !== "" ? t("还差：{0}", here.need) : "";
            if (group === "held") {
                actions.push({ key: `work-unhold-${i.id}`, label: t("取消暂缓"), action: { op: "work-hold", id: i.id, held: false } });
            }
            else if (group === "you" && here !== undefined) {
                const [yes, no] = here.answers ?? [t("好了"), t("没好")];
                actions.push({ key: `work-yes-${i.id}`, label: yes, primary: true, action: { op: "work-meet", id: i.id, step: here.id, yes: true, label: yes } }, { key: `work-no-${i.id}`, label: no, action: { op: "work-meet", id: i.id, step: here.id, yes: false, label: no } });
            }
            else if (group === "me") {
                // Another session's item, that session silent for a day: it will not move by itself, which the row says.
                const quiet = elsewhere && o.now !== undefined && (o.sessions ?? []).some((s) => s.id === i.session && Date.parse(o.now) - Date.parse(s.last) > QUIET_MS);
                const where = quiet ? t("在别的会话里（已结束）") : t("在别的会话里");
                if (i.next !== "") {
                    // Pressed already, or the turn running is on it: what became of it, not the button again.
                    const pressed = goneOnNote(i, o.gone, t) ?? doingNote(i, o.doing, t);
                    detail = pressed ?? t("接下来我去：{0}", i.next);
                    if (elsewhere)
                        detail = `${detail} · ${where}`;
                    else if (pressed === undefined)
                        actions.push({ key: `work-go-on-${i.id}`, label: t("好，做吧"), primary: true, action: { op: "work-go-on", id: i.id, next: i.next, at: i.at } });
                }
                else if (elsewhere)
                    detail = detail !== "" ? `${detail} · ${where}` : where;
                // Another session's item is taken over here, and 好，做吧 offered on it then; any is closed by the person's word.
                if (elsewhere)
                    actions.push({ key: `work-take-${i.id}`, label: t("转到本会话"), primary: true, action: { op: "work-take", id: i.id } });
                actions.push({ key: `work-done-${i.id}`, label: t("标为完成"), action: { op: "work-close", id: i.id, status: "done" } }, { key: `work-hold-${i.id}`, label: t("暂缓处理"), action: { op: "work-hold", id: i.id, held: true } });
            }
            const cells = flow !== undefined && p !== undefined ? p.cells.map((c) => ({ title: flow.states.find((s) => s.id === c.id).title, cell: c.cell })) : [];
            const unfolded = o.unfolded === i.id;
            const go = { key: `work-go-${i.id}`, label: t("看流程"), action: { op: "coach-go", flow: i.flow, id: i.id } };
            const made = madePress(o.made, i.id, t);
            rows.push({
                kind: "work", key: `work-${i.id}`, flow: i.flow, tag: flow?.title ?? i.flow, title: i.title, cells, detail, actions, go,
                open: { key: `work-open-${i.id}`, label: i.title, action: { op: "work-unfold", id: unfolded ? null : i.id } },
                ...(made !== undefined ? { made } : {}),
            }, ...asks.filter((q) => q.item === i.id).map((q) => askCard(q, asks.indexOf(q), t)));
            // Unfolded: how it came here — each turn that moved it, what it decided — then its prompts and its flow.
            if (unfolded) {
                const history = itemHistory(i.id, o.sessions ?? [], flows, t);
                const shownNow = history.slice(-HISTORY_SHOWN);
                if (history.length > shownNow.length)
                    rows.push({ kind: "text", text: t("…再往前 {0} 条", history.length - shownNow.length), tone: "dim" });
                for (const h of shownNow)
                    rows.push({ kind: "text", text: `${hhmm(h.at)}  ${h.text}`, tone: "dim" });
                if (history.length === 0)
                    rows.push({ kind: "text", text: t("还没有经过"), tone: "dim" });
                if (i.goal !== "")
                    rows.push({ kind: "text", text: t("最后：{0}", i.goal), tone: "dim" });
                // 放下 under the unfolded row, not on the folded one: given up, it is counted under 放下.
                rows.push({ kind: "buttons", items: [
                        { key: `work-prompts-${i.id}`, label: t("看这件的提示词"), action: { op: "session-item", id: i.id } }, go,
                        ...(group !== "held" ? [{ key: `work-drop-${i.id}`, label: t("放下"), action: { op: "work-close", id: i.id, status: "dropped" } }] : []),
                    ] });
            }
        }
    }
    return rows;
}
const stepTitle = (flows, flow, id) => flows.find((f) => f.name === flow)?.states.find((s) => s.id === id)?.title ?? id;
/** How a step was met in words: by the person's words, by their press, or as is. */
function metWords(m, title, t) {
    return m.said !== undefined ? t("✓{0} · 你说「{1}」", title, m.said) : m.pressed === true ? t("✓{0} · 你按的", title) : `✓${title}`;
}
/** A move of a work item in words: the steps met, else where it went (a way back), else how it ended or was put aside. */
function moveWords(mv, flows, t) {
    if (mv.status === "held")
        return t("已暂缓");
    if (mv.status === "dropped")
        return t("放下");
    if (mv.met.length > 0)
        return mv.met.map((m) => metWords(m, stepTitle(flows, mv.flow, m.step), t)).join(" ");
    return mv.status === "done" ? t("完成") : t("到「{0}」", stepTitle(flows, mv.flow, mv.state));
}
/** What a turn did, in words for the sessions tab: each work item it moved and how, each decision, each practice it learned. */
export function turnWords(turn, flows, learned, t) {
    flows = flowsIn(flows, t);
    return [
        ...(turn.moved ?? []).map((mv) => `→ ${mv.title} ${moveWords(mv, flows, t)}`),
        ...turn.decisions.map((d) => t("定：{0}", d)),
        ...learned.map((x) => t("新学到：{0}", x.text)),
    ];
}
/** A work item's history, oldest first, across every session: each turn that moved it — how, and what that turn decided. */
export function itemHistory(id, sessions, flows, t) {
    flows = flowsIn(flows, t);
    const out = [];
    for (const s of sessions) {
        for (const turn of s.turns) {
            const mv = (turn.moved ?? []).find((x) => x.id === id);
            if (mv === undefined)
                continue;
            out.push({ at: mv.at, text: moveWords(mv, flows, t) });
            for (const d of turn.decisions)
                out.push({ at: mv.at, text: t("定：{0}", d) });
        }
    }
    return out.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
}
/** How many entries of a work item's history its row lists when unfolded, the newest. */
export const HISTORY_SHOWN = 8;
/** A practice as a row: what to do, where it came from, its tag (新学到, 从记忆搬来, 团队), and the presses the person has on it. */
function practiceRow(p, t, now, count) {
    const fresh = now !== undefined && isNew(p, now);
    const tag = p.layer === "team" ? t("团队") : fresh ? t("新学到") : p.by === "memory" ? t("从记忆搬来") : "";
    const actions = p.layer === "team" ? [] : [
        { key: `practice-layer-${p.id}`, label: p.layer === "personal" ? t("个人") : t("项目"), action: { op: "practice-layer", id: p.id, layer: p.layer === "personal" ? "project" : "personal" } },
        ...(fresh || p.by === "memory" ? [{ key: `practice-delete-${p.id}`, label: "×", action: { op: "practice-delete", id: p.id } }] : []),
        // Only a practice on a step can hold calls until that step is met: those get 改成规定.
        ...(p.flow !== "*" && p.step !== "*" ? [{ key: `practice-rule-${p.id}`, label: t("改成规定"), action: { op: "practice-rule", id: p.id } }] : []),
        // Shared: a step's practice into the team's file in the repository; one for every time, into CLAUDE.md (read every turn), shown to the person first.
        p.flow !== "*" ? { key: `practice-share-${p.id}`, label: t("分享给团队"), action: { op: "practice-share", id: p.id } } : { key: `practice-claude-${p.id}`, label: t("写进 CLAUDE.md"), action: { op: "practice-claude-md", id: p.id } },
    ];
    return {
        kind: "practice", key: `practice-${p.id}`, text: p.text, why: [p.why, p.ref ?? ""].filter((x) => x !== "").join(" · "), tag, fresh, actions,
        ...(count !== undefined && count.before + count.after > 0 ? { count: { text: t("纠正 {0} → {1}", count.before, count.after), held: count.after === 0 } } : {}),
    };
}
/** The corrections a card quotes, one line a day: `10-28「…」「…」`. */
function quoteLines(quotes) {
    const days = new Map();
    for (const q of quotes) {
        const day = q.day ?? q.at.slice(5, 10);
        days.set(day, [...(days.get(day) ?? []), `「${q.text.length > 40 ? `${q.text.slice(0, 40)}…` : q.text}」`]);
    }
    return [...days.entries()].map(([day, said]) => `${day}${said.join("")}`);
}
/**
 * The ledger's cards on top of the flow tab (core/corrections.ts), each with what the person can do about it: a
 * correction said again and again with no practice where it was said (记为做法, or 设为通用做法 for one hung on another
 * step), a practice whose rule was said again since it was written (删除, 保留). 忽略 and 保留 put a card away.
 */
export function ledgerCardRows(cards, flows, t) {
    flows = flowsIn(flows, t);
    const stepTitle = (flow, step) => flows.find((f) => f.name === flow)?.states.find((s) => s.id === step)?.title ?? step;
    return cards.map((c) => {
        const away = (label) => ({ key: `ledger-away-${c.key}`, label, action: { op: "ledger-dismiss", key: c.key, n: c.n } });
        if (c.kind === "failing") {
            const instead = c.instead;
            return {
                kind: "card", key: `ledger-${c.key}`, icon: "warn", verb: t("失效"), title: t("生效后仍纠正 {0} 次：{1}", c.n, c.practice.text),
                detail: [...quoteLines(c.quotes), ...(instead !== undefined ? [t("已有替代做法（{0}）：{1}", c.insteadDay ?? instead.at.slice(5, 10), instead.text)] : [])],
                actions: [{ key: `ledger-delete-${c.key}`, label: t("删除"), ...(instead !== undefined ? { primary: true } : {}), action: { op: "practice-delete", id: c.practice.id } }, away(t("保留"))],
            };
        }
        const narrow = c.narrow;
        return {
            kind: "card", key: `ledger-${c.key}`, icon: "ask", verb: t("提议"), title: t("重复纠正 {0} 次：{1}", c.n, c.rule),
            detail: [...quoteLines(c.quotes), ...(narrow !== undefined ? [t("现有做法仅限「{0}」", stepTitle(narrow.flow, narrow.step))] : [])],
            actions: [
                narrow !== undefined
                    ? { key: `ledger-everywhere-${c.key}`, label: t("设为通用做法"), primary: true, action: { op: "practice-everywhere", id: narrow.id } }
                    : { key: `ledger-practice-${c.key}`, label: t("记为做法"), primary: true, action: { op: "practice-from-theme", theme: c.theme, rule: c.rule, flow: c.where?.flow ?? "*", step: c.where?.step ?? "*", why: t("重复纠正 {0} 次", c.n) } },
                away(t("忽略")),
            ],
        };
    });
}
/**
 * The flow tab's manual: how each kind of work goes in this project. Each flow with items on the way, the focused one
 * first, else the one moved last, then the ones opened: its heading (how many on the way, how it differs from the one
 * the plugin ships, a press that lists its practices or folds them), then its steps in order — the requirement to leave
 * each, who judges it, what it prevents, the step the focused item stands at marked — the practices on each step (on
 * the flow listed), the ways back. The flows with none on the way in one group, each a press that opens it; then the
 * practices for every flow and every step.
 */
export function manualRows(items, flows, practices, t, o) {
    flows = flowsIn(flows, t);
    const live = practices.filter((p) => p.deleted !== true);
    const open = items.filter((i) => i.status === "open");
    const latest = (f) => open.filter((i) => i.flow === f.name).reduce((m, i) => (i.at > m ? i.at : m), "");
    const focused = o.focus !== null ? open.find((i) => i.id === o.focus?.id) : undefined;
    const busy = flows.filter((f) => latest(f) !== "").sort((a, b) => (o.focus?.flow === a.name ? -1 : o.focus?.flow === b.name ? 1 : latest(a) < latest(b) ? 1 : -1));
    const expanded = o.expanded ?? [busy[0]?.name ?? ""];
    const shown = [...busy, ...flows.filter((f) => latest(f) === "" && expanded.includes(f.name))];
    const judgeWords = { fact: t("事实"), you: t("你"), model: t("模型") };
    const rows = [{ kind: "text", text: t("谁判：事实＝插件查得到 · 你＝要你点头 · 模型＝我判断"), tone: "dim" }, ...ledgerCardRows(o.ledger?.cards ?? [], flows, t)];
    const waiting = (o.proposals ?? []).filter((p) => p.status === "open");
    // A new kind of work proposed: on top, before the flows.
    for (const p of waiting.filter((x) => x.kind === "new-flow")) {
        rows.push({ kind: "card", key: `proposal-${p.id}`, icon: "ask", verb: t("提议"), title: t("新的一类活「{0}」：{1}", p.title ?? p.flow, (p.steps ?? []).map((x) => x.title).join(" → ")), detail: p.why !== "" ? [p.why] : [],
            actions: [{ key: `proposal-yes-${p.id}`, label: t("加上"), primary: true, action: { op: "proposal-answer", id: p.id, yes: true } }, { key: `proposal-no-${p.id}`, label: t("不用"), action: { op: "proposal-answer", id: p.id, yes: false } }] });
    }
    const focusFlow = flows.find((f) => f.name === focused?.flow);
    const focusHere = focused !== undefined && focusFlow !== undefined ? itemProgress(focused, focusFlow).here : null;
    if (focused !== undefined && focusFlow !== undefined && focusHere !== null) {
        rows.push({ kind: "text", text: t("从「{0}」过来 · 卡在「{1}」", focused.title, focusFlow.states.find((s) => s.id === focusHere)?.title ?? focusHere), tone: "dim" });
    }
    for (const f of shown) {
        const n = open.filter((i) => i.flow === f.name).length;
        const mine = live.filter((p) => p.flow === f.name);
        const listed = expanded.includes(f.name);
        const diff = f.diff !== undefined && (f.diff.added.length > 0 || f.diff.removed.length > 0)
            ? [f.diff.added.length > 0 ? t("比参考多{0}", f.diff.added.map((x) => `「${x}」`).join("")) : "", f.diff.removed.length > 0 ? t("比参考少{0}", f.diff.removed.map((x) => `「${x}」`).join("")) : ""].filter((x) => x !== "").join("，")
            : "";
        rows.push({
            kind: "section", key: `manual-${f.name}`, text: f.title, note: [n > 0 ? t("{0} 件在走", n) : "", diff !== "" ? t("本项目改过：{0}", diff) : ""].filter((x) => x !== "").join(" · "),
            actions: [{ key: `flow-share-${f.name}`, label: t("分享给团队"), action: { op: "flow-share", flow: f.name } }, { key: `flow-export-${f.name}`, label: t("导出"), action: { op: "flow-export", flow: f.name } }],
            ...(mine.length > 0 ? { fold: { key: `manual-fold-${f.name}`, label: listed ? t("收起做法") : t("做法 {0} 条", mine.length), action: { op: "manual-open", flow: f.name, open: !listed } } } : {}),
        });
        if (listed) {
            const wide = mine.filter((p) => p.step === "*");
            if (wide.length > 0)
                rows.push({ kind: "text", text: t("这类活都要："), tone: "dim" }, ...wide.map((p) => practiceRow(p, t, o.now, o.ledger?.counts[p.id])));
        }
        for (const s of f.states) {
            const held = (o.rules ?? []).filter((r) => (r.flow === f.name || r.flow === "*") && r.requires === s.id).map((r) => t("规定：{0}", r.text) + (r.held !== undefined && r.held > 0 ? ` · ${t("拦过 {0} 次", r.held)}` : ""));
            rows.push({ kind: "step", key: `step-${f.name}-${s.id}`, title: s.title, need: s.need, judge: s.final ? "" : judgeWords[s.judge], judgeKind: s.judge, prevents: s.prevents !== "" ? t("防：{0}", s.prevents) : "", here: focused?.flow === f.name && focusHere === s.id, final: s.final, ...(held.length > 0 ? { rules: held } : {}) });
            if (listed)
                rows.push(...mine.filter((p) => p.step === s.id).map((p) => practiceRow(p, t, o.now, o.ledger?.counts[p.id])));
            for (const e of f.edges.filter((x) => x.back && x.from === s.id)) {
                const target = f.states.find((x) => x.id === e.to)?.title ?? e.to;
                rows.push({ kind: "text", text: e.label !== "" ? `↩ ${t("{0}，回到{1}", e.label, target)}` : `↩ ${t("回到{0}", target)}`, tone: "dim" });
            }
        }
        // Changes to this flow waiting on the person: a step to add (the model saw it), a step to take out (gemworks saw it skipped).
        for (const p of waiting.filter((x) => x.kind === "add-step" && x.flow === f.name)) {
            const after = f.states.find((x) => x.id === p.after)?.title ?? p.after ?? "";
            rows.push({ kind: "card", key: `proposal-${p.id}`, icon: "ask", verb: t("提议"), title: t("在「{0}」后面加一步「{1}」", after, p.step?.title ?? ""), detail: [p.step?.need ?? "", p.why].filter((x) => x !== ""),
                actions: [{ key: `proposal-yes-${p.id}`, label: t("加上"), primary: true, action: { op: "proposal-answer", id: p.id, yes: true } }, { key: `proposal-no-${p.id}`, label: t("不用"), action: { op: "proposal-answer", id: p.id, yes: false } }] });
        }
        for (const k of (o.skipped ?? []).filter((x) => x.flow === f.name)) {
            const title = f.states.find((x) => x.id === k.step)?.title ?? k.step;
            rows.push({ kind: "card", key: `skipped-${f.name}-${k.step}`, icon: "ask", verb: t("提议"), title: t("「{0}」最近 5 件里 {1} 件跳过了，删掉这一步吗？", title, k.skipped), detail: [],
                actions: [{ key: `skipped-yes-${f.name}-${k.step}`, label: t("删掉"), action: { op: "proposal-skip", flow: f.name, step: k.step, yes: true } }, { key: `skipped-no-${f.name}-${k.step}`, label: t("留着"), primary: true, action: { op: "proposal-skip", flow: f.name, step: k.step, yes: false } }] });
        }
    }
    const idle = flows.filter((f) => latest(f) === "" && !expanded.includes(f.name));
    if (idle.length > 0) {
        rows.push({ kind: "section", key: "manual-idle", text: t("现在没有事项在走") });
        for (const f of idle)
            rows.push({ kind: "entry", key: `manual-idle-${f.name}`, title: f.title, tag: t("{0} 步", f.states.filter((s) => !s.final).length), tone: "dim", action: { op: "manual-open", flow: f.name, open: true } });
    }
    const anywhere = live.filter((p) => p.flow === "*");
    if (anywhere.length > 0) {
        const listed = expanded.includes("*");
        rows.push({ kind: "section", key: "manual-anywhere", text: t("所有时候的做法"), count: anywhere.length, fold: { key: "manual-fold-anywhere", label: listed ? t("收起") : t("展开"), action: { op: "manual-open", flow: "*", open: !listed } } });
        if (listed)
            rows.push(...anywhere.map((p) => practiceRow(p, t, o.now, o.ledger?.counts[p.id])));
    }
    // A reference imported: an exported flow's file, or another project's .gemworks/ — only to compare and take steps back from.
    rows.push({ kind: "input", key: "import-reference", placeholder: t("导入参考：导出的流程文件，或另一个项目的 .gemworks/"), field: "import-reference" });
    return rows;
}
/**
 * The band's one thing among this session's work items: when the last turn (since `since`) moved several that wait
 * on the person, those together with 逐个定; else the one it moved that waits on the person (等你, the step's two
 * words and 暂缓处理), else this session's last item on the way — what it needs, or what comes next with 好，做吧 and
 * 暂缓处理 (once pressed, 排队中 or 进行中 and no buttons: `gone`; while the person's own turn is on it, 我在做 and
 * no buttons: `doing`). The other items waiting on the person, in any session, are the ones more.
 */
export function coachBand(items, flows, session, t, since, gone, doing) {
    flows = flowsIn(flows, t);
    const at = (i) => {
        const flow = flows.find((f) => f.name === i.flow);
        return { i, flow, p: flow !== undefined ? itemProgress(i, flow) : undefined };
    };
    const open = items.filter((x) => x.status === "open").map(at);
    const mine = open.filter((x) => x.i.session === session);
    const touched = since !== undefined ? mine.filter((x) => x.i.at >= since) : [];
    const yours = (list) => list.filter((x) => x.p?.whose === "you");
    const moreOf = (shown) => {
        const rest = yours(open).filter((x) => !shown.includes(x.i.id));
        return { count: rest.length, detail: rest.map((x) => x.i.title).join(SEP_WORDS) };
    };
    const several = yours(touched);
    if (several.length > 1) {
        return {
            verb: t("等你"), title: t("这一轮 {0} 件等你：{1}", several.length, several.map((x) => x.i.title).join(SEP_WORDS)), note: "", detail: several.map((x) => x.i.title).join(SEP_WORDS),
            actions: [{ key: "band-one-by-one", label: t("逐个定"), primary: true, action: { op: "open-board", tab: "items" } }], more: moreOf(several.map((x) => x.i.id)),
        };
    }
    const one = several[0] ?? mine[0];
    if (one === undefined)
        return undefined;
    const { i, flow, p } = one;
    const here = flow?.states.find((s) => s.id === (p?.here ?? i.state));
    const tag = flow?.title ?? i.flow;
    const cells = flow !== undefined && p !== undefined ? stripText(p.cells.map((c) => ({ title: flow.states.find((s) => s.id === c.id).title, cell: c.cell }))) : "";
    const detail = [cells, i.goal !== "" ? t("最后：{0}", i.goal) : ""].filter((x) => x !== "").join(SEP_WORDS);
    const hold = { key: "band-hold", label: t("暂缓处理"), action: { op: "work-hold", id: i.id, held: true } };
    if (p?.whose === "you" && here !== undefined) {
        const [yes, no] = here.answers ?? [t("好了"), t("没好")];
        return {
            verb: `${t("等你")} · ${tag}`, title: i.title, note: i.needs !== "" ? i.needs : here.need, detail,
            actions: [{ key: "band-yes", label: yes, primary: true, action: { op: "work-meet", id: i.id, step: here.id, yes: true, label: yes } }, { key: "band-no", label: no, action: { op: "work-meet", id: i.id, step: here.id, yes: false, label: no } }, hold],
            more: moreOf([i.id]),
        };
    }
    const next = p?.whose === "me" && i.next !== "";
    const pressed = next ? (goneOnNote(i, gone, t) ?? doingNote(i, doing, t)) : undefined;
    return {
        verb: tag, title: i.title, note: pressed ?? (next ? t("接下来我去：{0}", i.next) : i.needs !== "" ? t("还差：{0}", i.needs) : here?.title ?? i.state), detail,
        actions: next && pressed === undefined ? [{ key: "band-go-on", label: t("好，做吧"), primary: true, action: { op: "work-go-on", id: i.id, next: i.next, at: i.at } }, hold] : [],
        more: moreOf([i.id]),
    };
}
const SEP_WORDS = " · ";
