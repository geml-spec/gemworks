// The work loop on the hosts whose Gemworks runs in Node (the MCP server, Codex's
// and Antigravity's hooks, DeepSeek Harness, Pi): the light flows read from the
// project's `.geml/coach/` and the ones the package ships; the work items, the
// practices, the proposals and the questions the model reports with its tools,
// written into the project's shared record (session-store.ts, practice-store.ts,
// `.geml/proposals.geml`) where every host and the Claude Code board read them;
// and what the model is told once and beside each prompt. The Claude Code module
// does the same through its engine's file calls (hooks/register.tsx); the pure
// parts are shared (core/work.ts, core/practice-tool.ts, core/growth.ts). Nothing
// here throws at a caller: a tool answers with why nothing was recorded.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ARTIFACT_TOOL } from "./core/artifact-tool.js";
import { ASK_PROMPT_ON_BOARD, ASK_TOOL_ON_BOARD, askedOf } from "./core/ask-tool.js";
import { ANSWER_TOOL, applyToFlow, flowText, GROWTH_PROMPT_ON_BOARD, newFlow, newProposals, parseProposals, PROPOSE_TOOL_ON_BOARD, proposalsText, type Proposal } from "./core/growth.js";
import { GEML_DIR } from "./core/layout.js";
import { PRACTICE_PROMPT, PRACTICE_TOOL, practiceContext } from "./core/practice-tool.js";
import { newPractices } from "./core/practices.js";
import { currentTurn, type SessionEvent } from "./core/session-log.js";
import { COACH_FLOWS, readCoachFlow, turnItem, WORK_TOOL, workContext, workEvents, workItemsOf, workPrompt, type CoachFlow, type WorkItem } from "./core/work.js";
import { handleRequest } from "./bridge.js";
import { journalBaseOf } from "./host-git.js";
import { readPractices, writePractices } from "./practice-store.js";
import { appendSession, readSessions } from "./session-store.js";

/** The flows the package ships, beside `dist/`. */
export const SHIPPED_COACH = fileURLToPath(new URL("../coach/", import.meta.url));

/** What a loop tool answers: whether it recorded anything, and the line the model reads. */
export interface LoopResult { ok: boolean; text: string }

/** A tool as an MCP server lists it. */
export interface LoopTool { name: string; description: string; inputSchema: Record<string, unknown> }

/** The tools of the work loop on a host with no status band, in the order they are listed. */
export const LOOP_TOOLS: readonly LoopTool[] = [WORK_TOOL, PRACTICE_TOOL, PROPOSE_TOOL_ON_BOARD, ANSWER_TOOL, ASK_TOOL_ON_BOARD, ARTIFACT_TOOL] as unknown as LoopTool[];

/** Whether a tool name is one of the loop's. */
export const isLoopTool = (name: string): boolean => LOOP_TOOLS.some((t) => t.name === name);

/** The project's own `.geml/` directory, in its main working tree: where every checkout reads and writes the same record. */
export const gemlHome = (root: string): string => join(journalBaseOf(root), GEML_DIR);

const readAt = (path: string): string | undefined => { try { return readFileSync(path, "utf8"); } catch { return undefined; } };
const stampOf = (at: string): string => Date.parse(at).toString(36).slice(-6);

/**
 * The light flows: for each shipped flow, the project's own (`.geml/coach/<name>.geml`), else the team's
 * (`.gemworks/flows/<name>.geml` in the checkout), else the shipped one; then the flows the project added. A flow that
 * does not read is left out.
 */
export function coachFlowsAt(root: string, shipped: string = SHIPPED_COACH): CoachFlow[] {
  const own = join(gemlHome(root), "coach");
  const flows: CoachFlow[] = [];
  for (const name of COACH_FLOWS) {
    const shippedText = readAt(join(shipped, `${name}.geml`));
    const reference = shippedText !== undefined ? readCoachFlow(name, shippedText) : undefined;
    const ownText = readAt(join(own, `${name}.geml`));
    const teamText = ownText === undefined ? readAt(join(root, ".gemworks", "flows", `${name}.geml`)) : undefined;
    const flow = (ownText !== undefined ? readCoachFlow(name, ownText, reference) : teamText !== undefined ? readCoachFlow(name, teamText, reference) : undefined) ?? reference;
    if (flow !== undefined) flows.push(flow);
  }
  let added: string[] = [];
  try { added = readdirSync(own).filter((n) => n.endsWith(".geml") && !(COACH_FLOWS as readonly string[]).includes(n.slice(0, -".geml".length))).sort(); } catch { /* none of its own */ }
  for (const file of added) {
    const text = readAt(join(own, file));
    const flow = text !== undefined ? readCoachFlow(file.slice(0, -".geml".length), text) : undefined;
    if (flow !== undefined) flows.push(flow);
  }
  return flows;
}

/** The work items the project's sessions reported, as they stand now, newest first. */
export function workItemsAt(root: string, flows: readonly CoachFlow[]): WorkItem[] {
  return workItemsOf(readSessions(root), flows);
}

/** The work tool: the turn's work items, checked against the flows, into this session's log. */
export function recordWork(root: string, host: string, session: string, args: Record<string, unknown>, now: string = new Date().toISOString()): LoopResult {
  const flows = coachFlowsAt(root);
  if (flows.length === 0) return { ok: false, text: "Nothing recorded: this project has no flows to report work items on." };
  const items = workItemsAt(root, flows);
  const stamp = stampOf(now);
  let errors: string[] = [];
  let made: SessionEvent[] = [];
  appendSession(root, host, session, (so) => {
    const r = workEvents(args, flows, items, now, currentTurn(so), (n) => `${stamp}${n}`);
    errors = r.errors;
    made = r.events;
    return r.events;
  }, now);
  if (made.length === 0) return { ok: false, text: `Nothing recorded: ${errors.join("; ") || "items is a list of work items"}.` };
  const said = made.map((e) => (e.t === "item" ? `#${e.id} «${e.title}» (${e.flow}: ${e.state}${e.status !== "open" ? `, ${e.status}` : ""})` : "")).join("; ");
  return { ok: true, text: `Recorded ${said}.${errors.length > 0 ? ` Left out: ${errors.join("; ")}.` : ""}` };
}

/** The practice tool: the practices given, checked against the flows and the ones kept, into their layers. */
export function recordPractices(root: string, host: string, session: string, args: Record<string, unknown>, now: string = new Date().toISOString()): LoopResult {
  const given = Array.isArray(args["practices"]) ? (args["practices"] as unknown[]) : [];
  const memory = args["memory"] === true;
  const flows = coachFlowsAt(root);
  const kept = readPractices(root).practices;
  const stamp = stampOf(now);
  const turn = currentTurn(appendSession(root, host, session, () => [], now));
  const r = newPractices(given, kept, now, memory ? "memory" : "model", (n) => `p${stamp}${n}`, flows.map((f) => ({ name: f.name, steps: f.states.map((s) => s.id) })), { session, turn });
  if (r.added.length === 0 && !memory) return { ok: false, text: `Nothing recorded: ${r.errors.join("; ") || "practices is a list"}.` };
  writePractices(root, r.added, memory);
  return { ok: true, text: `Recorded ${r.added.length} practice${r.added.length === 1 ? "" : "s"}; they remind at their steps.${r.errors.length > 0 ? ` Left out: ${r.errors.join("; ")}.` : ""}` };
}

/** The proposals kept in the project's `.geml/proposals.geml`. */
export function proposalsAt(root: string): Proposal[] {
  const text = readAt(join(gemlHome(root), "proposals.geml"));
  return text !== undefined ? parseProposals(text) : [];
}

function saveProposals(root: string, list: readonly Proposal[]): void {
  const path = join(gemlHome(root), "proposals.geml");
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, proposalsText(list), "utf8");
}

/** The propose tool: the proposals given, checked against the flows and the ones kept, for the person to answer. */
export function recordProposals(root: string, args: Record<string, unknown>, now: string = new Date().toISOString()): LoopResult {
  const given = Array.isArray(args["proposals"]) ? (args["proposals"] as unknown[]) : [];
  const kept = proposalsAt(root);
  const stamp = stampOf(now);
  const r = newProposals(given, coachFlowsAt(root), kept, now, (n) => `q${stamp}${n}`);
  if (r.added.length === 0) return { ok: false, text: `Nothing recorded: ${r.errors.join("; ") || "proposals is a list"}.` };
  saveProposals(root, [...kept, ...r.added]);
  return { ok: true, text: `Proposed ${r.added.length} (${r.added.map((p) => p.id).join(", ")}); the person answers in the conversation.${r.errors.length > 0 ? ` Left out: ${r.errors.join("; ")}.` : ""}` };
}

/** The answer tool: the person's yes or no to an open proposal, in their words; a yes writes the flow as the project's own. */
export function answerProposal(root: string, args: Record<string, unknown>): LoopResult {
  const id = typeof args["proposal"] === "string" ? args["proposal"].trim().replace(/^#/, "") : "";
  const said = typeof args["said"] === "string" ? args["said"].trim() : "";
  if (typeof args["yes"] !== "boolean") return { ok: false, text: "Nothing done: yes is true or false." };
  if (said === "") return { ok: false, text: "Nothing done: a proposal is answered only with the person's own words in said." };
  const list = proposalsAt(root);
  const p = list.find((x) => x.id === id);
  if (p === undefined || p.status !== "open") return { ok: false, text: `Nothing done: no open proposal ${id} (open: ${list.filter((x) => x.status === "open").map((x) => x.id).join(", ") || "none"}).` };
  const yes = args["yes"];
  if (yes) {
    const flow = p.kind === "new-flow" ? newFlow(p) : coachFlowsAt(root).find((f) => f.name === p.flow);
    if (flow === undefined) return { ok: false, text: `Nothing done: there is no flow ${p.flow} to change.` };
    const path = join(gemlHome(root), "coach", `${flow.name}.geml`);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, flowText(p.kind === "new-flow" ? flow : applyToFlow(flow, p)), "utf8");
  }
  saveProposals(root, list.map((x) => (x.id === p.id ? { ...x, status: yes ? "accepted" as const : "declined" as const } : x)));
  return { ok: true, text: yes ? `Accepted ${p.id}: ${p.kind === "new-flow" ? `the flow ${p.flow} is added` : `the flow ${p.flow} is changed`}.` : `Declined ${p.id}; it is not proposed again.` };
}

/** The ask tool on a host with no status band: the question into this session's log, for the board until the next prompt. */
export function recordAsk(root: string, host: string, session: string, args: Record<string, unknown>, now: string = new Date().toISOString()): LoopResult {
  const asked = askedOf(args);
  if ("error" in asked) return { ok: false, text: `Not registered: ${asked.error}.` };
  appendSession(root, host, session, (so) => [{
    t: "ask", turn: currentTurn(so), at: now, question: asked.question, options: asked.options,
    ...(asked.recommended !== undefined ? { recommended: asked.recommended } : {}), ...(asked.item !== undefined ? { item: asked.item } : {}),
  }], now);
  return { ok: true, text: "Registered: the Gemworks board lists it until the person's next prompt; ask it in your reply too." };
}

/**
 * The artifact tool: a link, a picture or a file under the work item this is for — the workflow's current one when the
 * project runs a workflow, else this session's work item on the way.
 */
export async function recordArtifact(root: string, session: string, args: Record<string, unknown>): Promise<LoopResult> {
  const kind = args["kind"];
  const where = typeof args["where"] === "string" ? args["where"].trim() : "";
  if ((kind !== "link" && kind !== "image" && kind !== "file") || where === "") return { ok: false, text: "Nothing recorded: kind is link, image or file, and where is the address or the path." };
  const status = await handleRequest({ v: 1, root, op: "status" }).catch(() => undefined);
  let on: { item?: string } | undefined;
  if (status !== undefined && status.ok && status.shell.status?.item.kind === "item") on = {};
  else {
    const item = turnItem(workItemsAt(root, coachFlowsAt(root)), session);
    if (item !== undefined) on = { item: item.id };
  }
  if (on === undefined) return { ok: false, text: "Nothing recorded: no work item is on the way in this session; report the one this is for with the work tool first." };
  const name = typeof args["name"] === "string" ? args["name"] : undefined;
  const version = typeof args["version"] === "string" ? args["version"] : undefined;
  const res = await handleRequest({ v: 1, root, op: "artifact", ...on, kind, where, ...(name !== undefined ? { name } : {}), ...(version !== undefined ? { version } : {}) }).catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : String(e) }));
  if (!res.ok) return { ok: false, text: `Nothing recorded: ${res.error.replace(/^gemworks: /, "")}` };
  return { ok: true, text: res.text ?? "Recorded." };
}

/** One of the loop's tools, called: its answer, or undefined for a name that is none of them. */
export async function callLoopTool(root: string, host: string, session: string, name: string, args: Record<string, unknown>, now: string = new Date().toISOString()): Promise<LoopResult | undefined> {
  try {
    switch (name) {
      case WORK_TOOL.name: return recordWork(root, host, session, args, now);
      case PRACTICE_TOOL.name: return recordPractices(root, host, session, args, now);
      case PROPOSE_TOOL_ON_BOARD.name: return recordProposals(root, args, now);
      case ANSWER_TOOL.name: return answerProposal(root, args);
      case ASK_TOOL_ON_BOARD.name: return recordAsk(root, host, session, args, now);
      case ARTIFACT_TOOL.name: return await recordArtifact(root, session, args);
      default: return undefined;
    }
  } catch (e) {
    return { ok: false, text: `gemworks: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/** What the model is told once, at a session's start, about the loop's tools: with the flows' steps, when there are flows. */
export function loopPrompt(flows: readonly CoachFlow[]): string[] {
  return flows.length === 0 ? [ASK_PROMPT_ON_BOARD] : [ASK_PROMPT_ON_BOARD, workPrompt(flows), PRACTICE_PROMPT, GROWTH_PROMPT_ON_BOARD];
}

/** The lines beside a prompt: the work items on the way, by id, and the practices of the step this session's item stands at. */
export function loopContext(root: string, session: string, flows: readonly CoachFlow[] = coachFlowsAt(root)): string[] {
  if (flows.length === 0) return [];
  const items = workItemsAt(root, flows);
  let practices: ReturnType<typeof readPractices>["practices"] = [];
  try { practices = readPractices(root).practices; } catch { /* no reminder this time */ }
  return [...workContext(items, flows), ...practiceContext(items, flows, practices, session)];
}
