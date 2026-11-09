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
import { practicesAt, type Practice } from "./practices.js";
import type { ArtifactRow } from "./artifacts.js";
import { artifactsOfItem } from "./artifacts.js";
import type { Proposal } from "./growth.js";
import type { Judge } from "./progress.js";
import type { SharedDecision } from "./session-log.js";
import { itemProgress, type CoachFlow, type CoachState, type WorkItem } from "./work.js";

/** A question the last turn of a session ended with. */
export interface BoardAsk { question: string; options: readonly string[]; item?: string }

export interface BoardPageInput {
  /** The project's name: its folder's. */
  project: string;
  /** When the page was written, as the person reads it (`2026-11-09 16:50`). */
  updated: string;
  flows: readonly CoachFlow[];
  /** Every work item, newest first: the open and held ones are shown. */
  items: readonly WorkItem[];
  asks: readonly BoardAsk[];
  proposals: readonly Proposal[];
  practices: readonly Practice[];
  artifacts: readonly ArtifactRow[];
  /** The other sessions' decisions, oldest first. */
  decisions: readonly SharedDecision[];
  /** Where an artifact row's link goes, from the page's own folder; undefined for none. */
  linkOf: (row: ArtifactRow) => string | undefined;
  /** A time as the person reads it (`16:50`). */
  clock: (iso: string) => string;
  /** A host's name as the person reads it. */
  hostName: (host: string) => string;
}

/** The most rows of each part: a page is read at a glance. */
const SHOWN = { items: 12, artifacts: 5, decisions: 5 };

/** Text as GEML reads it literally: markup punctuation escaped, a line break a space. */
export function literal(text: string): string {
  return text.replace(/\s*\r?\n\s*/g, " ").replace(/[\\*`~$[\]|{}%!#<>_]/g, (c) => `\\${c}`);
}

/** A link's target as GEML reads it: no spaces or parentheses left bare. */
const target = (href: string): string => href.replace(/[ ()]/g, (c) => encodeURIComponent(c));

/** A Mermaid label: no double quote can close it. */
const label = (text: string): string => text.replace(/"/g, "'").replace(/[\r\n]+/g, " ");

const JUDGE_WORDS: Record<Judge, string> = { fact: "事实", you: "你判", model: "模型判" };

/** An item as a table names it. */
const named = (i: WorkItem): string => `\\#${i.id} ${literal(i.title)}`;

/** The steps of an item's flow, met ones ticked, the one it stands at in bold. */
function stepsLine(i: WorkItem, flow: CoachFlow): string {
  const p = itemProgress(i, flow);
  return flow.states.filter((s) => !s.final).map((s) => {
    const cell = p.cells.find((c) => c.id === s.id)?.cell;
    return cell === "here" ? `**${literal(s.title)}**` : cell === "met" ? `${literal(s.title)} ✓` : literal(s.title);
  }).join(" → ");
}

/** What to say for each answer: 「好了」或「没好」. */
const sayOne = (answers: readonly string[]): string => answers.map((a) => `「${literal(a)}」`).join("或");

/** The rows of 等你: the questions, the steps the person judges, the proposals. */
function waitingRows(i: BoardPageInput, open: readonly WorkItem[]): string[] {
  const rows: string[] = [];
  for (const q of i.asks) {
    const item = q.item !== undefined ? open.find((x) => x.id === q.item) : undefined;
    rows.push(`| ${item !== undefined ? named(item) : "提问"} | ${literal(q.question)} | ${sayOne(q.options)} |`);
  }
  for (const item of open) {
    const flow = i.flows.find((f) => f.name === item.flow);
    if (flow === undefined || item.status !== "open") continue;
    const p = itemProgress(item, flow);
    const step = flow.states.find((s) => s.id === p.here);
    if (p.whose !== "you" || step === undefined) continue;
    rows.push(`| ${named(item)} | ${literal(step.title)}：${literal(step.need)} | ${sayOne(step.answers ?? ["好了", "没好"])} |`);
  }
  for (const p of i.proposals.filter((x) => x.status === "open")) {
    const what = p.kind === "new-flow"
      ? `新的一类活「${literal(p.title ?? p.flow)}」：${(p.steps ?? []).map((s) => literal(s.title)).join(" → ")}`
      : p.kind === "add-step" ? `${literal(p.flow)} 加一步「${literal(p.step?.title ?? "")}」` : `${literal(p.flow)} 去掉「${literal(p.remove ?? "")}」`;
    const name = literal(p.title ?? p.step?.title ?? p.remove ?? p.flow);
    rows.push(`| 提议 ${p.id} | ${what}${p.why !== "" ? `（${literal(p.why)}）` : ""} | 「加上${name}」或「不用${name}」 |`);
  }
  return rows;
}

/** The part a table heads, or a line saying there is nothing. */
function table(head: string, rows: readonly string[], id: string, none: string): string[] {
  if (rows.length === 0) return [none];
  const cells = head.split("|").filter((c) => c.trim() !== "").length;
  return [`=== table {#${id}}`, head, `|${"---|".repeat(cells)}`, ...rows, "==="];
}

/** A flow with items on it, as a Mermaid picture: its steps in order, the ones an item stands at drawn heavier. */
function flowPicture(flow: CoachFlow, on: readonly WorkItem[]): string[] {
  const here = new Map<string, WorkItem[]>();
  for (const item of on) {
    const at = itemProgress(item, flow).here;
    if (at !== null) here.set(at, [...(here.get(at) ?? []), item]);
  }
  const node = (s: CoachState, n: number): string => s.final ? `s${n}(["${label(s.title)}"])` : `s${n}["${label(s.title)} · ${JUDGE_WORDS[s.judge]}"]${here.has(s.id) ? ":::here" : ""}`;
  const steps = [...flow.states.filter((s) => !s.final), ...flow.states.filter((s) => s.final)];
  const caption = [...here.entries()].map(([step, items]) => `${items.map((x) => `#${x.id}`).join("、")} 在${flow.states.find((s) => s.id === step)?.title ?? step}`).join("；");
  return [
    `=== diagram {#flow-${flow.name} format=mermaid caption="${label(`${flow.title}：${caption}`)}"}`,
    "graph LR",
    `  ${steps.map(node).join(" --> ")}`,
    "  classDef here stroke-width:3px",
    "===",
  ];
}

/** The page. */
export function boardPage(i: BoardPageInput): string {
  const open = i.items.filter((x) => x.status === "open" || x.status === "held").slice(0, SHOWN.items);
  const out: string[] = [
    "=== meta",
    `title = "${label(`Gemworks 看板 · ${i.project}`)}"`,
    `updated = "${label(i.updated)}"`,
    "===",
    "",
    "=== note",
    "Gemworks 每回合改写这一页。VS Code 系编辑器里打开预览会自动刷新；浏览器里按 F5 刷新。下面要你定的事，都在对话里回答。",
    "===",
    "",
    "# 等你 {#waiting}",
    "",
    ...table("| 事项 | 要你定 | 在对话里说 |", waitingRows(i, open), "asks", "没有要你定的事。"),
    "",
    "# 工作项 {#items}",
    "",
  ];
  const itemRows = open.flatMap((item) => {
    const flow = i.flows.find((f) => f.name === item.flow);
    if (flow === undefined) return [];
    const where = `${stepsLine(item, flow)}${item.status === "held" ? "（暂缓）" : ""}`;
    return [`| ${named(item)} | ${literal(flow.title)} | ${where} | ${literal(item.needs)} | ${literal(item.next)} |`];
  });
  out.push(...table("| 工作项 | 流程 | 在哪一步 | 还要什么 | 接下来 |", itemRows, "work", "没有进行中的工作项。"));
  // The practices of the step each item stands at: what the model is reminded of beside the person's prompt.
  const practiced = open.flatMap((item) => {
    const flow = i.flows.find((f) => f.name === item.flow);
    const here = flow !== undefined && item.status === "open" ? itemProgress(item, flow).here : null;
    const at = flow !== undefined && here !== null ? practicesAt(i.practices, flow.name, here) : [];
    if (flow === undefined || here === null || at.length === 0) return [];
    return ["", `${named(item)} 在「${literal(flow.states.find((s) => s.id === here)?.title ?? here)}」：`, "", ...at.map((p, n) => `${n + 1}. ${literal(p.text)}`)];
  });
  if (practiced.length > 0) out.push("", "## 这一步的做法 {#practices}", ...practiced);
  out.push("", "# 产物 {#made}", "");
  const made = open.flatMap((item) => artifactsOfItem(i.artifacts, item.id).slice(0, SHOWN.artifacts).map((a) => {
    const last = a.versions.at(-1) as ArtifactRow;
    // A file is named by its file's name: a path written outside the project is long and says little.
    const bare = a.name.replace(/`/g, "");
    const name = literal(a.kind === "link" ? bare : bare.split(/[\\/]/).at(-1) ?? bare);
    const href = i.linkOf(last);
    return `| ${named(item)} | ${href !== undefined ? `[${name}](${target(href)})` : name} | ${literal(last.version)} | ${i.clock(last.at)} |`;
  }));
  out.push(...table("| 工作项 | 产物 | 版本 | 时间 |", made, "artifacts", "还没有产物。"));
  out.push("", "# 流程 {#flow}", "");
  const pictured = i.flows.flatMap((flow) => {
    const on = open.filter((x) => x.flow === flow.name && x.status === "open");
    return on.length > 0 ? [...flowPicture(flow, on), ""] : [];
  });
  out.push(...(pictured.length > 0 ? pictured.slice(0, -1) : ["没有工作项在流程上。"]));
  const decided = i.decisions.slice(-SHOWN.decisions).reverse();
  out.push("", "# 别的会话的决定 {#decisions}", "");
  out.push(...(decided.length > 0 ? decided.map((d) => `- ${literal(d.text)}（${literal(i.hostName(d.host))}，${i.clock(d.at)}）`) : ["还没有。"]));
  return `${out.join("\n")}\n`;
}
