// `gemworks kiro`: Gemworks's adapter for Kiro, the IDE and CLI V3. A Kiro hook is a file of `.kiro/hooks/` —
// `{ version: "v1", hooks: [{ name, trigger, matcher?, action: { type: "command", command }, timeout? }] }` — whose
// command gets one JSON event on stdin; the decisions are src/hooked.ts's, with Kiro's tool names (src/hosts/kiro).
//
// What Kiro's hooks can do is narrower than Claude Code's: a command that exits 0 has its stdout added to the agent's
// context, as plain text; one that exits otherwise has its stderr sent to the agent, and on PreToolUse the call is
// blocked. So the stage text, the work items and what follows a call are stdout; a refusal is exit 2 with the reason
// on stderr. A hook cannot change a call's input: no default parameter is filled and no shell command is wrapped, so a
// command's exit status is the one the shell tool's result reports. At Stop the work reminder is stdout too — Kiro's
// docs say it reaches the agent, not that the agent takes another turn for it.
//
// `gemworks kiro install [dir]` writes `~/.kiro/hooks/gemworks.json` (Kiro CLI V3 runs it in every workspace), and
// `<dir>/.kiro/hooks/gemworks.json` when a project is named (the IDE reads its workspace's hooks only), and the MCP
// server into `~/.kiro/settings/mcp.json`. The project is the event's `cwd` (Kiro runs a hook in the project root);
// where Kiro starts an MCP server its docs do not say, so the server falls back to the project the hooks last saw.
// Nothing here stops the agent: whatever fails, there is no output and exit 0, and the reason goes to stderr.
import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { runHooked, type HookedEvent, type HostTools } from "./hooked.js";
import { bareTool, callOf, exitCodeOf, isShell, writes } from "./hosts/kiro/hook.js";
import { readSettings } from "./cursor.js";

export const KIRO_HOST = "kiro";

const TOOLS: HostTools = { shell: "shell", isShell, callOf, writes, exitCodeOf, bareTool };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export interface KiroRun { stdout: string; stderr: string; code: number }
const NOTHING: KiroRun = { stdout: "", stderr: "", code: 0 };
const text = (t: string): KiroRun => ({ stdout: `${t}\n`, stderr: "", code: 0 });

export interface KiroOptions { home?: string; platform?: string; now?: string; here?: string }

export async function runKiro(input: string, env: NodeJS.ProcessEnv, o: KiroOptions = {}): Promise<KiroRun> {
  let v: unknown;
  try { v = JSON.parse(input); } catch { return NOTHING; }
  if (!isObject(v) || typeof v["hook_event_name"] !== "string") return NOTHING;
  const str = (k: string): string | undefined => (typeof v[k] === "string" ? (v[k] as string) : undefined);
  const sid = str("session_id");
  if (sid === undefined) return NOTHING;
  const root = resolve(str("cwd") ?? o.here ?? process.cwd());
  const tool = str("tool_name");
  const toolInput = isObject(v["tool_input"]) ? v["tool_input"] : {};
  let event: HookedEvent;
  switch (v["hook_event_name"]) {
    case "SessionStart": case "AgentSpawn": case "agentSpawn": event = { kind: "start" }; break;
    case "UserPromptSubmit": case "userPromptSubmit": {
      const words = str("prompt") ?? (env["USER_PROMPT"] !== undefined && env["USER_PROMPT"] !== "" ? env["USER_PROMPT"] : undefined);
      event = { kind: "prompt", personal: true, ...(words !== undefined ? { words } : {}) };
      break;
    }
    case "PreToolUse": case "preToolUse":
      if (tool === undefined) return NOTHING;
      event = { kind: "before", tool, input: toolInput };
      break;
    case "PostToolUse": case "postToolUse":
      if (tool === undefined) return NOTHING;
      event = { kind: "after", tool, input: toolInput, failed: false, response: v["tool_response"] };
      break;
    case "Stop": case "stop": event = { kind: "stop", retry: false, ...(str("assistant_response") !== undefined ? { answer: str("assistant_response")! } : {}) }; break;
    default: return NOTHING;
  }
  const answer = await runHooked(KIRO_HOST, TOOLS, sid, root, event, o);
  if (answer === undefined) return NOTHING;
  switch (answer.kind) {
    case "context": return text(answer.text);
    case "deny": return { stdout: "", stderr: `gemworks: ${answer.reason}\n`, code: 2 };
    // Kiro cannot take a changed input: only the note reaches the agent.
    case "allow": return answer.context === undefined ? NOTHING : text(answer.context);
    case "continue": return text(answer.reason);
  }
}

/** The triggers the adapter answers, and how long Kiro waits for each, in seconds. */
const TRIGGERS: Readonly<Record<string, number>> = { SessionStart: 60, UserPromptSubmit: 30, PreToolUse: 30, PostToolUse: 60, Stop: 30 };

/** The hook file the adapter writes: one hook per trigger, all running `command`. */
export function hookFile(command: string): Record<string, unknown> {
  return {
    version: "v1",
    hooks: Object.entries(TRIGGERS).map(([trigger, timeout]) => ({
      name: `gemworks ${trigger}`, description: "Gemworks: the workflow's gate, context and work loop", trigger, action: { type: "command", command }, timeout,
    })),
  };
}

/** `gemworks kiro install [dir]`: the hooks into Kiro's global hooks (and `dir`'s, when given) and the MCP server into Kiro's user MCP config, all running `bundle`. Returns the files written. */
export function installKiro(bundle: string, project?: string, home: string = homedir()): string[] {
  const mcpFile = join(home, ".kiro", "settings", "mcp.json");
  // Read before anything is written: an MCP config that is no plain JSON leaves every file as it was.
  const mcp = readSettings(mcpFile);
  const path = bundle.split("\\").join("/");
  const hooks = `${JSON.stringify(hookFile(`node "${path}" kiro`), null, 2)}\n`;
  const files = [join(home, ".kiro", "hooks", "gemworks.json"), ...(project !== undefined ? [join(resolve(project), ".kiro", "hooks", "gemworks.json")] : [])];
  for (const f of files) {
    mkdirSync(resolve(f, ".."), { recursive: true });
    writeFileSync(f, hooks, "utf8");
  }
  const servers = isObject(mcp["mcpServers"]) ? mcp["mcpServers"] : {};
  mkdirSync(resolve(mcpFile, ".."), { recursive: true });
  writeFileSync(mcpFile, `${JSON.stringify({ ...mcp, mcpServers: { ...servers, gemworks: { command: "node", args: [bundle, "mcp", "--host", KIRO_HOST] } } }, null, 2)}\n`, "utf8");
  return [...files, mcpFile];
}

