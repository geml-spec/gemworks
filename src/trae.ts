// `gemworks trae`: Gemworks's adapter for TRAE. TRAE's hooks are Claude Code's — one command per hook with the event on
// stdin (`session_id`, `cwd`, `hook_event_name`, `workspace_roots`, and per event `source`, `prompt`, `tool_use_id`,
// `tool_name`, `tool_input`, `tool_response`, `stop_hook_active`, `last_assistant_message`), Claude Code's
// `hookSpecificOutput` back — so the adapter is Qwen Code's with TRAE's names, and the decisions are src/hooked.ts's.
// TRAE names its tools by Claude Code's names already, but for the shell, `RunCommand`; `updatedInput` replaces a
// call's whole input; "allow" skips none of TRAE's own confirmations.
//
// `gemworks trae install` writes the hooks into `~/.trae/hooks.json` and `~/.trae-cn/hooks.json` (the international
// and the China build: the ones that are there, both when neither is). TRAE keeps its MCP servers in its own settings,
// in a file whose place its docs do not give, so the install prints the server's entry to add under Settings → MCP.
// The project is the workspace root holding a `.geml/`, else `TRAE_PROJECT_DIR`, else the event's `cwd`. Nothing here
// stops the agent: whatever fails, there is no output and exit 0, and the reason goes to stderr.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import type { CallFacts } from "./hosts/claude-code/fastpath.js";
import { runHooked, type HookedEvent, type HostTools } from "./hooked.js";
import { bareTool, contextFor, denyCall, exitCodeOf, pathOf, readEvent } from "./hosts/qwen/hook.js";
import { readSettings } from "./cursor.js";

export const TRAE_HOST = "trae";

/** TRAE's shell tool. */
export const SHELL = "RunCommand";
const WRITERS: ReadonlySet<string> = new Set(["Write", "Edit", "MultiEdit", "NotebookEdit"]);

/** The call as the gate and the dictionary read it: TRAE's names are Claude Code's but for the shell, a written file's path in `file_path`. */
export function callOf(tool: string, input: Readonly<Record<string, unknown>>): CallFacts {
  if (tool === SHELL) return { tool: "Bash", input: { ...input } };
  if (WRITERS.has(tool)) {
    const path = pathOf(input);
    return { tool, input: { ...input, ...(path !== undefined ? { file_path: path } : {}) } };
  }
  return { tool: bareTool(tool), input: { ...input } };
}

const TOOLS: HostTools = {
  shell: SHELL,
  callOf,
  writes: (tool, input) => { const p = WRITERS.has(tool) ? pathOf(input) : undefined; return p === undefined ? [] : [p]; },
  exitCodeOf,
  bareTool,
};

/** The project: the workspace root holding a `.geml/`, else `TRAE_PROJECT_DIR`, else the event's `cwd`. */
export function projectOf(roots: readonly string[], env: NodeJS.ProcessEnv, cwd: string | undefined): string | undefined {
  const withGeml = roots.find((r) => existsSync(join(r, ".geml")));
  const dir = withGeml ?? (env["TRAE_PROJECT_DIR"] !== undefined && env["TRAE_PROJECT_DIR"] !== "" ? env["TRAE_PROJECT_DIR"] : cwd);
  return dir === undefined ? undefined : resolve(dir);
}

export interface TraeRun { stdout: string }
const NOTHING: TraeRun = { stdout: "" };
const say = (o: Record<string, unknown>): TraeRun => ({ stdout: `${JSON.stringify(o)}\n` });

export interface TraeOptions { home?: string; platform?: string; now?: string }

export async function runTrae(text: string, env: NodeJS.ProcessEnv, o: TraeOptions = {}): Promise<TraeRun> {
  const ev = readEvent(text);
  if (ev === undefined) return NOTHING;
  const sid = ev.session_id;
  let roots: string[] = [];
  try { const v = JSON.parse(text) as { workspace_roots?: unknown }; if (Array.isArray(v.workspace_roots)) roots = v.workspace_roots.filter((r): r is string => typeof r === "string"); } catch { /* read above */ }
  const root = projectOf(roots, env, ev.cwd);
  if (sid === undefined || root === undefined) return NOTHING;
  let event: HookedEvent;
  switch (ev.hook_event_name) {
    case "SessionStart": event = { kind: "start", ...(ev.source !== undefined ? { source: ev.source } : {}) }; break;
    // TRAE runs it when the person sends a message: each one is a turn.
    case "UserPromptSubmit": event = { kind: "prompt", personal: true, ...(ev.prompt !== undefined ? { words: ev.prompt } : {}) }; break;
    case "PreToolUse":
      if (ev.tool_name === undefined) return NOTHING;
      event = { kind: "before", tool: ev.tool_name, input: ev.tool_input ?? {}, ...(ev.tool_use_id !== undefined ? { callId: ev.tool_use_id } : {}) };
      break;
    case "PostToolUse":
      if (ev.tool_name === undefined) return NOTHING;
      event = { kind: "after", tool: ev.tool_name, input: ev.tool_input ?? {}, failed: false, response: ev.tool_response, ...(ev.tool_use_id !== undefined ? { callId: ev.tool_use_id } : {}) };
      break;
    case "Stop": event = { kind: "stop", retry: ev.stop_hook_active === true, ...(ev.last_assistant_message !== undefined ? { answer: ev.last_assistant_message } : {}) }; break;
    default: return NOTHING;
  }
  const answer = await runHooked(TRAE_HOST, TOOLS, sid, root, event, o);
  if (answer === undefined) return NOTHING;
  switch (answer.kind) {
    case "context":
      if (ev.hook_event_name === "Stop") return NOTHING;
      if (ev.hook_event_name === "PreToolUse") return say({ hookSpecificOutput: { hookEventName: "PreToolUse", additionalContext: answer.text } });
      return say(contextFor(ev.hook_event_name as "SessionStart" | "UserPromptSubmit" | "PostToolUse", answer.text));
    case "deny": return say(denyCall(answer.reason));
    case "allow":
      return say({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "allow", permissionDecisionReason: "gemworks", ...(answer.input !== undefined ? { updatedInput: answer.input } : {}), ...(answer.context !== undefined ? { additionalContext: answer.context } : {}) } });
    case "continue": return say({ decision: "block", reason: answer.reason });
  }
}

/** The hook events the adapter answers, and how long TRAE waits for each, in seconds. */
const EVENTS: Readonly<Record<string, number>> = { SessionStart: 60, UserPromptSubmit: 30, PreToolUse: 30, PostToolUse: 60, Stop: 30 };

const isOurs = (hook: unknown): boolean => typeof hook === "object" && hook !== null && typeof (hook as { command?: unknown }).command === "string" && /gemworks(\.mjs)?"?\s+trae$/.test((hook as { command: string }).command);

/** The hooks file with this adapter's hooks put in, every other hook kept; a group left with no hook goes. */
export function hooksWith(file: Record<string, unknown>, command: string): Record<string, unknown> {
  const given = file["hooks"];
  const hooks: Record<string, unknown> = typeof given === "object" && given !== null && !Array.isArray(given) ? { ...(given as Record<string, unknown>) } : {};
  for (const [event, timeout] of Object.entries(EVENTS)) {
    const groups = Array.isArray(hooks[event]) ? (hooks[event] as unknown[]) : [];
    const kept = groups.flatMap((g) => {
      if (typeof g !== "object" || g === null || !Array.isArray((g as { hooks?: unknown }).hooks)) return [g];
      const left = ((g as { hooks: unknown[] }).hooks).filter((h) => !isOurs(h));
      return left.length === 0 ? [] : [{ ...(g as object), hooks: left }];
    });
    hooks[event] = [...kept, { hooks: [{ type: "command", command, timeout }] }];
  }
  return { version: 1, ...file, hooks };
}

/** The MCP server's entry, to add under TRAE's Settings → MCP. */
export const mcpEntry = (bundle: string): Record<string, unknown> => ({ mcpServers: { gemworks: { command: "node", args: [bundle, "mcp", "--host", TRAE_HOST] } } });

/** `gemworks trae install`: the hooks into the TRAE builds' user hooks files, running `bundle`. Returns the files written. */
export function installTrae(bundle: string, home: string = homedir()): string[] {
  const dirs = [join(home, ".trae"), join(home, ".trae-cn")];
  const present = dirs.filter((d) => existsSync(d));
  const files = (present.length > 0 ? present : dirs).map((d) => join(d, "hooks.json"));
  // Every file read before any is written: one that is no plain JSON leaves them all as they were.
  const read = files.map((f) => readSettings(f));
  const path = bundle.split("\\").join("/");
  files.forEach((f, i) => {
    mkdirSync(resolve(f, ".."), { recursive: true });
    writeFileSync(f, `${JSON.stringify(hooksWith(read[i]!, `node "${path}" trae`), null, 2)}\n`, "utf8");
  });
  return files;
}
