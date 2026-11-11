// OpenCode's tools as Gemworks reads them. OpenCode (2.x) names its built-in tools `shell`, `write`, `edit`, `patch`,
// `read`, `grep`, `glob`, `webfetch`, `websearch`, `todowrite`, `subagent`, and an MCP server's tools
// `<server>.<tool>`; a file tool names its file in `path`, `patch` in its patch text. The gate and the bundled
// dictionaries speak Claude Code's names, so a call is handed over as Claude Code would have made it. A shell call's
// result carries its exit status in `output.exit`. Pure: the CLI side (src/opencode.ts) and the plugin OpenCode loads
// do the rest.
import type { CallFacts } from "../claude-code/fastpath.js";
import { exitCodeIn, patchPaths } from "../codex/hook.js";

/** OpenCode's shell tool. */
export const SHELL = "shell";
/** OpenCode's tools that write a file, and the Claude Code tool each is taken as. */
const WRITERS: Readonly<Record<string, string>> = { write: "Write", edit: "Edit", patch: "Edit" };
/** The other built-in tools a dictionary may name by Claude Code's name. */
const READERS: Readonly<Record<string, string>> = { read: "Read", grep: "Grep", glob: "Glob", webfetch: "WebFetch", websearch: "WebSearch", todowrite: "TodoWrite", subagent: "Task" };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** An MCP tool's own name: OpenCode lists a server's tools as `<server>.<tool>`. */
export const bareTool = (tool: string): string => {
  const m = tool.match(/^[^.]+\.(.+)$/);
  return m !== null ? m[1]! : tool;
};

/** The files a call writes, as it names them: `path` for `write` and `edit`, every file of a `patch`. */
export function writes(tool: string, input: Readonly<Record<string, unknown>>): string[] {
  if (tool === "patch") return typeof input["patchText"] === "string" ? patchPaths(input["patchText"]) : [];
  if (!Object.hasOwn(WRITERS, tool)) return [];
  return typeof input["path"] === "string" && input["path"] !== "" ? [input["path"]] : [];
}

/**
 * The call as the gate and the dictionary read it: Claude Code's tool names, a shell call's command line in `command`,
 * a file's path in `file_path` (a patch's first file).
 */
export function callOf(tool: string, input: Readonly<Record<string, unknown>>): CallFacts {
  if (tool === SHELL) return { tool: "Bash", input: { ...input } };
  const file = Object.hasOwn(WRITERS, tool) ? writes(tool, input)[0] : typeof input["path"] === "string" && input["path"] !== "" ? input["path"] : undefined;
  const named = WRITERS[tool] ?? READERS[tool];
  return { tool: named ?? bareTool(tool), input: { ...input, ...(named !== undefined && file !== undefined ? { file_path: file } : {}) } };
}

/**
 * A shell call's exit status from its result (`{ output, content, metadata }`): the `[gemworks exit N]` a wrapped
 * command printed last, else the shell tool's own `output.exit`; null when there is none (a background command).
 */
export function exitCodeOf(response: unknown): number | null {
  const marked = exitCodeIn(response);
  if (marked !== null) return marked;
  if (!isObject(response)) return null;
  const output = response["output"];
  return isObject(output) && typeof output["exit"] === "number" ? output["exit"] : null;
}
