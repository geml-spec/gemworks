// The coach: the light flows a work item goes through — 新设计, 新功能, bugfix,
// 优化 — each its own statechart whose steps say who judges their leave
// requirement and what they prevent; the work items the model reports with the
// work tool at a turn's end (the steps met) and the person sets with a press,
// merged from every session's log; where each stands, worked out from the steps
// met (progress.ts); and what the board and the band draw of them: a row per
// work item on the work items tab, a picture per flow with items on it on the
// flow tab, a line for the band. A flow file is a `geml-statechart/v1`
// document; its diagram block's JSON is read here as it stands (the bridge's
// loader checks it). Pure.
import { progressOf, type Cell, type Judge, type Progress } from "../../core/progress.js";
import type { ItemStatus, MetStep, SessionEvent, SessionSummary, SessionTurn, TurnMove } from "../../core/session-log.js";
import { isNew, type Practice } from "../../core/practices.js";
import type { LedgerCard, PracticeCount, Quote } from "../../core/corrections.js";
import type { Asked } from "../../core/ask-tool.js";
import type { Pressable } from "./actions.js";
import type { BoardRow } from "./board.js";
import type { T } from "./text.js";
import { hhmm } from "./time.js";
import { madePress } from "./made.js";
import type { MadeAllEntry } from "./protocol.js";
import type { Proposal, Rule } from "./growth.js";

/** The light flows, by file name: the bundled `coach/<name>.geml`, or the project's own `.geml/coach/<name>.geml`. */
export const COACH_FLOWS = ["design", "feature", "bugfix", "optimize"] as const;

/**
 * A state: its words, what it needs to be left (its `description`), who judges that, what the step prevents, and for a
 * step the person judges the two words of its buttons (null: 好了 / 没好).
 */
export interface CoachState { id: string; title: string; need: string; final: boolean; judge: Judge; prevents: string; answers: readonly [string, string] | null; expires?: boolean }
/** A way between states; `back` when it does not go on to the next state in order (a way back, drawn dashed). */
export interface CoachEdge { from: string; to: string; label: string; back: boolean }
/** A flow: its name (the file's), its title, its states and ways; `diff` how a project's own flow differs from the shipped one, by step titles. */
export interface CoachFlow { name: string; title: string; states: CoachState[]; edges: CoachEdge[]; diff?: { added: string[]; removed: string[] } }

export type ItemEvent = Extract<SessionEvent, { t: "item" }>;

/** A work item as it stands: the newest event of its id, from whichever session reported it; `met` the steps met, `next` what the model will do next. */
export interface WorkItem { id: string; flow: string; title: string; state: string; needs: string; goal: string; status: ItemStatus; at: string; session: string; met: MetStep[]; next: string }

/** Where the board looks when a work item's arrow is pressed: its flow first, the item marked. */
export interface CoachFocus { flow: string; id: string }

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === "string" ? v : "");

const JUDGES: readonly Judge[] = ["fact", "you", "model"];
const pair = (v: unknown): readonly [string, string] | null =>
  Array.isArray(v) && v.length === 2 && typeof v[0] === "string" && typeof v[1] === "string" && v[0] !== "" && v[1] !== "" ? [v[0], v[1]] : null;

/**
 * A flow file read: its states in their order, its ways; undefined for a file with no statechart diagram in it. A state
 * that does not say who judges it, what it prevents or its buttons' words takes them from `reference`'s state of the
 * same id (a project's own flow, from the one the plugin ships); a state with neither is the model's to judge.
 */
export function readCoachFlow(name: string, text: string, reference?: CoachFlow): CoachFlow | undefined {
  const lines = text.split(/\r?\n/);
  const open = lines.findIndex((l) => /^===\s*diagram\b/.test(l.trim()) && l.includes("format=geml-statechart"));
  if (open < 0) return undefined;
  const close = lines.findIndex((l, i) => i > open && l.trim() === "===");
  let v: unknown;
  try { v = JSON.parse(lines.slice(open + 1, close < 0 ? undefined : close).join("\n")); } catch { return undefined; }
  if (!isObject(v) || !isObject(v["states"])) return undefined;
  const states: CoachState[] = Object.entries(v["states"]).flatMap(([id, s]) => {
    if (!isObject(s)) return [];
    const ref = reference?.states.find((r) => r.id === id);
    const judge = JUDGES.find((j) => j === s["judge"]) ?? ref?.judge ?? "model";
    const expires = s["expires"] === true || (s["expires"] === undefined && ref?.expires === true);
    return [{ id, title: str(s["title"]) || id, need: str(s["description"]), final: s["final"] === true, judge, prevents: str(s["prevents"]) || ref?.prevents || "", answers: pair(s["answers"]) ?? ref?.answers ?? null, ...(expires ? { expires: true } : {}) }];
  });
  if (states.length === 0) return undefined;
  const at = (id: string): number => states.findIndex((s) => s.id === id);
  const edges: CoachEdge[] = (Array.isArray(v["transitions"]) ? v["transitions"] : []).flatMap((x) => {
    if (!isObject(x) || at(str(x["from"])) < 0 || at(str(x["to"])) < 0) return [];
    const from = str(x["from"]);
    const to = str(x["to"]);
    return [{ from, to, label: str(x["label"]) || str(x["guard"]), back: at(to) !== at(from) + 1 }];
  });
  const title = text.match(/^title\s*=\s*"([^"]*)"/m)?.[1] ?? lines[open]?.match(/caption="([^"]*)"/)?.[1] ?? name;
  const diff = reference !== undefined
    ? { added: states.filter((s) => !s.final && !reference.states.some((r) => r.id === s.id)).map((s) => s.title), removed: reference.states.filter((r) => !r.final && !states.some((s) => s.id === r.id)).map((r) => r.title) }
    : undefined;
  return { name, title, states, edges, ...(diff !== undefined ? { diff } : {}) };
}

/**
 * The steps an event has met: the ones it names, or for an event that names only the state it stood in (written before
 * steps were met), every step before that state — every step, when that state is final.
 */
export function metOf(e: Pick<ItemEvent, "state" | "met" | "at" | "turn">, flow: CoachFlow | undefined): MetStep[] {
  if (e.met !== undefined) return e.met;
  if (flow === undefined) return [];
  const at = flow.states.findIndex((s) => s.id === e.state);
  if (at < 0) return [];
  const done = (flow.states[at] as CoachState).final;
  return flow.states.filter((s, i) => !s.final && (done || i < at)).map((s) => ({ step: s.id, at: e.at, turn: e.turn }));
}

/** Where an item stands on its flow (progress.ts); `running` the fact steps a check is under way for. */
export function itemProgress(item: Pick<WorkItem, "met">, flow: CoachFlow, running?: ReadonlySet<string>): Progress {
  return progressOf(flow.states, new Set(item.met.map((m) => m.step)), running);
}

/** The id a finished item stands at: its flow's final state. */
const finalOf = (flow: CoachFlow): string => (flow.states.find((s) => s.final) ?? (flow.states.at(-1) as CoachState)).id;

/** The work items the sessions reported, the newest event of each id, newest first; the steps an older event met read from its state. */
export function workItemsOf(sessions: readonly SessionSummary[], flows: readonly CoachFlow[] = []): WorkItem[] {
  const by = new Map<string, WorkItem>();
  for (const s of sessions) {
    for (const e of s.items ?? []) {
      const was = by.get(e.id);
      if (was !== undefined && was.at >= e.at) continue;
      const met = metOf(e, flows.find((f) => f.name === e.flow));
      by.set(e.id, { id: e.id, flow: e.flow, title: e.title, state: e.state, needs: e.needs, goal: e.goal, status: e.status, at: e.at, session: s.id, met, next: e.next ?? "" });
    }
  }
  return [...by.values()].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}

/** The tool the model reports a turn's work items with. */
export const WORK_TOOL = {
  name: "work",
  description: "Report, before the turn ends, the work items this turn was about, so the board shows the person where each stands: each a thing the person wants done (a new design, a new feature, a bugfix, an optimization), the flow that fits it, every step whose leave requirement is met now (where it stands follows from them, so steps may be skipped), what it still needs, what you will do next, and what it should be at the end. Update an item on the way by its id (listed beside the person's prompt); report a new one without an id. One turn may be about several items; a turn about none reports nothing.",
  inputSchema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string", description: "An item already on the way, by its id; leave it out for a new one." },
            title: { type: "string", description: "What the item is, in a few words of the person's language." },
            flow: { type: "string", description: "The flow it belongs to, by its name: design 新设计, feature 新功能, bugfix, optimize 优化, or one the project added (the flows are listed once)." },
            met: { type: "array", items: { type: "string" }, description: "Every step whose leave requirement is met now, by the id or title the flow lists; a way back is the same list with the later steps left out. Leave it out on an update to keep what was met." },
            said: { type: "string", description: "The person's own words, this turn, that meet a step they judge (marked you), e.g. 「好了」. Needed when met newly names such a step; without their words leave the step for their press." },
            next: { type: "string", description: "What you will do next for it: one short sentence in the person's language, as it would follow 「接下来我去」." },
            needs: { type: "string", description: "What it still needs to leave the step it stands at: one short phrase, in the person's language." },
            goal: { type: "string", description: "What it should be at the end: one short sentence, in the person's language." },
            status: { type: "string", enum: ["open", "done", "dropped"], description: "done once the person said it is; dropped when given up. Default open." },
          },
          required: ["title", "flow"],
          additionalProperties: false,
        },
      },
    },
    required: ["items"],
    additionalProperties: false,
  },
} as const;

/** What the model is told when a turn that changed things ends with no work item reported: once, then the turn ends. */
export const WORK_REMINDER = "Gemworks: this turn changed things but reported no work item. Before ending, call the gemworks `work` tool with the work items this turn was about (update one on the way by its id, report a new one without), then end the turn.";

/** What the model is told once about the work tool, with the flows' states. */
export function workPrompt(flows: readonly CoachFlow[]): string {
  const listed = flows.map((f) => `${f.name} ${f.title}: ${f.states.filter((s) => !s.final).map((s) => `${s.id} ${s.title} (${s.judge})`).join(" → ")}`).join("; ");
  return `Gemworks: before a turn ends, report the work items it was about with the gemworks \`work\` tool: the flow each belongs to, every step whose leave requirement is met now (\`met\`), what it still needs, what you will do next, what it should be at the end; update one on the way by its id. A step marked (you) is the person's to judge: name it in \`met\` only with their own words in \`said\`, else leave it for their press. The flows: ${listed}.`;
}

/** The line beside a prompt: the work items on the way, by id, so the model updates them rather than reporting them anew. */
export function workContext(items: readonly WorkItem[], flows: readonly CoachFlow[], limit = 8): string[] {
  const open = items.filter((i) => i.status === "open").slice(0, limit);
  if (open.length === 0) return [];
  const where = (i: WorkItem): string => {
    const flow = flows.find((f) => f.name === i.flow);
    const here = flow !== undefined ? itemProgress(i, flow).here ?? i.state : i.state;
    const met = i.met.length > 0 ? `met ${i.met.map((m) => m.step).join(", ")}; ` : "";
    return `${met}at ${here} ${flow?.states.find((s) => s.id === here)?.title ?? ""}`.trimEnd();
  };
  return [`[gemworks] work items on the way: ${open.map((i) => `#${i.id} «${i.title}» (${i.flow}: ${where(i)}${i.needs !== "" ? `, needs ${i.needs}` : ""})`).join("; ")}`];
}

/**
 * The tool's items checked against the flows and the items on the way: the
 * events to write and what was wrong with the rest. A step may be named by its
 * id or its title; `met` lists every step met now (left out, an update keeps
 * what was met; an older caller's `state` meets every step before it). A step
 * the person judges, newly met, needs their words in `said`. Every step met, or
 * a final one named, finishes the item; an id must be one on the way. `newId`
 * names a new item.
 */
export function workEvents(args: Record<string, unknown>, flows: readonly CoachFlow[], items: readonly WorkItem[], at: string, turn: number, newId: (n: number) => string): { events: ItemEvent[]; errors: string[] } {
  const given = Array.isArray(args["items"]) ? args["items"] : [];
  const events: ItemEvent[] = [];
  const errors: string[] = [];
  given.forEach((x, n) => {
    if (!isObject(x)) { errors.push(`item ${n + 1} is not an object`); return; }
    const flow = flows.find((f) => f.name === str(x["flow"]));
    if (flow === undefined) { errors.push(`item ${n + 1}: flow must be one of ${flows.map((f) => f.name).join(", ")}`); return; }
    const stepNamed = (name: string): CoachState | undefined => flow.states.find((s) => s.id === name) ?? flow.states.find((s) => s.title === name);
    const ids = flow.states.map((s) => s.id).join(", ");
    const id = str(x["id"]).replace(/^#/, "");
    const was = id !== "" ? items.find((i) => i.id === id) : undefined;
    if (id !== "" && was === undefined) { errors.push(`item ${n + 1}: no work item #${id} is on the way`); return; }
    let named: CoachState[] | undefined;
    if (Array.isArray(x["met"])) {
      const unknown = x["met"].find((m) => stepNamed(str(m)) === undefined);
      if (unknown !== undefined) { errors.push(`item ${n + 1}: ${flow.name} has no step "${str(unknown)}" (${ids})`); return; }
      const steps = x["met"].map((m) => stepNamed(str(m)) as CoachState);
      named = steps.some((s) => s.final) ? flow.states.filter((s) => !s.final) : steps;
    } else if (str(x["state"]) !== "") {
      const state = stepNamed(str(x["state"]));
      if (state === undefined) { errors.push(`item ${n + 1}: ${flow.name} has no state "${str(x["state"])}" (${ids})`); return; }
      const upTo = flow.states.indexOf(state);
      named = flow.states.filter((s, i) => !s.final && (state.final || i < upTo));
    }
    const title = str(x["title"]).trim() || was?.title || "";
    if (title === "") { errors.push(`item ${n + 1} has no title`); return; }
    const before = was?.met ?? [];
    const metIds = [...new Set(named !== undefined ? named.map((s) => s.id) : before.map((m) => m.step))];
    const said = str(x["said"]).trim();
    const theirs = metIds.map((s) => stepNamed(s) as CoachState).filter((s) => s.judge === "you" && !before.some((m) => m.step === s.id));
    if (theirs.length > 0 && said === "") { errors.push(`item ${n + 1}: ${theirs.map((s) => s.title).join("、")} is the person's to meet: put what they said in \`said\`, or leave it for their press`); return; }
    const met = metIds.map((s) => before.find((m) => m.step === s) ?? { step: s, at, turn, ...(theirs.some((t) => t.id === s) ? { said } : {}) });
    const p = itemProgress({ met }, flow);
    const status = p.whose === "done" ? "done" : x["status"] === "done" || x["status"] === "dropped" ? x["status"] : was?.status === "held" ? "held" : "open";
    const next = typeof x["next"] === "string" ? x["next"].trim() : was?.next ?? "";
    events.push({
      t: "item", turn, at, id: was?.id ?? newId(n), flow: flow.name, title, state: p.here ?? finalOf(flow),
      needs: typeof x["needs"] === "string" ? x["needs"].trim() : was?.needs ?? "", goal: typeof x["goal"] === "string" ? x["goal"].trim() : was?.goal ?? "", status,
      met, ...(next !== "" ? { next } : {}),
    });
  });
  return { events, errors };
}

/**
 * A press on a step the person judges: `yes` meets it; no takes the item back
 * the way the step's first way back goes (every step from there on unmet), or
 * unmeets the step itself where it has none.
 */
export function pressEvent(item: WorkItem, flow: CoachFlow, step: string, yes: boolean, at: string, turn: number): ItemEvent {
  const order = flow.states.map((s) => s.id);
  const back = flow.edges.find((e) => e.from === step && e.back);
  const from = order.indexOf(back?.to ?? step);
  const met = yes ? [...item.met.filter((m) => m.step !== step), { step, at, turn, pressed: true }] : item.met.filter((m) => order.indexOf(m.step) < from);
  const p = itemProgress({ met }, flow);
  return {
    t: "item", turn, at, id: item.id, flow: item.flow, title: item.title, state: p.here ?? finalOf(flow), needs: item.needs, goal: item.goal,
    status: p.whose === "done" ? "done" : item.status === "held" ? "held" : "open", met, ...(item.next !== "" ? { next: item.next } : {}),
  };
}

/** The person putting an item aside, or taking it up again: the item as it stands, with that status. */
export function holdEvent(item: WorkItem, held: boolean, at: string, turn: number): ItemEvent {
  return { t: "item", turn, at, id: item.id, flow: item.flow, title: item.title, state: item.state, needs: item.needs, goal: item.goal, status: held ? "held" : "open", met: item.met, ...(item.next !== "" ? { next: item.next } : {}) };
}

/**
 * A question the person has not answered, as a card: its answers its buttons, the recommended first; a press says
 * "question：answer", the band's own words for it, so the turn and the record take it as the band's press.
 */
function askCard(q: Asked, k: number, t: T): BoardRow {
  const actions = q.options.map((label, i): Pressable => ({ key: `ask-${k}-${i}`, label, ...(i === 0 ? { primary: true as const } : {}), action: { op: "say", text: `${q.question}：${label}`, decisions: [`${q.question}：${label}`] } }));
  return { kind: "card", key: `ask-${k}`, icon: "ask", verb: t("定"), title: q.question, detail: [], actions };
}

/** The work items tab's groups: whose turn it is, and the items the person put aside. */
export type WorkGroup = "you" | "me" | "wait" | "held";

/** How many items a group lists before the rest wait behind its heading's press. */
export const WORK_SHOWN = 12;

/** A step as one mark and its title, for a surface that draws no chips: ✓ met, ▸ stands here, · ahead, ⚠ skipped. */
export function stripText(cells: readonly { title: string; cell: Cell }[]): string {
  const mark: Record<Cell, string> = { met: "✓", here: "▸", ahead: "·", skipped: "⚠" };
  return cells.map((c) => `${mark[c.cell]}${c.title}`).join(" ");
}

export interface WorkRowsOptions {
  /** The questions the person has not answered. */
  asks?: readonly Asked[];
  /** This session's id: a step offered for another session's item only says where it is done. */
  own?: string;
  /** The fact steps a check is under way for, by item id. */
  running?: ReadonlyMap<string, ReadonlySet<string>>;
  /** The groups listed whole. */
  open?: readonly WorkGroup[];
  /** The item unfolded under its row, and the sessions its history is read from. */
  unfolded?: string | null;
  sessions?: readonly SessionSummary[];
  /** The 好，做吧 the person pressed, still on their way. */
  gone?: readonly GoneOn[];
  /** The item the person's own turn took up, while that turn runs. */
  doing?: Doing | null;
  /** Every artifact the project's work made: each row's press to its own on the 产物 tab says how many. */
  made?: readonly MadeAllEntry[];
}

/**
 * A 好，做吧 the person pressed: the item, the next step it said and the item's record it was pressed on, the turn ends
 * to wait for before its own turn starts (1 when a turn was running, 0 when the session was idle), and the ends since.
 */
export interface GoneOn { id: string; next: string; at: string; wait: number; ends: number }

/**
 * What a pressed 好，做吧 shows in place of its button while the item stands as it was pressed: 排队中 behind the turn
 * that was running, 进行中 until its own turn ends. Nothing once that turn has ended, or once the item was reported
 * again (its record changed): the button is offered again if a next step still is.
 */
export function goneOnNote(i: WorkItem, gone: readonly GoneOn[] | undefined, t: T): string | undefined {
  const g = (gone ?? []).find((x) => x.id === i.id && x.next === i.next && x.at === i.at);
  if (g === undefined || g.ends > g.wait) return undefined;
  return g.ends < g.wait ? t("排队中 {0}", i.next) : t("进行中 {0}", i.next);
}

/** The presses still on their way after a turn ended: each counts the end, and leaves once its own turn has ended. */
export function goneOnAfterTurn(gone: readonly GoneOn[]): GoneOn[] {
  return gone.map((g) => ({ ...g, ends: g.ends + 1 })).filter((g) => g.ends <= g.wait);
}

/** The work item a turn of this session is about: its last on the way (the one whose step's practices go beside the prompt). */
export function turnItem(items: readonly WorkItem[], session: string): WorkItem | undefined {
  return items.find((x) => x.status === "open" && x.session === session);
}

/** The item the person's own turn took up, as its record stood when the turn started. */
export interface Doing { id: string; next: string; at: string }

/**
 * What the item the person's own turn took up shows in place of 好，做吧 while that turn runs: 我在做. Nothing once the
 * item was reported again (its record changed): what it says next is for after this turn.
 */
export function doingNote(i: WorkItem, doing: Doing | null | undefined, t: T): string | undefined {
  return doing != null && doing.id === i.id && doing.next === i.next && doing.at === i.at ? t("我在做：{0}", i.next) : undefined;
}

/**
 * The work items tab's rows: the questions waiting on the person that belong to no item on the way (等你定), then the
 * items by whose turn it is — 等你, 我来, 等结果 — and those put aside (已暂缓, folded). Each item's row: its flow, its
 * steps as cells (met, here, ahead, skipped), what it needs or what comes next, the presses that are the person's (a
 * step they judge: its two words; the model's next step: 好，做吧 and 暂缓处理), and the arrow to its flow; the
 * questions about it under it. A group lists its first WORK_SHOWN items until its heading's press lists it whole.
 */
export function workRows(items: readonly WorkItem[], flows: readonly CoachFlow[], t: T, o: WorkRowsOptions = {}): BoardRow[] {
  const asks = o.asks ?? [];
  const shown = items.filter((i) => i.status === "open" || i.status === "held");
  const loose = asks.filter((q) => q.item === undefined || !shown.some((i) => i.id === q.item));
  const rows: BoardRow[] = loose.length > 0 ? [{ kind: "section", key: "asks", text: t("等你定"), count: loose.length }, ...loose.map((q) => askCard(q, asks.indexOf(q), t))] : [];
  const placed = shown.map((i) => {
    const flow = flows.find((f) => f.name === i.flow);
    const p = flow !== undefined ? itemProgress(i, flow, o.running?.get(i.id)) : undefined;
    const group: WorkGroup = i.status === "held" ? "held" : p === undefined || p.whose === "done" ? "me" : p.whose;
    return { i, flow, p, group };
  });
  const heading: Record<WorkGroup, string> = { you: t("等你"), me: t("我来"), wait: t("等结果"), held: t("已暂缓") };
  for (const group of ["you", "me", "wait", "held"] as const) {
    const all = placed.filter((x) => x.group === group);
    if (all.length === 0) continue;
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
      const actions: Pressable[] = [];
      let detail = i.needs !== "" ? t("还差：{0}", i.needs) : here !== undefined && here.need !== "" ? t("还差：{0}", here.need) : "";
      if (group === "held") {
        actions.push({ key: `work-unhold-${i.id}`, label: t("取消暂缓"), action: { op: "work-hold", id: i.id, held: false } });
      } else if (group === "you" && here !== undefined) {
        const [yes, no] = here.answers ?? [t("好了"), t("没好")];
        actions.push(
          { key: `work-yes-${i.id}`, label: yes, primary: true, action: { op: "work-meet", id: i.id, step: here.id, yes: true, label: yes } },
          { key: `work-no-${i.id}`, label: no, action: { op: "work-meet", id: i.id, step: here.id, yes: false, label: no } },
        );
      } else if (group === "me") {
        if (i.next !== "") {
          // Pressed already, or the turn running is on it: what became of it, not the button again.
          const pressed = goneOnNote(i, o.gone, t) ?? doingNote(i, o.doing, t);
          detail = pressed ?? t("接下来我去：{0}", i.next);
          if (elsewhere) detail = `${detail} · ${t("在别的会话里")}`;
          else if (pressed === undefined) actions.push({ key: `work-go-on-${i.id}`, label: t("好，做吧"), primary: true, action: { op: "work-go-on", id: i.id, next: i.next, at: i.at } });
        }
        actions.push({ key: `work-hold-${i.id}`, label: t("暂缓处理"), action: { op: "work-hold", id: i.id, held: true } });
      }
      const cells = flow !== undefined && p !== undefined ? p.cells.map((c) => ({ title: (flow.states.find((s) => s.id === c.id) as CoachState).title, cell: c.cell })) : [];
      const unfolded = o.unfolded === i.id;
      const go: Pressable = { key: `work-go-${i.id}`, label: t("看流程"), action: { op: "coach-go", flow: i.flow, id: i.id } };
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
        if (history.length > shownNow.length) rows.push({ kind: "text", text: t("…再往前 {0} 条", history.length - shownNow.length), tone: "dim" });
        for (const h of shownNow) rows.push({ kind: "text", text: `${hhmm(h.at)}  ${h.text}`, tone: "dim" });
        if (history.length === 0) rows.push({ kind: "text", text: t("还没有经过"), tone: "dim" });
        if (i.goal !== "") rows.push({ kind: "text", text: t("最后：{0}", i.goal), tone: "dim" });
        rows.push({ kind: "buttons", items: [{ key: `work-prompts-${i.id}`, label: t("看这件的提示词"), action: { op: "session-item", id: i.id } }, go] });
      }
    }
  }
  return rows;
}

const stepTitle = (flows: readonly CoachFlow[], flow: string, id: string): string => flows.find((f) => f.name === flow)?.states.find((s) => s.id === id)?.title ?? id;

/** How a step was met in words: by the person's words, by their press, or as is. */
function metWords(m: MetStep, title: string, t: T): string {
  return m.said !== undefined ? t("✓{0} · 你说「{1}」", title, m.said) : m.pressed === true ? t("✓{0} · 你按的", title) : `✓${title}`;
}

/** A move of a work item in words: the steps met, else where it went (a way back), else how it ended or was put aside. */
function moveWords(mv: TurnMove, flows: readonly CoachFlow[], t: T): string {
  if (mv.status === "held") return t("已暂缓");
  if (mv.status === "dropped") return t("放下");
  if (mv.met.length > 0) return mv.met.map((m) => metWords(m, stepTitle(flows, mv.flow, m.step), t)).join(" ");
  return mv.status === "done" ? t("完成") : t("到「{0}」", stepTitle(flows, mv.flow, mv.state));
}

/** What a turn did, in words for the sessions tab: each work item it moved and how, each decision, each practice it learned. */
export function turnWords(turn: SessionTurn, flows: readonly CoachFlow[], learned: readonly Practice[], t: T): string[] {
  return [
    ...(turn.moved ?? []).map((mv) => `→ ${mv.title} ${moveWords(mv, flows, t)}`),
    ...turn.decisions.map((d) => t("定：{0}", d)),
    ...learned.map((x) => t("新学到：{0}", x.text)),
  ];
}

/** A work item's history, oldest first, across every session: each turn that moved it — how, and what that turn decided. */
export function itemHistory(id: string, sessions: readonly SessionSummary[], flows: readonly CoachFlow[], t: T): { at: string; text: string }[] {
  const out: { at: string; text: string }[] = [];
  for (const s of sessions) {
    for (const turn of s.turns) {
      const mv = (turn.moved ?? []).find((x) => x.id === id);
      if (mv === undefined) continue;
      out.push({ at: mv.at, text: moveWords(mv, flows, t) });
      for (const d of turn.decisions) out.push({ at: mv.at, text: t("定：{0}", d) });
    }
  }
  return out.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
}

/** How many entries of a work item's history its row lists when unfolded, the newest. */
export const HISTORY_SHOWN = 8;

/** The flow tab's options: the work item whose arrow was pressed, the flows whose practices are listed (null: the first flow's), now. */
export interface ManualOptions { focus: CoachFocus | null; expanded: readonly string[] | null; now?: string; proposals?: readonly Proposal[]; rules?: readonly Rule[]; skipped?: readonly { flow: string; step: string; skipped: number }[]; ledger?: { cards: readonly LedgerCard[]; counts: Readonly<Record<string, PracticeCount>> } }

/** A practice as a row: what to do, where it came from, its tag (新学到, 从记忆搬来, 团队), and the presses the person has on it. */
function practiceRow(p: Practice, t: T, now: string | undefined, count?: PracticeCount): BoardRow {
  const fresh = now !== undefined && isNew(p, now);
  const tag = p.layer === "team" ? t("团队") : fresh ? t("新学到") : p.by === "memory" ? t("从记忆搬来") : "";
  const actions: Pressable[] = p.layer === "team" ? [] : [
    { key: `practice-layer-${p.id}`, label: p.layer === "personal" ? t("个人") : t("项目"), action: { op: "practice-layer", id: p.id, layer: p.layer === "personal" ? "project" : "personal" } },
    ...(fresh || p.by === "memory" ? [{ key: `practice-delete-${p.id}`, label: "×", action: { op: "practice-delete" as const, id: p.id } }] : []),
    // Only a practice on a step can hold calls until that step is met: those get 改成规定.
    ...(p.flow !== "*" && p.step !== "*" ? [{ key: `practice-rule-${p.id}`, label: t("改成规定"), action: { op: "practice-rule" as const, id: p.id } }] : []),
    // Shared: a step's practice into the team's file in the repository; one for every time, into CLAUDE.md (read every turn), shown to the person first.
    p.flow !== "*" ? { key: `practice-share-${p.id}`, label: t("分享给团队"), action: { op: "practice-share" as const, id: p.id } } : { key: `practice-claude-${p.id}`, label: t("写进 CLAUDE.md"), action: { op: "practice-claude-md" as const, id: p.id } },
  ];
  return {
    kind: "practice", key: `practice-${p.id}`, text: p.text, why: [p.why, p.ref ?? ""].filter((x) => x !== "").join(" · "), tag, fresh, actions,
    ...(count !== undefined && count.before + count.after > 0 ? { count: { text: t("纠正 {0} → {1}", count.before, count.after), held: count.after === 0 } } : {}),
  };
}

/** The corrections a card quotes, one line a day: `10-28「…」「…」`. */
function quoteLines(quotes: readonly Quote[]): string[] {
  const days = new Map<string, string[]>();
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
export function ledgerCardRows(cards: readonly LedgerCard[], flows: readonly CoachFlow[], t: T): BoardRow[] {
  const stepTitle = (flow: string, step: string): string => flows.find((f) => f.name === flow)?.states.find((s) => s.id === step)?.title ?? step;
  return cards.map((c): BoardRow => {
    const away = (label: string): Pressable => ({ key: `ledger-away-${c.key}`, label, action: { op: "ledger-dismiss", key: c.key, n: c.n } });
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
export function manualRows(items: readonly WorkItem[], flows: readonly CoachFlow[], practices: readonly Practice[], t: T, o: ManualOptions): BoardRow[] {
  const live = practices.filter((p) => p.deleted !== true);
  const open = items.filter((i) => i.status === "open");
  const latest = (f: CoachFlow): string => open.filter((i) => i.flow === f.name).reduce((m, i) => (i.at > m ? i.at : m), "");
  const focused = o.focus !== null ? open.find((i) => i.id === o.focus?.id) : undefined;
  const busy = flows.filter((f) => latest(f) !== "").sort((a, b) => (o.focus?.flow === a.name ? -1 : o.focus?.flow === b.name ? 1 : latest(a) < latest(b) ? 1 : -1));
  const expanded = o.expanded ?? [busy[0]?.name ?? ""];
  const shown = [...busy, ...flows.filter((f) => latest(f) === "" && expanded.includes(f.name))];
  const judgeWords: Record<Judge, string> = { fact: t("事实"), you: t("你"), model: t("模型") };
  const rows: BoardRow[] = [{ kind: "text", text: t("谁判：事实＝插件查得到 · 你＝要你点头 · 模型＝我判断"), tone: "dim" }, ...ledgerCardRows(o.ledger?.cards ?? [], flows, t)];
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
      if (wide.length > 0) rows.push({ kind: "text", text: t("这类活都要："), tone: "dim" }, ...wide.map((p) => practiceRow(p, t, o.now, o.ledger?.counts[p.id])));
    }
    for (const s of f.states) {
      const held = (o.rules ?? []).filter((r) => (r.flow === f.name || r.flow === "*") && r.requires === s.id).map((r) => t("规定：{0}", r.text) + (r.held !== undefined && r.held > 0 ? ` · ${t("拦过 {0} 次", r.held)}` : ""));
      rows.push({ kind: "step", key: `step-${f.name}-${s.id}`, title: s.title, need: s.need, judge: s.final ? "" : judgeWords[s.judge], judgeKind: s.judge, prevents: s.prevents !== "" ? t("防：{0}", s.prevents) : "", here: focused?.flow === f.name && focusHere === s.id, final: s.final, ...(held.length > 0 ? { rules: held } : {}) });
      if (listed) rows.push(...mine.filter((p) => p.step === s.id).map((p) => practiceRow(p, t, o.now, o.ledger?.counts[p.id])));
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
    for (const f of idle) rows.push({ kind: "entry", key: `manual-idle-${f.name}`, title: f.title, tag: t("{0} 步", f.states.filter((s) => !s.final).length), tone: "dim", action: { op: "manual-open", flow: f.name, open: true } });
  }
  const anywhere = live.filter((p) => p.flow === "*");
  if (anywhere.length > 0) {
    const listed = expanded.includes("*");
    rows.push({ kind: "section", key: "manual-anywhere", text: t("所有时候的做法"), count: anywhere.length, fold: { key: "manual-fold-anywhere", label: listed ? t("收起") : t("展开"), action: { op: "manual-open", flow: "*", open: !listed } } });
    if (listed) rows.push(...anywhere.map((p) => practiceRow(p, t, o.now, o.ledger?.counts[p.id])));
  }
  // A reference imported: an exported flow's file, or another project's .gemworks/ — only to compare and take steps back from.
  rows.push({ kind: "input", key: "import-reference", placeholder: t("导入参考：导出的流程文件，或另一个项目的 .gemworks/"), field: "import-reference" });
  return rows;
}

/** The band's line for a work item: its words, what hovering it shows (its cells, what it ends as), its presses, and how many more wait on the person. */
export interface CoachBandLine { verb: string; title: string; note: string; detail: string; actions: Pressable[]; more: { count: number; detail: string } }

/**
 * The band's one thing among this session's work items: when the last turn (since `since`) moved several that wait
 * on the person, those together with 逐个定; else the one it moved that waits on the person (等你, the step's two
 * words and 暂缓处理), else this session's last item on the way — what it needs, or what comes next with 好，做吧 and
 * 暂缓处理 (once pressed, 排队中 or 进行中 and no buttons: `gone`; while the person's own turn is on it, 我在做 and
 * no buttons: `doing`). The other items waiting on the person, in any session, are the ones more.
 */
export function coachBand(items: readonly WorkItem[], flows: readonly CoachFlow[], session: string, t: T, since?: string, gone?: readonly GoneOn[], doing?: Doing | null): CoachBandLine | undefined {
  const at = (i: WorkItem) => {
    const flow = flows.find((f) => f.name === i.flow);
    return { i, flow, p: flow !== undefined ? itemProgress(i, flow) : undefined };
  };
  const open = items.filter((x) => x.status === "open").map(at);
  const mine = open.filter((x) => x.i.session === session);
  const touched = since !== undefined ? mine.filter((x) => x.i.at >= since) : [];
  const yours = (list: typeof open) => list.filter((x) => x.p?.whose === "you");
  const moreOf = (shown: readonly string[]) => {
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
  if (one === undefined) return undefined;
  const { i, flow, p } = one;
  const here = flow?.states.find((s) => s.id === (p?.here ?? i.state));
  const tag = flow?.title ?? i.flow;
  const cells = flow !== undefined && p !== undefined ? stripText(p.cells.map((c) => ({ title: (flow.states.find((s) => s.id === c.id) as CoachState).title, cell: c.cell }))) : "";
  const detail = [cells, i.goal !== "" ? t("最后：{0}", i.goal) : ""].filter((x) => x !== "").join(SEP_WORDS);
  const hold: Pressable = { key: "band-hold", label: t("暂缓处理"), action: { op: "work-hold", id: i.id, held: true } };
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
