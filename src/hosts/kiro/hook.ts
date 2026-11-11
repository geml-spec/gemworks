// Kiro's tools as Gemworks reads them. Kiro (the IDE and CLI V3) hands a command hook one JSON event on stdin —
// `hook_event_name`, `session_id`, `cwd`, and per event `prompt`, `tool_name`, `tool_input`, `tool_response` — and
// names its built-in tools differently in its surfaces: `shell` (`execute_bash`, `execute_cmd`, the IDE's
// `executeBash`), `write` (`fs_write`, the IDE's `fsWrite`, `fsAppend`, `strReplace`), `read` (`fs_read`, `readFile`),
// `grep`, `glob`, `web_fetch`, `web_search`, `subagent`, `todo`, and an MCP tool `mcp_<server>_<tool>`. A name is read
// with its case and underscores folded, so every spelling lands on Claude Code's name. Pure: the CLI side
// (src/kiro.ts) does the rest.
import type { CallFacts } from "../claude-code/fastpath.js";
import { exitCodeIn } from "../codex/hook.js";

const fold = (tool: string): string => tool.toLowerCase().replace(/[_-]/g, "");

const SHELLS: ReadonlySet<string> = new Set(["shell", "executebash", "executecmd", "executepwsh", "bash"]);
/** Kiro's tools that write a file, folded, and the Claude Code tool each is taken as. */
const WRITERS: Readonly<Record<string, string>> = { write: "Write", fswrite: "Write", fsappend: "Edit", strreplace: "Edit", edit: "Edit" };
const READERS: Readonly<Record<string, string>> = {
  read: "Read", fsread: "Read", readfile: "Read", readmultiplefiles: "Read", grep: "Grep", grepsearch: "Grep", glob: "Glob", filesearch: "Glob",
  listdirectory: "LS", webfetch: "WebFetch", websearch: "WebSearch", subagent: "Task", usesubagent: "Task", todo: "TodoWrite",
};

/** Whether a tool is Kiro's shell, by any of its names. */
export const isShell = (tool: string): boolean => SHELLS.has(fold(tool));

/** An MCP tool's own name: Kiro's hook events name it `mcp_<server>_<tool>`, gemworks' own `mcp_gemworks_<tool>`. */
export function bareTool(tool: string): string {
  if (tool.startsWith("mcp_gemworks_")) return tool.slice("mcp_gemworks_".length);
  const m = tool.match(/^mcp_[^_]+_(.+)$/);
  return m !== null ? m[1]! : tool;
}

/** Where a Kiro file tool names its file. */
export function pathOf(input: Readonly<Record<string, unknown>>): string | undefined {
  for (const k of ["path", "file_path", "filePath", "targetFile", "target_file", "absolute_path"]) if (typeof input[k] === "string" && input[k] !== "") return input[k] as string;
  return undefined;
}

/** The files a call writes, as it names them. */
export function writes(tool: string, input: Readonly<Record<string, unknown>>): string[] {
  if (!Object.hasOwn(WRITERS, fold(tool))) return [];
  const p = pathOf(input);
  return p === undefined ? [] : [p];
}

/** The call as the gate and the dictionary read it: Claude Code's tool names, a written file's path in `file_path`. */
export function callOf(tool: string, input: Readonly<Record<string, unknown>>): CallFacts {
  if (isShell(tool)) return { tool: "Bash", input: { ...input } };
  const f = fold(tool);
  if (Object.hasOwn(WRITERS, f)) {
    const p = pathOf(input);
    return { tool: WRITERS[f]!, input: { ...input, ...(p !== undefined ? { file_path: p } : {}) } };
  }
  return { tool: READERS[f] ?? bareTool(tool), input: { ...input } };
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * A shell call's exit status from its result: the `[gemworks exit N]` a wrapped command printed, else a number the
 * result names (`exit_status`, `exitStatus`, `exit_code`, `exitCode`), else an `Exit Code: N` or `exit status: N` line;
 * null when there is none.
 */
export function exitCodeOf(response: unknown): number | null {
  const marked = exitCodeIn(response);
  if (marked !== null) return marked;
  let found: number | null = null;
  const visit = (v: unknown): void => {
    if (found !== null) return;
    if (typeof v === "string") { const m = v.match(/^(?:Exit Code|exit status|exit_status):\s*(\d+)\s*$/im); if (m !== null) found = Number(m[1]); }
    else if (Array.isArray(v)) v.forEach(visit);
    else if (isObject(v)) {
      for (const k of ["exit_status", "exitStatus", "exit_code", "exitCode"]) {
        const n = v[k];
        if (typeof n === "number") { found = n; return; }
        if (typeof n === "string" && /^\d+$/.test(n)) { found = Number(n); return; }
      }
      Object.values(v).forEach(visit);
    }
  };
  visit(response);
  return found;
}
