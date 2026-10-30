// How the flows grow and shrink, and the rules that block. Proposals change a
// flow's steps only once the person nods: a step to add or a new kind of work
// (the model proposes, with the propose tool), a step to take out (gemworks
// sees it skipped in most of a flow's recent work items). A rule is a practice
// the person turned into one: a tool call matching its key is refused while
// the step it requires is unmet on this session's work item; only what the
// plugin can check, and checked at once. A flow changed or added is written
// back as a geml-statechart/v1 document, the project's own. Pure.
import type { CoachFlow, CoachState, WorkItem } from "./coach.js";
import { keyMatches } from "../../core/dictionary.js";
import type { Judge } from "../../core/progress.js";

// ---- the files: one record a line, in a GEML data block -------------------------------------------

function parseLines<V>(text: string, block: string, is: (v: unknown) => v is V): V[] {
  const lines = text.split(/\r?\n/);
  const open = lines.findIndex((l) => l.trim() === `=== data {#${block} format=jsonl}`);
  if (open < 0) return [];
  const close = lines.findIndex((l, i) => i > open && l.trim() === "===");
  const out: V[] = [];
  for (const line of lines.slice(open + 1, close < 0 ? undefined : close)) {
    if (line.trim() === "") continue;
    try { const v: unknown = JSON.parse(line); if (is(v)) out.push(v); } catch { /* not one */ }
  }
  return out;
}

const linesText = (title: string, block: string, records: readonly unknown[]): string =>
  `=== meta\ntitle = "${title}"\n===\n\n=== data {#${block} format=jsonl}\n${records.map((r) => `${JSON.stringify(r)}\n`).join("")}===\n`;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === "string" ? v : "");

// ---- proposals ----------------------------------------------------------------------------------

/** A step as a proposal names it. */
export interface ProposedStep { id: string; title: string; need: string; judge: Judge; prevents: string }

/**
 * A change to the flows waiting on the person: a step to add after another, a step to take out, a new kind of work
 * with its steps. `by` who saw it; `status` once answered (a declined one is not proposed again).
 */
export interface Proposal {
  id: string; kind: "add-step" | "remove-step" | "new-flow"; flow: string; why: string; at: string; by: "model" | "gemworks" | "reference";
  status: "open" | "accepted" | "declined";
  after?: string; step?: ProposedStep; remove?: string; title?: string; steps?: ProposedStep[];
  /** A proposal from an imported reference: its name. */
  ref?: string;
}

const JUDGES: readonly Judge[] = ["fact", "you", "model"];
const isStep = (v: unknown): v is ProposedStep => isObj(v) && ["id", "title", "need", "prevents"].every((k) => typeof v[k] === "string") && JUDGES.includes(v["judge"] as Judge);
const isProposal = (v: unknown): v is Proposal => isObj(v) && ["id", "flow", "why", "at"].every((k) => typeof v[k] === "string")
  && ["add-step", "remove-step", "new-flow"].includes(v["kind"] as string) && ["model", "gemworks", "reference"].includes(v["by"] as string) && ["open", "accepted", "declined"].includes(v["status"] as string)
  && (v["step"] === undefined || isStep(v["step"])) && (v["steps"] === undefined || (Array.isArray(v["steps"]) && v["steps"].every(isStep)));

export const parseProposals = (text: string): Proposal[] => parseLines(text, "proposals", isProposal);
export const proposalsText = (list: readonly Proposal[]): string => linesText("提议", "proposals", list);

/** A step id from its title: ascii letters and digits kept, else a short hash of the title. */
export function stepId(title: string, taken: readonly string[]): string {
  const ascii = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  let base = ascii;
  if (base === "") { let h = 0; for (const ch of title) h = (h * 31 + (ch.codePointAt(0) ?? 0)) >>> 0; base = `s${h.toString(36).slice(0, 5)}`; }
  let id = base;
  for (let n = 2; taken.includes(id); n++) id = `${base}-${n}`;
  return id;
}

/** Proposals the model gave (the propose tool), checked against the flows and the ones kept; `newId` names a new one. */
export function newProposals(given: readonly unknown[], flows: readonly CoachFlow[], kept: readonly Proposal[], at: string, newId: (n: number) => string): { added: Proposal[]; errors: string[] } {
  const added: Proposal[] = [];
  const errors: string[] = [];
  const stepOf = (x: Record<string, unknown>, taken: string[]): ProposedStep | undefined => {
    const title = str(x["title"]).trim();
    if (title === "") return undefined;
    const judge = JUDGES.includes(x["judge"] as Judge) ? (x["judge"] as Judge) : "model";
    const step = { id: stepId(title, taken), title, need: str(x["need"]).trim(), judge, prevents: str(x["prevents"]).trim() };
    taken.push(step.id);
    return step;
  };
  given.forEach((v, n) => {
    if (!isObj(v)) { errors.push(`proposal ${n + 1} is not an object`); return; }
    const why = str(v["why"]).trim();
    if (v["kind"] === "add-step") {
      const flow = flows.find((f) => f.name === str(v["flow"]));
      if (flow === undefined) { errors.push(`proposal ${n + 1}: no flow "${str(v["flow"])}"`); return; }
      const after = str(v["after"]);
      if (!flow.states.some((s) => s.id === after && !s.final)) { errors.push(`proposal ${n + 1}: ${flow.name} has no step "${after}" to add after`); return; }
      const step = stepOf(v, flow.states.map((s) => s.id));
      if (step === undefined) { errors.push(`proposal ${n + 1} names no step title`); return; }
      if ([...kept, ...added].some((p) => p.kind === "add-step" && p.flow === flow.name && p.step?.title === step.title)) { errors.push(`proposal ${n + 1}: already proposed`); return; }
      added.push({ id: newId(n), kind: "add-step", flow: flow.name, after, step, why, at, by: "model", status: "open" });
    } else if (v["kind"] === "new-flow") {
      const title = str(v["title"]).trim();
      const raw = Array.isArray(v["steps"]) ? v["steps"] : [];
      const taken: string[] = ["done"];
      const steps = raw.flatMap((x) => (isObj(x) ? [stepOf(x, taken)] : [])).filter((s): s is ProposedStep => s !== undefined);
      if (title === "" || steps.length === 0) { errors.push(`proposal ${n + 1}: a new kind of work needs its title and its steps`); return; }
      const name = stepId(str(v["name"]) || title, flows.map((f) => f.name));
      if ([...kept, ...added].some((p) => p.kind === "new-flow" && p.title === title)) { errors.push(`proposal ${n + 1}: already proposed`); return; }
      added.push({ id: newId(n), kind: "new-flow", flow: name, title, steps, why, at, by: "model", status: "open" });
    } else errors.push(`proposal ${n + 1}: kind must be add-step or new-flow`);
  });
  return { added, errors };
}

/**
 * The steps gemworks would take out: in a flow's last `window` finished work items, a step skipped (left unmet) in at
 * least `least` of them. One declined before is not proposed again.
 */
export function skippedSteps(items: readonly WorkItem[], flows: readonly CoachFlow[], kept: readonly Proposal[], window = 5, least = 4): { flow: string; step: string; skipped: number }[] {
  const out: { flow: string; step: string; skipped: number }[] = [];
  for (const f of flows) {
    const done = items.filter((i) => i.flow === f.name && i.status === "done").sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, window);
    if (done.length < window) continue;
    for (const s of f.states.filter((x) => !x.final)) {
      const skipped = done.filter((i) => !i.met.some((m) => m.step === s.id)).length;
      if (skipped >= least && !kept.some((p) => p.kind === "remove-step" && p.flow === f.name && p.remove === s.id)) out.push({ flow: f.name, step: s.id, skipped });
    }
  }
  return out;
}

const toState = (s: ProposedStep): CoachState => ({ id: s.id, title: s.title, need: s.need, final: false, judge: s.judge, prevents: s.prevents, answers: null });

/** A flow with a step added after another (the ways on rewired through it) or one taken out (its ways joined around it). */
export function applyToFlow(flow: CoachFlow, p: Pick<Proposal, "kind" | "after" | "step" | "remove">): CoachFlow {
  if (p.kind === "add-step" && p.after !== undefined && p.step !== undefined) {
    const at = flow.states.findIndex((s) => s.id === p.after);
    const step = toState(p.step);
    const states = [...flow.states.slice(0, at + 1), step, ...flow.states.slice(at + 1)];
    const next = flow.states[at + 1]?.id;
    const edges = flow.edges.flatMap((e) => (e.from === p.after && e.to === next && !e.back ? [{ ...e, to: step.id }, { from: step.id, to: next, label: "", back: false }] : [e]));
    return { ...flow, states, edges };
  }
  if (p.kind === "remove-step" && p.remove !== undefined) {
    const gone = p.remove;
    const into = flow.edges.filter((e) => e.to === gone && !e.back).map((e) => e.from);
    const out = flow.edges.filter((e) => e.from === gone && !e.back).map((e) => e.to);
    const kept = flow.edges.filter((e) => e.from !== gone && e.to !== gone);
    const joined = into.flatMap((a) => out.map((b) => ({ from: a, to: b, label: "", back: false })));
    const backs = flow.edges.filter((e) => e.back && e.to === gone).map((e) => ({ ...e, to: out[0] ?? e.to })).filter((e) => e.to !== gone);
    return { ...flow, states: flow.states.filter((s) => s.id !== gone), edges: [...kept, ...joined, ...backs] };
  }
  return flow;
}

/** A new kind of work as a flow: its steps in order, then 完成. */
export function newFlow(p: Pick<Proposal, "flow" | "title" | "steps">): CoachFlow {
  const steps = (p.steps ?? []).map(toState);
  const states: CoachState[] = [...steps, { id: "done", title: "完成", need: "", final: true, judge: "model", prevents: "", answers: null }];
  const edges = states.slice(1).map((s, i) => ({ from: (states[i] as CoachState).id, to: s.id, label: "", back: false }));
  return { name: p.flow, title: p.title ?? p.flow, states, edges };
}

/** A flow written as the project's own geml-statechart/v1 document. */
export function flowText(flow: CoachFlow): string {
  const states = Object.fromEntries(flow.states.map((s) => [s.id, s.final
    ? { title: s.title, final: true }
    : { title: s.title, description: s.need, judge: s.judge, ...(s.prevents !== "" ? { prevents: s.prevents } : {}), ...(s.answers !== null ? { answers: s.answers } : {}), ...(s.expires === true ? { expires: true } : {}) }]));
  const transitions = flow.edges.map((e) => ({ from: e.from, to: e.to, ...(e.label !== "" ? { guard: e.label } : {}) }));
  const initial = flow.states.find((s) => !s.final)?.id ?? flow.states[0]?.id ?? "done";
  const json = JSON.stringify({ initial, states, transitions }, null, 2);
  return `=== meta\ntitle   = "${flow.title}"\nprofile = "geml-statechart/v1"\n===\n\n=== diagram {#flow format=geml-statechart caption="${flow.title}"}\n${json}\n===\n`;
}

// ---- rules --------------------------------------------------------------------------------------

/** A rule: a tool key it holds (`Bash(npm run deploy*)`), the step of a flow that must be met first, its words, whose it is, how often it held. */
export interface Rule { id: string; flow: string; requires: string; key: string; text: string; why: string; at: string; layer: "project" | "team"; from?: string; held?: number }

const isRule = (v: unknown): v is Omit<Rule, "layer"> => isObj(v) && ["id", "flow", "requires", "key", "text", "why", "at"].every((k) => typeof v[k] === "string") && v["key"] !== ""
  && (v["held"] === undefined || typeof v["held"] === "number") && (v["from"] === undefined || typeof v["from"] === "string");

export const parseRules = (text: string, layer: Rule["layer"]): Rule[] => parseLines(text, "rules", isRule).map((r) => ({ ...r, layer }));
export const rulesText = (list: readonly Rule[]): string => linesText("规定", "rules", list.map(({ layer: _layer, ...r }) => r));

/** Whether a path is one of the files that keep rules: rules are the person's to change, not the model's. */
export function isRulesFile(path: string): boolean {
  return /(^|[\\/])\.(geml|gemworks)[\\/]rules\.geml$/.test(path);
}

/**
 * Why a tool call is refused, if a rule holds it: one of its keys matches a rule of the flow this session's work item
 * is on (or of every flow), and the step the rule requires is unmet on that item.
 */
export function ruleRefusal(rules: readonly Rule[], item: WorkItem | undefined, flows: readonly CoachFlow[], keys: readonly string[]): { rule: Rule; reason: string } | undefined {
  if (item === undefined || item.status !== "open") return undefined;
  const flow = flows.find((f) => f.name === item.flow);
  if (flow === undefined) return undefined;
  for (const r of rules) {
    if (r.flow !== item.flow && r.flow !== "*") continue;
    if (!keys.some((k) => keyMatches(r.key, k))) continue;
    if (item.met.some((m) => m.step === r.requires)) continue;
    const step = flow.states.find((s) => s.id === r.requires)?.title ?? r.requires;
    return { rule: r, reason: `规定：${r.text}（「${item.title}」的「${step}」还没满足）` };
  }
  return undefined;
}

/** Whether a work item stands past a step (it is met): what a rule reads. */
export const metOn = (item: WorkItem, step: string): boolean => item.met.some((m) => m.step === step);

/** The step a fact expires at once the work changes after it: met steps of the item's flow marked `expires`. */
export function expiring(item: WorkItem, flow: CoachFlow): string[] {
  return flow.states.filter((s) => s.expires === true && item.met.some((m) => m.step === s.id)).map((s) => s.id);
}

// ---- what the model is given ----------------------------------------------------------------------

/** The tool the model proposes a change to the flows with; nothing changes until the person nods on the flow tab. */
export const PROPOSE_TOOL = {
  name: "propose",
  description: "Propose a change to how the project's work goes, for the person to accept or decline on the flow tab: a step to add to a flow, when the same thing keeps being done at the same place in that kind of work and it prevents a pitfall; or a new kind of work, when several work items in a row fit none of the flows. Nothing changes until the person accepts.",
  inputSchema: {
    type: "object",
    properties: {
      proposals: {
        type: "array",
        items: {
          type: "object",
          properties: {
            kind: { type: "string", enum: ["add-step", "new-flow"] },
            flow: { type: "string", description: "add-step: the flow, by its name." },
            after: { type: "string", description: "add-step: the step it comes after, by id." },
            title: { type: "string", description: "add-step: the new step's title; new-flow: the kind of work's title." },
            need: { type: "string", description: "add-step: what it needs to be left, a few words." },
            judge: { type: "string", enum: ["fact", "you", "model"], description: "add-step: who judges that requirement." },
            prevents: { type: "string", description: "add-step: the pitfall it prevents." },
            name: { type: "string", description: "new-flow: a short ascii name for it." },
            steps: { type: "array", items: { type: "object", properties: { title: { type: "string" }, need: { type: "string" }, judge: { type: "string", enum: ["fact", "you", "model"] }, prevents: { type: "string" } }, required: ["title"], additionalProperties: false }, description: "new-flow: its steps in order, as the work items that fit none actually went." },
            why: { type: "string", description: "What you saw: the work items or the incidents behind it." },
          },
          required: ["kind", "why"],
          additionalProperties: false,
        },
      },
    },
    required: ["proposals"],
    additionalProperties: false,
  },
} as const;

/** The tool the model writes a rule with, only once the person pressed 改成规定 on a practice. */
export const RULE_TOOL = {
  name: "rule",
  description: "Write down the rule the person asked for when they pressed 改成规定 on a practice: the tool key it holds (as the tool dictionary writes keys, e.g. Bash(node scripts/sync-dev.mjs*)) and the step that must be met first. Only after that press; a rule then refuses matching calls while the step is unmet.",
  inputSchema: {
    type: "object",
    properties: {
      practice: { type: "string", description: "The practice's id, as the request named it." },
      key: { type: "string", description: "The tool key the rule holds, a pattern with * as the dictionary writes it." },
      requires: { type: "string", description: "The step of the practice's flow that must be met first, by id." },
      text: { type: "string", description: "The rule in a few words, in the person's language." },
    },
    required: ["practice", "key", "requires", "text"],
    additionalProperties: false,
  },
} as const;

/** What the model is told once about proposals. */
export const GROWTH_PROMPT = "Gemworks: the flows grow from what happens here. When the same thing keeps being done at the same place in a kind of work, or several work items in a row fit none of the flows, propose it with the gemworks `propose` tool; the person accepts or declines on the flow tab.";

/** What is said for the person when they press 改成规定: the model writes the rule with the rule tool. */
export function ruleAsk(practice: { id: string; flow: string; step: string; text: string }, flowTitle: string, stepTitle: string): string {
  return `把做法「${practice.text}」改成规定（${flowTitle} · ${stepTitle}，id ${practice.id}）：用 gemworks 的 rule 工具写下它要拦的命令（工具键）和必须先满足的那一步。`;
}

/** A work item with the facts that expire taken back: the work changed after them, so they are to be met again. */
export function expireEvent(item: WorkItem, steps: readonly string[], needs: string, at: string, turn: number): Extract<import("../../core/session-log.js").SessionEvent, { t: "item" }> {
  const met = item.met.filter((m) => !steps.includes(m.step));
  return { t: "item", turn, at, id: item.id, flow: item.flow, title: item.title, state: item.state, needs, goal: item.goal, status: item.status, met, ...(item.next !== "" ? { next: item.next } : {}) };
}

// ---- sharing, references ------------------------------------------------------------------------

/**
 * A flow exported as one GEML document: its route (the flow), its practices with where each came from, its rules —
 * the flow tab's manual for it. The person's own layer stays home.
 */
export function exportText(flow: CoachFlow, practices: readonly import("../../core/practices.js").Practice[], rules: readonly Rule[]): string {
  const mine = practices.filter((p) => p.flow === flow.name && p.deleted !== true && p.layer !== "personal").map(({ layer: _layer, session: _session, turn: _turn, ...p }) => p);
  const held = rules.filter((r) => r.flow === flow.name).map(({ layer: _layer, held: _held, ...r }) => r);
  return `${flowText(flow)}\n=== data {#practices format=jsonl}\n${mine.map((p) => `${JSON.stringify(p)}\n`).join("")}===\n\n=== data {#rules format=jsonl}\n${held.map((r) => `${JSON.stringify(r)}\n`).join("")}===\n`;
}

/** The name an exported flow goes by: its file's name without .geml, ascii; else the flow's own. */
export function referenceName(file: string, fallback: string): string {
  const base = file.replace(/^.*[\\/]/, "").replace(/\.geml$/i, "").replace(/^flow-/, "");
  return /^[A-Za-z0-9._-]+$/.test(base) ? base : fallback;
}

/**
 * What a reference offers the project's flow: each step it has that the flow lacks, as a proposal to take it back
 * (after the step before it in the reference, when the flow has that one); a reference of a kind of work the project
 * does not have, as a new kind of work. One proposed or answered before is not offered again.
 */
export function referenceProposals(ref: CoachFlow, refName: string, flows: readonly CoachFlow[], kept: readonly Proposal[], at: string, newId: (n: number) => string): Proposal[] {
  const out: Proposal[] = [];
  const mine = flows.find((f) => f.name === ref.name);
  const steps = ref.states.filter((s) => !s.final);
  const asStep = (s: CoachState): ProposedStep => ({ id: s.id, title: s.title, need: s.need, judge: s.judge, prevents: s.prevents });
  if (mine === undefined) {
    if (!kept.some((p) => p.kind === "new-flow" && p.flow === ref.name)) out.push({ id: newId(0), kind: "new-flow", flow: ref.name, title: ref.title, steps: steps.map(asStep), why: `参考「${refName}」`, at, by: "reference", status: "open", ref: refName });
    return out;
  }
  steps.forEach((s, i) => {
    if (mine.states.some((x) => x.id === s.id)) return;
    const before = [...steps.slice(0, i)].reverse().find((x) => mine.states.some((y) => y.id === x.id && !y.final));
    const after = before?.id ?? mine.states.find((x) => !x.final)?.id;
    if (after === undefined) return;
    if (kept.some((p) => p.kind === "add-step" && p.flow === mine.name && p.step?.id === s.id)) return;
    out.push({ id: newId(out.length), kind: "add-step", flow: mine.name, after, step: asStep(s), why: `参考「${refName}」里有`, at, by: "reference", status: "open", ref: refName });
  });
  return out;
}
