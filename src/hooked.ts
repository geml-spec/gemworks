// What the adapters of hosts with Claude Code-like hooks share — Qwen Code (src/qwen.ts) and OpenCode
// (src/opencode.ts): one event in, what the host should do out, decided with the same functions the Claude Code module
// and the Codex adapter decide with. Each event opens the workspace through the bridge's own `handleRequest`, in this
// process; each adapter reads its host's event into a `HookedEvent` and writes the `HookedAnswer` back in its host's
// shape.
//
// A session starts: the model is handed the work loop's standing instructions, the note tool and the stage text, and
// the GEML board opens when it has work on it. A prompt: it is recorded, and the stage text when it changed, the other
// sessions' decisions not yet read, the work items on the way and the step's practices go beside it. Before a call: what
// the gate refuses is refused, a tool's default parameters are filled, and a shell command whose exit status is evidence
// is wrapped so the status comes back in its output. After a call: the status is read back and `after` asked, and a
// written file goes into the project's shared session record. The turn's end: the answer and the board are written — or,
// when the turn changed things and reported no work item, the model goes back once with the reminder.
//
// Nothing here stops the agent: what fails to be written is missed, and a failed bridge answer says nothing.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { handleRequest } from "./bridge.js";
import { commandOf } from "./core/command-line.js";
import { bindingOf, evidenceKeys, type Dictionary } from "./core/dictionary.js";
import { CONTEXT_DOC } from "./core/layout.js";
import type { FlowPolicy } from "./core/policy.js";
import { currentTurn, decisionsContext, SESSIONS_PROMPT } from "./core/session-log.js";
import { isOwnTool } from "./core/verb-specs.js";
import { WORK_REMINDER } from "./core/work.js";
import { exists, readText } from "./host-fs.js";
import { afterNeeded, beforeDecision, paramsToFill, type CallFacts } from "./hosts/claude-code/fastpath.js";
import type { BridgeOp, BridgeResponse } from "./hosts/claude-code/protocol.js";
import { contextOf } from "./hosts/claude-code/readers.js";
import { isWrapped, unwrapCommand, wrapCommand } from "./hosts/codex/hook.js";
import type { Status } from "./workspace.js";
import { boardHasWork, openBoardOnce, writeBoard } from "./board-file.js";
import { projectPath } from "./cursor.js";
import { coachFlowsAt, loopContext, loopPrompt } from "./loop.js";
import { appendSession, commits, decisionsFor, hostLabel, recordAnswer, recordFile, recordPrompt } from "./session-store.js";

/** How a host names its tools, and where its calls say what they did. */
export interface HostTools {
  /** The shell tool's name. */
  readonly shell: string;
  /** Whether a tool is the shell, for a host that has it under several names; else the one `shell` names. */
  readonly isShell?: (tool: string) => boolean;
  /** The call as the gate and the dictionary read it: Claude Code's tool names. */
  readonly callOf: (tool: string, input: Readonly<Record<string, unknown>>) => CallFacts;
  /** The files a call writes, as it names them; none for a tool that writes nothing. */
  readonly writes: (tool: string, input: Readonly<Record<string, unknown>>) => readonly string[];
  /** A shell call's exit status from its result; null when there is none. */
  readonly exitCodeOf: (response: unknown) => number | null;
  /** An MCP tool's own name. */
  readonly bareTool: (tool: string) => string;
}

/** One event, in no host's shape. */
export type HookedEvent =
  | { kind: "start"; source?: string }
  /** `personal`: the words are surely the person's, so this is a new turn whatever `turn` says. */
  | { kind: "prompt"; words?: string; turn?: string; personal: boolean }
  | { kind: "before"; tool: string; callId?: string; input: Record<string, unknown> }
  | { kind: "after"; tool: string; callId?: string; input: Record<string, unknown>; failed: boolean; response?: unknown }
  /** `retry`: the turn already went on once because the host's stop was blocked. */
  | { kind: "stop"; answer?: string; retry: boolean };

/** What the host should do; undefined is nothing. */
export type HookedAnswer =
  | { kind: "context"; text: string }
  | { kind: "deny"; reason: string }
  /** The call goes on, with `input` in place of its own when given, and `context` for the model when given. */
  | { kind: "allow"; input?: Record<string, unknown>; context?: string }
  | { kind: "continue"; reason: string }
  | undefined;

export interface HookedOptions { home?: string; platform?: string; now?: string }

/**
 * What one session has been told and done: the stage text it last read, when it last read the other sessions'
 * decisions, the turn it is in, whether that turn committed or changed things, and whether it was already sent back.
 */
interface SessionState { delivered: string | null; decisionsSeen: string | null; turn: string | null; committed: boolean; acted: boolean; reminded: boolean }
const FRESH: SessionState = { delivered: null, decisionsSeen: null, turn: null, committed: false, acted: false, reminded: false };

function readState(file: string): SessionState {
  try { return { ...FRESH, ...(JSON.parse(readFileSync(file, "utf8")) as Partial<SessionState>) }; } catch { return { ...FRESH }; }
}

/** Whether a shell command's exit status is `tool` evidence: a key of it is bound to a use some `tool` variable reads. */
function speaksEvidence(policy: FlowPolicy, command: string): boolean {
  const keys = evidenceKeys(command);
  if (keys === null) return false;
  const dict: Dictionary = { rows: policy.rows, diagnostics: [] };
  const evidence = new Set(policy.evidence);
  return keys.some((k) => { const row = bindingOf(dict, k); return row?.for !== undefined && evidence.has(row.for); });
}

/** Where an adapter keeps its sessions' state. */
export const hostStateDir = (host: string, home: string = homedir()): string => join(home, ".gemworks", host);

/** The session a host's hooks last saw and its project: what an MCP server started outside any project writes for. */
export interface Active { session: string; root: string; at: string }

export function activeOf(host: string, home: string = homedir()): Active | undefined {
  try {
    const a = JSON.parse(readFileSync(join(hostStateDir(host, home), "active.json"), "utf8")) as Partial<Active>;
    return typeof a.session === "string" && typeof a.root === "string" ? { session: a.session, root: a.root, at: a.at ?? "" } : undefined;
  } catch { return undefined; }
}

/** The project and session a host's MCP server works in: its own folder when that has a `.geml/` (undefined), else the one the hooks last saw. */
export function mcpRootOf(host: string, root: string, home: string = homedir()): Active | undefined {
  return existsSync(join(root, ".geml")) ? undefined : activeOf(host, home);
}

/** One event of session `sid` in project `root`, as host `host` names its tools. */
export async function runHooked(host: string, tools: HostTools, sid: string, root: string, ev: HookedEvent, o: HookedOptions = {}): Promise<HookedAnswer> {
  const home = o.home ?? homedir();
  const platform = o.platform ?? process.platform;
  const now = o.now ?? new Date().toISOString();
  const dir = hostStateDir(host, home);
  const file = join(dir, `${sid.replace(/[^A-Za-z0-9._-]/g, "_")}.json`);
  const state = readState(file);
  // Where this host's MCP server writes when it was started outside any project.
  try { mkdirSync(dir, { recursive: true }); writeFileSync(join(dir, "active.json"), JSON.stringify({ session: sid, root, at: now } satisfies Active), "utf8"); } catch { /* the server keeps its own folder */ }
  // The project's shared session record and this adapter's own state: what fails to be written is missed, never a broken hook.
  const record = (f: () => void): void => { try { f(); } catch { /* missed this once */ } };
  const save = (): void => record(() => { mkdirSync(dir, { recursive: true }); writeFileSync(file, JSON.stringify(state), "utf8"); });
  const ask = (op: BridgeOp): Promise<BridgeResponse> => handleRequest({ v: 1, root, ...op });
  const isShell = (tool: string): boolean => (tools.isShell !== undefined ? tools.isShell(tool) : tool === tools.shell);
  const own = (tool: string): boolean => isOwnTool(tool) || isOwnTool(tools.bareTool(tool));
  /** The call's id: the host's, else one made from the call itself, the same before and after it (a wrapped command unwrapped). */
  const idOf = (given: string | undefined, call: CallFacts): string => given ?? `${host}-${createHash("sha1").update(JSON.stringify(call)).digest("hex").slice(0, 12)}`;

  /** The stage text, when the model has not read this `item@rev` yet and the item is the session's current one. */
  const stage = (status: Status | null, always = false): string | undefined => {
    const doc = join(root, CONTEXT_DOC);
    if (!exists(doc)) return undefined;
    const seen = contextOf(readText(doc));
    if (seen === undefined || (!always && seen.key === state.delivered)) return undefined;
    const item = status?.item;
    if (item === undefined || item.kind !== "item" || item.id !== seen.item) return undefined;
    state.delivered = seen.key;
    return seen.text;
  };

  switch (ev.kind) {
    case "start": {
      record(() => { appendSession(root, host, sid, () => [], now); });
      let told: string[] = [];
      try { told = [SESSIONS_PROMPT.replace("gemworks `note` tool", "`note` tool of the gemworks MCP server"), ...loopPrompt(coachFlowsAt(root))]; } catch { /* the tools' own descriptions say it */ }
      if (ev.source === undefined || ev.source === "startup") record(() => { if (boardHasWork(root)) openBoardOnce(root, sid); });
      let text: string | undefined;
      const res = await ask({ op: "status" });
      if (res.ok && res.shell.status !== null) {
        // The git facts first: a PR merged or CI finished since the last session may move the stage now.
        const fresh = await ask({ op: "refresh" });
        text = stage((fresh.ok ? fresh.shell.status : null) ?? res.shell.status, true);
      }
      save();
      const said = [text, ...told].filter((x): x is string => x !== undefined && x !== "").join("\n\n");
      return said === "" ? undefined : { kind: "context", text: said };
    }
    case "prompt": {
      const words = ev.words;
      // The reminder the turn's end sent, and a host's own sends inside a turn, are the same turn: nothing to record or say again.
      const reminder = words !== undefined && words.trim() === WORK_REMINDER.trim();
      const newTurn = !reminder && (ev.personal || ev.turn === undefined || ev.turn !== state.turn);
      if (!newTurn) return undefined;
      state.turn = ev.turn ?? null;
      let shared: string | undefined;
      record(() => {
        if (words !== undefined && words.trim() !== "") recordPrompt(root, host, sid, words, now);
        const fresh = decisionsFor(root, sid, state.decisionsSeen, now);
        state.decisionsSeen = now;
        if (fresh.length > 0) shared = decisionsContext(fresh, (d) => `${hostLabel(d.host)}${d.branch !== undefined ? ` · ${d.branch}` : ""}，${new Date(d.at).toTimeString().slice(0, 5)}`);
      });
      // A new turn: nothing changed in it yet, and it was not sent back. The board says the last turn's questions are answered.
      state.acted = false;
      state.reminded = false;
      record(() => { writeBoard(root); });
      let loop: string[] = [];
      try { loop = loopContext(root, sid); } catch { /* the model reports them anew */ }
      const res = await ask({ op: "status" });
      const text = res.ok && res.shell.status !== null ? stage(res.shell.status) : undefined;
      save();
      const said = [text, shared, ...loop].filter((x): x is string => x !== undefined && x !== "");
      return said.length === 0 ? undefined : { kind: "context", text: said.join("\n\n") };
    }
    case "before": {
      const { tool, input } = ev;
      if (own(tool)) return undefined;
      const call = tools.callOf(tool, input);
      const res = await ask({ op: "status" });
      if (!res.ok || res.shell.policy === null) return undefined;
      const { policy } = res.shell;
      let context: string | undefined;
      const decision = beforeDecision(policy, call);
      if (decision.kind === "prefer") context = `[gemworks] ${decision.use}'s preferred tool is ${decision.preferred}; this call uses ${decision.key}.`;
      else if (decision.kind === "consult") {
        const before = await ask({ op: "before", tool: call.tool, callId: idOf(ev.callId, call), input: call.input, cwd: root, ...(decision.waived !== undefined ? { waived: decision.waived } : {}) });
        if (before.ok && before.refusal !== undefined) return { kind: "deny", reason: before.refusal };
      }
      let updated: Record<string, unknown> | undefined;
      const fill = paramsToFill(policy, call);
      if (fill !== undefined) updated = { ...input, ...fill };
      // A shell command whose exit status is evidence prints it last, whatever shape the result takes. Not on Windows: the wrapper is POSIX shell.
      const command = isShell(tool) ? commandOf(input) : undefined;
      if (command !== undefined && policy.active && platform !== "win32" && !isWrapped(command) && speaksEvidence(policy, command)) updated = { ...(updated ?? input), command: wrapCommand(command) };
      if (updated === undefined && context === undefined) return undefined;
      return { kind: "allow", ...(updated !== undefined ? { input: updated } : {}), ...(context !== undefined ? { context } : {}) };
    }
    case "after": {
      const { tool, failed } = ev;
      if (own(tool)) return undefined;
      // The host reports the command as it ran it — wrapped, when `before` wrapped it; the journal records the command itself.
      const raw = isShell(tool) ? commandOf(ev.input) : undefined;
      const input = raw !== undefined && isWrapped(raw) ? { ...ev.input, command: unwrapCommand(raw) } : ev.input;
      const call = tools.callOf(tool, input);
      const written = failed ? [] : tools.writes(tool, input).map((p) => projectPath(root, p)).filter((p): p is string => p !== undefined);
      for (const p of written) record(() => { recordFile(root, host, sid, p, now); });
      const wrote = written[0];
      if (isShell(tool) && raw !== undefined && !failed && commits(unwrapCommand(raw))) state.committed = true;
      if (isShell(tool) || tools.writes(tool, input).length > 0) state.acted = true;
      save();
      const res = await ask({ op: "status" });
      if (!res.ok || res.shell.policy === null) return undefined;
      const exitCode = isShell(tool) && !failed ? tools.exitCodeOf(ev.response) : undefined;
      const isError = failed || (typeof exitCode === "number" && exitCode !== 0);
      const outcome = { isError, gitOperation: false, consulted: false, ...(typeof exitCode === "number" ? { exitCode } : {}), ...(wrote !== undefined ? { wrotePath: wrote } : {}) };
      if (!afterNeeded(res.shell.policy, call, outcome)) return undefined;
      const after = await ask({
        op: "after", tool: call.tool, callId: idOf(ev.callId, call), input: call.input, isError, gitOperation: false, cwd: root,
        ...(typeof exitCode === "number" ? { exitCode } : {}), ...(wrote !== undefined ? { wrotePath: wrote } : {}), ...(state.delivered !== null ? { delivered: state.delivered } : {}) });
      if (!after.ok || after.context === undefined) return undefined;
      if (after.shell.contextKey !== null) { state.delivered = after.shell.contextKey; save(); }
      return { kind: "context", text: after.handoff !== undefined ? `${after.handoff}\n${after.context}` : after.context };
    }
    // The turn's end. One that changed things and reported no work item goes back once to report it (the record
    // unread counts as reported: the reminder never comes from Gemworks' own failure). Else its answer and the commits
    // a command in it made go into the record, and the board is written again.
    case "stop": {
      if (state.acted && !ev.retry && !state.reminded) {
        state.acted = false;
        let reported = true;
        record(() => {
          const events = appendSession(root, host, sid, () => [], now);
          const turn = currentTurn(events);
          reported = events.some((e) => e.t === "item" && e.turn === turn) || coachFlowsAt(root).length === 0;
        });
        if (!reported) { state.reminded = true; save(); return { kind: "continue", reason: WORK_REMINDER }; }
      }
      record(() => { writeBoard(root); });
      record(() => { recordAnswer(root, host, sid, ev.answer ?? "", state.committed, now); });
      Object.assign(state, { committed: false, acted: false });
      save();
      return undefined;
    }
  }
}
