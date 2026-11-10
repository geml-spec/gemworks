// The Qwen Code adapter: the pure reading and answering of Qwen Code's hook events (src/hosts/qwen/hook.ts), the install,
// then `gemworks qwen` through the bundle in a project with the dev workflow, event by event in the order Qwen Code
// raises them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { hooksWith, installQwen, projectOf } from "../dist/qwen.js";
import { allowCall, bareTool, callOf, denyCall, exitCodeOf, readEvent } from "../dist/hosts/qwen/hook.js";
import { wrapCommand } from "../dist/hosts/codex/hook.js";
import { BUNDLE, fakeGh, gitRepo, hook, withWorkflow } from "./helpers/repo.mjs";

const WS_DEV = fileURLToPath(new URL("./fixtures/ws-dev/", import.meta.url));
// A session's start opens the GEML board: never a window from a test.
process.env.GEMWORKS_OPEN_BOARD = "0";

/** A home of its own for each test: the adapter keeps its state under it. */
const homeEnv = () => { const home = mkdtempSync(join(tmpdir(), "gemworks-qwen-home-")); return { HOME: home, USERPROFILE: home }; };

/** One Qwen Code hook event through the bundle: its answer parsed, null when it said nothing. */
function qwen(root, event, env = {}) {
  const r = spawnSync(process.execPath, [BUNDLE, "qwen"], {
    cwd: root, input: JSON.stringify({ session_id: "s-1", cwd: root, transcript_path: "/t.jsonl", timestamp: "2026-11-11T00:00:00Z", permission_mode: "default", ...event }), encoding: "utf8", env: { ...process.env, QWEN_PROJECT_DIR: root, ...env }, timeout: 60_000,
  });
  assert.equal(r.status, 0, `qwen exit ${r.status}: ${r.stderr}`);
  return r.stdout.trim() === "" ? null : JSON.parse(r.stdout);
}
const project = () => {
  const root = gitRepo();
  withWorkflow(root, WS_DEV, "dev");
  return root;
};

test("Qwen Code's events and tools: read from JSON with a hook_event_name; run_shell_command taken as Bash, the writing tools as Write, Edit or NotebookEdit with their file_path, the readers by Claude Code's names, an MCP tool bare", () => {
  assert.equal(readEvent("not json"), undefined);
  assert.equal(readEvent(JSON.stringify({ session_id: "s" })), undefined, "no hook_event_name");
  assert.deepEqual(readEvent(JSON.stringify({ hook_event_name: "Stop", session_id: "s", stop_hook_active: true, last_assistant_message: "ok", context_usage: 0.2 })), { hook_event_name: "Stop", session_id: "s", stop_hook_active: true, last_assistant_message: "ok" });
  assert.deepEqual(callOf("run_shell_command", { command: "npm test", directory: "/p" }), { tool: "Bash", input: { command: "npm test", directory: "/p" } });
  assert.deepEqual(callOf("write_file", { file_path: "src/a.ts", content: "x" }), { tool: "Write", input: { file_path: "src/a.ts", content: "x" } });
  assert.equal(callOf("edit", { file_path: "a", old_string: "x", new_string: "y" }).tool, "Edit");
  assert.deepEqual(callOf("notebook_edit", { notebook_path: "n.ipynb" }), { tool: "NotebookEdit", input: { notebook_path: "n.ipynb", file_path: "n.ipynb" } });
  assert.equal(callOf("read_file", { absolute_path: "/p/a" }).tool, "Read");
  assert.equal(callOf("grep_search", {}).tool, "Grep");
  assert.equal(callOf("mcp__fetch_server__fetch", {}).tool, "fetch");
  assert.equal(bareTool("mcp__gemworks__work"), "work");
  assert.equal(bareTool("glob"), "glob");
});

test("a shell result's exit status: the wrapper's marker, else the shell tool's Exit Code line, else a number its JSON names, else none; the answers before a call", () => {
  assert.equal(exitCodeOf("Command: npm test\nOutput: all green\n[gemworks exit 0]\nExit Code: 0"), 0);
  assert.equal(exitCodeOf({ llmContent: "Command: npm test\nOutput: boom\nExit Code: 1\nSignal: (none)" }), 1);
  assert.equal(exitCodeOf({ exitCode: 2 }), 2);
  assert.equal(exitCodeOf([{ text: "a" }, { text: "Exit Code: 3" }]), 3);
  assert.equal(exitCodeOf({ llmContent: "a\nb" }), null);
  assert.deepEqual(denyCall("not now"), { hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: "gemworks: not now" } });
  assert.equal(allowCall(), undefined);
  assert.deepEqual(allowCall({ command: "x" }), { hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "allow", permissionDecisionReason: "gemworks", updatedInput: { command: "x" } } });
  assert.equal(projectOf({ QWEN_PROJECT_DIR: "/p/q" }, "/elsewhere").replaceAll("\\", "/").replace(/^[A-Za-z]:/, ""), "/p/q");
  assert.equal(projectOf({}, undefined), undefined);
});

test("gemworks qwen install: the hooks into ~/.qwen/settings.json beside the person's own, an earlier install's replaced, every other setting kept; the MCP server beside the others; a settings file that is no plain JSON left alone", () => {
  const home = mkdtempSync(join(tmpdir(), "gemworks-qwen-install-"));
  mkdirSync(join(home, ".qwen"));
  const file = join(home, ".qwen", "settings.json");
  writeFileSync(file, JSON.stringify({
    model: { name: "qwen3-coder" },
    mcpServers: { other: { command: "x" } },
    hooks: {
      PostToolUse: [{ matcher: "^write_file$", hooks: [{ type: "command", command: "./format.sh" }] }],
      Stop: [{ hooks: [{ type: "command", command: "node \"/old/place/gemworks.mjs\" qwen" }] }],
    },
  }));
  assert.deepEqual(installQwen("/opt/gw/dist/gemworks.mjs", home), [file]);
  const settings = JSON.parse(readFileSync(file, "utf8"));
  const ours = { hooks: [{ type: "command", command: "node \"/opt/gw/dist/gemworks.mjs\" qwen", name: "gemworks", timeout: 60 }] };
  assert.deepEqual(settings.model, { name: "qwen3-coder" });
  assert.deepEqual(settings.hooks.PostToolUse, [{ matcher: "^write_file$", hooks: [{ type: "command", command: "./format.sh" }] }, ours], "the person's own hook kept, ours after it");
  assert.deepEqual(settings.hooks.Stop, [{ hooks: [{ ...ours.hooks[0], timeout: 30 }] }], "the earlier install's taken out");
  assert.deepEqual(Object.keys(settings.hooks).sort(), ["PostToolUse", "PostToolUseFailure", "PreToolUse", "SessionStart", "Stop", "UserPromptSubmit"]);
  assert.deepEqual(settings.mcpServers, { other: { command: "x" }, gemworks: { command: "node", args: ["/opt/gw/dist/gemworks.mjs", "mcp", "--host", "qwen"] } });
  // Again: the same file, nothing doubled.
  installQwen("/opt/gw/dist/gemworks.mjs", home);
  assert.deepEqual(JSON.parse(readFileSync(file, "utf8")), settings);
  assert.deepEqual(Object.keys(hooksWith({}, "c").hooks).length, 6);
  // Comments in it: refused, and the file as it was.
  const commented = "{\n  // mine\n  \"model\": {}\n}\n";
  writeFileSync(file, commented);
  assert.throws(() => installQwen("/opt/gw/dist/gemworks.mjs", home), /not plain JSON/);
  assert.equal(readFileSync(file, "utf8"), commented);
  const r = spawnSync(process.execPath, [BUNDLE, "qwen", "install"], { encoding: "utf8", env: { ...process.env, HOME: home, USERPROFILE: home } });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /^gemworks qwen install: .*not plain JSON/);
});

test("gemworks qwen, in event order: the stage at the start, a refused command, a wrapped test run whose status moves the stage, the new stage reaching the model once", () => {
  const root = project();
  const gh = fakeGh();
  gh.set({ pr: "OPEN" });
  const env = { ...gh.env, ...homeEnv() };
  const start = qwen(root, { hook_event_name: "SessionStart", source: "startup", model: "qwen3-coder" }, env);
  assert.equal(start.hookSpecificOutput.hookEventName, "SessionStart");
  assert.match(start.hookSpecificOutput.additionalContext, /^\[gemworks\] stage build · rev 0/m);
  assert.match(start.hookSpecificOutput.additionalContext, /`note` tool of the gemworks MCP server/);
  // A person's command, and a use fenced to another state: refused with the reason.
  const person = qwen(root, { hook_event_name: "PreToolUse", tool_name: "run_shell_command", tool_use_id: "c1", tool_input: { command: "gemworks mark reviewed" } }, env);
  assert.equal(person.hookSpecificOutput.permissionDecision, "deny");
  assert.match(person.hookSpecificOutput.permissionDecisionReason, /^gemworks: .*for a person/);
  const fenced = qwen(root, { hook_event_name: "PreToolUse", tool_name: "run_shell_command", tool_use_id: "c2", tool_input: { command: "npx wrangler deploy --env production" } }, env);
  assert.match(fenced.hookSpecificOutput.permissionDecisionReason, /is deploy-prod, which is used only in #release; the workflow is in #build/);
  assert.equal(hook(root, { op: "status" }, env).shell.status.refusals, 2, "both refusals recorded");
  // A read tool the dictionary allows everywhere, an MCP tool no row takes, and the adapter's own tool: through, with nothing to say.
  assert.equal(qwen(root, { hook_event_name: "PreToolUse", tool_name: "read_file", tool_use_id: "c3", tool_input: { absolute_path: join(root, "README.md") } }, env), null);
  assert.equal(qwen(root, { hook_event_name: "PreToolUse", tool_name: "mcp__fetch__fetch", tool_use_id: "c4", tool_input: { url: "https://x" } }, env), null);
  assert.equal(qwen(root, { hook_event_name: "PreToolUse", tool_name: "mcp__gemworks__status", tool_use_id: "c5", tool_input: {} }, env), null);
  // The test command's status is evidence: the call is rewritten to print it, its other fields kept (Qwen Code replaces the whole input).
  const run = qwen(root, { hook_event_name: "PreToolUse", tool_name: "run_shell_command", tool_use_id: "c6", tool_input: { command: "npm test", description: "run the tests" } }, env);
  const windows = process.platform === "win32";
  if (windows) assert.equal(run, null, "the wrapper is POSIX shell: on Windows the command runs as it is");
  else assert.deepEqual(run.hookSpecificOutput.updatedInput, { command: wrapCommand("npm test"), description: "run the tests" });
  // It ran and passed: tests-pass and the open PR take the workflow to review; the model hears of the new stage with the result.
  const command = windows ? "npm test" : wrapCommand("npm test");
  const ran = qwen(root, { hook_event_name: "PostToolUse", tool_name: "run_shell_command", tool_use_id: "c6", tool_input: { command }, tool_response: { llmContent: `Command: ${command}\nOutput: all green\n${windows ? "" : "[gemworks exit 0]\n"}Exit Code: 0` } }, env);
  assert.equal(ran.hookSpecificOutput.hookEventName, "PostToolUse");
  assert.match(ran.hookSpecificOutput.additionalContext, /^\[gemworks\] stage review · rev \d/m);
  const status = hook(root, { op: "status" }, env);
  assert.equal(status.shell.status.state.id, "review");
  assert.equal(status.shell.status.vars["tests-pass"], true);
  // The next prompt: the stage is read already; a result with no status says nothing.
  qwen(root, { hook_event_name: "UserPromptSubmit", prompt: "next", submitted_prompt: "next", prompt_id: "p2" }, env);
  assert.equal(qwen(root, { hook_event_name: "PostToolUse", tool_name: "run_shell_command", tool_use_id: "c7", tool_input: { command: "ls" }, tool_response: { llmContent: "Output: a\nExit Code: 0" } }, env), null);
});

test("gemworks qwen says nothing and exits 0 where there is nothing to say: no workflow, no event, no session", () => {
  const bare = gitRepo();
  const env = homeEnv();
  const told = qwen(bare, { hook_event_name: "SessionStart", source: "startup" }, env).hookSpecificOutput.additionalContext;
  assert.match(told, /gemworks `work` tool/, "no workflow: the start tells only the work loop");
  assert.doesNotMatch(told, /\[gemworks\] stage/);
  assert.equal(qwen(bare, { hook_event_name: "PreToolUse", tool_name: "run_shell_command", tool_use_id: "c1", tool_input: { command: "gemworks mark x" } }, env), null, "no workflow: nothing is refused");
  assert.equal(qwen(bare, { hook_event_name: "UserPromptSubmit", prompt: "x", session_id: undefined }, env), null, "no session");
  for (const input of ["not json", ""]) {
    const r = spawnSync(process.execPath, [BUNDLE, "qwen"], { cwd: bare, input, encoding: "utf8", env: { ...process.env, ...env } });
    assert.equal(r.status, 0);
    assert.equal(r.stdout, "");
  }
});

test("the project's record and the work loop through Qwen Code's hooks: what is said beside a prompt, once a turn; a file, the answer; a turn that wrote and reported nothing sent back once, the reminder no prompt of the person's", async () => {
  const { logName, parseLog } = await import("../dist/core/session-log.js");
  const { recordDecisions, recordPrompt, sessionsDirOf } = await import("../dist/session-store.js");
  const { recordWork } = await import("../dist/loop.js");
  const { WORK_REMINDER } = await import("../dist/core/work.js");
  const root = gitRepo();
  const env = homeEnv();
  const log = () => parseLog(readFileSync(join(sessionsDirOf(root), logName("qwen", "s-1")), "utf8"));
  const start = qwen(root, { hook_event_name: "SessionStart", source: "startup" }, env).hookSpecificOutput.additionalContext;
  assert.match(start, /feature 新功能: mockup 样稿 \(you\) → build/, "the flows' steps");
  assert.deepEqual(log().map((e) => [e.t, e.host]), [["session", "qwen"]]);

  recordPrompt(root, "claude-code", "cc1", "另一个会话问的");
  recordDecisions(root, "claude-code", "cc1", ["合并前先跑三平台 CI"]);
  recordWork(root, "qwen", "s-1", { items: [{ title: "看板", flow: "feature", needs: "你看样稿" }] });
  const said = qwen(root, { hook_event_name: "UserPromptSubmit", prompt: "接 Qwen\n<expanded>", submitted_prompt: "接 Qwen", prompt_id: "p1" }, env).hookSpecificOutput;
  assert.equal(said.hookEventName, "UserPromptSubmit");
  assert.match(said.additionalContext, /- 合并前先跑三平台 CI（Claude · feat\/x，\d\d:\d\d）/);
  assert.match(said.additionalContext, /\[gemworks\] work items on the way: #\S+ «看板» \(feature: at mockup 样稿, needs 你看样稿\)/);
  assert.match(readFileSync(join(root, ".geml", "board.geml"), "utf8"), /看板/, "the board, written at the prompt");
  // Qwen Code's own send inside the same turn (a tool result): the same turn, nothing said again or recorded.
  assert.equal(qwen(root, { hook_event_name: "UserPromptSubmit", prompt: "<tool result>", prompt_id: "p1" }, env), null);

  // The turn writes a file inside the project and one outside it, and reports no work item of its own.
  qwen(root, { hook_event_name: "PostToolUse", tool_name: "write_file", tool_use_id: "w1", tool_input: { file_path: join(root, "src", "qwen-made.ts"), content: "x" }, tool_response: {} }, env);
  qwen(root, { hook_event_name: "PostToolUse", tool_name: "edit", tool_use_id: "w2", tool_input: { file_path: join(tmpdir(), "elsewhere.ts") }, tool_response: {} }, env);
  assert.deepEqual(qwen(root, { hook_event_name: "Stop", stop_hook_active: false, last_assistant_message: "接好了。" }, env), { decision: "block", reason: WORK_REMINDER }, "sent back once");
  // The reminder may come back as a prompt: the hook's words, so no prompt of the person's and the same turn; it reports its item and ends.
  assert.equal(qwen(root, { hook_event_name: "UserPromptSubmit", prompt: WORK_REMINDER, prompt_id: "p1" }, env), null);
  assert.equal(qwen(root, { hook_event_name: "Stop", stop_hook_active: true, last_assistant_message: "报好了。" }, env), null);
  // A turn that only talked is not sent back.
  qwen(root, { hook_event_name: "UserPromptSubmit", prompt: "问一句", submitted_prompt: "问一句", prompt_id: "p2" }, env);
  assert.equal(qwen(root, { hook_event_name: "Stop", stop_hook_active: false, last_assistant_message: "答了。" }, env), null);
  const events = log().filter((e) => e.t !== "item").map((e) => [e.t, e.turn ?? null, e.text ?? e.path ?? e.host]);
  assert.deepEqual(events, [
    ["session", null, "qwen"], ["prompt", 1, "接 Qwen"], ["file", 1, "src/qwen-made.ts"], ["answer", 1, "报好了。"], ["prompt", 2, "问一句"], ["answer", 2, "答了。"],
  ]);
});
