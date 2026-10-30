import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  addPrompts, applyThemes, claimThemes, defaultPeriods, dismiss, EMPTY_LEDGER, flowless, ledgerCards, ledgerText, linkKey, parseLedger, parsePeriod,
  practiceCounts, promptId, readFlowDraft, readLabels, readThemes, report, reportText, tally, themeRequest, typedWords, unthemed,
} from "../dist/core/corrections.js";
import { addLabelled, correctionsPath, labelledRows, readLedger, unlabelledPrompts, updateLedger } from "../dist/corrections-store.js";
import { cellWidth } from "../dist/hosts/claude-code/band.js";
import { COACH_FLOWS, ledgerCardRows, manualRows, readCoachFlow } from "../dist/hosts/claude-code/coach.js";
import { wordsFor } from "../dist/hosts/claude-code/text.js";
import { BUNDLE, gitRepo, hook } from "./helpers/repo.mjs";

const t = wordsFor("zh");
const flows = COACH_FLOWS.map((name) => readCoachFlow(name, readFileSync(new URL(`../coach/${name}.geml`, import.meta.url), "utf8")));
const row = (id, at, kind, over = {}) => ({ id, at, session: "s1aaaaaaaa", text: `words ${id}`, kind, by: "model", ...over });
const fix = (id, at, sub, over = {}) => row(id, at, "correct", { sub, ...over });
const practice = (id, at, over = {}) => ({ id, flow: "*", step: "*", text: `rule ${id}`, why: "", at, by: "model", layer: "personal", ...over });

test("the ledger's file holds its prompts, themes, cards put away, links and claim; a line that is no record is left out", () => {
  const l = { prompts: [fix("a", "2026-10-28T02:00:00Z", "verify", { work: "ui", flow: "feature", step: "mockup", theme: "t1" })], themes: [{ id: "t1", rule: "改完附上路径", at: "x", practices: ["p1"] }], dismissed: [{ key: "repeat:t1", n: 3, at: "x" }], linked: "p1", claim: "s1@2026-10-30T00:00:00Z" };
  const text = ledgerText(l);
  assert.deepEqual(parseLedger(text), l);
  assert.deepEqual(parseLedger(text.replace("=== data {#prompts format=jsonl}\n", "=== data {#prompts format=jsonl}\nnot json\n{\"id\":1}\n")), l);
  assert.deepEqual(parseLedger(""), EMPTY_LEDGER);
});

test("a prompt is one prompt: by id, or the same words in the same session within ten minutes; ids take #2 within a second", () => {
  const a = row("s1aaaaaa@2026-10-28T02:00:00", "2026-10-28T02:00:00Z", "task", { text: "继续" });
  let { ledger, added } = addPrompts(EMPTY_LEDGER, [a]);
  assert.equal(added, 1);
  ({ ledger, added } = addPrompts(ledger, [{ ...a, id: "other", at: "2026-10-28T02:05:00Z" }, { ...a, id: "later", at: "2026-10-28T02:30:00Z" }]));
  assert.deepEqual([added, ledger.prompts.map((p) => p.id)], [1, ["s1aaaaaa@2026-10-28T02:00:00", "later"]]);
  assert.equal(promptId("s1aaaaaaaa", "2026-10-28T02:00:00.123Z", new Set(["s1aaaaaa@2026-10-28T02:00:00"])), "s1aaaaaa@2026-10-28T02:00:00#2");
  assert.equal(addPrompts(EMPTY_LEDGER, [{ ...a, text: "x".repeat(900) }]).ledger.prompts[0].text.length, 300);
});

test("only typed words are labelled: the host's reminders stripped, another session's report (one reminder) and a notice are nothing typed", () => {
  assert.equal(typedWords("<system-reminder>\nLinked sessions now: top is idle\n</system-reminder>\n\n\n示例六"), "示例六");
  assert.equal(typedWords("<system-reminder>\nThe session \"x\" you started finished a turn. It reported: done\n</system-reminder>\n"), undefined);
  assert.equal(typedWords("<task-notification> a hook was skipped </task-notification>"), undefined);
  assert.equal(typedWords("<system-reminder>\nThe session \"x\" you started finished a turn. It reported: a report clipped befo"), undefined, "a reminder cut short runs to the end");
  assert.equal(typedWords("[Request interrupted by user]"), "[Request interrupted by user]");
});

test("a label reply is read by number; a correction with no sub is other, a kind it does not know leaves the prompt unlabelled", () => {
  const reply = 'Here: [{"n": 2, "kind": "correct", "sub": "verify", "work": "ui"}, {"n": 1, "kind": "task", "sub": null, "work": "writing"}, {"n": 3, "kind": "correct", "sub": "nonsense"}, {"n": 4, "kind": "shout"}]';
  assert.deepEqual(readLabels(reply, 4), [{ kind: "task", work: "writing" }, { kind: "correct", sub: "verify", work: "ui" }, { kind: "correct", sub: "other" }, undefined]);
  assert.deepEqual(readLabels("no json", 2), [undefined, undefined]);
});

test("a theme reply puts corrections into themes by handle, makes a new theme once per rule, and links themes to the practices that state them", () => {
  const l = { ...EMPTY_LEDGER, prompts: [fix("c1", "2026-10-28T02:00:00Z", "verify"), fix("c2", "2026-10-28T03:00:00Z", "show"), fix("c3", "2026-10-28T04:00:00Z", "judgment")], themes: [{ id: "old", rule: "改完先跑测试", at: "x", practices: [] }] };
  const ask = themeRequest(unthemed(l), l.themes, [practice("pA", "2026-10-30T05:37:00Z", { text: "示例做法丁" })]);
  assert.match(ask.prompt, /p1\. 示例做法丁/);
  assert.match(ask.prompt, /t1\. 改完先跑测试/);
  assert.match(ask.prompt, /c3\. \[judgment\]/);
  const answer = readThemes('{"assign": [{"c": "c1", "theme": {"new": "改完附上路径"}}, {"c": "c2", "theme": "改完附上路径"}, {"c": "c3", "theme": null}, {"c": "c9", "theme": "t1"}], "links": [{"theme": "改完附上路径", "practices": ["p1", "p7"]}, {"theme": "t1", "practices": []}]}', ask.handles);
  assert.deepEqual(answer.assign.map((a) => a.id), ["c1", "c2", "c3"]);
  const next = applyThemes(l, answer, "2026-10-30T06:00:00Z", "pA", (n) => `new${n}`);
  assert.deepEqual(next.themes.map((x) => [x.id, x.rule, x.practices]), [["old", "改完先跑测试", []], ["new0", "改完附上路径", ["pA"]]]);
  assert.deepEqual(next.prompts.map((p) => p.theme), ["new0", "new0", ""]);
  assert.deepEqual([next.linked, unthemed(next).length], ["pA", 0]);
  // A backlog is themed newest first: the cards read the last weeks.
  assert.deepEqual(unthemed(l, 2).map((p) => p.id), ["c2", "c3"]);
  assert.equal(linkKey([practice("b", "x"), practice("a", "x"), practice("z", "x", { deleted: true })]), "a,b");
});

test("a practice holds while its theme's corrections stop: before it was written and after, and the cards say which do not", () => {
  const theme = (id, practices) => ({ id, rule: `rule of ${id}`, at: "x", practices });
  const pOld = practice("pOld", "2026-10-29T10:32:00Z"), pNew = practice("pNew", "2026-10-30T04:55:00Z"), pMock = practice("pMock", "2026-10-26T19:07:00Z", { flow: "feature", step: "mockup" });
  const l = {
    ...EMPTY_LEDGER,
    themes: [theme("write", ["pOld", "pNew"]), theme("link", ["pMock"]), theme("held", ["pHeld"]), theme("bare", [])],
    prompts: [
      fix("w1", "2026-10-29T10:29:00Z", "judgment", { theme: "write" }), fix("w2", "2026-10-29T11:26:00Z", "judgment", { theme: "write" }), fix("w3", "2026-10-30T04:51:00Z", "judgment", { theme: "write" }),
      fix("l1", "2026-10-28T02:16:00Z", "verify", { theme: "link", flow: "design", step: "draft" }), fix("l2", "2026-10-28T03:15:00Z", "verify", { theme: "link" }), fix("l3", "2026-10-30T05:35:00Z", "show", { theme: "link", flow: "feature", step: "mockup" }),
      fix("h1", "2026-10-20T01:00:00Z", "show", { theme: "held" }), fix("h2", "2026-10-21T01:00:00Z", "show", { theme: "held" }),
      fix("b1", "2026-10-27T01:00:00Z", "process", { theme: "bare", flow: "bugfix", step: "fix" }), fix("b2", "2026-10-28T01:00:00Z", "process", { theme: "bare", flow: "bugfix", step: "fix" }), fix("b3", "2026-10-29T01:00:00Z", "process", { theme: "bare", flow: "bugfix", step: "fix" }),
      row("task", "2026-10-29T01:00:00Z", "task", { theme: "bare" }),
    ],
  };
  const practices = [pOld, pNew, pMock, practice("pHeld", "2026-10-22T00:00:00Z")];
  // pMock hangs on 样稿: of the theme's three corrections after it, only the one said at 样稿 counts against it.
  assert.deepEqual(practiceCounts(l, practices), { pOld: { before: 1, after: 2 }, pNew: { before: 3, after: 0 }, pMock: { before: 0, after: 1 }, pHeld: { before: 2, after: 0 } });
  const cards = ledgerCards(l, practices, "2026-10-30T06:00:00Z");
  assert.deepEqual(cards.map((c) => [c.kind, c.key, c.n]), [["failing", "failing:pOld", 2], ["repeat", "repeat:link", 3], ["repeat", "repeat:bare", 3]]);
  assert.equal(cards[0].instead.id, "pNew");
  assert.equal(cards[1].narrow.id, "pMock");
  assert.equal(cards[1].where, undefined, "said at several steps: no one step to hang it on");
  assert.deepEqual(cards[2].where, { flow: "bugfix", step: "fix" });
  // Put away, a card stays away until two more are said.
  const away = dismiss(l, "repeat:bare", 3, "x");
  assert.ok(!ledgerCards(away, practices, "2026-10-30T06:00:00Z").some((c) => c.key === "repeat:bare"));
  const twoMore = { ...away, prompts: [...away.prompts, fix("b4", "2026-10-29T02:00:00Z", "process", { theme: "bare" }), fix("b5", "2026-10-29T03:00:00Z", "process", { theme: "bare" })] };
  assert.ok(ledgerCards(twoMore, practices, "2026-10-30T06:00:00Z").some((c) => c.key === "repeat:bare"));
  // A practice for every flow and step covers its theme wherever it was said.
  assert.ok(!ledgerCards({ ...l, themes: l.themes.map((x) => (x.id === "bare" ? { ...x, practices: ["pAll"] } : x)) }, [...practices, practice("pAll", "2026-10-29T12:00:00Z")], "2026-10-30T06:00:00Z").some((c) => c.key === "repeat:bare"));
});

test("only one session at a time puts corrections in themes, until it stops asking for five minutes", () => {
  const first = claimThemes(EMPTY_LEDGER, "s1", "2026-10-30T06:00:00Z");
  assert.equal(first.mine, true);
  assert.equal(claimThemes(first.ledger, "s2", "2026-10-30T06:04:00Z").mine, false);
  assert.equal(claimThemes(first.ledger, "s1", "2026-10-30T06:04:00Z").mine, true);
  assert.equal(claimThemes(first.ledger, "s2", "2026-10-30T06:06:00Z").mine, true);
});

test("work corrected often with no flow is found; a drafted flow is read for the propose tool", () => {
  const xs = Array.from({ length: 10 }, (_, i) => fix(`w${i}`, `2026-10-29T0${i}:00:00Z`, i < 7 ? "judgment" : "verify", { work: "writing" }));
  const l = { ...EMPTY_LEDGER, prompts: [...xs, fix("ui", "2026-10-29T10:00:00Z", "visual", { work: "ui" }), fix("old", "2026-10-01T00:00:00Z", "judgment", { work: "writing" })] };
  assert.deepEqual(flowless(l, "2026-10-30T06:00:00Z"), [{ work: "writing", n: 10, judgment: 7 }]);
  assert.deepEqual(flowless({ ...l, prompts: l.prompts.map((p) => ({ ...p, flow: "feature", step: "build" })) }, "2026-10-30T06:00:00Z"), []);
  assert.deepEqual(flowless({ ...l, prompts: l.prompts.map((p) => ({ ...p, by: "import" })) }, "2026-10-30T06:00:00Z"), [], "an imported prompt never knew its step");
  assert.deepEqual(readFlowDraft('{"title": "写文章", "steps": [{"id": "pick", "title": "选题"}]}'), { title: "写文章", steps: [{ id: "pick", title: "选题" }] });
  assert.equal(readFlowDraft('{"title": "", "steps": []}'), undefined);
});

test("the tables count prompts per 100 by kind, by kind of work and by week (Monday, local time), a bare interruption not a prompt", () => {
  const xs = [
    row("a", "2026-10-19T04:00:00Z", "task", { work: "ui" }), fix("b", "2026-10-20T04:00:00Z", "verify", { work: "ui" }), fix("c", "2026-10-21T04:00:00Z", "judgment", { work: "spec" }),
    fix("bare", "2026-10-21T05:00:00Z", "other", { text: "[Request interrupted by user]" }), row("i", "2026-10-21T06:00:00Z", "interrupt"),
    // Monday 02:00 at UTC+8 is still Sunday in UTC: it counts in the Monday's week.
    fix("d", "2026-10-25T18:00:00Z", "scope", { work: "ui" }), row("e", "2026-10-27T04:00:00Z", "task", { work: "writing" }),
  ];
  const l = { ...EMPTY_LEDGER, prompts: xs };
  assert.deepEqual(tally(xs).by.verify, 1);
  const r = report(l, { baseline: { from: "2026-10-19", to: "2026-10-25" }, trial: { from: "2026-10-26", to: "2026-11-01" }, offset: 480, byWork: true });
  assert.deepEqual([r.baseline.prompts, r.baseline.corrections, r.baseline.fixed, r.baseline.person], [3, 2, 1, 1]);
  assert.deepEqual([r.trial.prompts, r.trial.corrections, r.trial.fixed], [2, 1, 1]);
  assert.deepEqual(r.weeks.map((w) => [w.week, w.prompts]), [["2026-10-19", 3], ["2026-10-26", 2]]);
  assert.deepEqual(r.byWork.find((w) => w.work === "ui").baseline.fixed, 1);
  const text = reportText(r, cellWidth, 4);
  assert.match(text, /4 句未标注/);
  assert.match(text, /固定检查\s+33\.3\s+50\.0/);
  assert.match(text, /说好了但没好\s+33\.3\s+0\.0/);
  assert.match(text, /10-26\s+2\s+50\.0\s+50\.0\s+0\.0/);
  assert.deepEqual(parsePeriod("2026-08-30..2026-10-25"), { from: "2026-08-30", to: "2026-10-25" });
  assert.equal(parsePeriod("2026-10-25..2026-08-30"), undefined);
  assert.deepEqual(defaultPeriods("2026-10-30"), { trial: { from: "2026-10-26", to: "2026-10-30" }, baseline: { from: "2026-08-31", to: "2026-10-25" } });
});

test("the store keeps the ledger in the person's home; prompts not labelled yet are read from the host's transcripts, reminders stripped", () => {
  const home = mkdtempSync(join(tmpdir(), "gw-home-"));
  const transcripts = mkdtempSync(join(tmpdir(), "gw-tr-"));
  mkdirSync(join(transcripts, "C--proj"));
  const lines = [
    // A session started by another: its brief is that session's words, not the person's.
    { type: "user", uuid: "u0", sessionId: "sess0001-xyz", timestamp: "2026-10-30T00:59:00.000Z", turnOrigin: "sdk", message: { content: "Background (from the session that started this one): build it" } },
    { type: "user", uuid: "u1", sessionId: "sess0001-xyz", timestamp: "2026-10-30T01:00:00.000Z", cwd: "/work/proj", message: { content: "写个函数" } },
    { type: "assistant", sessionId: "sess0001-xyz", timestamp: "2026-10-30T01:01:00.000Z", message: { content: [{ type: "text", text: "写好了。" }] } },
    { type: "user", uuid: "u2", sessionId: "sess0001-xyz", timestamp: "2026-10-30T01:02:00.000Z", turnOrigin: "human", origin: { kind: "human" }, message: { content: "<system-reminder>linked sessions</system-reminder>\n测试没跑" } },
    { type: "user", uuid: "n1", sessionId: "sess0001-xyz", timestamp: "2026-10-30T01:02:30.000Z", message: { content: "<task-notification> a hook was skipped </task-notification>" } },
    { type: "attachment", uuid: "q1", sessionId: "sess0001-xyz", timestamp: "2026-10-30T01:03:00.000Z", attachment: { type: "queued_command", prompt: "停", timestamp: "2026-10-30T01:03:00.000Z" } },
  ];
  writeFileSync(join(transcripts, "C--proj", "sess0001-xyz.jsonl"), `${lines.map((x) => JSON.stringify(x)).join("\n")}\n`);
  // A fork repeats its parent's prompts at the same times, under its own session id.
  writeFileSync(join(transcripts, "C--proj", "fork0002-abc.jsonl"), `${JSON.stringify({ ...lines[1], sessionId: "fork0002-abc" })}\n`);
  const pending = unlabelledPrompts(readLedger(home), transcripts, { since: "2026-10-29T00:00:00Z" });
  assert.deepEqual(pending.map((p) => [p.text, p.before]), [["写个函数", ""], ["测试没跑", "写好了。"], ["停", "写好了。"]]);
  // One of the two copies of the forked prompt is kept, whichever transcript is read first.
  assert.match(pending[0].id, /^(sess0001|fork0002)@2026-10-30T01:00:00$/);
  const given = labelledRows([{ ...pending[1], kind: "correct", sub: "show", work: "ui" }, { ...pending[0], kind: "correct" }, { id: "x" }], "agent");
  assert.equal(given.rows.length, 1);
  assert.equal(given.errors.length, 2);
  assert.equal(addLabelled(given.rows, home), 1);
  assert.equal(addLabelled(given.rows, home), 0);
  assert.ok(correctionsPath(home).startsWith(home));
  assert.deepEqual(unlabelledPrompts(readLedger(home), transcripts, { since: "2026-10-29T00:00:00Z" }).map((p) => p.text), ["写个函数", "停"]);
  updateLedger((l) => dismiss(l, "k", 1, "x"), home);
  assert.deepEqual(readLedger(home).dismissed.map((d) => d.key), ["k"]);
});

test("the bridge adds labelled prompts, puts them in themes for the session holding the claim, and puts cards away", () => {
  const root = gitRepo();
  const home = mkdtempSync(join(tmpdir(), "gw-home-"));
  const env = { HOME: home, USERPROFILE: home };
  const now = Date.now();
  const at = (minutes) => new Date(now - minutes * 60_000).toISOString();
  const prompts = [1, 2, 3].map((n) => ({ id: `s1@${n}`, at: at(60 - n), session: "s1", text: `示例纠正 ${n}`, kind: "correct", sub: "verify", work: "ui" }));
  let r = hook(root, { op: "corrections-add", prompts }, env);
  assert.deepEqual([r.ok, r.corrections.unthemed, r.corrections.cards], [true, 3, []]);
  r = hook(root, { op: "corrections", toTheme: true, session: "s1" }, env);
  assert.deepEqual(r.corrections.toTheme.corrections.map((c) => c.id), ["s1@1", "s1@2", "s1@3"]);
  assert.equal(hook(root, { op: "corrections", toTheme: true, session: "s2" }, env).corrections.toTheme, undefined, "another session holds the claim");
  r = hook(root, { op: "corrections-themes", answer: { assign: prompts.map((p) => ({ id: p.id, theme: { rule: "改完附上路径" } })), links: [] }, linked: "" }, env);
  assert.deepEqual([r.corrections.unthemed, r.corrections.cards.map((c) => [c.kind, c.rule, c.n])], [0, [["repeat", "改完附上路径", 3]]]);
  assert.match(r.corrections.cards[0].quotes[0].day, /^\d\d-\d\d$/);
  r = hook(root, { op: "corrections-dismiss", key: r.corrections.cards[0].key, n: 3 }, env);
  assert.deepEqual(r.corrections.cards, []);
  assert.equal(hook(root, { op: "corrections-add", prompts: [{ id: 1 }] }, env).ok, false);
});

test("gemworks corrections: labels taken back, the tables for two periods by kind of work, and the guide", () => {
  const home = mkdtempSync(join(tmpdir(), "gw-home-"));
  const env = { ...process.env, HOME: home, USERPROFILE: home, CLAUDE_CONFIG_DIR: join(home, ".claude") };
  const run = (args, input) => spawnSync(process.execPath, [BUNDLE, "corrections", ...args], { encoding: "utf8", env, input, timeout: 60_000 });
  const file = join(home, "labels.jsonl");
  const lines = [
    { id: "a@1", at: "2026-09-10T12:00:00Z", session: "sa", text: "做吧", kind: "nudge", work: "spec" },
    { id: "a@2", at: "2026-09-10T12:10:00Z", session: "sa", text: "示例四", kind: "correct", sub: "verify", work: "ui" },
    { id: "b@1", at: "2026-10-28T12:00:00Z", session: "sb", text: "示例五", kind: "correct", sub: "judgment", work: "writing" },
    { id: "b@2", at: "2026-10-28T12:10:00Z", session: "sb", text: "好", kind: "decide", work: "writing" },
  ];
  writeFileSync(file, `${lines.map((x) => JSON.stringify(x)).join("\n")}\n`);
  let r = run(["label", file, "--import"]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^4 labelled/);
  assert.match(run(["label"], `${JSON.stringify(lines[0])}\n`).stdout, /^0 labelled, 1 already/);
  r = run(["--baseline", "2026-09-01..2026-09-30", "--trial", "2026-10-20..2026-10-31", "--by", "work"]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /固定检查\s+50\.0\s+0\.0/);
  assert.match(r.stdout, /靠人判断（对照）\s+0\.0\s+50\.0/);
  assert.match(r.stdout, /文档与写作/);
  r = run(["--json", "--baseline", "2026-09-01..2026-09-30", "--trial", "2026-10-20..2026-10-31"]);
  assert.deepEqual([JSON.parse(r.stdout).baseline.corrections, JSON.parse(r.stdout).unlabelled], [1, 0]);
  assert.match(run(["guide"]).stdout, /sub — only when kind is correct/);
  assert.equal(run(["pending"]).stdout, "");
  assert.equal(run(["--trial", "2026-10-31..2026-10-01"]).status, 2);
});

test("the flow tab draws the ledger's cards on top, each with what to do, and each practice's count", () => {
  const p = practice("pMock", "2026-10-26T19:07:00Z", { flow: "feature", step: "mockup", text: "示例做法丙", by: "memory" });
  const cards = [
    { kind: "failing", key: "failing:pOld", practice: practice("pOld", "2026-10-29T10:32:00Z", { text: "示例做法甲" }), n: 6, quotes: [{ at: "2026-10-30T03:20:00Z", day: "10-30", text: "示例一" }, { at: "2026-10-30T04:51:00Z", day: "10-30", text: "示例二" }], instead: practice("pNew", "2026-10-30T04:55:00Z", { text: "示例做法乙" }), insteadDay: "10-30" },
    { kind: "repeat", key: "repeat:t1", theme: "t1", rule: "改完附上路径", n: 5, quotes: [{ at: "2026-10-28T02:16:00Z", day: "10-28", text: "示例三" }], narrow: p },
    { kind: "repeat", key: "repeat:t2", theme: "t2", rule: "改完先跑测试", n: 3, quotes: [], where: { flow: "bugfix", step: "reproduce" } },
  ];
  const rows = ledgerCardRows(cards, flows, t);
  assert.deepEqual(rows.map((r) => [r.verb, r.title]), [["失效", "生效后仍纠正 6 次：示例做法甲"], ["提议", "重复纠正 5 次：改完附上路径"], ["提议", "重复纠正 3 次：改完先跑测试"]]);
  assert.deepEqual(rows[0].detail, ["10-30「示例一」「示例二」", "已有替代做法（10-30）：示例做法乙"]);
  assert.deepEqual(rows[0].actions.map((b) => [b.label, b.primary === true, b.action.op]), [["删除", true, "practice-delete"], ["保留", false, "ledger-dismiss"]]);
  assert.equal(rows[1].detail.at(-1), "现有做法仅限「样稿」");
  assert.deepEqual(rows[1].actions.map((b) => [b.label, b.action]), [["设为通用做法", { op: "practice-everywhere", id: "pMock" }], ["忽略", { op: "ledger-dismiss", key: "repeat:t1", n: 5 }]]);
  assert.deepEqual(rows[2].actions[0].action, { op: "practice-from-theme", theme: "t2", rule: "改完先跑测试", flow: "bugfix", step: "reproduce", why: "重复纠正 3 次" });
  const item = { id: "a1", flow: "feature", title: "示例工作项", state: "mockup", needs: "", goal: "", status: "open", at: "2026-10-30T05:00:00Z", session: "s1", met: [], next: "" };
  const manual = manualRows([item], flows, [p], t, { focus: null, expanded: ["feature"], ledger: { cards: cards.slice(1, 2), counts: { pMock: { before: 2, after: 0 } } } });
  assert.equal(manual[1].key, "ledger-repeat:t1", "the cards come first, under the line that says who judges");
  assert.deepEqual(manual.find((r) => r.key === "practice-pMock").count, { text: "纠正 2 → 0", held: true });
});
