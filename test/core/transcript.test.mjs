// A Claude Code transcript read into the session record's turns (transcript.ts), and earlier turns put before a log's own (session-log.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { newTurns, promptShown, promptWords, queuedMessages, readTranscript, slugOf, transcriptEvents } from "../../dist/core/transcript.js";
import { parseLog, formatLog, summarize, withEarlierTurns } from "../../dist/core/session-log.js";

const rec = (o) => JSON.stringify({ sessionId: "s-1", cwd: "C:\\agentProjects\\geml-spec", gitBranch: "main", isSidechain: false, ...o });
const user = (uuid, at, text, over = {}) => rec({ type: "user", uuid, timestamp: at, message: { content: text }, ...over });
const assistant = (at, content) => rec({ type: "assistant", timestamp: at, message: { content } });
const result = (at, id, text) => rec({ type: "user", timestamp: at, message: { content: [{ type: "tool_result", tool_use_id: id, content: text }] } });

test("a prompt's words: the host's reminders out, one cut short running to the end; only a reminder shows its own words", () => {
  const typed = "<system-reminder>\nLinked sessions now: top is idle\n</system-reminder>\n\n\n产物还是 WIP 哪个好？";
  assert.equal(promptWords(typed), "产物还是 WIP 哪个好？");
  assert.equal(promptShown(typed), "产物还是 WIP 哪个好？");
  assert.equal(promptWords("做个看板\n<system-reminder>\nLinked sessions now: a report clipped befo"), "做个看板");
  assert.equal(promptWords("<system-reminder>only this</system-reminder>"), "");
  assert.equal(promptShown("<system-reminder>only this</system-reminder>"), "only this");
  assert.equal(promptShown("  就这一句  "), "就这一句");
});

test("the slug: Claude Code's folder for a directory", () => {
  assert.equal(slugOf("C:\\agentProjects\\geml-spec"), "C--agentProjects-geml-spec");
  assert.equal(slugOf("C:\\agentProjects\\geml-spec\\.claude\\worktrees\\x-1"), "C--agentProjects-geml-spec--claude-worktrees-x-1");
  assert.equal(slugOf("/home/u/proj"), "-home-u-proj");
});

test("a transcript: the person's prompts become turns with the last answer, the files written, the page published; reminders, notifications, summaries, subagents and tool results are not turns", () => {
  const lines = [
    rec({ type: "attachment", timestamp: "2026-10-20T01:00:00Z" }),
    user("u1", "2026-10-20T01:00:01Z", "<system-reminder>x</system-reminder>\n产物不是产品，叫artifacts"),
    assistant("2026-10-20T01:00:05Z", [{ type: "text", text: "先看一下。" }, { type: "tool_use", id: "t1", name: "Write", input: { file_path: "C:\\p\\out\\a.md" } }]),
    result("2026-10-20T01:00:06Z", "t1", "ok"),
    assistant("2026-10-20T01:00:09Z", [{ type: "tool_use", id: "t2", name: "Artifact", input: { title: "Gemworks 界面示意", file_path: "C:\\p\\page.html" } }]),
    result("2026-10-20T01:00:10Z", "t2", "Published C:\\p\\page.html at https://claude.ai/artifact/Aw9u (Version 3, version id x)"),
    assistant("2026-10-20T01:00:12Z", [{ type: "text", text: "改好了：products 改名 artifacts。\n\n细节如下。" }]),
    user("u2", "2026-10-20T01:05:00Z", [{ type: "text", text: "<task-notification>done</task-notification>" }], { origin: { kind: "task-notification" } }),
    user("u3", "2026-10-20T01:06:00Z", "The summarized conversation…", { isCompactSummary: true }),
    user("u4", "2026-10-20T01:07:00Z", "<local-command-caveat>…</local-command-caveat>"),
    user("u5", "2026-10-20T01:08:00Z", "side", { isSidechain: true }),
    user("u6", "2026-10-20T01:09:00Z", [{ type: "image", source: { type: "base64", media_type: "image/png", data: "iVBOR" } }, { type: "text", text: "这个图标好看吗" }], { gitBranch: "feat/x" }),
    assistant("2026-10-20T01:09:30Z", [{ type: "text", text: "好看。" }]),
    user("u7", "2026-10-20T01:10:00Z", "把这个修复转给 Gemworks 会话", { origin: { kind: "peer", from: "local_1" } }),
  ];
  const tr = readTranscript(lines.join("\n") + "\n");
  assert.equal(tr.id, "s-1");
  assert.equal(tr.cwd, "C:\\agentProjects\\geml-spec");
  assert.equal(tr.branch, "main");
  assert.deepEqual(tr.turns.map((t) => [t.uuid, t.kind, t.text]), [["u1", "person", "产物不是产品，叫artifacts"], ["u6", "person", "这个图标好看吗"], ["u7", "peer", "把这个修复转给 Gemworks 会话"]]);
  const [first, second] = tr.turns;
  assert.equal(first.answer, "改好了：products 改名 artifacts。\n\n细节如下。", "the last answer with words");
  assert.equal(first.answerAt, "2026-10-20T01:00:12Z");
  assert.deepEqual(first.files, ["C:\\p\\out\\a.md"]);
  assert.deepEqual(first.links, [{ url: "https://claude.ai/artifact/Aw9u", version: "3", title: "Gemworks 界面示意" }]);
  assert.deepEqual(second.uploads, [{ mediaType: "image/png", data: "iVBOR" }]);
  assert.equal(second.branch, "feat/x");
  assert.deepEqual([tr.started, tr.last], ["2026-10-20T01:00:01Z", "2026-10-20T01:10:00Z"]);
  assert.equal(readTranscript("not json\n"), undefined);
  assert.equal(readTranscript(rec({ type: "attachment", timestamp: "2026-10-20T01:00:00Z" })).turns.length, 0, "a session with no prompt: no turns");
});

test("a transcript: the online documents a turn wrote are its links, once each, named as last named; a read, a failure, an error are not", () => {
  const doc = "https://acme.sg.larksuite.com/docx/Vf6UdiUTvoIESpxu04hlTT20gzd";
  const lines = [
    user("u1", "2026-10-20T01:00:01Z", "把方案写进飞书"),
    assistant("2026-10-20T01:00:05Z", [{ type: "tool_use", id: "c1", name: "Bash", input: { command: 'lark-cli docs +create --title "迁移方案" --content x' } }]),
    result("2026-10-20T01:00:06Z", "c1", `{ "ok": true, "data": { "document": { "url": "${doc}" } } }`),
    assistant("2026-10-20T01:00:07Z", [{ type: "tool_use", id: "c2", name: "Bash", input: { command: "lark-cli docs +update --doc Vf6U --content y" } }]),
    result("2026-10-20T01:00:08Z", "c2", `{ "ok": true, "data": { "document": { "url": "${doc}" } } }`),
    assistant("2026-10-20T01:00:09Z", [{ type: "tool_use", id: "c3", name: "Bash", input: { command: "lark-cli docs +fetch --doc Vf6U" } }]),
    result("2026-10-20T01:00:10Z", "c3", `{ "ok": true, "data": { "document": { "url": "https://acme.sg.larksuite.com/docx/Read0nly12345678" } } }`),
    assistant("2026-10-20T01:00:11Z", [{ type: "tool_use", id: "c4", name: "Bash", input: { command: "lark-cli sheets +batch --url https://acme.sg.larksuite.com/sheets/Fail0000000000" } }]),
    result("2026-10-20T01:00:12Z", "c4", '{ "ok": false, "error": { "type": "missing_scope" } }'),
    assistant("2026-10-20T01:00:13Z", [{ type: "tool_use", id: "c5", name: "mcp__lark-mcp__docx_builtin_import", input: { markdown: "x", file_name: "Plan" } }]),
    rec({ type: "user", timestamp: "2026-10-20T01:00:14Z", message: { content: [{ type: "tool_result", tool_use_id: "c5", is_error: true, content: "https://acme.sg.larksuite.com/docx/Err00000000000" }] } }),
    assistant("2026-10-20T01:00:15Z", [{ type: "text", text: "写好了。" }]),
  ];
  const [turn] = readTranscript(lines.join("\n") + "\n").turns;
  assert.deepEqual(turn.links, [{ url: doc, online: true, title: "迁移方案" }]);
});

test("a scheduled task's session is marked by the task's name; its events carry it, each prompt its uuid and the backfilled mark, the answer whole", () => {
  const long = "x".repeat(10_000);
  const lines = [
    user("u1", "2026-10-19T08:12:00Z", '<scheduled-task name="weekly-geml-docs-review" file="C:\\x">\n审一下文档\n</scheduled-task>'),
    assistant("2026-10-19T08:13:00Z", [{ type: "text", text: long }]),
  ];
  const tr = readTranscript(lines.join("\n"));
  assert.deepEqual([tr.turns[0].kind, tr.turns[0].scheduled], ["scheduled", "weekly-geml-docs-review"]);
  const events = transcriptEvents(tr, "claude-code", { head: true });
  assert.deepEqual(events[0], { t: "session", id: "s-1", host: "claude-code", at: "2026-10-19T08:12:00Z", branch: "main", checkout: "C:\\agentProjects\\geml-spec", backfilled: true, scheduled: "weekly-geml-docs-review" });
  assert.deepEqual(events[1], { t: "prompt", turn: 1, at: "2026-10-19T08:12:00Z", text: tr.turns[0].text, uuid: "u1", backfilled: true, kind: "scheduled" });
  assert.equal(events[2].text, long);
  // The log reads back with the marks, and summarizes with them.
  const back = parseLog(formatLog(events));
  assert.deepEqual(back, events);
  const s = summarize(back);
  assert.deepEqual([s.backfilled, s.scheduled, s.turns[0].uuid, s.turns[0].backfilled, s.turns[0].kind], [true, "weekly-geml-docs-review", "u1", true, "scheduled"]);
  // Read again: nothing new.
  assert.deepEqual(newTurns(tr, back).turns, []);
  assert.equal(transcriptEvents(newTurns(tr, back), "claude-code", { head: false, from: 2 }).length, 0);
});

test("earlier turns go before a log's own: numbered from 1, the live ones moved up; one already there (same words, minutes apart) is left out", () => {
  const own = [
    { t: "session", id: "s", host: "claude-code", at: "2026-10-21T05:00:00Z" },
    { t: "prompt", turn: 1, at: "2026-10-21T05:00:10Z", text: "提交改动" },
    { t: "decision", turn: 1, at: "2026-10-21T05:00:20Z", text: "一笔提交" },
    { t: "prompt", turn: 2, at: "2026-10-21T05:10:00Z", text: "推" },
  ];
  const earlier = [
    { t: "prompt", turn: 1, at: "2026-10-20T01:00:00Z", text: "产物不是产品", uuid: "u1", backfilled: true },
    { t: "answer", turn: 1, at: "2026-10-20T01:00:12Z", text: "改好了" },
    { t: "prompt", turn: 2, at: "2026-10-21T05:00:08Z", text: "提交改动", uuid: "u2", backfilled: true },
    { t: "prompt", turn: 3, at: "2026-10-21T04:00:00Z", text: "改吧", uuid: "u3", backfilled: true },
  ];
  const merged = withEarlierTurns(own, earlier);
  assert.deepEqual(merged.map((e) => [e.t, e.turn ?? null, e.text ?? e.id]), [
    ["session", null, "s"],
    ["prompt", 1, "产物不是产品"], ["answer", 1, "改好了"], ["prompt", 2, "改吧"],
    ["prompt", 3, "提交改动"], ["decision", 3, "一笔提交"], ["prompt", 4, "推"],
  ]);
  assert.deepEqual(withEarlierTurns(own, [earlier[2]]), own, "nothing new: the log as it was");
  assert.deepEqual(withEarlierTurns([], earlier.slice(0, 2)).map((e) => e.turn), [1, 1], "no session line: the earlier turns alone");
});

test("the lines typed while a turn ran, in order, at the time they were sent (the record's when the line has none); a subagent's, another attachment and a line that does not read are not", () => {
  const lines = [
    rec({ type: "attachment", uuid: "q1", timestamp: "2026-10-20T01:00:00Z", attachment: { type: "queued_command", prompt: "停一下", timestamp: "2026-10-20T01:00:02Z" } }),
    rec({ type: "attachment", uuid: "q2", timestamp: "2026-10-20T01:00:05Z", attachment: { type: "queued_command", prompt: "再加一句" } }),
    rec({ type: "attachment", uuid: "q3", timestamp: "2026-10-20T01:00:06Z", isSidechain: true, attachment: { type: "queued_command", prompt: "a subagent's" } }),
    user("u1", "2026-10-20T01:00:07Z", "the words queued_command, typed"),
    rec({ type: "attachment", uuid: "q4", timestamp: "2026-10-20T01:00:08Z", attachment: { type: "edited_text_file", note: "queued_command" } }),
    '{"type": "attachment", "queued_command": ',
    rec({ type: "attachment", timestamp: "2026-10-20T01:00:09Z", attachment: { type: "queued_command", prompt: "no uuid" } }),
    rec({ type: "attachment", uuid: "q5", timestamp: "2026-10-20T01:00:10Z", attachment: { type: "queued_command", prompt: { text: "not words" } } }),
    JSON.stringify({ type: "attachment", uuid: "q6", attachment: { type: "queued_command", prompt: "no time at all" } }),
  ];
  assert.deepEqual(queuedMessages(lines.join("\r\n")), [
    { uuid: "q1", text: "停一下", at: "2026-10-20T01:00:02Z" },
    { uuid: "q2", text: "再加一句", at: "2026-10-20T01:00:05Z" },
  ]);
  assert.deepEqual(queuedMessages(""), []);
});

test("a transcript with no session id, branch or folder: a prompt with no uuid is named by its time, an answer with no time takes its prompt's, and what does not read as a record is passed over", () => {
  const raw = (o) => JSON.stringify(o);
  const lines = [
    "42", "null", '"a string"',
    raw({ type: "summary", summary: "no time on this one" }),
    raw({ type: "user", timestamp: "2026-10-20T01:00:00Z", message: { content: [{ type: "text", text: 7 }, { type: "text", text: "看看这张图" }, { type: "image", source: { type: "base64", data: "AAAA" } }, { type: "image", source: { type: "url", url: "https://example.com/a.png" } }] } }),
    raw({ type: "assistant", message: { content: [
      { type: "text", text: null }, { type: "text", text: "看了。" },
      { type: "tool_use", id: "t0", input: "not an object" },
      { type: "tool_use", id: "t1", name: "NotebookEdit", input: { notebook_path: "nb/a.ipynb" } },
      { type: "tool_use", id: "t2", name: "Artifact", input: { file_path: "page.html" } },
    ] } }),
    raw({ type: "user", timestamp: "2026-10-20T01:00:03Z", message: { content: [
      { type: "tool_result", content: "a result with no call id" },
      { type: "tool_result", tool_use_id: "t2", content: [{ type: "text", text: "Published page.html at https://claude.ai/artifact/Bx7 (Version 2, version id y)" }, { type: "image" }] },
    ] } }),
    raw({ type: "user", timestamp: "2026-10-20T01:01:00Z", message: { content: "<command-message>review is running…</command-message>" } }),
  ];
  const tr = readTranscript(lines.join("\n"));
  assert.deepEqual(tr, {
    id: "", started: "2026-10-20T01:00:00Z", last: "2026-10-20T01:01:00Z",
    turns: [{
      uuid: "2026-10-20T01:00:00Z#0", at: "2026-10-20T01:00:00Z", text: "看看这张图", kind: "person", answer: "看了。",
      files: ["nb/a.ipynb"], links: [{ url: "https://claude.ai/artifact/Bx7", version: "2" }], uploads: [{ data: "AAAA" }],
    }],
  }, "a command's message is no turn; a picture given by link is no upload; a page published with no title has none");
  assert.deepEqual(transcriptEvents(tr, "claude-code", { head: true }), [
    { t: "session", id: "", host: "claude-code", at: "2026-10-20T01:00:00Z", backfilled: true },
    { t: "prompt", turn: 1, at: "2026-10-20T01:00:00Z", text: "看看这张图", uuid: "2026-10-20T01:00:00Z#0", backfilled: true },
    { t: "answer", turn: 1, at: "2026-10-20T01:00:00Z", text: "看了。" },
    { t: "file", turn: 1, at: "2026-10-20T01:00:00Z", path: "nb/a.ipynb" },
  ]);
  assert.equal(readTranscript(raw({ type: "summary", sessionId: "s-9" })), undefined, "a session id and no time: no session to read");
});

test("a scheduled task whose prompt names no task: its session is still marked scheduled, with an empty name", () => {
  const tr = readTranscript(user("u1", "2026-10-19T08:12:00Z", '<scheduled-task file="C:\\x">\n审一下文档\n</scheduled-task>'));
  assert.deepEqual([tr.turns[0].kind, tr.turns[0].scheduled], ["scheduled", undefined]);
  const [head, prompt] = transcriptEvents(tr, "claude-code", { head: true });
  assert.equal(head.scheduled, "");
  assert.equal(prompt.kind, "scheduled");
});
