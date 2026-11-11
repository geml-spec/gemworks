// The Devin adapter (Devin Desktop, formerly Windsurf, and the Devin CLI): how Devin's tools are read
// (src/hosts/devin/hook.ts), the install, then `gemworks devin` through the bundle in a project with the dev workflow,
// event by event in the order Devin raises them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { activeOf, configDir, hooksWith, installDevin, mcpRootOf, projectOf } from "../dist/devin.js";
import { callOf, exitCodeOf, failedIn, writes } from "../dist/hosts/devin/hook.js";
import { wrapCommand } from "../dist/hosts/codex/hook.js";
import { BUNDLE, fakeGh, gitRepo, hook, withWorkflow } from "./helpers/repo.mjs";

const WS_DEV = fileURLToPath(new URL("./fixtures/ws-dev/", import.meta.url));
// A session's start opens the GEML board: never a window from a test.
process.env.GEMWORKS_OPEN_BOARD = "0";

/** A home of its own for each test: the adapter keeps its state under it. */
const homeEnv = () => { const home = mkdtempSync(join(tmpdir(), "gemworks-devin-home-")); return { HOME: home, USERPROFILE: home }; };

/** One Devin hook event through the bundle: its exit code, stderr, and answer parsed (null when it said nothing). */
function devin(root, event, env = {}) {
  const r = spawnSync(process.execPath, [BUNDLE, "devin"], {
    cwd: root, input: JSON.stringify({ session_id: "s-1", ...event }), encoding: "utf8", env: { ...process.env, DEVIN_PROJECT_DIR: root, ...env }, timeout: 60_000,
  });
  return { code: r.status, stderr: r.stderr, answer: r.stdout.trim() === "" ? null : JSON.parse(r.stdout) };
}
const said = (root, event, env) => { const r = devin(root, event, env); assert.equal(r.code, 0, r.stderr); return r.answer; };
const project = () => {
  const root = gitRepo();
  withWorkflow(root, WS_DEV, "dev");
  return root;
};

test("Devin's tools: the shell taken as Bash, write, edit, apply_patch and notebook_edit as Write, Edit or NotebookEdit with their file, the readers by Claude Code's names, an MCP tool bare; a result's failure and a wrapped command's status", () => {
  assert.deepEqual(callOf("exec", { command: "npm test", shell_id: "1" }), { tool: "Bash", input: { command: "npm test", shell_id: "1" } });
  assert.deepEqual(callOf("write", { file_path: "src/a.ts", content: "x" }), { tool: "Write", input: { file_path: "src/a.ts", content: "x" } });
  assert.deepEqual(callOf("edit", { path: "a.ts" }), { tool: "Edit", input: { path: "a.ts", file_path: "a.ts" } });
  const patch = "*** Begin Patch\n*** Update File: src/a.ts\n@@\n-x\n+y\n*** Add File: src/b.ts\n+z\n*** End Patch";
  assert.deepEqual(writes("apply_patch", { input: patch }), ["src/a.ts", "src/b.ts"]);
  assert.equal(callOf("apply_patch", { input: patch }).input.file_path, "src/a.ts");
  assert.equal(callOf("notebook_edit", { notebook_path: "n.ipynb" }).tool, "NotebookEdit");
  assert.deepEqual(writes("read", { file_path: "a" }), []);
  assert.equal(callOf("read", {}).tool, "Read");
  assert.equal(callOf("run_subagent", {}).tool, "Task");
  assert.equal(callOf("mcp__github__create_issue", {}).tool, "create_issue");
  assert.equal(exitCodeOf({ success: true, output: "all green\n[gemworks exit 0]", error: null }), 0);
  assert.equal(exitCodeOf({ success: false, output: "boom", error: "exit status 1" }), null, "Devin reports no status of its own");
  assert.equal(failedIn({ success: false, output: "", error: "x" }), true);
  assert.equal(failedIn({ success: true }), false);
  assert.equal(projectOf({ DEVIN_PROJECT_DIR: "/p/q" }, "/e", "/here").replaceAll("\\", "/").replace(/^[A-Za-z]:/, ""), "/p/q");
  assert.equal(projectOf({}, undefined, "/here").replaceAll("\\", "/").replace(/^[A-Za-z]:/, ""), "/here");
});

test("gemworks devin install: the hooks under `hooks` in Devin's config.json beside the person's own, an earlier install's replaced; the MCP server into mcp_config.json beside the others; a file that is no plain JSON leaves both alone", () => {
  const home = mkdtempSync(join(tmpdir(), "gemworks-devin-install-"));
  assert.equal(configDir(home, {}, "darwin"), join(home, ".config", "devin"));
  assert.equal(configDir(home, { APPDATA: "C:\\Users\\x\\AppData\\Roaming" }, "win32"), join("C:\\Users\\x\\AppData\\Roaming", "devin"));
  const dir = join(home, ".config", "devin");
  mkdirSync(dir, { recursive: true });
  const configFile = join(dir, "config.json");
  const mcpFile = join(dir, "mcp_config.json");
  writeFileSync(configFile, JSON.stringify({
    theme: "dark",
    hooks: {
      PreToolUse: [{ matcher: "write", hooks: [{ type: "command", command: "./check.sh" }] }],
      Stop: [{ hooks: [{ type: "command", command: "node \"/old/gemworks.mjs\" devin" }] }],
    },
  }));
  writeFileSync(mcpFile, JSON.stringify({ mcpServers: { github: { command: "npx", args: ["x"] } } }));
  assert.deepEqual(installDevin("/opt/gw/dist/gemworks.mjs", home, {}, "darwin"), [configFile, mcpFile]);
  const config = JSON.parse(readFileSync(configFile, "utf8"));
  const ours = { hooks: [{ type: "command", command: "node \"/opt/gw/dist/gemworks.mjs\" devin", timeout: 30 }] };
  assert.equal(config.theme, "dark");
  assert.deepEqual(config.hooks.PreToolUse, [{ matcher: "write", hooks: [{ type: "command", command: "./check.sh" }] }, ours]);
  assert.deepEqual(config.hooks.Stop, [ours], "the earlier install's taken out");
  assert.deepEqual(Object.keys(config.hooks).sort(), ["PostToolUse", "PreToolUse", "SessionStart", "Stop", "UserPromptSubmit"]);
  assert.deepEqual(JSON.parse(readFileSync(mcpFile, "utf8")).mcpServers, { github: { command: "npx", args: ["x"] }, gemworks: { command: "node", args: ["/opt/gw/dist/gemworks.mjs", "mcp", "--host", "devin"] } });
  installDevin("/opt/gw/dist/gemworks.mjs", home, {}, "darwin");
  assert.deepEqual(JSON.parse(readFileSync(configFile, "utf8")), config, "again: nothing doubled");
  assert.equal(Object.keys(hooksWith({}, "c").hooks).length, 5);
  const commented = "{\n  // mine\n}\n";
  writeFileSync(mcpFile, commented);
  const before = readFileSync(configFile, "utf8");
  assert.throws(() => installDevin("/opt/gw/dist/gemworks.mjs", home, {}, "darwin"), /not plain JSON/);
  assert.equal(readFileSync(mcpFile, "utf8"), commented);
  assert.equal(readFileSync(configFile, "utf8"), before);
});

test("gemworks devin, in event order: the stage at the start, a refused command (exit 2, the reason on stderr), a wrapped test run whose status moves the stage; the MCP server's project the hooks' when its own folder has none", () => {
  const root = project();
  const gh = fakeGh();
  gh.set({ pr: "OPEN" });
  const env = { ...gh.env, ...homeEnv() };
  const start = said(root, { hook_event_name: "SessionStart", source: "startup" }, env);
  assert.equal(start.hookSpecificOutput.hookEventName, "SessionStart");
  assert.match(start.hookSpecificOutput.additionalContext, /^\[gemworks\] stage build · rev 0/m);
  const refused = devin(root, { hook_event_name: "PreToolUse", prompt_id: "p1", tool_name: "exec", tool_input: { command: "gemworks mark reviewed" } }, env);
  assert.equal(refused.code, 2);
  assert.equal(refused.answer, null);
  assert.match(refused.stderr, /^gemworks: .*for a person/);
  assert.equal(said(root, { hook_event_name: "PreToolUse", prompt_id: "p1", tool_name: "read", tool_input: { file_path: join(root, "README.md") } }, env), null);
  assert.equal(said(root, { hook_event_name: "PreToolUse", prompt_id: "p1", tool_name: "mcp__gemworks__status", tool_input: {} }, env), null);
  const run = said(root, { hook_event_name: "PreToolUse", prompt_id: "p1", tool_name: "exec", tool_input: { command: "npm test" } }, env);
  const windows = process.platform === "win32";
  if (windows) assert.equal(run, null, "the wrapper is POSIX shell: on Windows the command runs as it is");
  else assert.deepEqual(run, { hookSpecificOutput: { hookEventName: "PreToolUse", updatedInput: { command: wrapCommand("npm test") } } });
  const command = windows ? "npm test" : wrapCommand("npm test");
  const ran = said(root, { hook_event_name: "PostToolUse", prompt_id: "p1", tool_name: "exec", tool_input: { command }, tool_response: { success: true, output: windows ? "all green" : "all green\n[gemworks exit 0]", error: null } }, env);
  if (!windows) {
    assert.match(ran.hookSpecificOutput.additionalContext, /^\[gemworks\] stage review · rev \d/m);
    assert.equal(hook(root, { op: "status" }, env).shell.status.state.id, "review");
  }
  const outside = mkdtempSync(join(tmpdir(), "gemworks-devin-mcp-"));
  assert.deepEqual(mcpRootOf(outside, env.HOME), activeOf(env.HOME));
  assert.equal(activeOf(env.HOME).session, "s-1");
  assert.equal(mcpRootOf(root, env.HOME), undefined, "a folder with a .geml/ is the server's own project");
});

test("the record and the work loop through Devin's hooks: a prompt once a turn; a written file; a turn that wrote and reported nothing sent back once, and not again on the retry", async () => {
  const { logName, parseLog } = await import("../dist/core/session-log.js");
  const { sessionsDirOf } = await import("../dist/session-store.js");
  const { WORK_REMINDER } = await import("../dist/core/work.js");
  const root = gitRepo();
  const env = homeEnv();
  const log = () => parseLog(readFileSync(join(sessionsDirOf(root), logName("devin", "s-1")), "utf8"));
  assert.match(said(root, { hook_event_name: "SessionStart", source: "startup" }, env).hookSpecificOutput.additionalContext, /feature 新功能: mockup 样稿 \(you\) → build/);
  said(root, { hook_event_name: "UserPromptSubmit", prompt_id: "p1", prompt: "接 Devin" }, env);
  assert.equal(said(root, { hook_event_name: "UserPromptSubmit", prompt_id: "p1", prompt: "接 Devin" }, env), null, "the same turn: nothing said again");
  said(root, { hook_event_name: "PostToolUse", prompt_id: "p1", tool_name: "write", tool_input: { file_path: join(root, "src", "devin-made.ts") }, tool_response: { success: true, output: "", error: null } }, env);
  said(root, { hook_event_name: "PostToolUse", prompt_id: "p1", tool_name: "edit", tool_input: { file_path: join(root, "src", "failed.ts") }, tool_response: { success: false, output: "", error: "no match" } }, env);
  assert.deepEqual(said(root, { hook_event_name: "Stop", prompt_id: "p1", stop_hook_active: false }, env), { decision: "block", reason: WORK_REMINDER });
  assert.equal(said(root, { hook_event_name: "Stop", prompt_id: "p1", stop_hook_active: true }, env), null);
  assert.deepEqual(log().filter((e) => e.t !== "item").map((e) => [e.t, e.text ?? e.path ?? e.host]), [["session", "devin"], ["prompt", "接 Devin"], ["file", "src/devin-made.ts"]]);
});
