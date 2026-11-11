// `gemworks qwen`: Gemworks's adapter for Qwen Code (its hooks: the `hooks` of
// `~/.qwen/settings.json`, put there by `gemworks qwen install`). Qwen Code
// runs one command per hook, a fresh process each time, with the event on
// stdin (src/hosts/qwen/hook.ts reads it); each event opens the workspace
// through the bridge's own `handleRequest`, in this process, and decides with
// the same functions the Claude Code module and the Codex adapter decide with.
//
// Qwen Code's hooks are Claude Code's, so the adapter is Codex's with Qwen
// Code's names (the decisions are src/hooked.ts's): SessionStart hands the model the work loop's standing
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
import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { hostStateDir, runHooked, type HookedEvent, type HostTools } from "./hooked.js";
import { allowCall, bareTool, callOf, contextFor, denyCall, exitCodeOf, pathOf, readEvent, SHELL, writesFiles } from "./hosts/qwen/hook.js";
import { readSettings } from "./cursor.js";

export const QWEN_HOST = "qwen";

/** Where the adapter keeps a session's state. */
export const stateDir = (home: string = homedir()): string => hostStateDir(QWEN_HOST, home);

/** The project: `QWEN_PROJECT_DIR`, else the event's `cwd`. */
export function projectOf(env: NodeJS.ProcessEnv, cwd: string | undefined): string | undefined {
  const dir = env["QWEN_PROJECT_DIR"] !== undefined && env["QWEN_PROJECT_DIR"] !== "" ? env["QWEN_PROJECT_DIR"] : cwd;
  return dir === undefined ? undefined : resolve(dir);
}

const TOOLS: HostTools = {
  shell: SHELL,
  callOf,
  writes: (tool, input) => { const p = writesFiles(tool) ? pathOf(input) : undefined; return p === undefined ? [] : [p]; },
  exitCodeOf,
  bareTool,
};

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
  let event: HookedEvent;
  switch (ev.hook_event_name) {
    case "SessionStart": event = { kind: "start", ...(ev.source !== undefined ? { source: ev.source } : {}) }; break;
    // UserPromptSubmit also runs on some of Qwen Code's own sends inside a turn: a new turn is one whose `prompt_id` is
    // new or that carries the person's `submitted_prompt`.
    case "UserPromptSubmit": {
      const words = ev.submitted_prompt ?? ev.prompt;
      event = { kind: "prompt", personal: ev.submitted_prompt !== undefined, ...(words !== undefined ? { words } : {}), ...(ev.prompt_id !== undefined ? { turn: ev.prompt_id } : {}) };
      break;
    }
    case "PreToolUse":
      if (ev.tool_name === undefined) return NOTHING;
      event = { kind: "before", tool: ev.tool_name, input: ev.tool_input ?? {}, ...(ev.tool_use_id !== undefined ? { callId: ev.tool_use_id } : {}) };
      break;
    case "PostToolUse":
    case "PostToolUseFailure":
      if (ev.tool_name === undefined) return NOTHING;
      event = { kind: "after", tool: ev.tool_name, input: ev.tool_input ?? {}, failed: ev.hook_event_name === "PostToolUseFailure", response: ev.tool_response, ...(ev.tool_use_id !== undefined ? { callId: ev.tool_use_id } : {}) };
      break;
    case "Stop": event = { kind: "stop", retry: ev.stop_hook_active === true, ...(ev.last_assistant_message !== undefined ? { answer: ev.last_assistant_message } : {}) }; break;
    default: return NOTHING;
  }
  const answer = await runHooked(QWEN_HOST, TOOLS, sid, root, event, o);
  if (answer === undefined) return NOTHING;
  switch (answer.kind) {
    case "context":
      if (ev.hook_event_name === "PreToolUse" || ev.hook_event_name === "Stop") return NOTHING;
      return say(contextFor(ev.hook_event_name as "SessionStart" | "UserPromptSubmit" | "PostToolUse" | "PostToolUseFailure", answer.text));
    case "deny": return say(denyCall(answer.reason));
    case "allow": return say(allowCall(answer.input, answer.context));
    case "continue": return say({ decision: "block", reason: answer.reason });
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
