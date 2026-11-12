// The Antigravity editor's adapter (src/antigravity.ts): its transcript read for the prompt and the answer, its hook
// events into the project's shared session record, the install, and the MCP server finding the project the hooks saw.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { activeOf, answerOf, installAntigravity, promptsAfter, requestOf, runAntigravity } from "../dist/antigravity.js";
import { logName, parseLog } from "../dist/core/session-log.js";
import { recordDecisions, recordPrompt, sessionsDirOf } from "../dist/session-store.js";
import { BUNDLE, gitRepo } from "./helpers/repo.mjs";

// A session's start opens the GEML board: never a window from a test.
process.env.GEMWORKS_OPEN_BOARD = "0";

const step = (i, type, extra) => JSON.stringify({ step_index: i, source: type === "USER_INPUT" ? "USER_EXPLICIT" : "MODEL", type, status: "DONE", created_at: "2026-10-19T05:55:51Z", ...extra });
const ask = (i, text) => step(i, "USER_INPUT", { content: `<USER_REQUEST>\n${text}\n</USER_REQUEST>\n<ADDITIONAL_METADATA>\nThe current local time is: 2026-10-19T13:55:51+08:00.\n</ADDITIONAL_METADATA>` });

test("the transcript: the prompt inside <USER_REQUEST>, the prompts after a step, the turn's answer the last model words since the prompt", () => {
  assert.equal(requestOf("<USER_REQUEST>\n列一下文件\n</USER_REQUEST>\n<ADDITIONAL_METADATA>x</ADDITIONAL_METADATA>"), "列一下文件");
  assert.equal(requestOf("  plain  "), "plain");
  const steps = [ask(0, "第一句"), step(1, "PLANNER_RESPONSE", { tool_calls: [{ name: "run_command", args: {} }] }), step(2, "GENERIC", { content: "output" }), step(3, "PLANNER_RESPONSE", { content: "答第一句" }), ask(4, "第二句"), step(5, "PLANNER_RESPONSE", { content: "答第二句" })].map((l) => JSON.parse(l));
  assert.deepEqual(promptsAfter(steps, -1).map((p) => [p.step, p.text]), [[0, "第一句"], [4, "第二句"]]);
  assert.deepEqual(promptsAfter(steps, 0).map((p) => p.step), [4]);
  assert.equal(answerOf(steps), "答第二句");
  assert.equal(answerOf(steps.slice(0, 3)), "", "no words since the prompt yet");
});

test("the hooks into the project's record: a session's log and its note tool told; a prompt as a turn with the other sessions' decisions beside it; a file, a commit and the answer", () => {
  const home = mkdtempSync(join(tmpdir(), "gemworks-agy-home-"));
  const root = gitRepo();
  // `git log --since` counts whole seconds, and the repository's init commit is made in the same second as the
  // prompt: dated a minute back, on both branches, it is not the turn's commit.
  const minuteAgo = new Date(Date.now() - 60_000).toISOString();
  spawnSync("git", ["-C", root, "commit", "-q", "--amend", "--allow-empty", "--no-edit"], { env: { ...process.env, GIT_AUTHOR_DATE: minuteAgo, GIT_COMMITTER_DATE: minuteAgo } });
  spawnSync("git", ["-C", root, "branch", "-f", "main", "HEAD"]);
  const transcript = join(home, "transcript_full.jsonl");
  const ev = (extra = {}) => JSON.stringify({ conversationId: "conv-1", workspacePaths: [root.split("\\").join("/")], transcriptPath: transcript, modelName: "m", ...extra });
  const log = () => parseLog(readFileSync(join(sessionsDirOf(root), logName("antigravity", "conv-1")), "utf8"));

  const start = JSON.parse(runAntigravity("SessionStart", ev(), home).stdout);
  assert.match(start.injectSteps[0].systemMessage.systemMessage, /`note` tool of the gemworks MCP server/);
  assert.match(start.injectSteps[0].systemMessage.systemMessage, /gemworks `work` tool[\s\S]*feature 新功能: mockup 样稿/, "and the work loop, with the flows' steps");
  assert.deepEqual(log().map((e) => [e.t, e.host]), [["session", "antigravity"]]);
  assert.deepEqual(activeOf(home), { conversationId: "conv-1", root, at: activeOf(home).at }, "the pointer the MCP server reads");

  recordPrompt(root, "codex", "cx1", "问一句");
  recordDecisions(root, "codex", "cx1", ["合并前先跑三平台 CI"]);
  writeFileSync(transcript, `${ask(0, "接 Antigravity")}\n`);
  const pre = JSON.parse(runAntigravity("PreInvocation", ev({ invocationNum: 0 }), home).stdout);
  assert.match(pre.injectSteps[0].ephemeralMessage, /- 合并前先跑三平台 CI（Codex · feat\/x，\d\d:\d\d）/);
  assert.equal(runAntigravity("PreInvocation", ev({ invocationNum: 1 }), home).stdout, "", "the same prompt again: nothing new");

  runAntigravity("PostToolUse", ev({ toolCall: { name: "write_to_file", args: { TargetFile: join(root, "src", "agy.ts") } }, error: "" }), home);
  runAntigravity("PostToolUse", ev({ toolCall: { name: "write_to_file", args: { TargetFile: join(tmpdir(), "elsewhere.ts") } }, error: "" }), home);
  writeFileSync(join(root, "agy.txt"), "x");
  spawnSync("git", ["-C", root, "add", "agy.txt"]);
  spawnSync("git", ["-C", root, "commit", "-q", "-m", "agy commit"], { env: { ...process.env, GIT_COMMITTER_DATE: new Date(Date.now() + 60_000).toISOString() } });
  runAntigravity("PostToolUse", ev({ toolCall: { name: "run_command", args: { CommandLine: "git commit -m 'agy commit'", Cwd: root } }, error: "" }), home);
  writeFileSync(transcript, `${ask(0, "接 Antigravity")}\n${step(1, "PLANNER_RESPONSE", { content: "接好了。" })}\n`);
  runAntigravity("Stop", ev({ fullyIdle: true, terminationReason: "NO_TOOL_CALL", error: "" }), home);
  assert.deepEqual(log().map((e) => [e.t, e.text ?? e.path ?? e.subject ?? e.host]), [
    ["session", "antigravity"], ["prompt", "接 Antigravity"], ["file", "src/agy.ts"], ["answer", "接好了。"], ["commit", "agy commit"],
  ], "a file outside the project is not the project's");
  assert.equal(runAntigravity("Stop", "not json", home).stdout, "");
});

test("install: the adapter's hooks under its own name in the global hooks file, the probe taken out and every other hook kept; the MCP server added beside the others", () => {
  const home = mkdtempSync(join(tmpdir(), "gemworks-agy-home-"));
  const dir = join(home, ".gemini", "config");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "hooks.json"), JSON.stringify({ "gemworks-probe": { Stop: [] }, "my-linter": { PostToolUse: [] } }));
  writeFileSync(join(dir, "mcp_config.json"), JSON.stringify({ mcpServers: { pencil: { command: "p" } } }));
  installAntigravity("/opt/gemworks/dist/gemworks.mjs", home);
  const hooks = JSON.parse(readFileSync(join(dir, "hooks.json"), "utf8"));
  assert.deepEqual(Object.keys(hooks).sort(), ["gemworks", "my-linter"]);
  assert.deepEqual(Object.keys(hooks.gemworks), ["SessionStart", "PreInvocation", "PostToolUse", "Stop"]);
  assert.equal(hooks.gemworks.Stop[0].command, "node /opt/gemworks/dist/gemworks.mjs antigravity Stop", "no quotes: Antigravity passes them on as they are");
  const mcp = JSON.parse(readFileSync(join(dir, "mcp_config.json"), "utf8"));
  assert.deepEqual(Object.keys(mcp.mcpServers).sort(), ["gemworks", "pencil"]);
  assert.deepEqual(mcp.mcpServers.gemworks.args, ["/opt/gemworks/dist/gemworks.mjs", "mcp", "--host", "antigravity"]);
});

test("the MCP server for Antigravity, started outside the project: note writes to the conversation the hooks last saw, in its project", () => {
  const home = mkdtempSync(join(tmpdir(), "gemworks-agy-home-"));
  const root = gitRepo();
  runAntigravity("SessionStart", JSON.stringify({ conversationId: "conv-9", workspacePaths: [root], transcriptPath: join(home, "t.jsonl") }), home);
  const r = spawnSync(process.execPath, [BUNDLE, "mcp", "--host", "antigravity"], {
    cwd: tmpdir(), encoding: "utf8", timeout: 60_000, env: { ...process.env, HOME: home, USERPROFILE: home },
    input: `${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "note", arguments: { decisions: ["Antigravity 也记进来"] } } })}\n`,
  });
  assert.equal(r.status, 0, r.stderr);
  assert.match(JSON.parse(r.stdout.trim()).result.content[0].text, /^Recorded 1 decision/);
  const e = parseLog(readFileSync(join(sessionsDirOf(root), logName("antigravity", "conv-9")), "utf8"));
  assert.deepEqual(e.filter((x) => x.t === "decision").map((x) => x.text), ["Antigravity 也记进来"]);
});

test("the work loop through Antigravity's hooks: a new prompt's transient message carries the work items on the way and the step's practices; the board is written", async () => {
  const { recordWork } = await import("../dist/loop.js");
  const home = mkdtempSync(join(tmpdir(), "gemworks-agy-home-"));
  const root = gitRepo();
  const transcript = join(home, "transcript_full.jsonl");
  const ev = (extra = {}) => JSON.stringify({ conversationId: "conv-2", workspacePaths: [root.split("\\").join("/")], transcriptPath: transcript, modelName: "m", ...extra });
  runAntigravity("SessionStart", ev(), home);
  recordWork(root, "antigravity", "conv-2", { items: [{ title: "看板", flow: "feature", needs: "你看样稿" }] });
  writeFileSync(transcript, `${JSON.stringify({ step_index: 0, type: "USER_INPUT", source: "USER_EXPLICIT", content: "<USER_REQUEST>接着做</USER_REQUEST>" })}\n`);
  const pre = JSON.parse(runAntigravity("PreInvocation", ev({ invocationNum: 0 }), home).stdout);
  assert.match(pre.injectSteps[0].ephemeralMessage, /^\[gemworks\] work items on the way: #\S+ «看板» \(feature: at mockup 样稿, needs 你看样稿\)/);
  assert.match(readFileSync(join(root, ".geml", "board.geml"), "utf8"), /看板/);
});

test("the Antigravity plugin in this folder: its manifest has what the Marketplace asks, its hooks and MCP server run the bundle it ships, its skills are only the ones skills/ lacks", async () => {
  const { hooksFor } = await import("../dist/antigravity.js");
  const { existsSync, readdirSync } = await import("node:fs");
  const at = (p) => new URL(`../${p}`, import.meta.url);
  const json = (p) => JSON.parse(readFileSync(at(p), "utf8"));
  const m = json(".antigravity-plugin/plugin.json");
  assert.equal(m.name, "gemworks");
  assert.equal(m.displayName, "Gemworks", "no Antigravity/Gemini/Claude/Cursor in front, no Plugin or MCP behind");
  assert.ok(m.description.length >= 120 && m.description.length <= 160, `the Marketplace's 120 to 160 characters: ${m.description.length}`);
  for (const k of ["version", "author", "license", "logo"]) assert.ok(m[k] !== undefined, k);
  const logo = readFileSync(at(m.logo), "utf8");
  const [, , w, h] = /viewBox="([^"]+)"/.exec(logo)[1].split(/\s+/).map(Number);
  assert.equal(w, h, "a square logo");
  assert.match(logo, /width="128" height="128"/, "at least 128 pixels");
  // Claude Code's skills/ is read by Antigravity too: the manifest adds only the geml plugin's two, so no name comes twice.
  const own = readdirSync(at("skills"));
  for (const s of m.skills) {
    assert.ok(existsSync(at(`${s.slice(2)}/SKILL.md`)), s);
    assert.ok(!own.includes(s.split("/").pop()), `${s} is not also in skills/`);
  }
  // The hooks run from the plugin's root, on the bundle the package ships: the commands the global install writes, with the path relative.
  assert.deepEqual(json("hooks.json"), { gemworks: hooksFor("node ./dist/gemworks.mjs") });
  assert.deepEqual(json("mcp_config.json"), { mcpServers: { gemworks: { command: "node", args: ["${PLUGIN_ROOT}/dist/gemworks.mjs", "mcp", "--host", "antigravity"] } } });
});
