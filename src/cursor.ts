// `gemworks cursor`: Gemworks's adapter for Cursor's agent (its hooks:
// `~/.cursor/hooks.json`, put there by `gemworks cursor install`). Cursor runs
// one command per hook, a fresh process each time, with the event on stdin
// (src/hosts/cursor/hook.ts reads it); each event opens the workspace through
// the bridge's own `handleRequest`, in this process, and decides with the same
// functions the Claude Code module and the Codex adapter decide with.
//
// sessionStart hands the model the work loop's standing instructions, the
// note tool and the stage text, and opens the GEML board when it has work on
// it. beforeSubmitPrompt records the prompt, but Cursor lets that hook only
// pass or stop the prompt, never speak to the model: what Codex says beside a
// prompt — the stage text when it changed, the other sessions' decisions not
// yet read, the work items on the way and the step's practices — waits in the
// conversation's state and reaches the model with the result of the turn's
// first tool call (postToolUse's `additional_context`); a turn that calls no
// tool hears it at the next one. preToolUse refuses what the gate refuses,
// fills a tool's default parameters, and wraps a shell command whose exit
// status is evidence so the status comes back in its output; postToolUse reads
// it back and asks `after`. afterFileEdit puts the file in the project's
// shared session record, afterAgentResponse keeps the turn's answer, and stop
// writes the answer and the board — or, when the turn changed things and
// reported no work item, sends the model back once with the reminder as a
// follow-up message.
//
// The hooks run in `~/.cursor`, so the project is the workspace root holding
// a `.geml/`, else the first one, else `CURSOR_PROJECT_DIR`. The MCP server,
// which Cursor starts with no project of its own, learns the conversation and
// its project from a pointer the hooks keep (as Antigravity's does). Nothing
// here stops the agent: whatever fails, the answer is `{}` — Cursor blocks a
// permission hook whose output is no JSON — and the reason goes to stderr.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { handleRequest } from "./bridge.js";
import { commandOf } from "./core/command-line.js";
import { bindingOf, evidenceKeys, type Dictionary } from "./core/dictionary.js";
import { CONTEXT_DOC } from "./core/layout.js";
import type { FlowPolicy } from "./core/policy.js";
import { currentTurn, decisionsContext, SESSIONS_PROMPT } from "./core/session-log.js";
import { isOwnTool } from "./core/verb-specs.js";
import { WORK_REMINDER } from "./core/work.js";
import { exists, readText } from "./host-fs.js";
import { afterNeeded, beforeDecision, paramsToFill } from "./hosts/claude-code/fastpath.js";
import type { BridgeOp, BridgeResponse } from "./hosts/claude-code/protocol.js";
import { contextOf, normalised } from "./hosts/claude-code/readers.js";
import { isWrapped, unwrapCommand, wrapCommand } from "./hosts/codex/hook.js";
import { bareTool, callOf, denyCall, exitCodeOf, pathOf, readEvent, rewriteCall, SHELL, writesFiles } from "./hosts/cursor/hook.js";
import type { Status } from "./workspace.js";
import { boardHasWork, openBoardOnce, writeBoard } from "./board-file.js";
import { coachFlowsAt, loopContext, loopPrompt } from "./loop.js";
import { appendSession, commits, decisionsFor, hostLabel, recordAnswer, recordFile, recordPrompt } from "./session-store.js";

export const CURSOR_HOST = "cursor";

/** Where the adapter keeps a conversation's state and the pointer to the active one. */
export function stateDir(home: string = homedir()): string {
  return join(home, ".gemworks", "cursor");
}

/**
 * What one conversation has been told and done: the stage text it last read, when it last read the other sessions'
 * decisions, what waits to be said beside the next tool result, the turn's answer so far, and whether the turn
 * committed or changed things.
 */
interface ConversationState { delivered: string | null; decisionsSeen: string | null; pending: string[]; answer: string; committed: boolean; acted: boolean }
const FRESH: ConversationState = { delivered: null, decisionsSeen: null, pending: [], answer: "", committed: false, acted: false };

function readJson<T extends object>(file: string, fallback: T): T {
  try { return { ...fallback, ...(JSON.parse(readFileSync(file, "utf8")) as Partial<T>) }; } catch { return { ...fallback }; }
}

function writeJson(file: string, value: unknown): void {
  mkdirSync(resolve(file, ".."), { recursive: true });
  writeFileSync(file, JSON.stringify(value), "utf8");
}

/** The conversation the hooks last saw and its project: what the MCP server, started outside any project, writes for. */
export interface Active { conversationId: string; root: string; at: string }

export function activeOf(home: string = homedir()): Active | undefined {
  const a = readJson<Partial<Active>>(join(stateDir(home), "active.json"), {});
  return typeof a.conversationId === "string" && typeof a.root === "string" ? { conversationId: a.conversationId, root: a.root, at: a.at ?? "" } : undefined;
}

/** The project: the workspace root holding a `.geml/`, else the first root, else `CURSOR_PROJECT_DIR`, else the event's `cwd`. */
export function projectOf(roots: readonly string[], env: NodeJS.ProcessEnv, cwd: string | undefined): string | undefined {
  const withGeml = roots.find((r) => existsSync(join(r, ".geml")));
  const pick = withGeml ?? roots[0] ?? (env["CURSOR_PROJECT_DIR"] !== undefined && env["CURSOR_PROJECT_DIR"] !== "" ? env["CURSOR_PROJECT_DIR"] : undefined) ?? cwd;
  return pick === undefined ? undefined : resolve(pick);
}

/** Whether a shell command's exit status is `tool` evidence: a key of it is bound to a use some `tool` variable reads. */
function speaksEvidence(policy: FlowPolicy, command: string): boolean {
  const keys = evidenceKeys(command);
  if (keys === null) return false;
  const dict: Dictionary = { rows: policy.rows, diagnostics: [] };
  const evidence = new Set(policy.evidence);
  return keys.some((k) => { const row = bindingOf(dict, k); return row?.for !== undefined && evidence.has(row.for); });
}

/** A path as the record keeps it: project-relative, `/`-separated; undefined outside the project. */
export function projectPath(root: string, path: string | undefined): string | undefined {
  if (path === undefined) return undefined;
  const p = normalised(path);
  const base = normalised(root)?.replace(/\/+$/, "");
  if (p === undefined || base === undefined) return undefined;
  const lower = (s: string): string => (process.platform === "win32" ? s.toLowerCase() : s);
  if (lower(p).startsWith(`${lower(base)}/`)) return p.slice(base.length + 1);
  if (p.startsWith("/") || /^[A-Za-z]:/.test(p)) return undefined;
  return p === "" ? undefined : p.replace(/^\.\//, "");
}

export interface CursorRun { stdout: string }
const say = (o: Record<string, unknown>): CursorRun => ({ stdout: `${JSON.stringify(o)}\n` });
const NOTHING: CursorRun = say({});

export interface CursorOptions { home?: string; platform?: string; now?: string }

export async function runCursor(text: string, env: NodeJS.ProcessEnv, o: CursorOptions = {}): Promise<CursorRun> {
  const ev = readEvent(text);
  if (ev === undefined) return NOTHING;
  const home = o.home ?? homedir();
  const platform = o.platform ?? process.platform;
  const sid = ev.conversation_id ?? ev.session_id;
  const root = projectOf(ev.workspace_roots ?? [], env, ev.cwd);
  if (sid === undefined || root === undefined) return ev.hook_event_name === "beforeSubmitPrompt" ? say({ continue: true }) : NOTHING;
  const now = o.now ?? new Date().toISOString();
  const file = join(stateDir(home), `${sid.replace(/[^A-Za-z0-9._-]/g, "_")}.json`);
  const state = readJson<ConversationState>(file, FRESH);
  // The project's shared session record and this adapter's own state: what fails to be written is missed, never a broken hook.
  const record = (f: () => void): void => { try { f(); } catch { /* missed this once */ } };
  const save = (): void => record(() => writeJson(file, state));
  record(() => writeJson(join(stateDir(home), "active.json"), { conversationId: sid, root, at: now } satisfies Active));
  const ask = (op: BridgeOp): Promise<BridgeResponse> => handleRequest({ v: 1, root, ...op });

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

  switch (ev.hook_event_name) {
    case "sessionStart": {
      record(() => { appendSession(root, CURSOR_HOST, sid, () => [], now); });
      let told: string[] = [];
      try { told = [SESSIONS_PROMPT.replace("gemworks `note` tool", "`note` tool of the gemworks MCP server"), ...loopPrompt(coachFlowsAt(root))]; } catch { /* the tools' own descriptions say it */ }
      record(() => { if (boardHasWork(root)) openBoardOnce(root, sid); });
      let text: string | undefined;
      const res = await ask({ op: "status" });
      if (res.ok && res.shell.status !== null) {
        // The git facts first: a PR merged or CI finished since the last session may move the stage now.
        const fresh = await ask({ op: "refresh" });
        text = stage((fresh.ok ? fresh.shell.status : null) ?? res.shell.status, true);
      }
      Object.assign(state, { pending: [], answer: "", acted: false });
      save();
      const said = [text, ...told].filter((x): x is string => x !== undefined && x !== "").join("\n\n");
      return said === "" ? NOTHING : say({ additional_context: said });
    }
    case "beforeSubmitPrompt": {
      // The prompt into the record; what Codex would say beside it waits for the turn's first tool result.
      const pending: string[] = [];
      record(() => {
        // The reminder stop sent comes back as a prompt: the hook's words, not the person's, and the same turn.
        if (ev.prompt !== undefined && ev.prompt.trim() !== "" && ev.prompt.trim() !== WORK_REMINDER.trim()) recordPrompt(root, CURSOR_HOST, sid, ev.prompt, now);
        const fresh = decisionsFor(root, sid, state.decisionsSeen, now);
        state.decisionsSeen = now;
        if (fresh.length > 0) pending.push(decisionsContext(fresh, (d) => `${hostLabel(d.host)}${d.branch !== undefined ? ` · ${d.branch}` : ""}，${new Date(d.at).toTimeString().slice(0, 5)}`));
      });
      // A new turn: nothing changed in it yet. The board says the last turn's questions are answered.
      Object.assign(state, { acted: false, answer: "" });
      record(() => { writeBoard(root); });
      let loop: string[] = [];
      try { loop = loopContext(root, sid); } catch { /* the model reports them anew */ }
      const res = await ask({ op: "status" });
      const text = res.ok && res.shell.status !== null ? stage(res.shell.status) : undefined;
      // What the last turn left unsaid is older than this: the newest stands alone.
      state.pending = [text, ...pending, ...loop].filter((x): x is string => x !== undefined && x !== "");
      save();
      return say({ continue: true });
    }
    case "preToolUse": {
      const tool = ev.tool_name;
      if (tool === undefined || isOwnTool(bareTool(tool))) return NOTHING;
      const input = ev.tool_input ?? {};
      const call = callOf(tool, input);
      const res = await ask({ op: "status" });
      if (!res.ok || res.shell.policy === null) return NOTHING;
      const { policy } = res.shell;
      const decision = beforeDecision(policy, call);
      if (decision.kind === "prefer") { state.pending.push(`[gemworks] ${decision.use}'s preferred tool is ${decision.preferred}; this call uses ${decision.key}.`); save(); }
      else if (decision.kind === "consult") {
        const before = await ask({ op: "before", tool: call.tool, callId: ev.tool_use_id ?? "cursor", input: call.input, cwd: root, ...(decision.waived !== undefined ? { waived: decision.waived } : {}) });
        if (before.ok && before.refusal !== undefined) return say(denyCall(before.refusal));
      }
      let updated: Record<string, unknown> | undefined;
      const fill = paramsToFill(policy, call);
      if (fill !== undefined) updated = { ...input, ...fill };
      // A shell command whose exit status is evidence prints it last, in case Cursor's result does not carry it. Not on Windows: the wrapper is POSIX shell.
      const command = tool === SHELL ? commandOf(input) : undefined;
      if (command !== undefined && policy.active && platform !== "win32" && !isWrapped(command) && speaksEvidence(policy, command)) updated = { ...(updated ?? input), command: wrapCommand(command) };
      return say(rewriteCall(updated));
    }
    case "postToolUse":
    case "postToolUseFailure": {
      const tool = ev.tool_name;
      if (tool === undefined) return NOTHING;
      const failed = ev.hook_event_name === "postToolUseFailure";
      // What waits to be said goes with this result, whatever the tool.
      const said = state.pending;
      state.pending = [];
      const reply = (extra?: string): CursorRun => {
        save();
        const all = [...said, ...(extra !== undefined ? [extra] : [])];
        return all.length === 0 ? NOTHING : say({ additional_context: all.join("\n\n") });
      };
      if (isOwnTool(bareTool(tool))) return reply();
      // Cursor reports the command as it ran it — wrapped, when preToolUse wrapped it; the journal records the command itself.
      const given = ev.tool_input ?? {};
      const raw = tool === SHELL ? commandOf(given) : undefined;
      const input = raw !== undefined && isWrapped(raw) ? { ...given, command: unwrapCommand(raw) } : given;
      const call = callOf(tool, input);
      if (tool === SHELL && raw !== undefined && commits(unwrapCommand(raw)) && !failed) state.committed = true;
      if (tool === SHELL || writesFiles(tool)) state.acted = true;
      const res = await ask({ op: "status" });
      if (!res.ok || res.shell.policy === null) return reply();
      const exitCode = tool === SHELL && !failed ? exitCodeOf(ev.tool_output) : undefined;
      const wrotePath = writesFiles(tool) && !failed ? projectPath(root, pathOf(input)) : undefined;
      const isError = failed || (typeof exitCode === "number" && exitCode !== 0);
      const outcome = { isError, gitOperation: false, consulted: false, ...(typeof exitCode === "number" ? { exitCode } : {}), ...(wrotePath !== undefined ? { wrotePath } : {}) };
      if (!afterNeeded(res.shell.policy, call, outcome)) return reply();
      const after = await ask({
        op: "after", tool: call.tool, callId: ev.tool_use_id ?? "cursor", input: call.input, isError, gitOperation: false, cwd: root,
        ...(typeof exitCode === "number" ? { exitCode } : {}), ...(wrotePath !== undefined ? { wrotePath } : {}), ...(state.delivered !== null ? { delivered: state.delivered } : {}) });
      if (!after.ok || after.context === undefined) return reply();
      if (after.shell.contextKey !== null) state.delivered = after.shell.contextKey;
      return reply(after.handoff !== undefined ? `${after.handoff}\n${after.context}` : after.context);
    }
    case "afterFileEdit": {
      const path = projectPath(root, ev.file_path);
      if (path !== undefined) record(() => { recordFile(root, CURSOR_HOST, sid, path, now); });
      state.acted = true;
      save();
      return NOTHING;
    }
    case "afterAgentResponse": {
      if (ev.text !== undefined && ev.text.trim() !== "") { state.answer = ev.text; save(); }
      return NOTHING;
    }
    // The turn's end. One that changed things and reported no work item goes back once to report it (the record
    // unread counts as reported: the reminder never comes from Gemworks' own failure). Else its answer and the commits
    // a command in it made go into the record, and the board is written again.
    case "stop": {
      if (state.acted && ev.status === "completed" && (ev.loop_count ?? 0) === 0) {
        state.acted = false;
        let reported = true;
        record(() => {
          const events = appendSession(root, CURSOR_HOST, sid, () => [], now);
          const turn = currentTurn(events);
          reported = events.some((e) => e.t === "item" && e.turn === turn) || coachFlowsAt(root).length === 0;
        });
        if (!reported) { save(); return say({ followup_message: WORK_REMINDER }); }
      }
      record(() => { writeBoard(root); });
      record(() => { recordAnswer(root, CURSOR_HOST, sid, state.answer, state.committed, now); });
      Object.assign(state, { committed: false, acted: false, answer: "" });
      save();
      return NOTHING;
    }
    default:
      return NOTHING;
  }
}

/** The hook events the adapter answers, and how long Cursor waits for each, in seconds. */
const EVENTS: Readonly<Record<string, number>> = { sessionStart: 60, beforeSubmitPrompt: 30, preToolUse: 30, postToolUse: 60, postToolUseFailure: 30, afterFileEdit: 20, afterAgentResponse: 20, stop: 30 };

/** Whether a hooks-file entry is one of this adapter's, from this install or an earlier one wherever the bundle lay. */
const isOurs = (entry: unknown): boolean => typeof entry === "object" && entry !== null && typeof (entry as { command?: unknown }).command === "string" && /gemworks(\.mjs)?"?\s+cursor$/.test((entry as { command: string }).command);

/** The hooks file with this adapter's entries put in, every other hook kept. */
export function hooksWith(file: Record<string, unknown>, command: string): Record<string, unknown> {
  const hooks = typeof file["hooks"] === "object" && file["hooks"] !== null && !Array.isArray(file["hooks"]) ? { ...(file["hooks"] as Record<string, unknown>) } : {};
  for (const [event, timeout] of Object.entries(EVENTS)) {
    const kept = Array.isArray(hooks[event]) ? (hooks[event] as unknown[]).filter((e) => !isOurs(e)) : [];
    hooks[event] = [...kept, { command, timeout }];
  }
  return { ...file, version: typeof file["version"] === "number" ? file["version"] : 1, hooks };
}

/** A settings file as an object: none when it is not there; an error when it is there and is not a JSON object, since writing it again would lose it. */
export function readSettings(file: string): Record<string, unknown> {
  if (!existsSync(file)) return {};
  const text = readFileSync(file, "utf8");
  if (text.trim() === "") return {};
  let v: unknown;
  try { v = JSON.parse(text); } catch { throw new Error(`${file} is not plain JSON (comments?): add the hooks and the MCP server by hand, or remove what keeps it from parsing`); }
  if (typeof v !== "object" || v === null || Array.isArray(v)) throw new Error(`${file} is not a JSON object`);
  return v as Record<string, unknown>;
}

/**
 * `gemworks cursor install`: the adapter's hooks into Cursor's user hooks file and the MCP server into its user MCP
 * config, both running `bundle`. Returns the two files written.
 */
export function installCursor(bundle: string, home: string = homedir()): string[] {
  const dir = join(home, ".cursor");
  const hooksFile = join(dir, "hooks.json");
  const mcpFile = join(dir, "mcp.json");
  mkdirSync(dir, { recursive: true });
  // Cursor runs a hook command through the shell: the path with forward slashes, quoted.
  const path = bundle.split("\\").join("/");
  const hooks = readSettings(hooksFile);
  const mcp = readSettings(mcpFile) as { mcpServers?: Record<string, unknown> };
  writeFileSync(hooksFile, `${JSON.stringify(hooksWith(hooks, `node "${path}" cursor`), null, 2)}\n`, "utf8");
  mcp.mcpServers = { ...(mcp.mcpServers ?? {}), gemworks: { command: "node", args: [bundle, "mcp", "--host", CURSOR_HOST] } };
  writeFileSync(mcpFile, `${JSON.stringify(mcp, null, 2)}\n`, "utf8");
  return [hooksFile, mcpFile];
}
