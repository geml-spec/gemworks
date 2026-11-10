// The work items and their light flows, for every host: the flows a work item
// goes through — the ten shipped ones (新设计, 新功能, bugfix, 优化, 线上事故,
// 代码审查, 调研选型, 重构, 文档, 数据分析) and the ones a project adds — each
// its own statechart whose steps say who judges their leave requirement and what
// they prevent; the work items the model reports with the work tool (the steps
// met), merged from every session's log; where each stands, worked out from the
// steps met (progress.ts); and what the model is told about them. A flow file is
// a `geml-statechart/v1` document; its diagram block's JSON is read here as it
// stands. Pure: the hosts draw them (the Claude Code board, the GEML board).
import { progressOf, type Judge, type Progress } from "./progress.js";
import type { ItemStatus, MetStep, SeenRun, SessionEvent, SessionSummary } from "./session-log.js";

/** The light flows, by file name: the bundled `coach/<name>.geml`, or the project's own `.geml/coach/<name>.geml`. */
export const COACH_FLOWS = ["design", "feature", "bugfix", "optimize", "incident", "review", "research", "refactor", "docs", "analysis"] as const;

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
            flow: { type: "string", description: "The flow it belongs to, by its name: design 新设计, feature 新功能, bugfix, optimize 优化, incident 线上事故, review 代码审查, research 调研选型, refactor 重构, docs 文档, analysis 数据分析, or one the project added (the flows are listed once)." },
            met: { type: "array", items: { type: "string" }, description: "Every step whose leave requirement is met now, by the id or title the flow lists; a way back is the same list with the later steps left out. Leave it out on an update to keep what was met." },
            said: { type: "string", description: "The person's own words, this turn, that meet a step they judge (marked you), e.g. 「好了」. Needed when met newly names such a step; without their words leave the step for their press." },
            evidence: { type: "string", description: "What proves a step marked (fact) that met newly names: the check as it ran — the command in backticks and its result (`npm test` exit 0), the CI run, the numbers measured. It goes on the item's sign-off sheet beside the run gemworks saw." },
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
  return `Gemworks: before a turn ends, report the work items it was about with the gemworks \`work\` tool: the flow each belongs to, every step whose leave requirement is met now (\`met\`), what it still needs, what you will do next, what it should be at the end; update one on the way by its id. A step marked (you) is the person's to judge: name it in \`met\` only with their own words in \`said\`, else leave it for their press. A step marked (fact) is met with what proves it in \`evidence\`: the command as it ran and its result. The flows: ${listed}.`;
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
 * names a new item. A fact step newly met keeps the item's `evidence` and the
 * run of `runs` (this session's, oldest first) it names.
 */
export function workEvents(args: Record<string, unknown>, flows: readonly CoachFlow[], items: readonly WorkItem[], at: string, turn: number, newId: (n: number) => string, runs: readonly SeenRun[] = []): { events: ItemEvent[]; errors: string[] } {
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
    const evidence = str(x["evidence"]).trim();
    const facts = metIds.filter((s) => (stepNamed(s) as CoachState).judge === "fact" && !before.some((m) => m.step === s));
    const seen = evidence !== "" ? seenIn(evidence, runs) : undefined;
    const met = metIds.map((s) => before.find((m) => m.step === s) ?? {
      step: s, at, turn,
      ...(theirs.some((t) => t.id === s) ? { said } : {}),
      ...(facts.includes(s) && evidence !== "" ? { evidence, ...(seen !== undefined ? { seen } : {}) } : {}),
    });
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
 * The run evidence names: the newest of `runs` whose command the evidence
 * holds, or that holds a backticked command of the evidence; undefined for none.
 */
export function seenIn(evidence: string, runs: readonly SeenRun[]): SeenRun | undefined {
  const quoted = [...evidence.matchAll(/`([^`]+)`/g)].map((m) => (m[1] as string).trim()).filter((q) => q !== "");
  const named = (r: SeenRun): boolean => {
    const command = r.command.trim();
    return command !== "" && (evidence.includes(command) || quoted.some((q) => command.includes(q)));
  };
  return [...runs].reverse().find(named);
}

/**
 * A press on a step the person judges: `yes` meets it, with the button's words
 * when given; no takes the item back the way the step's first way back goes
 * (every step from there on unmet), or unmeets the step itself where it has none.
 */
export function pressEvent(item: WorkItem, flow: CoachFlow, step: string, yes: boolean, at: string, turn: number, label?: string): ItemEvent {
  const order = flow.states.map((s) => s.id);
  const back = flow.edges.find((e) => e.from === step && e.back);
  const from = order.indexOf(back?.to ?? step);
  const met = yes ? [...item.met.filter((m) => m.step !== step), { step, at, turn, pressed: true, ...(label !== undefined && label !== "" ? { said: label } : {}) }] : item.met.filter((m) => order.indexOf(m.step) < from);
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
 * The person's word on an item, as this session's event: taken over (`open`: the newest event names the session an
 * item is on, so it is this one's from now), closed as done, or dropped — another session's too, and one whose session
 * has ended, which would never close it itself.
 */
export function closeEvent(item: WorkItem, status: "open" | "done" | "dropped", at: string, turn: number): ItemEvent {
  return { ...holdEvent(item, false, at, turn), status, ...(status !== "open" ? { next: "" } : {}) };
}

/** The work item a turn of this session is about: its last on the way (the one whose step's practices go beside the prompt). */
export function turnItem(items: readonly WorkItem[], session: string): WorkItem | undefined {
  return items.find((x) => x.status === "open" && x.session === session);
}
