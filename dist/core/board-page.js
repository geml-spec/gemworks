// The GEML board: the workbench on a host that draws no panel of its own
// (Codex, Antigravity, an MCP-only host), as one GEML page the project's
// `.geml/board.geml` holds and a GEML viewer shows — beside the conversation
// in a VS Code-family editor, whose preview follows the file, or in a browser.
// Five parts: what waits on the person (the questions the last turn ended
// with, the steps they judge, the proposals), the work items with the step
// each stands at and that step's practices, their artifacts, a picture of each
// flow with items on it, and the other sessions' latest decisions. A page has
// no buttons: every row that waits on the person says what to say in the
// conversation. Pure: the caller reads the record and writes the file.
import { practicesAt } from "./practices.js";
import { artifactsOfItem } from "./artifacts.js";
import { itemProgress } from "./work.js";
/** Chinese, the words' own language: each key as written, its holes filled. */
export const SAY_ZH = (key, ...args) => key.replace(/\{(\d+)\}/g, (hole, n) => (args[Number(n)] !== undefined ? String(args[Number(n)]) : hole));
/** The most rows of each part: a page is read at a glance. */
const SHOWN = { items: 12, artifacts: 5, decisions: 5 };
/** Text as GEML reads it literally: markup punctuation escaped, a line break a space. */
export function literal(text) {
    return text.replace(/\s*\r?\n\s*/g, " ").replace(/[\\*`~$[\]|{}%!#<>_]/g, (c) => `\\${c}`);
}
/** A link's target as GEML reads it: no spaces or parentheses left bare. */
const target = (href) => href.replace(/[ ()]/g, (c) => encodeURIComponent(c));
/** A Mermaid label: no double quote can close it. */
const label = (text) => text.replace(/"/g, "'").replace(/[\r\n]+/g, " ");
const JUDGE_WORDS = { fact: "事实", you: "你判", model: "模型判" };
/** An item as a table names it. */
const named = (i) => `\\#${i.id} ${literal(i.title)}`;
/** The steps of an item's flow, met ones ticked, the one it stands at in bold. */
function stepsLine(i, flow) {
    const p = itemProgress(i, flow);
    return flow.states.filter((s) => !s.final).map((s) => {
        const cell = p.cells.find((c) => c.id === s.id)?.cell;
        return cell === "here" ? `**${literal(s.title)}**` : cell === "met" ? `${literal(s.title)} ✓` : literal(s.title);
    }).join(" → ");
}
/** What to say for each answer: 「好了」或「没好」. */
const sayOne = (answers, t) => answers.map((a) => t("「{0}」", literal(a))).join(t("或"));
/** What waits on the person: the questions the last turn ended with, the steps they judge, the open proposals. */
export function waitingOf(flows, items, asks, proposals, t = SAY_ZH) {
    const out = [];
    for (const q of asks) {
        const item = q.item !== undefined ? items.find((x) => x.id === q.item) : undefined;
        out.push({ ...(item !== undefined ? { item } : { label: t("提问") }), ask: q.question, say: q.options });
    }
    for (const item of items) {
        const flow = flows.find((f) => f.name === item.flow);
        if (flow === undefined || item.status !== "open")
            continue;
        const p = itemProgress(item, flow);
        const step = flow.states.find((s) => s.id === p.here);
        if (p.whose !== "you" || step === undefined)
            continue;
        out.push({ item, ask: t("{0}：{1}", step.title, step.need), say: step.answers ?? [t("好了"), t("没好")] });
    }
    for (const p of proposals.filter((x) => x.status === "open")) {
        const what = p.kind === "new-flow"
            ? t("新的一类活「{0}」：{1}", p.title ?? p.flow, (p.steps ?? []).map((s) => s.title).join(" → "))
            : p.kind === "add-step" ? t("{0} 加一步「{1}」", p.flow, p.step?.title ?? "") : t("{0} 去掉「{1}」", p.flow, p.remove ?? "");
        const name = p.title ?? p.step?.title ?? p.remove ?? p.flow;
        out.push({ label: t("提议 {0}", p.id), ask: `${what}${p.why !== "" ? t("（{0}）", p.why) : ""}`, say: [t("加上{0}", name), t("不用{0}", name)] });
    }
    return out;
}
/** The rows of 等你. */
function waitingRows(i, open, t) {
    return waitingOf(i.flows, open, i.asks, i.proposals, t).map((w) => `| ${w.item !== undefined ? `\\#${w.item.id} ${literal(w.item.title)}` : literal(w.label ?? "")} | ${literal(w.ask)} | ${sayOne(w.say, t)} |`);
}
/** The part a table heads, or a line saying there is nothing. */
function table(head, rows, id, none) {
    if (rows.length === 0)
        return [none];
    const cells = head.split("|").filter((c) => c.trim() !== "").length;
    return [`=== table {#${id}}`, head, `|${"---|".repeat(cells)}`, ...rows, "==="];
}
/** A flow with items on it, as a Mermaid picture: its steps in order, the ones an item stands at drawn heavier. */
function flowPicture(flow, on, t) {
    const here = new Map();
    for (const item of on) {
        const at = itemProgress(item, flow).here;
        if (at !== null)
            here.set(at, [...(here.get(at) ?? []), item]);
    }
    const node = (s, n) => s.final ? `s${n}(["${label(s.title)}"])` : `s${n}["${label(s.title)} · ${t(JUDGE_WORDS[s.judge])}"]${here.has(s.id) ? ":::here" : ""}`;
    const steps = [...flow.states.filter((s) => !s.final), ...flow.states.filter((s) => s.final)];
    const caption = [...here.entries()].map(([step, items]) => t("{0} 在{1}", items.map((x) => `#${x.id}`).join(t("、")), flow.states.find((s) => s.id === step)?.title ?? step)).join(t("；"));
    return [
        `=== diagram {#flow-${flow.name} format=mermaid caption="${label(t("{0}：{1}", flow.title, caption))}"}`,
        "graph LR",
        `  ${steps.map(node).join(" --> ")}`,
        "  classDef here stroke-width:3px",
        "===",
    ];
}
/** The page. */
export function boardPage(i) {
    const t = i.t ?? SAY_ZH;
    const open = i.items.filter((x) => x.status === "open" || x.status === "held").slice(0, SHOWN.items);
    const out = [
        "=== meta",
        `title = "${label(t("Gemworks 看板 · {0}", i.project))}"`,
        `updated = "${label(i.updated)}"`,
        "===",
        "",
        "=== note",
        t("Gemworks 每回合改写这一页。VS Code 系编辑器里打开预览会自动刷新；浏览器里按 F5 刷新。下面要你定的事，都在对话里回答。"),
        "===",
        "",
        `# ${t("等你")} {#waiting}`,
        "",
        ...table(`| ${t("事项")} | ${t("要你定")} | ${t("在对话里说")} |`, waitingRows(i, open, t), "asks", t("没有要你定的事。")),
        "",
        `# ${t("工作项")} {#items}`,
        "",
    ];
    const itemRows = open.flatMap((item) => {
        const flow = i.flows.find((f) => f.name === item.flow);
        if (flow === undefined)
            return [];
        const where = `${stepsLine(item, flow)}${item.status === "held" ? t("（暂缓）") : ""}`;
        return [`| ${named(item)} | ${literal(flow.title)} | ${where} | ${literal(item.needs)} | ${literal(item.next)} |`];
    });
    out.push(...table(`| ${t("工作项")} | ${t("流程")} | ${t("在哪一步")} | ${t("还要什么")} | ${t("接下来")} |`, itemRows, "work", t("没有进行中的工作项。")));
    // The practices of the step each item stands at: what the model is reminded of beside the person's prompt.
    const practiced = open.flatMap((item) => {
        const flow = i.flows.find((f) => f.name === item.flow);
        const here = flow !== undefined && item.status === "open" ? itemProgress(item, flow).here : null;
        const at = flow !== undefined && here !== null ? practicesAt(i.practices, flow.name, here) : [];
        if (flow === undefined || here === null || at.length === 0)
            return [];
        return ["", t("{0} 在「{1}」：", named(item), literal(flow.states.find((s) => s.id === here)?.title ?? here)), "", ...at.map((p, n) => `${n + 1}. ${literal(p.text)}`)];
    });
    if (practiced.length > 0)
        out.push("", `## ${t("这一步的做法")} {#practices}`, ...practiced);
    out.push("", `# ${t("产物")} {#made}`, "");
    const made = open.flatMap((item) => artifactsOfItem(i.artifacts, item.id).slice(0, SHOWN.artifacts).map((a) => {
        const last = a.versions.at(-1);
        // A file is named by its file's name: a path written outside the project is long and says little.
        const bare = a.name.replace(/`/g, "");
        const name = literal(a.kind === "link" ? bare : bare.split(/[\\/]/).at(-1) ?? bare);
        const href = i.linkOf(last);
        return `| ${named(item)} | ${href !== undefined ? `[${name}](${target(href)})` : name} | ${literal(last.version)} | ${i.clock(last.at)} |`;
    }));
    out.push(...table(`| ${t("工作项")} | ${t("产物")} | ${t("版本")} | ${t("时间")} |`, made, "artifacts", t("还没有产物。")));
    out.push("", `# ${t("流程")} {#flow}`, "");
    const pictured = i.flows.flatMap((flow) => {
        const on = open.filter((x) => x.flow === flow.name && x.status === "open");
        return on.length > 0 ? [...flowPicture(flow, on, t), ""] : [];
    });
    out.push(...(pictured.length > 0 ? pictured.slice(0, -1) : [t("没有工作项在流程上。")]));
    const decided = i.decisions.slice(-SHOWN.decisions).reverse();
    out.push("", `# ${t("别的会话的决定")} {#decisions}`, "");
    out.push(...(decided.length > 0 ? decided.map((d) => `- ${t("{0}（{1}，{2}）", literal(d.text), literal(i.hostName(d.host)), i.clock(d.at))}`) : [t("还没有。")]));
    return `${out.join("\n")}\n`;
}
