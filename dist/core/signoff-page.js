import { artifactsOfItem } from "./artifacts.js";
import { literal, SAY_ZH } from "./board-page.js";
import { itemProgress } from "./work.js";
const JUDGE_WORDS = { fact: "事实", you: "你判", model: "模型判" };
/** A Mermaid-free GEML label: no double quote can close it. */
const quoted = (text) => text.replace(/"/g, "'").replace(/[\r\n]+/g, " ");
/** What a met step stands on, in the person's words. */
function grounds(m, judge, t, clock) {
    if (judge === "you") {
        if (m.pressed === true)
            return m.said !== undefined && m.said !== "" ? t("你按了「{0}」", literal(m.said)) : t("你按了确认");
        if (m.said !== undefined && m.said !== "")
            return t("你的原话：「{0}」", literal(m.said));
        return t("记为已过");
    }
    if (judge === "fact") {
        if (m.evidence === undefined || m.evidence === "")
            return t("只有模型的报告（第 {0} 轮）", m.turn);
        const seen = m.seen !== undefined
            ? t("本会话看到 {0} 退出码 {1}（{2}）", `\`${m.seen.command.replace(/`/g, "'")}\``, m.seen.exit, clock(m.seen.at))
            : t("本会话没看到这条命令");
        return `${t("模型给的凭据：{0}", literal(m.evidence))}${t("；")}${seen}`;
    }
    return t("模型在第 {0} 轮报告做完", m.turn);
}
/** The page. */
export function signoffPage(i) {
    const t = i.t ?? SAY_ZH;
    const { item, flow } = i;
    const p = itemProgress(item, flow);
    const steps = flow.states.filter((s) => !s.final);
    const done = item.status === "done" || p.whose === "done";
    const last = [...item.met].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0)).at(-1);
    const here = steps.find((s) => s.id === p.here);
    const status = done ? t("已完成") : item.status === "dropped" ? t("已放下") : item.status === "held" ? t("暂缓") : t("进行中");
    const out = [
        "=== meta",
        `title  = "${quoted(t("验收单 · #{0} {1}", item.id, item.title))}"`,
        `item   = "${quoted(item.id)}"`,
        `flow   = "${quoted(flow.title)}"`,
        `status = "${quoted(status)}"`,
        `opened = "${quoted(i.day(i.opened))}"`,
        ...(done && last !== undefined ? [`closed = "${quoted(i.day(last.at))}"`] : []),
        "===",
        "",
        `# ${t("结论")} {#verdict}`,
        "",
    ];
    const verdict = done
        ? t("已完成：{0} 步都过了。", steps.filter((s) => item.met.some((m) => m.step === s.id)).length)
        : item.status === "dropped" ? t("已放下。")
            : t("{0}：停在「{1}」。", status, literal(here?.title ?? item.state));
    out.push(`${verdict}${item.needs !== "" ? t("还记着：{0}", literal(item.needs)) : ""}`);
    if (item.goal !== "")
        out.push("", t("目标：{0}", literal(item.goal)));
    out.push("", `# ${t("每一步怎么过的")} {#steps}`, "", "=== table {#steps-table}", `| ${t("步骤")} | ${t("谁判")} | ${t("凭什么")} | ${t("时间")} |`, "|---|---|---|---|");
    for (const s of steps) {
        const m = item.met.find((x) => x.step === s.id);
        const cell = p.cells.find((c) => c.id === s.id)?.cell;
        const why = m !== undefined ? grounds(m, s.judge, t, i.clock) : cell === "skipped" ? t("跳过了") : t("还没过");
        out.push(`| ${literal(s.title)} | ${t(JUDGE_WORDS[s.judge])} | ${why} | ${m !== undefined ? i.clock(m.at) : ""} |`);
    }
    out.push("===", "", `# ${t("产物")} {#made}`, "");
    const made = [
        ...i.commits.map((c) => ({ at: c.at, row: `| ${literal(`${c.sha.slice(0, 7)} ${c.subject}`)} | ${t("提交")} | ${i.clock(c.at)} |` })),
        ...artifactsOfItem(i.artifacts, item.id).filter((a) => a.name !== i.self).map((a) => {
            const v = a.versions.at(-1);
            const kind = { link: "链接", doc: "文档", file: "文件", image: "图片" }[a.kind];
            const name = a.kind === "link" ? a.name : a.name.replace(/`/g, "").split(/[\\/]/).at(-1) ?? a.name;
            return { at: v.at, row: `| ${literal(name)}${v.version !== "" ? ` (${literal(v.version)})` : ""} | ${t(kind)} | ${i.clock(v.at)} |` };
        }),
    ].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
    out.push(...(made.length > 0
        ? ["=== table {#made-table}", `| ${t("产物")} | ${t("种类")} | ${t("时间")} |`, "|---|---|---|", ...made.map((x) => x.row), "==="]
        : [t("还没有产物。")]));
    out.push("", `# ${t("经过")} {#history}`, "", `- ${i.clock(i.opened)} ${t("开始，按「{0}」流程走", literal(flow.title))}`);
    for (const m of [...item.met].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0))) {
        const s = steps.find((x) => x.id === m.step);
        if (s !== undefined)
            out.push(`- ${i.clock(m.at)} ${t("过了「{0}」", literal(s.title))}`);
    }
    if (done && last !== undefined)
        out.push(`- ${i.clock(last.at)} ${t("已完成")}`);
    return `${out.join("\n")}\n`;
}
