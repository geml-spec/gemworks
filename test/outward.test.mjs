// Outward actions (src/core/outward.ts): which calls reach beyond this machine, how the question puts them, what an
// answer does; the project dictionary's rows that let them through (src/dictionary-io.ts, the bridge's outward op);
// and the tools tab's list of them (board.ts outwardRows).
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { commandsRun } from "../dist/core/command-line.js";
import { allowedOutward, isOutwardKey, mcpOutward, outwardAnswer, outwardOf, outwardQuestion } from "../dist/core/outward.js";
import { readDictionary } from "../dist/core/dictionary-file.js";
import { outwardAllowed, projectDictionaryPath } from "../dist/dictionary-io.js";
import { outwardRows } from "../dist/hosts/claude-code/board.js";
import { wordsFor } from "../dist/hosts/claude-code/text.js";
import { gitRepo, hook } from "./helpers/repo.mjs";

const SHELLS = ["Bash", "PowerShell", "Monitor"];
const keys = (tool, command) => outwardOf(tool, { command }, SHELLS).map((o) => `${o.key} ${o.what}`);

test("a command line's commands: each command position, a shell's string, and a line that does not tokenise read loosely", () => {
  assert.deepEqual(commandsRun("cd repo && git push origin main | tee log"), [["cd", "repo"], ["git", "push", "origin", "main"], ["tee", "log"]]);
  assert.ok(commandsRun('bash -c "git push origin main"').some((c) => c.join(" ") === "git push origin main"), "the string bash is handed");
  assert.deepEqual(commandsRun("echo 'git push'"), [["echo", "git push"]], "a quoted argument is no command");
  assert.ok(commandsRun("git push \"$(git branch").some((c) => c[0] === "git" && c[1] === "push"), "a quote that does not close: read loosely");
});

test("the outward actions a shell command makes, through launchers, chains, shells and PowerShell; learned by their words", () => {
  for (const [command, want] of [
    ["git push origin main", "Bash(git push*) 推到远端"],
    ["rtk git push", "Bash(git push*) 推到远端"],
    ["cd C:/repo && git -C sub push --tags", "Bash(git push*) 推到远端"],
    ["sudo -u bob git push", "Bash(git push*) 推到远端"],
    ['bash -c "git push origin HEAD"', "Bash(git push*) 推到远端"],
    ["gh pr create --title x --body y", "Bash(gh pr create*) GitHub 写操作"],
    ["gh workflow run ci.yml", "Bash(gh workflow run*) GitHub 写操作"],
    ["gh api -X POST repos/o/r/issues", "Bash(gh api*) GitHub 写操作"],
    ["gh api repos/o/r/labels -f name=x", "Bash(gh api*) GitHub 写操作"],
    ["npm publish --access public", "Bash(npm publish*) 发包"],
    ["yarn npm publish", "Bash(yarn npm publish*) 发包"],
    ["docker push ghcr.io/o/i:1", "Bash(docker push*) 推镜像"],
    ["curl -X POST https://example.com/hook", "Bash(curl*) 往外发数据"],
    ["curl --data-binary @body.json https://example.com", "Bash(curl*) 往外发数据"],
    ["npx wrangler deploy", "Bash(wrangler deploy*) 部署"],
    ["terraform apply -auto-approve", "Bash(terraform apply*) 部署"],
    ["ssh build-box 'ls'", "Bash(ssh*) 远程登录"],
    ["scp dist.tgz me@host:/tmp/", "Bash(scp*) 传到远端"],
  ]) assert.deepEqual(keys("Bash", command), [want], command);
  assert.deepEqual(keys("PowerShell", "git push origin main; if ($?) { Write-Output ok }"), ["Bash(git push*) 推到远端"], "PowerShell's line, read the same way");
  assert.deepEqual(keys("Bash", "git push && npm publish && git push --tags"), ["Bash(git push*) 推到远端", "Bash(npm publish*) 发包"], "each once");
  assert.deepEqual(keys("Bash", "/usr/bin/git.exe push"), ["Bash(git push*) 推到远端"], "a path and .exe");
});

test("what is not outward: reading, committing, installing, a word in a message, a local copy", () => {
  for (const command of [
    "git status", "git commit -m 'push it'", "git log --grep=push", "echo git push", "npm install", "npm test",
    "gh pr view 3", "gh run watch 123", "gh secret list", "gh api repos/o/r", "curl https://example.com", "kubectl get pods",
    "rsync -a src/ dst/", "scp C:\\a.txt D:\\b.txt", "scp 'C:\\a.txt' D:/b.txt", "ssh -V", "docker build .", "vercel whoami",
  ]) assert.deepEqual(keys("Bash", command), [], command);
  assert.deepEqual(outwardOf("Read", { command: "git push" }, SHELLS), [], "only a shell tool's command is one");
  assert.deepEqual(outwardOf("Edit", { file_path: "a.ts" }, SHELLS), []);
});

test("an MCP tool is outward when it writes somewhere else: a word in its name says so, and the servers that act here never are", () => {
  for (const tool of ["mcp__lark-mcp__im_v1_message_create", "mcp__dataworks__CreateNode", "mcp__oss__put_object", "mcp__gemsbang__im_say", "mcp__Figma__add_code_connect_map", "mcp__dataworks__AbolishPipelineRun"]) assert.equal(mcpOutward(tool), true, tool);
  for (const tool of ["mcp__dataworks__GetNode", "mcp__lark-mcp__im_v1_message_list", "mcp__flink__switch_workspace", "mcp__gemworks__set", "mcp__ccd_session__start_session", "mcp__claude-in-chrome__computer", "mcp__plugin_geml_geml__geml_set", "mcp__lark-mcp__get_settings", "Bash", "mcp__oss__get_object"]) assert.equal(mcpOutward(tool), false, tool);
  assert.deepEqual(outwardOf("mcp__lark-mcp__im_v1_message_create", {}, SHELLS), [{ key: "mcp__lark-mcp__im_v1_message_create", keys: ["mcp__lark-mcp__im_v1_message_create"], what: "MCP 写操作" }]);
});

test("a row that allows a key in every state lets the action through: the key 以后都放行 wrote, or one written by hand", () => {
  const [push] = outwardOf("Bash", { command: "rtk git push origin main" }, SHELLS);
  assert.equal(allowedOutward(["Bash(git push*)"], push), true);
  assert.equal(allowedOutward(["Bash(git push origin main)"], push), true, "a row for exactly this command");
  assert.equal(allowedOutward(["Bash(git push origin dev)", "Bash(npm publish*)"], push), false);
  const [send] = outwardOf("mcp__lark-mcp__im_v1_message_create", {}, SHELLS);
  assert.equal(allowedOutward(["mcp__lark-mcp__im_v1_message_create"], send), true);
  assert.equal(allowedOutward(["mcp__lark-mcp__*"], send), true, "a server's tools at once");
  assert.deepEqual(["Bash(git push*)", "Bash(npm test)", "mcp__oss__put_object", "Read", "Bash(gh pr create*)"].filter(isOutwardKey), ["Bash(git push*)", "mcp__oss__put_object", "Bash(gh pr create*)"]);
});

test("the question: what kind, the call cut short, three answers; only the two that let it run do, anything else holds it", () => {
  const zh = wordsFor("zh");
  const found = outwardOf("Bash", { command: "git push origin main && npm publish" }, SHELLS);
  const q = outwardQuestion(found, "git push origin main && npm publish", zh);
  assert.deepEqual(q, { question: "gemworks：推到远端、发包：git push origin main && npm publish，放行吗？", options: ["这次放行", "以后都放行", "不放行"], header: "对外动作" });
  assert.match(outwardQuestion(found, `git push ${"x".repeat(200)}`, zh).question, /x…，放行吗？$/, "a long call cut at 80 characters");
  assert.deepEqual(outwardAnswer("这次放行", found, zh), { kind: "pass" });
  assert.deepEqual(outwardAnswer("以后都放行", found, zh), { kind: "allow", keys: ["Bash(git push*)", "Bash(npm publish*)"] });
  for (const other of ["不放行", undefined, "User dismissed the question", "先别推"]) assert.equal(outwardAnswer(other, found, zh).kind, "hold", String(other));
  assert.match(outwardAnswer(undefined, found, zh).reason, /did not let this outward action through \(Bash\(git push\*\), Bash\(npm publish\*\)\): ask them/);
  const en = wordsFor("en");
  assert.deepEqual(outwardQuestion(found.slice(0, 1), "git push", en), { question: "gemworks: push to a remote: git push. Let it run?", options: ["Run it this time", "Always run it", "Don't run it"], header: "Outward" });
  assert.deepEqual(outwardAnswer("Always run it", found.slice(0, 1), en), { kind: "allow", keys: ["Bash(git push*)"] });
});

test("the project dictionary: 以后都放行 writes a row allowing the key everywhere, 删除 takes it out, what a person wrote stays; the bridge answers the same", () => {
  const root = gitRepo();
  const path = projectDictionaryPath(root);
  // The main working tree's, compared by its end: macOS reads the temp folder through /private, Windows by a short name.
  assert.ok(path.endsWith(join(".geml", "tools.geml")), path);
  assert.deepEqual(outwardAllowed(root), [], "no file: nothing let through");
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, "=== meta\ntitle = \"tools\"\n===\n\nA note a person wrote.\n\n=== table {#tools}\n| tool | for | allow | deny | default | params |\n| --- | --- | --- | --- | --- | --- |\n| Bash(npm test) | | * | | | |\n===\n");
  assert.deepEqual(outwardAllowed(root, { allow: ["Bash(git push*)"] }), ["Bash(npm test)", "Bash(git push*)"]);
  const text = readFileSync(path, "utf8");
  assert.match(text, /A note a person wrote\./, "only the table is rewritten");
  assert.deepEqual(readDictionary(text).diagnostics, [], "the file still reads with no diagnostic");
  assert.deepEqual(outwardAllowed(root, { forget: ["Bash(git push*)"] }), ["Bash(npm test)"]);
  const res = hook(root, { op: "outward", allow: ["mcp__oss__put_object"] });
  assert.equal(res.ok, true);
  assert.deepEqual(res.outward, ["Bash(npm test)", "mcp__oss__put_object"], "through the bridge, with no workflow");
  assert.equal(hook(root, { op: "outward", allow: ["a\nb"] }).ok, false, "a key with a line break is no row");
  assert.ok(existsSync(path));
});

test("the tools tab lists the outward actions let through, each with 删除 that asks first; none: a line saying they are asked about", () => {
  const t = wordsFor("zh");
  const none = outwardRows(["Bash(npm test)"], t, 80);
  assert.deepEqual(none.map((r) => r.kind === "section" ? `§ ${r.text}` : r.text ?? r.lines?.join("")), ["§ 对外动作", "推送、发布、部署、发消息之前都先问你；还没有放行过的。"]);
  const rows = outwardRows(["Bash(npm test)", "Bash(git push*)", "mcp__oss__put_object"], t, 80);
  assert.deepEqual(rows.slice(1).map((r) => [r.kind, r.tag, r.extra.label, r.extra.action]), [
    ["entry", "已放行", "删除", { op: "outward-forget", key: "Bash(git push*)", confirm: { question: `删除 ${rows[1].title}？之后它再要运行时会先问你。`, yes: "删除" } }],
    ["entry", "已放行", "删除", { op: "outward-forget", key: "mcp__oss__put_object", confirm: { question: `删除 ${rows[2].title}？之后它再要运行时会先问你。`, yes: "删除" } }],
  ]);
});
