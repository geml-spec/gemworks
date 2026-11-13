import { test } from "node:test";
import assert from "node:assert/strict";
import { parse } from "@geml/geml";
import { appendEvents, currentTurn, decisionsContext, decisionsSince, filesBySession, isLogName, legacyLogName, logName, nextTurn, NOTE_TOOL, noteReply, parseLog, personPrompts, readNote, saidByPerson, summarize } from "../dist/core/session-log.js";

const log = (events) => appendEvents("", events);

test("a log is a GEML document: one event a line in its events block, added at the block's end; the parser reads it with no diagnostic", () => {
  const text = log([{ t: "session", id: "s1", host: "claude-code", at: "2026-10-19T08:00:00Z", branch: "feat/x" }, { t: "prompt", turn: 1, at: "2026-10-19T08:01:00Z", text: "按项目组织会话\n=== 不是围栏" }]);
  assert.equal(text, `=== data {#events format=jsonl}\n${JSON.stringify({ t: "session", id: "s1", host: "claude-code", at: "2026-10-19T08:00:00Z", branch: "feat/x" })}\n${JSON.stringify({ t: "prompt", turn: 1, at: "2026-10-19T08:01:00Z", text: "按项目组织会话\n=== 不是围栏" })}\n===\n`);
  const more = appendEvents(text, [{ t: "decision", turn: 1, at: "2026-10-19T08:02:00Z", text: "每会话一个文件" }]);
  assert.deepEqual(parseLog(more).map((e) => e.t), ["session", "prompt", "decision"]);
  assert.deepEqual(parse(more).diagnostics, [], "a well-formed GEML document");
  assert.deepEqual(parseLog(more.replace("\n===\n", '\n{"t":"decision","turn":1,"at":"2026-10-19T0\n===\n')).map((e) => e.t), ["session", "prompt", "decision"], "a line cut short is left out");
  const earlier = `${JSON.stringify({ t: "session", id: "s0", host: "codex", at: "2026-10-18T08:00:00Z" })}\n${JSON.stringify({ t: "prompt", turn: 1, at: "2026-10-18T08:01:00Z", text: "旧的" })}\n`;
  assert.deepEqual(parseLog(earlier).map((e) => e.t), ["session", "prompt"], "an earlier log of plain JSON lines still reads");
  assert.match(appendEvents(earlier, []), /^=== data \{#events format=jsonl\}\n/, "and comes out as a GEML one when written");
  assert.deepEqual(parseLog('{"t":"prompt","turn":"x","at":"a","text":"t"}\nnot json\n{"t":"other","at":"a"}'), [], "only well-formed events count");
});

test("a log's name keeps the host and the id, and nothing that leaves the directory", () => {
  assert.equal(logName("claude-code", "3f70c07c-a125"), "claude-code-3f70c07c-a125.geml");
  assert.equal(legacyLogName("claude-code", "3f70c07c-a125"), "claude-code-3f70c07c-a125.jsonl");
  assert.equal(logName("codex", "../../etc/x"), "codex-..-..-etc-x.geml", "no separator left: it stays a name in the directory");
  assert.deepEqual(["a.geml", "a.jsonl", "b.jsonl", ".gitignore"].filter((n, _, all) => isLogName(n, all)), ["a.geml", "b.jsonl"], "an earlier log with a GEML one beside it is that one's past");
});

test("turns: the next prompt opens one past the last; the current one is the last prompt's", () => {
  const events = parseLog(log([
    { t: "session", id: "s1", host: "codex", at: "2026-10-19T08:00:00Z" },
    { t: "prompt", turn: 1, at: "2026-10-19T08:01:00Z", text: "a" },
    { t: "answer", turn: 1, at: "2026-10-19T08:02:00Z", text: "A" },
    { t: "prompt", turn: 2, at: "2026-10-19T08:03:00Z", text: "b" },
  ]));
  assert.equal(currentTurn(events), 2);
  assert.equal(nextTurn(events), 3);
  assert.equal(nextTurn([]), 1);
  assert.equal(currentTurn([]), 0);
});

test("a session read whole: its turns with their answers and decisions, the files and commits once each", () => {
  const s = summarize(parseLog(log([
    { t: "session", id: "s1", host: "claude-code", at: "2026-10-19T08:00:00Z", branch: "feat/x", checkout: "/w/x" },
    { t: "prompt", turn: 1, at: "2026-10-19T08:01:00Z", text: "按项目组织会话" },
    { t: "decision", turn: 1, at: "2026-10-19T08:05:00Z", text: "每会话一个文件" },
    { t: "file", turn: 1, at: "2026-10-19T08:06:00Z", path: "src/a.ts", branch: "feat/x" },
    { t: "file", turn: 1, at: "2026-10-19T08:07:00Z", path: "src/a.ts", branch: "feat/x" },
    { t: "commit", turn: 1, at: "2026-10-19T08:08:00Z", sha: "abc1234", subject: "sessions", branch: "feat/x" },
    { t: "answer", turn: 1, at: "2026-10-19T08:09:00Z", text: "好了。" },
  ])));
  assert.deepEqual([s.id, s.host, s.branch, s.checkout, s.started, s.last], ["s1", "claude-code", "feat/x", "/w/x", "2026-10-19T08:00:00Z", "2026-10-19T08:09:00Z"]);
  assert.deepEqual(s.turns, [{ turn: 1, at: "2026-10-19T08:01:00Z", prompt: "按项目组织会话", answer: "好了。", decisions: ["每会话一个文件"] }]);
  assert.deepEqual(s.files.map((f) => f.path), ["src/a.ts"]);
  assert.deepEqual(s.commits.map((c) => c.sha), ["abc1234"]);
  assert.equal(summarize(parseLog(log([{ t: "prompt", turn: 1, at: "x", text: "a" }]))), undefined, "no session line, no session");
});

test("what the other sessions decided: after the last one seen, oldest first, the newest few; never this session's own", () => {
  const mk = (id, host, branch, decisions) => summarize(parseLog(log([{ t: "session", id, host, at: "2026-10-19T07:00:00Z", branch }, ...decisions.map(([at, text]) => ({ t: "decision", turn: 1, at, text }))])));
  const sessions = [
    mk("me", "claude-code", "feat/x", [["2026-10-19T08:00:00Z", "我自己的"]]),
    mk("cx", "codex", "feat/y", [["2026-10-19T08:10:00Z", "合并前先跑三平台 CI"], ["2026-10-19T07:30:00Z", "旧的"]]),
    mk("gm", "gemini", "main", [["2026-10-19T08:20:00Z", "解析器先发"]]),
  ];
  assert.deepEqual(decisionsSince(sessions, "me", null).map((d) => d.text), ["旧的", "合并前先跑三平台 CI", "解析器先发"]);
  assert.deepEqual(decisionsSince(sessions, "me", "2026-10-19T08:00:00Z").map((d) => [d.text, d.host, d.branch]), [["合并前先跑三平台 CI", "codex", "feat/y"], ["解析器先发", "gemini", "main"]]);
  assert.deepEqual(decisionsSince(sessions, "me", null, 1).map((d) => d.text), ["解析器先发"], "the newest kept");
});

test("the files each session changed: one changed by two sessions comes first, it is the clash to settle before merging", () => {
  const mk = (id, files) => summarize(parseLog(log([{ t: "session", id, host: "claude-code", at: "2026-10-19T07:00:00Z" }, ...files.map(([at, path]) => ({ t: "file", turn: 1, at, path }))])));
  const files = filesBySession([mk("me", [["2026-10-19T08:00:00Z", "hooks/register.tsx"], ["2026-10-19T08:05:00Z", "src/board.ts"]]), mk("cx", [["2026-10-19T08:10:00Z", "hooks/register.tsx"], ["2026-10-19T08:01:00Z", "src/runtime.ts"]])]);
  assert.deepEqual(files.map((f) => [f.path, f.sessions]), [["hooks/register.tsx", ["me", "cx"]], ["src/board.ts", ["me"]], ["src/runtime.ts", ["cx"]]]);
});

test("whose a decision is: the person's press or words as the event says; an earlier event the person's press only when its words are one of their prompts", () => {
  const s = summarize(parseLog(log([
    { t: "session", id: "s1", host: "claude-code", at: "2026-11-13T08:00:00Z" },
    { t: "prompt", turn: 1, at: "2026-11-13T08:01:00Z", text: "旧记录怎么算？：按钮算你的，其余算模型" },
    { t: "decision", turn: 1, at: "2026-11-13T08:01:00Z", text: "旧记录怎么算？：按钮算你的，其余算模型" },
    { t: "decision", turn: 1, at: "2026-11-13T08:02:00Z", text: "旧记录按来源分" },
    { t: "prompt", turn: 2, at: "2026-11-13T08:03:00Z", text: "留 plugin 分支" },
    { t: "decision", turn: 2, at: "2026-11-13T08:04:00Z", text: "plugin 分支保持原名", by: "person", said: "留 plugin 分支" },
    { t: "decision", turn: 2, at: "2026-11-13T08:04:00Z", text: "词典先不动", by: "model" },
    { t: "prompt", turn: 3, at: "2026-11-13T08:05:00Z", text: "另一个会话说：都放 main", kind: "peer" },
    { t: "decision", turn: 3, at: "2026-11-13T08:05:00Z", text: "另一个会话说：都放 main" },
  ])));
  assert.deepEqual(s.decisions.map((d) => [d.text, d.by, d.pressed === true, d.said ?? ""]), [
    ["旧记录怎么算？：按钮算你的，其余算模型", "person", true, ""],
    ["旧记录按来源分", "model", false, ""],
    ["plugin 分支保持原名", "person", false, "留 plugin 分支"],
    ["词典先不动", "model", false, ""],
    ["另一个会话说：都放 main", "model", false, ""],
  ], "another session's message is no prompt of the person's");
  assert.deepEqual(s.turns.map((x) => x.byPerson ?? []), [["旧记录怎么算？：按钮算你的，其余算模型"], ["plugin 分支保持原名"], []]);
  assert.deepEqual(decisionsSince([s], "me", null).map((d) => [d.text, d.by]), s.decisions.map((d) => [d.text, d.by]), "another session reads whose each is");
  assert.deepEqual(parseLog(log([{ t: "decision", turn: 1, at: "a", text: "x", by: "someone" }])), [], "only a known author counts");
});

test("a note read against the person's prompts: their choices theirs only when their words are found, the model's otherwise, status left out", () => {
  const prompts = personPrompts(parseLog(log([
    { t: "prompt", turn: 1, at: "a", text: "按钮算你的，其余算模型" },
    { t: "prompt", turn: 2, at: "b", text: "Keep the Plugin  branch" },
    { t: "prompt", turn: 3, at: "c", text: "都放 main", kind: "peer" },
  ])));
  assert.deepEqual(prompts, ["按钮算你的，其余算模型", "Keep the Plugin  branch"]);
  assert.equal(saidByPerson("「按钮算你的，其余算模型」", prompts), true, "quotes are not the words");
  assert.equal(saidByPerson("按钮算你的,其余算模型", prompts), true, "a half-width comma for a full-width one");
  assert.equal(saidByPerson("keep the plugin branch", prompts), true, "ASCII case and spaces");
  assert.equal(saidByPerson("都放 main", prompts), false, "another session's words are not the person's");
  assert.equal(saidByPerson("  ", prompts), false);
  const note = readNote({
    decisions: ["词典先不动", "  ", "gemworks 0.3.20 synced"],
    theirs: [{ text: "旧记录：按钮算他的", said: "按钮算你的" }, { text: "都放 main", said: "都放 main" }, { text: "不带原话" }, "not an object"],
  }, prompts);
  assert.deepEqual(note.decided, [
    { text: "词典先不动", by: "model" },
    { text: "旧记录：按钮算他的", by: "person", said: "按钮算你的" },
    { text: "都放 main", by: "model" },
    { text: "不带原话", by: "model" },
  ]);
  assert.deepEqual(note.status, ["gemworks 0.3.20 synced"]);
  assert.deepEqual(note.unfound, ["都放 main", "不带原话"]);
  assert.match(noteReply(note), /^Recorded 4 decisions; .* 2 recorded as yours, not the person's: .*"都放 main", "不带原话".* 1 left out as status/);
  assert.match(noteReply(readNote({ decisions: [] }, prompts)), /^Nothing recorded: `decisions` is a list of short sentences, `theirs` the person's choices/);
  assert.deepEqual(NOTE_TOOL.inputSchema.properties.theirs.items.required, ["text", "said"], "a choice of the person's comes with their words");
});

test("the other sessions' decisions beside a prompt: the person's first, saying how they gave each; a model's apart, as reference", () => {
  const at = "2026-11-13T08:04:00Z";
  const label = () => "Codex · main，08:04";
  const theirs = { text: "plugin 分支保持原名", at, session: "s", host: "codex", by: "person", said: "一二三四五六七八九十一二三四五六七八九十一二三四五六" };
  const pressed = { text: "旧记录：按钮算他的", at, session: "s", host: "codex", by: "person", pressed: true };
  const models = { text: "词典先不动", at, session: "s", host: "codex", by: "model" };
  assert.equal(decisionsContext([models, theirs, pressed], label), [
    "[gemworks] 本项目其他会话里用户定的：",
    "- plugin 分支保持原名（用户说「一二三四五六七八九十一二三四五六七八九十一二三四…」· Codex · main，08:04）",
    "- 旧记录：按钮算他的（用户按的 · Codex · main，08:04）",
    "[gemworks] 本项目其他会话的模型记下的，用户没说过，只作参考：",
    "- 词典先不动（Codex · main，08:04）",
  ].join("\n"));
  assert.equal(decisionsContext([models], label), "[gemworks] 本项目其他会话的模型记下的，用户没说过，只作参考：\n- 词典先不动（Codex · main，08:04）", "no heading for the person's when they decided nothing");
});
