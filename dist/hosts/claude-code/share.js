/** The most artifacts the text names. */
const ARTIFACTS_NAMED = 3;
/**
 * Where the work stands, in a few lines: the work item, its flow and stage;
 * the first thing to decide and the first to accept, with how many more
 * wait; its latest commits. Empty with no work item.
 */
export function statusShareText(shell, pending, artifacts, t) {
    const s = shell?.status;
    if (!s || s.item.kind !== "item" || s.state === undefined)
        return "";
    const lines = [`${s.title ?? s.item.id} · ${s.workflow.title} · ${s.state.title}${s.paused ? ` · ${t("已暂停")}` : ""}`];
    const deciding = pending.filter((i) => i.kind !== "approve" || i.closes !== true);
    const accepting = pending.filter((i) => i.kind === "approve" && i.closes === true);
    if (deciding[0] !== undefined)
        lines.push(`${t("需决定：{0}", deciding[0].title)}${deciding.length > 1 ? t("（还有 {0} 件）", deciding.length - 1) : ""}`);
    if (accepting[0] !== undefined)
        lines.push(`${t("需验收：{0}", accepting[0].title)}${accepting.length > 1 ? t("（还有 {0} 件）", accepting.length - 1) : ""}`);
    const made = (artifacts?.commits ?? []).filter((c) => c.ours).slice(0, ARTIFACTS_NAMED).map((c) => c.sha.slice(0, 8));
    if (made.length > 0)
        lines.push(t("最近产物：{0}", made.join(" · ")));
    return lines.join("\n");
}
