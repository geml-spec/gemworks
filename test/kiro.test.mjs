// The Kiro adapter (IDE and CLI V3): how Kiro's tools are read under their several names (src/hosts/kiro/hook.ts),
// the install, then `gemworks kiro` through the bundle in a project with the dev workflow, event by event.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { hookFile, installKiro } from "../dist/kiro.js";
import { bareTool, callOf, exitCodeOf, isShell, writes } from "../dist/hosts/kiro/hook.js";
import { mcpRootOf } from "../dist/hooked.js";
import { BUNDLE, fakeGh, gitRepo, hook, withWorkflow } from "./helpers/repo.mjs";

const WS_DEV = fileURLToPath(new URL("./fixtures/ws-dev/", import.meta.url));
// A session's start opens the GEML board: never a window from a test.
process.env.GEMWORKS_OPEN_BOARD = "0";

const homeEnv = () => { const home = mkdtempSync(join(tmpdir(), "gemworks-kiro-home-")); return { HOME: home, USERPROFILE: home }; };

/** One Kiro hook event through the bundle: its exit code, stdout and stderr. */
function kiro(root, event, env = {}) {
  const r = spawnSync(process.execPath, [BUNDLE, "kiro"], { cwd: root, input: JSON.stringify({ session_id: "s-1", cwd: root, ...event }), encoding: "utf8", env: { ...process.env, ...env }, timeout: 60_000 });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}
const said = (root, event, env) => { const r = kiro(root, event, env); assert.equal(r.code, 0, r.stderr); return r.stdout; };
const project = () => {
  const root = gitRepo();
  withWorkflow(root, WS_DEV, "dev");
  return root;
};

test("Kiro's tools under every surface's name: the shell taken as Bash, the writers as Write or Edit with their file, the readers by Claude Code's names, an MCP tool bare; a shell result's exit status", () => {
  for (const t of ["shell", "execute_bash", "execute_cmd", "executeBash", "executePwsh"]) assert.ok(isShell(t), t);
  assert.equal(isShell("write"), false);
  assert.deepEqual(callOf("execute_bash", { command: "npm test" }), { tool: "Bash", input: { command: "npm test" } });
  assert.deepEqual(callOf("fs_write", { command: "create", path: "src/a.ts", file_text: "x" }), { tool: "Write", input: { command: "create", path: "src/a.ts", file_text: "x", file_path: "src/a.ts" } });
  assert.equal(callOf("strReplace", { path: "a" }).tool, "Edit");
  assert.deepEqual(writes("fsWrite", { path: "b.ts" }), ["b.ts"]);
  assert.deepEqual(writes("read", { path: "b.ts" }), []);
  assert.equal(callOf("fs_read", {}).tool, "Read");
  assert.equal(callOf("grepSearch", {}).tool, "Grep");
  assert.equal(callOf("web_fetch", {}).tool, "WebFetch");
  assert.equal(callOf("use_subagent", {}).tool, "Task");
  assert.equal(bareTool("mcp_gemworks_work"), "work");
  assert.equal(bareTool("mcp_postgres_query"), "query");
  assert.equal(exitCodeOf({ exit_status: "1", stdout: "boom" }), 1);
  assert.equal(exitCodeOf({ result: [{ exitCode: 0 }] }), 0);
  assert.equal(exitCodeOf("out\nexit status: 3"), 3);
  assert.equal(exitCodeOf({ stdout: "x" }), null);
});

test("gemworks kiro install: the hook file into ~/.kiro/hooks and, given a project, into its .kiro/hooks; the MCP server beside the others in ~/.kiro/settings/mcp.json; an MCP config that is no plain JSON leaves everything alone", () => {
  const home = mkdtempSync(join(tmpdir(), "gemworks-kiro-install-"));
  const proj = mkdtempSync(join(tmpdir(), "gemworks-kiro-proj-"));
  mkdirSync(join(home, ".kiro", "settings"), { recursive: true });
  const mcpFile = join(home, ".kiro", "settings", "mcp.json");
  writeFileSync(mcpFile, JSON.stringify({ mcpServers: { postgres: { command: "pg" } } }));
  const files = installKiro("/opt/gw/dist/gemworks.mjs", proj, home);
  assert.deepEqual(files, [join(home, ".kiro", "hooks", "gemworks.json"), join(proj, ".kiro", "hooks", "gemworks.json"), mcpFile]);
  const hooks = JSON.parse(readFileSync(files[0], "utf8"));
  assert.deepEqual(hooks, hookFile("node \"/opt/gw/dist/gemworks.mjs\" kiro"));
  assert.equal(hooks.version, "v1");
  assert.deepEqual(hooks.hooks.map((h) => h.trigger), ["SessionStart", "UserPromptSubmit", "PreToolUse", "PostToolUse", "Stop"]);
  assert.ok(hooks.hooks.every((h) => h.action.type === "command" && h.action.command === "node \"/opt/gw/dist/gemworks.mjs\" kiro"));
  assert.deepEqual(JSON.parse(readFileSync(files[1], "utf8")), hooks);
  assert.deepEqual(JSON.parse(readFileSync(mcpFile, "utf8")).mcpServers, { postgres: { command: "pg" }, gemworks: { command: "node", args: ["/opt/gw/dist/gemworks.mjs", "mcp", "--host", "kiro"] } });
  assert.deepEqual(installKiro("/opt/gw/dist/gemworks.mjs", undefined, home), [files[0], mcpFile], "no project: the global hooks alone");
  writeFileSync(mcpFile, "{ // mine\n}\n");
  writeFileSync(files[0], "before");
  assert.throws(() => installKiro("/opt/gw/dist/gemworks.mjs", undefined, home), /not plain JSON/);
  assert.equal(readFileSync(files[0], "utf8"), "before");
});

test("gemworks kiro, in event order: the stage at the start as plain text, a refused command (exit 2, the reason on stderr), a test run whose reported status moves the stage; the MCP server's project the hooks' when its own folder has none", () => {
  const root = project();
  const gh = fakeGh();
  gh.set({ pr: "OPEN" });
  const env = { ...gh.env, ...homeEnv() };
  assert.match(said(root, { hook_event_name: "SessionStart" }, env), /^\[gemworks\] stage build · rev 0/m);
  const refused = kiro(root, { hook_event_name: "PreToolUse", tool_name: "execute_bash", tool_input: { command: "gemworks mark reviewed" } }, env);
  assert.equal(refused.code, 2);
  assert.equal(refused.stdout, "");
  assert.match(refused.stderr, /^gemworks: .*for a person/);
  assert.equal(said(root, { hook_event_name: "PreToolUse", tool_name: "fs_read", tool_input: { path: join(root, "README.md") } }, env), "");
  assert.equal(said(root, { hook_event_name: "PreToolUse", tool_name: "mcp_gemworks_status", tool_input: {} }, env), "");
  assert.equal(said(root, { hook_event_name: "PreToolUse", tool_name: "execute_bash", tool_input: { command: "npm test" } }, env), "", "no input can change: nothing to say");
  const ran = said(root, { hook_event_name: "PostToolUse", tool_name: "execute_bash", tool_input: { command: "npm test" }, tool_response: { exit_status: "0", stdout: "all green" } }, env);
  assert.match(ran, /^\[gemworks\] stage review · rev \d/m);
  assert.equal(hook(root, { op: "status" }, env).shell.status.state.id, "review");
  assert.equal(mcpRootOf("kiro", mkdtempSync(join(tmpdir(), "gemworks-kiro-mcp-")), env.HOME).session, "s-1");
});

test("the record and the work loop through Kiro's hooks: the prompt from the event or USER_PROMPT; a written file; a turn that wrote and reported nothing told once at Stop", async () => {
  const { logName, parseLog } = await import("../dist/core/session-log.js");
  const { sessionsDirOf } = await import("../dist/session-store.js");
  const { WORK_REMINDER } = await import("../dist/core/work.js");
  const root = gitRepo();
  const env = homeEnv();
  const log = () => parseLog(readFileSync(join(sessionsDirOf(root), logName("kiro", "s-1")), "utf8"));
  said(root, { hook_event_name: "SessionStart" }, env);
  said(root, { hook_event_name: "UserPromptSubmit" }, { ...env, USER_PROMPT: "接 Kiro" });
  said(root, { hook_event_name: "PostToolUse", tool_name: "fs_write", tool_input: { command: "create", path: join(root, "src", "kiro-made.ts") }, tool_response: {} }, env);
  assert.equal(said(root, { hook_event_name: "Stop" }, env).trim(), WORK_REMINDER.trim());
  assert.equal(said(root, { hook_event_name: "Stop" }, env), "", "once a turn");
  said(root, { hook_event_name: "UserPromptSubmit", prompt: "再一句" }, env);
  assert.deepEqual(log().filter((e) => e.t !== "item").map((e) => [e.t, e.text ?? e.path ?? e.host]), [["session", "kiro"], ["prompt", "接 Kiro"], ["file", "src/kiro-made.ts"], ["prompt", "再一句"]]);
});
