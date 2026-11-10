// Qwen Code's hooks as Gemworks reads and answers them: Qwen Code runs one
// command per hook, `gemworks qwen`, with one JSON event on stdin —
// `hook_event_name`, `session_id`, `cwd`, `prompt_id`, and per event `prompt`
// / `submitted_prompt` (UserPromptSubmit), `source` (SessionStart),
// `tool_name` / `tool_input` / `tool_use_id` and after the call
// `tool_response` or `error` (PreToolUse, PostToolUse, PostToolUseFailure),
// `last_assistant_message` and `stop_hook_active` (Stop) — and answers one
// JSON object, Claude Code's envelope: `hookSpecificOutput` with
// `hookEventName`, `permissionDecision` / `permissionDecisionReason` /
// `updatedInput` before a call, `additionalContext` the model reads; Stop's
// top-level `decision: "block"` with its `reason`. Qwen Code names its tools
// by runtime id — `run_shell_command`, `write_file`, `edit`,
// `notebook_edit`, `read_file`, `grep_search`, `glob` — and the gate and the
// bundled dictionaries speak Claude Code's names, so a call is handed over as
// Claude Code would have made it. Pure: the CLI side (src/qwen.ts) does the
// files and the workspace.
import type { CallFacts } from "../claude-code/fastpath.js";
import { exitCodeIn } from "../codex/hook.js";

export interface QwenEvent {
  hook_event_name: string;
  session_id?: string;
  cwd?: string;
  /** The model turn the event belongs to: the same through a turn's tool round trips. */
  prompt_id?: string;
  tool_name?: string;
  tool_use_id?: string;
  tool_input?: Record<string, unknown>;
  tool_response?: unknown;
  /** PostToolUseFailure: why the call failed. */
  error?: string;
  /** UserPromptSubmit: the model-bound text, which on some paths is not the person's. */
  prompt?: string;
  /** UserPromptSubmit: the text the person submitted, when Qwen Code knows it. */
  submitted_prompt?: string;
  /** SessionStart: startup, resume, clear or compact. */
  source?: string;
  /** Stop: the turn's last answer. */
  last_assistant_message?: string;
  /** Stop: whether the turn already went on once because a Stop hook blocked it. */
  stop_hook_active?: boolean;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** The event Qwen Code wrote to stdin; undefined when it is not one. */
export function readEvent(text: string): QwenEvent | undefined {
  let v: unknown;
  try { v = JSON.parse(text); } catch { return undefined; }
  if (!isObject(v) || typeof v["hook_event_name"] !== "string") return undefined;
  const out: QwenEvent = { hook_event_name: v["hook_event_name"] as string };
  for (const k of ["session_id", "cwd", "prompt_id", "tool_name", "tool_use_id", "error", "prompt", "submitted_prompt", "source", "last_assistant_message"] as const) {
    if (typeof v[k] === "string") out[k] = v[k] as string;
  }
  if (isObject(v["tool_input"])) out.tool_input = v["tool_input"];
  if ("tool_response" in v) out.tool_response = v["tool_response"];
  if (typeof v["stop_hook_active"] === "boolean") out.stop_hook_active = v["stop_hook_active"];
  return out;
}

/** Qwen Code's shell tool. */
export const SHELL = "run_shell_command";
/** Qwen Code's tools that write a file, and the Claude Code tool each is taken as. */
const WRITERS: Readonly<Record<string, string>> = { write_file: "Write", edit: "Edit", replace: "Edit", notebook_edit: "NotebookEdit" };
export const writesFiles = (tool: string): boolean => Object.hasOwn(WRITERS, tool);
/** The other built-in tools a dictionary may name by Claude Code's name. */
const READERS: Readonly<Record<string, string>> = { read_file: "Read", read_many_files: "Read", grep_search: "Grep", glob: "Glob", list_directory: "LS", web_fetch: "WebFetch", web_search: "WebSearch", todo_write: "TodoWrite", task: "Task" };

/** An MCP tool's own name: Qwen Code lists a server's tools as `mcp__<server>__<tool>`, or bare. */
export const bareTool = (tool: string): string => {
  const m = tool.match(/^mcp__.+?__(.+)$/);
  return m !== null ? m[1]! : tool;
};

/** Where a Qwen Code tool names its file. */
export function pathOf(input: Readonly<Record<string, unknown>>): string | undefined {
  for (const k of ["file_path", "absolute_path", "notebook_path", "path"]) if (typeof input[k] === "string" && input[k] !== "") return input[k] as string;
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
    return { tool: WRITERS[tool]!, input: { ...input, ...(path !== undefined ? { file_path: path } : {}) } };
  }
  return { tool: READERS[tool] ?? bareTool(tool), input: { ...input } };
}

/**
 * A shell call's exit status from its result, whatever shape Qwen Code gives
 * it: the `[gemworks exit N]` a wrapped command printed last, else the
 * `Exit Code: N` line of the shell tool's own report, else a number its JSON
 * names (`exitCode`, `exit_code`); null when there is none.
 */
export function exitCodeOf(response: unknown): number | null {
  const marked = exitCodeIn(response);
  if (marked !== null) return marked;
  let last: number | null = null;
  const visit = (v: unknown): void => {
    if (typeof v === "string") { for (const m of v.matchAll(/^Exit Code: (\d+)\s*$/gm)) last = Number(m[1]); }
    else if (Array.isArray(v)) v.forEach(visit);
    else if (isObject(v)) {
      for (const k of ["exitCode", "exit_code"]) if (typeof v[k] === "number") last = v[k] as number;
      if (last === null) Object.values(v).forEach(visit);
    }
  };
  visit(response);
  return last;
}

export type HookEventName = "SessionStart" | "UserPromptSubmit" | "PreToolUse" | "PostToolUse" | "PostToolUseFailure";

/** A refusal, read by the model as the tool's error. */
export const denyCall = (reason: string): Record<string, unknown> => ({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: `gemworks: ${reason}` } });

/**
 * The call goes on, rewritten when `updatedInput` is given (Qwen Code replaces the whole input with it), with a note for
 * the model when `context` is; undefined when there is neither. "allow" skips none of Qwen Code's own approvals.
 */
export function allowCall(updatedInput?: Record<string, unknown>, context?: string): Record<string, unknown> | undefined {
  if (updatedInput === undefined && context === undefined) return undefined;
  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse", permissionDecision: "allow", permissionDecisionReason: "gemworks",
      ...(updatedInput !== undefined ? { updatedInput } : {}), ...(context !== undefined ? { additionalContext: context } : {}),
    },
  };
}

export const contextFor = (event: Exclude<HookEventName, "PreToolUse">, text: string): Record<string, unknown> => ({ hookSpecificOutput: { hookEventName: event, additionalContext: text } });
