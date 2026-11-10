// `gemworks qwen`: Gemworks's adapter for Qwen Code (its hooks: the `hooks` of
// `~/.qwen/settings.json`, put there by `gemworks qwen install`). Qwen Code
// runs one command per hook, a fresh process each time, with the event on
// stdin (src/hosts/qwen/hook.ts reads it); each event opens the workspace
// through the bridge's own `handleRequest`, in this process, and decides with
// the same functions the Claude Code module and the Codex adapter decide with.
//
// Qwen Code's hooks are Claude Code's, so the adapter is Codex's with Qwen
// Code's names: SessionStart hands the model the work loop's standing
// instructions, the note tool and the stage text, and opens the GEML board
// when it has work on it; UserPromptSubmit records the prompt and says beside
// it the stage text when it changed, the other sessions' decisions not yet
// read, the work items on the way and the step's practices; PreToolUse refuses
// what the gate refuses, fills a tool's default parameters, and wraps a shell
// command whose exit status is evidence so the status comes back in its output
// (the shell tool's own report usually says it too); PostToolUse reads it back
// and asks `after`, and puts a written file in the project's shared session
// record; Stop writes the answer and the board — or, when the turn changed
// things and reported no work item, sends the model back once with the
// reminder.
//
// UserPromptSubmit also runs on some of Qwen Code's own sends inside a turn,
// so a new turn is one whose `prompt_id` is new or that carries the person's
// `submitted_prompt`, and the person's words are `submitted_prompt` when Qwen
// Code gives it. The project is `QWEN_PROJECT_DIR`, else the event's `cwd`;
// the MCP server Qwen Code starts in the same directory and finds the session
// in the record. Nothing here stops the agent: whatever fails, there is no
// output and exit 0, and the reason goes to stderr.
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
import { contextOf } from "./hosts/claude-code/readers.js";
import { isWrapped, unwrapCommand, wrapCommand } from "./hosts/codex/hook.js";
import { allowCall, bareTool, callOf, contextFor, denyCall, exitCodeOf, pathOf, readEvent, SHELL, writesFiles } from "./hosts/qwen/hook.js";
import type { Status } from "./workspace.js";
import { boardHasWork, openBoardOnce, writeBoard } from "./board-file.js";
import { projectPath, readSettings } from "./cursor.js";
import { coachFlowsAt, loopContext, loopPrompt } from "./loop.js";
import { appendSession, commits, decisionsFor, hostLabel, recordAnswer, recordFile, recordPrompt } from "./session-store.js";

export const QWEN_HOST = "qwen";

/** Where the adapter keeps a session's state. */
export function stateDir(home: string = homedir()): string {
  return join(home, ".gemworks", "qwen");
}

/** What one session has been told and done: the stage text it last read, when it last read the other sessions' decisions, the turn it is in, and whether that turn committed or changed things. */
interface SessionState { delivered: string | null; decisionsSeen: string | null; turn: string | null; committed: boolean; acted: boolean }
const FRESH: SessionState = { delivered: null, decisionsSeen: null, turn: null, committed: false, acted: false };

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

/** The project: `QWEN_PROJECT_DIR`, else the event's `cwd`. */
export function projectOf(env: NodeJS.ProcessEnv, cwd: string | undefined): string | undefined {
  const dir = env["QWEN_PROJECT_DIR"] !== undefined && env["QWEN_PROJECT_DIR"] !== "" ? env["QWEN_PROJECT_DIR"] : cwd;
  return dir === undefined ? undefined : resolve(dir);
}

export interface QwenRun { stdout: string }
const NOTHING: QwenRun = { stdout: "" };
const say = (o: Record<string, unknown> | undefined): QwenRun => (o === undefined ? NOTHING : { stdout: `${JSON.stringify(o)}\n` });

export interface QwenOptions { home?: string; platform?: string; now?: string }

export async function runQwen(text: string, env: NodeJS.ProcessEnv, o: QwenOptions = {}): Promise<QwenRun> {
  const ev = readEvent(text);
  if (ev === undefined) return NOTHING;
  const sid = ev.session_id;
  const root = projectOf(env, ev.cwd);
  if (sid === undefined || root === undefined) return NOTHING;
  const home = o.home ?? homedir();
  const platform = o.platform ?? process.platform;
  const now = o.now ?? new Date().toISOString();
  const file = join(stateDir(home), `${sid.replace(/[^A-Za-z0-9._-]/g, "_")}.json`);
  const state = readState(file);
  // The project's shared session record and this adapter's own state: what fails to be written is missed, never a broken hook.
  const record = (f: () => void): void => { try { f(); } catch { /* missed this once */ } };
  const save = (): void => record(() => { mkdirSync(stateDir(home), { recursive: true }); writeFileSync(file, JSON.stringify(state), "utf8"); });
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
    case "SessionStart": {
      record(() => { appendSession(root, QWEN_HOST, sid, () => [], now); });
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
      return said === "" ? NOTHING : say(contextFor("SessionStart", said));
    }
    case "UserPromptSubmit": {
      const words = ev.submitted_prompt ?? ev.prompt;
      // The reminder Stop sent, and Qwen Code's own sends inside a turn, are the same turn: nothing to record or say again.
      const reminder = words !== undefined && words.trim() === WORK_REMINDER.trim();
      const newTurn = !reminder && (ev.submitted_prompt !== undefined || ev.prompt_id === undefined || ev.prompt_id !== state.turn);
      if (!newTurn) return NOTHING;
      state.turn = ev.prompt_id ?? null;
      let shared: string | undefined;
      record(() => {
        if (words !== undefined && words.trim() !== "") recordPrompt(root, QWEN_HOST, sid, words, now);
        const fresh = decisionsFor(root, sid, state.decisionsSeen, now);
        state.decisionsSeen = now;
        if (fresh.length > 0) shared = decisionsContext(fresh, (d) => `${hostLabel(d.host)}${d.branch !== undefined ? ` · ${d.branch}` : ""}，${new Date(d.at).toTimeString().slice(0, 5)}`);
      });
      // A new turn: nothing changed in it yet. The board says the last turn's questions are answered.
      state.acted = false;
      record(() => { writeBoard(root); });
      let loop: string[] = [];
      try { loop = loopContext(root, sid); } catch { /* the model reports them anew */ }
      const res = await ask({ op: "status" });
      const text = res.ok && res.shell.status !== null ? stage(res.shell.status) : undefined;
      save();
      const said = [text, shared, ...loop].filter((x): x is string => x !== undefined && x !== "");
      return said.length === 0 ? NOTHING : say(contextFor("UserPromptSubmit", said.join("\n\n")));
    }
    case "PreToolUse": {
      const tool = ev.tool_name;
      if (tool === undefined || isOwnTool(tool) || isOwnTool(bareTool(tool))) return NOTHING;
      const input = ev.tool_input ?? {};
      const call = callOf(tool, input);
      const res = await ask({ op: "status" });
      if (!res.ok || res.shell.policy === null) return NOTHING;
      const { policy } = res.shell;
      let context: string | undefined;
      const decision = beforeDecision(policy, call);
      if (decision.kind === "prefer") context = `[gemworks] ${decision.use}'s preferred tool is ${decision.preferred}; this call uses ${decision.key}.`;
      else if (decision.kind === "consult") {
        const before = await ask({ op: "before", tool: call.tool, callId: ev.tool_use_id ?? "qwen", input: call.input, cwd: root, ...(decision.waived !== undefined ? { waived: decision.waived } : {}) });
        if (before.ok && before.refusal !== undefined) return say(denyCall(before.refusal));
      }
      let updated: Record<string, unknown> | undefined;
      const fill = paramsToFill(policy, call);
      if (fill !== undefined) updated = { ...input, ...fill };
      // A shell command whose exit status is evidence prints it last, whatever shape the result takes. Not on Windows: the wrapper is POSIX shell.
      const command = tool === SHELL ? commandOf(input) : undefined;
      if (command !== undefined && policy.active && platform !== "win32" && !isWrapped(command) && speaksEvidence(policy, command)) updated = { ...(updated ?? input), command: wrapCommand(command) };
      return say(allowCall(updated, context));
    }
    case "PostToolUse":
    case "PostToolUseFailure": {
      const tool = ev.tool_name;
      if (tool === undefined || isOwnTool(tool) || isOwnTool(bareTool(tool))) return NOTHING;
      const failed = ev.hook_event_name === "PostToolUseFailure";
      // Qwen Code reports the command as it ran it — wrapped, when PreToolUse wrapped it; the journal records the command itself.
      const given = ev.tool_input ?? {};
      const raw = tool === SHELL ? commandOf(given) : undefined;
      const input = raw !== undefined && isWrapped(raw) ? { ...given, command: unwrapCommand(raw) } : given;
      const call = callOf(tool, input);
      const wrote = writesFiles(tool) && !failed ? projectPath(root, pathOf(input)) : undefined;
      if (wrote !== undefined) record(() => { recordFile(root, QWEN_HOST, sid, wrote, now); });
      if (tool === SHELL && raw !== undefined && !failed && commits(unwrapCommand(raw))) state.committed = true;
      if (tool === SHELL || writesFiles(tool)) state.acted = true;
      save();
      const res = await ask({ op: "status" });
      if (!res.ok || res.shell.policy === null) return NOTHING;
      const exitCode = tool === SHELL && !failed ? exitCodeOf(ev.tool_response) : undefined;
      const isError = failed || (typeof exitCode === "number" && exitCode !== 0);
      const outcome = { isError, gitOperation: false, consulted: false, ...(typeof exitCode === "number" ? { exitCode } : {}), ...(wrote !== undefined ? { wrotePath: wrote } : {}) };
      if (!afterNeeded(res.shell.policy, call, outcome)) return NOTHING;
      const after = await ask({
        op: "after", tool: call.tool, callId: ev.tool_use_id ?? "qwen", input: call.input, isError, gitOperation: false, cwd: root,
        ...(typeof exitCode === "number" ? { exitCode } : {}), ...(wrote !== undefined ? { wrotePath: wrote } : {}), ...(state.delivered !== null ? { delivered: state.delivered } : {}) });
      if (!after.ok || after.context === undefined) return NOTHING;
      if (after.shell.contextKey !== null) { state.delivered = after.shell.contextKey; save(); }
      return say(contextFor(failed ? "PostToolUseFailure" : "PostToolUse", after.handoff !== undefined ? `${after.handoff}\n${after.context}` : after.context));
    }
    // The turn's end. One that changed things and reported no work item goes back once to report it (the record
    // unread counts as reported: the reminder never comes from Gemworks' own failure). Else its answer and the commits
    // a command in it made go into the record, and the board is written again.
    case "Stop": {
      if (state.acted && ev.stop_hook_active !== true) {
        state.acted = false;
        let reported = true;
        record(() => {
          const events = appendSession(root, QWEN_HOST, sid, () => [], now);
          const turn = currentTurn(events);
          reported = events.some((e) => e.t === "item" && e.turn === turn) || coachFlowsAt(root).length === 0;
        });
        if (!reported) { save(); return say({ decision: "block", reason: WORK_REMINDER }); }
      }
      record(() => { writeBoard(root); });
      record(() => { recordAnswer(root, QWEN_HOST, sid, ev.last_assistant_message ?? "", state.committed, now); });
      Object.assign(state, { committed: false, acted: false });
      save();
      return NOTHING;
    }
    default:
      return NOTHING;
  }
}

/** The hook events the adapter answers, and how long Qwen Code waits for each, in seconds. */
const EVENTS: Readonly<Record<string, number>> = { SessionStart: 60, UserPromptSubmit: 30, PreToolUse: 30, PostToolUse: 60, PostToolUseFailure: 30, Stop: 30 };

/** Whether a hook is one of this adapter's, from this install or an earlier one wherever the bundle lay. */
const isOurs = (hook: unknown): boolean => typeof hook === "object" && hook !== null && typeof (hook as { command?: unknown }).command === "string" && /gemworks(\.mjs)?"?\s+qwen$/.test((hook as { command: string }).command);

/** The settings' hooks with this adapter's put in, every other hook kept; a group left with no hook goes. */
export function hooksWith(settings: Record<string, unknown>, command: string): Record<string, unknown> {
  const given = settings["hooks"];
  const hooks: Record<string, unknown> = typeof given === "object" && given !== null && !Array.isArray(given) ? { ...(given as Record<string, unknown>) } : {};
  for (const [event, timeout] of Object.entries(EVENTS)) {
    const groups = Array.isArray(hooks[event]) ? (hooks[event] as unknown[]) : [];
    const kept = groups.flatMap((g) => {
      if (typeof g !== "object" || g === null || !Array.isArray((g as { hooks?: unknown }).hooks)) return [g];
      const left = ((g as { hooks: unknown[] }).hooks).filter((h) => !isOurs(h));
      return left.length === 0 ? [] : [{ ...(g as object), hooks: left }];
    });
    hooks[event] = [...kept, { hooks: [{ type: "command", command, name: "gemworks", timeout }] }];
  }
  return { ...settings, hooks };
}

/** `gemworks qwen install`: the adapter's hooks and the MCP server into Qwen Code's user settings, both running `bundle`. Returns the file written. */
export function installQwen(bundle: string, home: string = homedir()): string[] {
  const dir = join(home, ".qwen");
  const file = join(dir, "settings.json");
  const settings = readSettings(file);
  // Qwen Code runs a hook command through the shell: the path with forward slashes, quoted.
  const path = bundle.split("\\").join("/");
  const next = hooksWith(settings, `node "${path}" qwen`);
  const servers = typeof settings["mcpServers"] === "object" && settings["mcpServers"] !== null ? (settings["mcpServers"] as Record<string, unknown>) : {};
  next["mcpServers"] = { ...servers, gemworks: { command: "node", args: [bundle, "mcp", "--host", QWEN_HOST] } };
  mkdirSync(dir, { recursive: true });
  writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return [file];
}
