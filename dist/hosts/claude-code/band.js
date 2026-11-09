import { TODO_CAP } from "./protocol.js";
import { ZH } from "./text.js";
/** Drawn, dim, between two segments. */
export const SEP = " · ";
/** Gemworks's red, for the current stage where a surface draws words. Nothing else is red. */
export const BRAND_RED = "#ef3b3f";
/** The violet of the mark's lower half: the mark where a surface draws no picture. */
export const MARK_VIOLET = "#8b5cf6";
/** The mark where a surface draws no picture (the terminal): Gemworks's one-character sign. */
export const MARK = { text: "»", tone: "mark" };
/** Gemworks's mark, the Prism Chevron: cyan over violet, a mint facet at each joint, for a surface that draws pictures. */
export const MARK_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="17.5 17 66 66"><polygon points="27,20 55,20 79,50 67,50 48,30 35,30 51,50 39,50 22,30 22,25" fill="#06b6d4"/><polygon points="27,80 55,80 79,50 67,50 48,70 35,70 51,50 39,50 22,70 22,75" fill="#8b5cf6"/><polygon points="39,50 45,42 51,50 45,58" fill="#67e8f9"/><polygon points="35,45 45,42 39,50" fill="#0ea5e9"/><polygon points="35,55 45,58 39,50" fill="#6366f1"/><polygon points="67,50 73,42 79,50 73,58" fill="#67e8f9"/><polygon points="63,45 73,42 67,50" fill="#0ea5e9"/><polygon points="63,55 73,58 67,50" fill="#6366f1"/></svg>';
const WIDE = [
    [0x1100, 0x115f], [0x2e80, 0x303e], [0x3041, 0x33ff], [0x3400, 0x4dbf], [0x4e00, 0x9fff], [0xa000, 0xa4cf],
    [0xac00, 0xd7a3], [0xf900, 0xfaff], [0xfe30, 0xfe4f], [0xff00, 0xff60], [0xffe0, 0xffe6],
    [0x1f300, 0x1f64f], [0x1f900, 0x1f9ff], [0x20000, 0x3fffd],
];
/** Terminal cells a string takes: East Asian wide and fullwidth characters two; joiners, combining marks and variation selectors none. */
export function cellWidth(text) {
    let width = 0;
    for (const ch of text) {
        const c = ch.codePointAt(0);
        if (c === 0x200d || (c >= 0x300 && c <= 0x36f) || (c >= 0xfe00 && c <= 0xfe0f))
            continue;
        width += WIDE.some(([a, b]) => c >= a && c <= b) ? 2 : 1;
    }
    return width;
}
/** At most `max` cells, ending in `…` when cut; never half of a wide character. */
export function truncate(text, max) {
    if (cellWidth(text) <= max)
        return text;
    if (max <= 0)
        return "";
    let out = "";
    let width = 0;
    for (const ch of text) {
        const w = cellWidth(ch);
        if (width + w > max - 1)
            break;
        out += ch;
        width += w;
    }
    return `${out}…`;
}
/** `text` broken into rows of at most `width` cells, at most `rows` of them, the last ending in "…" when some is left over. */
export function wrapCells(text, width, rows) {
    const out = [];
    let line = "";
    for (const c of text) {
        if (cellWidth(line + c) > width) {
            out.push(line);
            line = "";
        }
        line += c;
    }
    if (line !== "")
        out.push(line);
    if (out.length <= rows)
        return out;
    const kept = out.slice(0, rows);
    const last = kept[rows - 1];
    kept[rows - 1] = `${[...last].slice(0, Math.max(0, [...last].length - 1)).join("")}…`;
    return kept;
}
/** Whole segments while they fit in `columns`, separators counted; the first that does not is cut, the rest dropped. */
export function fitSegments(segments, columns) {
    const out = [];
    let used = 0;
    for (const s of segments) {
        const sep = out.length > 0 ? cellWidth(SEP) : 0;
        const width = cellWidth(s.text);
        if (used + sep + width <= columns) {
            out.push(s);
            used += sep + width;
            continue;
        }
        const room = columns - used - sep;
        if (room >= 2)
            out.push({ ...s, text: truncate(s.text, room) });
        break;
    }
    return out;
}
const TONE_COLOR = { normal: undefined, dim: undefined, success: "success", warning: "warning", error: "error", brand: BRAND_RED, mark: MARK_VIOLET };
/** A `Text`'s props for a tone: a theme color, the brand's red or the mark's violet in bold, or dim. */
export function toneProps(tone) {
    if (tone === "dim")
        return { dimColor: true };
    if (tone === "brand")
        return { color: BRAND_RED, bold: true };
    if (tone === "mark")
        return { color: MARK_VIOLET, bold: true };
    const color = TONE_COLOR[tone];
    return color !== undefined ? { color } : {};
}
/** Who takes a transition: a person, the machine when its guard holds, or the model (or a person) by hand. */
export const howText = (x, t = ZH) => (x.approval ? t("需批准") : x.judge === "machine" ? t("自动") : t("手动"));
/** The way on in the flow's words: the step it leads to, and its note or who takes it. */
export function wayOnText(x, t = ZH) {
    return `${t("下一步「{0}」", x.label)}${x.note !== "" ? `：${x.note}` : `${SEP}${howText(x, t)}`}`;
}
export function nextText(x, t = ZH) {
    const waiting = x.judge === "machine" && !x.holds && x.missing.length > 0 ? `${SEP}${t("待 {0}", x.missing.join(" "))}` : "";
    return `→ #${x.to} ${howText(x, t)}${waiting}`;
}
/** A variable as the band shows it: a boolean as ✓ or ✗, anything else as its value. */
export function varSegment(name, value) {
    if (typeof value === "boolean")
        return { text: `${name} ${value ? "✓" : "✗"}`, tone: value ? "success" : "dim" };
    return { text: `${name}=${JSON.stringify(value ?? null)}`, tone: "normal" };
}
/** A media work item's to-do count (spec §7.2), as the last refresh or board read it: display only; past the cap, `999+`. */
export function todoSegment(count, t = ZH) {
    if (count <= 0)
        return { text: t("无待办"), tone: "success" };
    return { text: t("待办 {0} 项", count > TODO_CAP ? `${TODO_CAP}+` : count), tone: "normal" };
}
/**
 * The band's words: the bridge's problem alone when there is one; else the
 * work item, its stage, its to-do count when it is a media entry, the
 * variables the next guards read, the next step and the warnings. `setup` — a
 * tool or command the session would not register — comes last, or alone when
 * there is no stage to show. `todo` counts only for the work item it names,
 * and only while that item is in the stage it was read in.
 */
export function bandSegments(shell, problem, setup = null, todo = null, t = ZH, show = { vars: true }) {
    if (problem !== null)
        return [{ text: problem, tone: "error" }];
    const tail = setup !== null ? [{ text: setup, tone: "error" }] : [];
    return [...stageSegments(shell, todo, t, show), ...tail];
}
function stageSegments(shell, todo, t, show) {
    // The band is there from the start: before the bridge has answered it says so.
    if (shell === null)
        return [{ text: t("启动中…"), tone: "dim" }];
    const s = shell.status;
    if (s === null) {
        if (shell.problem !== undefined && !shell.problem.quiet)
            return [{ text: `gemworks：${shell.problem.text}`, tone: "error" }];
        // No workflow of the project's own: the light flows are there; nothing is missing to say.
        return [];
    }
    if (s.item.kind === "inactive")
        return [{ text: `⧗ ${s.item.reason}`, tone: "dim" }];
    const out = [{ text: `⧗ ${s.item.id}`, tone: "normal" }];
    // A work item started under another workflow than the default names its own.
    if (s.workflow.default !== undefined)
        out.push({ text: t("流程 {0}", s.workflow.name), tone: "dim" });
    out.push({ text: s.state?.id ?? "?", tone: "normal" });
    if (s.paused) {
        out.push({ text: `${t("⏸ 已暂停")}${SEP}${t("阶段不变，照常记录")}`, tone: "warning" });
        return out;
    }
    if (todo !== null && todo.item === s.item.id && todo.state === s.state?.id)
        out.push(todoSegment(todo.count, t));
    if (show.vars)
        for (const name of shell.policy?.relevant ?? [])
            out.push(varSegment(name, s.vars[name]));
    const edge = s.next.find((x) => x.judge === "machine" && !x.approval) ?? s.next.find((x) => x.approval) ?? s.next[0];
    if (edge !== undefined)
        out.push({ text: nextText(edge, t), tone: "dim" });
    else if (s.state?.final === true)
        out.push({ text: t("✓ 完成"), tone: "success" });
    if (s.gh !== undefined && !s.gh.available)
        out.push({ text: t("git 证据不可用：{0}", s.gh.reason), tone: "warning" });
    return out;
}
/** The most options the band draws for its one thing. */
const BAND_OPTIONS = 3;
/**
 * The band (spec §8.1): the one thing that is the person's now, with its
 * options, then how many more wait. A broken bridge or a setup problem comes
 * first; a held item offers `继续`; with nothing waiting, what Claude is
 * working on and in which stage.
 */
export function bandView(o) {
    const { t } = o;
    const none = { verb: "", note: "", detail: "", actions: [], more: { count: 0, detail: "" } };
    const [first, ...rest] = o.inbox;
    const more = { count: rest.length, detail: rest.map((x) => `${x.verb ? `${x.verb} ` : ""}${x.title}`).join(SEP) };
    if (first?.kind === "broken")
        return { ...none, title: first.title, tone: "error", detail: first.detail.join(SEP), actions: first.actions.slice(0, BAND_OPTIONS), more };
    // A bridge problem the inbox has not taken up yet: its words, nothing to press into it.
    if (o.problem !== null)
        return { ...none, title: o.problem, tone: "error", more };
    if (o.setup !== null)
        return { ...none, title: o.setup, tone: "error", more };
    if (o.notice != null)
        return { ...none, title: o.notice.text, tone: o.notice.tone, more };
    const shell = o.shell;
    if (shell === null)
        return { ...none, title: t("启动中…"), tone: "dim" };
    const s = shell.status;
    // No workflow of the project's own is no missing flow: the light flows are always there, and the band names the work item on the way.
    if (s === null) {
        if (shell.problem !== undefined && !shell.problem.quiet)
            return { ...none, title: `gemworks：${shell.problem.text}`, tone: "error" };
        return { ...none, verb: t("我在做"), title: "", tone: "dim" };
    }
    if (s.item.kind === "inactive")
        return { ...none, title: s.item.reason, tone: "dim" };
    const name = s.title ?? s.item.id;
    if (s.paused)
        return { ...none, verb: t("已暂停"), title: name, tone: "warning", note: t("阶段不变，照常记录"), actions: [{ key: "resume", label: t("继续"), primary: true, action: { op: "resume" } }], more };
    if (first !== undefined) {
        return { verb: first.verb, title: first.title, tone: "normal", note: "", detail: first.detail.join(SEP), actions: first.actions.slice(0, BAND_OPTIONS), more };
    }
    const todo = o.todo !== null && o.todo.item === s.item.id && o.todo.state === s.state?.id ? todoSegment(o.todo.count, t).text : "";
    if (s.state?.final === true)
        return { ...none, title: name, tone: "normal", note: [t("✓ 完成"), todo].filter((x) => x !== "").join(SEP) };
    const waits = (s.depends ?? []).filter((d) => !d.done);
    const stage = [s.state?.title ?? "", waits.length > 0 ? t("等「{0}」完成", waits.map((d) => d.title ?? d.id).join("」「")) : ""].filter((x) => x !== "").join(SEP);
    const on = s.next.filter((x) => !x.toStart);
    const edge = on.find((x) => x.judge === "machine" && !x.approval) ?? on[0] ?? s.next[0];
    return {
        ...none, verb: t("我在做"), title: name, tone: "normal", note: [stage, todo].filter((x) => x !== "").join(SEP),
        detail: [stage, edge !== undefined ? wayOnText(edge, t) : ""].filter((x) => x !== "").join(SEP),
    };
}
