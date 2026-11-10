// Cursor's agent hooks as Gemworks reads and answers them: Cursor runs one
// command per hook, `gemworks cursor`, with one JSON event on stdin —
// `hook_event_name`, `conversation_id`, `workspace_roots`, and per event
// `prompt` (beforeSubmitPrompt), `tool_name` / `tool_input` / `tool_use_id`
// and after the call `tool_output` (a JSON string) or `error_message`
// (preToolUse, postToolUse, postToolUseFailure), `file_path`
// (afterFileEdit), `text` (afterAgentResponse), `status` and `loop_count`
// (stop) — and answers one JSON object. Cursor names its tools `Shell`,
// `Read`, `Write`, `Grep`, `Delete`, `Task` and `MCP:<tool>`; the gate and the
// bundled dictionaries speak Claude Code's names, so a call is handed over as
// Claude Code would have made it: `Shell` as `Bash`, a file-writing tool as
// `Write` or `Edit` with its path in `file_path`. Pure: the CLI side
// (src/cursor.ts) does the files and the workspace.
import type { CallFacts } from "../claude-code/fastpath.js";
import { exitCodeIn } from "../codex/hook.js";

export interface CursorEvent {
  hook_event_name: string;
  conversation_id?: string;
  session_id?: string;
  workspace_roots?: string[];
  tool_name?: string;
  tool_use_id?: string;
  tool_input?: Record<string, unknown>;
  /** postToolUse: the tool's result, as Cursor gives it (a JSON string). */
  tool_output?: unknown;
  /** postToolUseFailure: why the call failed. */
  error_message?: string;
  prompt?: string;
  /** afterFileEdit: the file the agent edited. */
  file_path?: string;
  /** afterAgentResponse: the model's words. */
  text?: string;
  /** stop: completed, aborted or error. */
  status?: string;
  /** stop: how many follow-ups the hooks sent this turn already. */
  loop_count?: number;
  cwd?: string;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** `tool_input` as an object: Cursor gives MCP calls theirs as a JSON string. */
function inputOf(v: unknown): Record<string, unknown> | undefined {
  if (isObject(v)) return v;
  if (typeof v !== "string") return undefined;
  try { const p: unknown = JSON.parse(v); return isObject(p) ? p : undefined; } catch { return undefined; }
}

/** The event Cursor wrote to stdin; undefined when it is not one. */
export function readEvent(text: string): CursorEvent | undefined {
  let v: unknown;
  try { v = JSON.parse(text); } catch { return undefined; }
  if (!isObject(v) || typeof v["hook_event_name"] !== "string") return undefined;
  const str = (k: string): string | undefined => (typeof v[k] === "string" ? (v[k] as string) : undefined);
  const roots = Array.isArray(v["workspace_roots"]) ? v["workspace_roots"].filter((r): r is string => typeof r === "string") : undefined;
  const input = inputOf(v["tool_input"]);
  const out: CursorEvent = { hook_event_name: v["hook_event_name"] as string };
  for (const k of ["conversation_id", "session_id", "tool_name", "tool_use_id", "error_message", "prompt", "file_path", "text", "status", "cwd"] as const) {
    const s = str(k);
    if (s !== undefined) out[k] = s;
  }
  if (roots !== undefined) out.workspace_roots = roots;
  if (input !== undefined) out.tool_input = input;
  if ("tool_output" in v) out.tool_output = v["tool_output"];
  if (typeof v["loop_count"] === "number") out.loop_count = v["loop_count"];
  return out;
}

/** Cursor's shell tool. */
export const SHELL = "Shell";
/** Cursor's tools that write or remove a file; `Write` keeps its name, the rest are taken as Claude Code's `Edit`. */
const WRITERS: ReadonlySet<string> = new Set(["Write", "Edit", "StrReplace", "MultiEdit", "Delete", "ApplyPatch"]);
export const writesFiles = (tool: string): boolean => WRITERS.has(tool);

/** An MCP tool's own name, without Cursor's `MCP:` prefix. */
export const bareTool = (tool: string): string => (tool.startsWith("MCP:") ? tool.slice(4) : tool);

/** Where a Cursor tool names its file. */
export function pathOf(input: Readonly<Record<string, unknown>>): string | undefined {
  for (const k of ["file_path", "path", "target_file", "filePath", "target_notebook"]) if (typeof input[k] === "string" && input[k] !== "") return input[k] as string;
  return undefined;
}

/**
 * The call as the gate and the dictionary read it: Claude Code's tool names, a
 * shell call's command line in `command`, a written file's path in `file_path`.
 */
export function callOf(tool: string, input: Readonly<Record<string, unknown>>): CallFacts {
  if (tool === SHELL) return { tool: "Bash", input: { ...input } };
  if (writesFiles(tool)) {
    const path = pathOf(input);
    return { tool: tool === "Write" ? "Write" : "Edit", input: { ...input, ...(path !== undefined ? { file_path: path } : {}) } };
  }
  return { tool: bareTool(tool), input: { ...input } };
}

/**
 * A shell call's exit status from its result: a number Cursor's JSON names
 * (`exitCode`, `exit_code`, `returnCode`), else the `[gemworks exit N]` a
 * wrapped command printed last; null when there is neither.
 */
export function exitCodeOf(output: unknown): number | null {
  let v: unknown = output;
  if (typeof v === "string") { try { v = JSON.parse(v); } catch { /* plain text */ } }
  if (isObject(v)) for (const k of ["exitCode", "exit_code", "returnCode"]) if (typeof v[k] === "number") return v[k] as number;
  return exitCodeIn(v);
}

/** preToolUse's answers: a refusal the person and the model both read; a rewritten call; nothing — `{}`, since Cursor blocks a permission hook whose output is no JSON. */
export const denyCall = (reason: string): Record<string, unknown> => ({ permission: "deny", user_message: `gemworks: ${reason}`, agent_message: `gemworks: ${reason}` });
export const rewriteCall = (updated: Record<string, unknown> | undefined): Record<string, unknown> => (updated === undefined ? {} : { updated_input: updated });
