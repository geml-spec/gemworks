import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { closeEvent, COACH_FLOWS, coachBand, doingNote, flowsIn, goneOnAfterTurn, growthDays, GROWTH_SHOWN, goneOnNote, holdEvent, itemHistory, ledgerCardRows, manualRows, turnWords, itemProgress, metOf, pressEvent, readCoachFlow, stripText, turnItem, WORK_SHOWN, workContext, workEvents, workItemsOf, workPrompt, workRows } from "../../dist/hosts/claude-code/coach.js";
import { parseLog, summarize } from "../../dist/core/session-log.js";
import { wordsFor } from "../../dist/hosts/claude-code/text.js";

const t = wordsFor("zh");
const flows = COACH_FLOWS.map((name) => readCoachFlow(name, readFileSync(new URL(`../../coach/${name}.geml`, import.meta.url), "utf8")));
const flow = (name) => flows.find((f) => f.name === name);
const m = (step, over = {}) => ({ step, at: "2026-10-23T09:00:00Z", turn: 1, ...over });
const item = (over) => ({ id: "a1", flow: "bugfix", title: "导出跳过不留", state: "confirm", needs: "你按一次跳过", goal: "跳过不留文件", status: "open", at: "2026-10-23T10:00:00Z", session: "s1", met: [m("reproduce"), m("rootcause"), m("failtest"), m("fix"), m("verify")], next: "", ...over });

test("the flows the plugin ships: 新设计, 新功能, bugfix, 优化, 线上事故, 代码审查, 调研选型, 重构, 文档, 数据分析, each its states in order, each a requirement, the way back dashed", () => {
  assert.deepEqual(flows.map((f) => [f.name, f.title]), [["design", "新设计"], ["feature", "新功能"], ["bugfix", "bugfix"], ["optimize", "优化"], ["incident", "线上事故"], ["review", "代码审查"], ["research", "调研选型"], ["refactor", "重构"], ["docs", "文档"], ["analysis", "数据分析"]]);
  assert.deepEqual(flow("bugfix").states.map((s) => [s.title, s.need, s.final]), [["复现", "版本已确认", false], ["找根因", "说得出为什么坏", false], ["先写会失败的测试", "有一个现在会失败、能复现问题的测试", false], ["修", "一个猜测一版", false], ["验证", "测试通过", false], ["你确认", "你按过说对", false], ["完成", "", true]]);
  for (const f of flows) assert.ok(f.states.at(-1).final && f.states.slice(0, -1).every((s) => !s.final && s.need !== "" && s.prevents !== ""), `${f.name}: every step a requirement and a pitfall, the last one final`);
  const added = ["incident", "review", "research", "refactor", "docs", "analysis"];
  for (const n of added) assert.ok(flow(n).states.filter((s) => s.judge === "you").every((s) => s.answers?.length === 2), `${n}: a step the person judges names its two answers`);
  assert.deepEqual(added.map((n) => flow(n).edges.filter((e) => e.back).map((e) => [e.from, e.to])), [
    [["recovered", "mitigate"]], [["approve", "rest"]], [["decide", "options"]], [["confirm", "steps"]], [["confirm", "write"]], [["confirm", "question"]],
  ], "each new flow's way back from the person's step");
  assert.deepEqual(flow("bugfix").edges.filter((e) => e.back).map((e) => [e.from, e.to, e.label]), [["confirm", "reproduce", "你说没好"]]);
  assert.deepEqual(flow("design").states.map((s) => s.title), ["讨论", "出样稿", "你点头", "完成"]);
  assert.equal(readCoachFlow("x", "=== meta\ntitle = \"x\"\n===\n"), undefined, "no diagram: no flow");
  assert.equal(readCoachFlow("x", "=== diagram {#flow format=geml-statechart}\n{ not json\n===\n"), undefined);
});

test("every step says who judges it and what it prevents; a step the person judges may name its buttons' words", () => {
  assert.deepEqual(flow("feature").states.filter((s) => !s.final).map((s) => [s.title, s.need, s.judge, s.prevents]), [
    ["样稿", "你看过说行", "you", "做出来不是你要的，返工最贵"], ["实现", "一个模块一版", "model", "一次改太多，出了错找不到在哪"],
    ["验证", "测试通过", "fact", "说做完了，其实跑不起来"], ["你确认", "你用过说对", "you", "测试过了，但不是你要的样子"],
  ]);
  assert.deepEqual(flow("feature").edges.filter((e) => e.back).map((e) => [e.to, e.label]), [["build", "你说不对"], ["mockup", "方向不对"]]);
  assert.deepEqual(flow("optimize").states.map((s) => [s.id, s.judge]).slice(0, 4), [["baseline", "fact"], ["change", "model"], ["measure", "fact"], ["confirm", "you"]]);
  assert.equal(flow("optimize").states[2].need, "数字比基线好，测试照样通过");
  assert.deepEqual([flow("design").states[2].answers, flow("bugfix").states[5].answers], [["行", "要改"], null]);
});

test("a project's own flow takes who judges a step, what it prevents and its words from the shipped step of the same id; a step of its own is the model's", () => {
  const own = readCoachFlow("bugfix", [
    "=== diagram {#flow format=geml-statechart caption=\"bugfix\"}",
    JSON.stringify({ initial: "reproduce", states: { reproduce: { title: "复现", description: "版本已确认" }, gates: { title: "过三道门", description: "三项都过" }, confirm: { title: "你确认", description: "你按过说对" }, done: { title: "完成", final: true } },
      transitions: [{ from: "reproduce", to: "gates" }, { from: "gates", to: "confirm" }, { from: "confirm", to: "done" }] }),
    "===",
  ].join("\n"), flow("bugfix"));
  assert.deepEqual(own.states.map((s) => [s.id, s.judge, s.prevents !== ""]), [["reproduce", "model", true], ["gates", "model", false], ["confirm", "you", true], ["done", "model", false]]);
});

test("an older event names only the state it stood in: every step before it is met; at a final state every step is", () => {
  const bug = flow("bugfix");
  assert.deepEqual(metOf({ state: "confirm", at: "2026-10-01T00:00:00Z", turn: 3 }, bug).map((x) => x.step), ["reproduce", "rootcause", "failtest", "fix", "verify"]);
  assert.deepEqual(metOf({ state: "done", at: "2026-10-01T00:00:00Z", turn: 3 }, bug).map((x) => x.step), ["reproduce", "rootcause", "failtest", "fix", "verify", "confirm"]);
  assert.deepEqual(metOf({ state: "nowhere", at: "2026-10-01T00:00:00Z", turn: 3 }, bug), []);
  assert.deepEqual(metOf({ state: "confirm", at: "2026-10-01T00:00:00Z", turn: 3 }, undefined), [], "its flow unread: nothing met");
  const log = [{ t: "session", id: "s1", host: "claude-code", at: "2026-10-01T00:00:00Z" }, { t: "item", turn: 3, at: "2026-10-01T00:00:00Z", id: "ozl", flow: "bugfix", title: "旧的", state: "confirm", needs: "", goal: "", status: "open" }];
  const [old] = workItemsOf([summarize(parseLog(log.map((e) => JSON.stringify(e)).join("\n")))], flows);
  assert.deepEqual([itemProgress(old, bug).here, itemProgress(old, bug).whose], ["confirm", "you"]);
});

test("a session's log keeps its work item events; the items as they stand are the newest event of each id, whichever session wrote it", () => {
  const log = (id, lines) => [{ t: "session", id, host: "claude-code", at: "2026-10-23T09:00:00Z" }, ...lines].map((e) => JSON.stringify(e)).join("\n");
  const ev = (at, over) => ({ t: "item", turn: 1, at, id: "a1", flow: "bugfix", title: "导出", state: "fix", needs: "", goal: "", status: "open", ...over });
  const one = summarize(parseLog(log("s1", [ev("2026-10-23T10:00:00Z", {}), ev("2026-10-23T10:05:00Z", { state: "verify" })])));
  assert.deepEqual(one.items.map((e) => e.state), ["verify"], "the newest of an id in one session");
  const two = summarize(parseLog(log("s2", [ev("2026-10-23T10:10:00Z", { state: "confirm" }), ev("2026-10-23T09:30:00Z", { id: "b2", title: "对齐", flow: "optimize", state: "change" })])));
  assert.equal(summarize(parseLog(log("s3", [{ ...ev("2026-10-23T10:00:00Z", {}), status: "maybe" }]))).items, undefined, "an event that is no item is left out");
  const items = workItemsOf([one, two]);
  assert.deepEqual(items.map((i) => [i.id, i.state, i.session]), [["a1", "confirm", "s2"], ["b2", "change", "s2"]], "newest first, across sessions");
});

test("the work tool's items: steps met by id or title, where it stands follows from them; an update by id keeps what it does not say; every step met finishes it", () => {
  const on = [item({})];
  const r = workEvents({ items: [
    { title: "新的", flow: "feature", met: ["实现"], needs: "一个模块", goal: "能用", next: "跑测试" },
    { id: "#a1", title: "", flow: "bugfix", met: ["reproduce", "rootcause", "failtest", "fix", "verify", "confirm"], said: "好了" },
    { title: "x", flow: "release", met: [] },
    { title: "x", flow: "bugfix", met: ["nowhere"] },
    { id: "zz", title: "x", flow: "bugfix", met: [] },
    { title: " ", flow: "bugfix", met: [] },
    { id: "a1", title: "", flow: "bugfix", met: ["reproduce", "rootcause", "failtest", "fix", "verify", "confirm"] },
  ] }, flows, on, "2026-10-23T11:00:00Z", 4, (n) => `new${n}`);
  assert.deepEqual(r.events.map((e) => [e.id, e.flow, e.title, e.state, e.needs, e.goal, e.status, e.turn, e.next]), [
    ["new0", "feature", "新的", "verify", "一个模块", "能用", "open", 4, "跑测试"],
    ["a1", "bugfix", "导出跳过不留", "done", "你按一次跳过", "跳过不留文件", "done", 4, undefined],
  ]);
  assert.deepEqual(r.events[0].met, [{ step: "build", at: "2026-10-23T11:00:00Z", turn: 4 }], "the mockup skipped: not met");
  assert.deepEqual(r.events[1].met.map((x) => [x.step, x.turn, x.said]), [["reproduce", 1, undefined], ["rootcause", 1, undefined], ["failtest", 1, undefined], ["fix", 1, undefined], ["verify", 1, undefined], ["confirm", 4, "好了"]], "a step kept keeps when it was met; the person's step keeps their words");
  assert.deepEqual(r.errors, [
    "item 3: flow must be one of design, feature, bugfix, optimize, incident, review, research, refactor, docs, analysis",
    "item 4: bugfix has no step \"nowhere\" (reproduce, rootcause, failtest, fix, verify, confirm, done)",
    "item 5: no work item #zz is on the way",
    "item 6 has no title",
    "item 7: 你确认 is the person's to meet: put what they said in `said`, or leave it for their press",
  ]);
  const kept = workEvents({ items: [{ id: "a1", title: "", flow: "bugfix", needs: "再看一眼" }] }, flows, on, "2026-10-23T12:00:00Z", 5, () => "x").events[0];
  assert.deepEqual([kept.met.map((x) => x.step), kept.state, kept.needs], [["reproduce", "rootcause", "failtest", "fix", "verify"], "confirm", "再看一眼"], "met left out: kept");
  const back = workEvents({ items: [{ id: "a1", title: "", flow: "bugfix", met: ["reproduce"] }] }, flows, on, "2026-10-23T12:00:00Z", 5, () => "x").events[0];
  assert.equal(back.state, "rootcause", "a way back is fewer steps met");
});

test("a press on a step the person judges: yes meets it; no goes the step's first way back, every step from there unmet; holding keeps the steps", () => {
  const bug = flow("bugfix");
  const yes = pressEvent(item({}), bug, "confirm", true, "2026-10-23T12:00:00Z", 7);
  assert.deepEqual([yes.status, yes.state, yes.met.at(-1)], ["done", "done", { step: "confirm", at: "2026-10-23T12:00:00Z", turn: 7, pressed: true }]);
  const no = pressEvent(item({}), bug, "confirm", false, "2026-10-23T12:00:00Z", 7);
  assert.deepEqual([no.status, no.state, no.met], ["open", "reproduce", []], "你说没好: back to 复现");
  const feat = pressEvent(item({ flow: "feature", met: [m("mockup"), m("build"), m("verify")] }), flow("feature"), "confirm", false, "x", 7);
  assert.deepEqual([feat.state, feat.met.map((x) => x.step)], ["build", ["mockup"]], "its first way back: 你说不对, to 实现");
  const held = holdEvent(item({}), true, "x", 7);
  assert.deepEqual([held.status, held.met.length, holdEvent(item({ status: "held" }), false, "x", 7).status], ["held", 5, "open"]);
});

test("what the model is told: the flows once, with their steps and who judges each; beside each prompt the items on the way, by id, with the steps met", () => {
  assert.match(workPrompt(flows), /`work` tool/);
  assert.match(workPrompt(flows), /bugfix bugfix: reproduce 复现 \(model\) → rootcause 找根因 \(model\) → failtest 先写会失败的测试 \(model\) → fix 修 \(model\) → verify 验证 \(fact\) → confirm 你确认 \(you\);/);
  assert.match(workPrompt(flows), /incident 线上事故: triage 定级 \(model\) → mitigate 止血 \(model\) → recovered 确认恢复 \(you\) → postmortem 复盘 \(model\) → followup 跟进 \(model\);/);
  assert.match(workPrompt(flows), /only with their own words in `said`/);
  assert.deepEqual(workContext([item({}), item({ id: "b2", status: "done" })], flows), ["[gemworks] work items on the way: #a1 «导出跳过不留» (bugfix: met reproduce, rootcause, failtest, fix, verify; at confirm 你确认, needs 你按一次跳过)"]);
  assert.deepEqual(workContext([], flows), []);
});

test("the work items tab: items by whose turn it is, each its steps as cells; the person's step its two buttons, the model's next step 好，做吧 and 暂缓处理", () => {
  const rows = workRows([
    item({}),
    item({ id: "f2", flow: "feature", title: "回合结束补报", met: [m("build"), m("verify")], needs: "" }),
    item({ id: "d3", flow: "design", title: "流程手册", met: [m("discuss")], needs: "", next: "出工作项页样稿" }),
    item({ id: "e4", flow: "design", title: "别处的", met: [m("discuss")], next: "出样稿", session: "s2" }),
    item({ id: "h5", status: "held" }),
    item({ id: "b6", status: "dropped" }),
  ], flows, t, { own: "s1" });
  assert.deepEqual(rows.filter((r) => r.kind === "section").map((r) => [r.text, r.count, r.fold?.label]), [["等你", 2, undefined], ["我来", 2, undefined], ["已暂缓", 1, "展开"]]);
  const a1 = rows.find((r) => r.key === "work-a1");
  assert.deepEqual(a1.cells.map((c) => `${c.title}:${c.cell}`), ["复现:met", "找根因:met", "先写会失败的测试:met", "修:met", "验证:met", "你确认:here", "完成:ahead"]);
  assert.deepEqual([a1.detail, a1.actions.map((b) => [b.label, b.action])], ["还差：你按一次跳过", [
    ["好了", { op: "work-meet", id: "a1", step: "confirm", yes: true, label: "好了" }], ["没好", { op: "work-meet", id: "a1", step: "confirm", yes: false, label: "没好" }],
  ]]);
  assert.deepEqual(rows.find((r) => r.key === "work-f2").cells.map((c) => c.cell), ["skipped", "met", "met", "here", "ahead"]);
  assert.equal(rows.find((r) => r.key === "work-f2").detail, "还差：你用过说对", "no needs: the step's own requirement");
  const d3 = rows.find((r) => r.key === "work-d3");
  assert.deepEqual([d3.detail, d3.actions.map((b) => [b.label, b.action.op])], ["接下来我去：出工作项页样稿", [["好，做吧", "work-go-on"], ["标为完成", "work-close"], ["暂缓处理", "work-hold"]]]);
  const e4 = rows.find((r) => r.key === "work-e4");
  assert.deepEqual([e4.detail, e4.actions.map((b) => b.label)], ["接下来我去：出样稿 · 在别的会话里", ["转到本会话", "标为完成", "暂缓处理"]], "another session's next step: no 好，做吧 here, but it can be taken over");
  assert.equal(rows.find((r) => r.key === "work-h5"), undefined, "the held group folded");
  const opened = workRows([item({ id: "h5", status: "held" })], flows, t, { open: ["held"] });
  assert.deepEqual(opened.at(-1).actions.map((b) => [b.label, b.action]), [["取消暂缓", { op: "work-hold", id: "h5", held: false }]]);
  assert.equal(stripText(a1.cells), "✓复现 ✓找根因 ✓先写会失败的测试 ✓修 ✓验证 ▸你确认 ·完成");
});

test("the work items tab: an item whose flow cannot be read still shows, with no cells; many items list the first few of a group until its heading's press", () => {
  const lost = workRows([item({ flow: "gone" })], flows, t);
  assert.deepEqual(lost.filter((r) => r.kind === "work").map((r) => [r.title, r.tag, r.cells, r.actions.map((b) => b.label)]), [["导出跳过不留", "gone", [], ["标为完成", "暂缓处理"]]]);
  const many = Array.from({ length: 60 }, (_, n) => item({ id: `i${n}` }));
  const folded = workRows(many, flows, t);
  assert.equal(folded.filter((r) => r.kind === "work").length, WORK_SHOWN);
  assert.deepEqual([folded[0].count, folded[0].fold.label, folded[0].fold.action], [60, "展开", { op: "work-fold", group: "you", open: true }]);
  assert.equal(workRows(many, flows, t, { open: ["you"] }).filter((r) => r.kind === "work").length, 60);
});

test("the flow tab's manual: each flow with items on the way, the focused first; its steps with who judges and what each prevents, the focused item's step marked, the ways back", () => {
  const items = [item({}), item({ id: "b2", title: "工具页对齐", at: "2026-10-23T09:00:00Z" }), item({ id: "c3", flow: "design", title: "流程改成教练", met: [m("discuss")], at: "2026-10-23T11:00:00Z" })];
  const rows = manualRows(items, flows, [], t, { focus: { flow: "bugfix", id: "b2" }, expanded: null });
  assert.deepEqual([rows[0].kind, rows[0].lead, rows[0].items.map((x) => [x.judge, x.word, x.means])], ["judges", "谁判：", [["fact", "事实", "插件查得到"], ["you", "你", "要你点头"], ["model", "模型", "我判断"]]]);
  // How the flows run, said once: nobody picks them, and only a rule holds anything up.
  assert.equal(rows[1].text, "这些流程自动套用，不用你选：每轮结束，模型把手上的事归到一条，报它过了哪几步。只提醒、不拦；改成规定的做法（🔒）才拦。");
  assert.equal(rows[2].text, "从「工具页对齐」过来 · 卡在「你确认」");
  assert.deepEqual(rows.filter((r) => r.kind === "section").map((r) => [r.text, r.note]), [["bugfix", ""], ["新设计", ""]]);
  assert.deepEqual(rows.filter((r) => r.kind === "text" && r.text.startsWith("走过")).map((r) => r.text), ["走过 2 件 · 0 件走完", "走过 1 件 · 0 件走完"], "under each heading, how many went through it");
  assert.deepEqual(rows.filter((r) => r.kind === "rule").map((r) => r.key), ["manual-rule-design", "manual-rule-idle"], "a line between flows, and before those with none on the way");
  // The work on its way, under its flow's heading, as the work items tab lists it — its presses too — but not named by its flow.
  const going = rows.filter((r) => r.kind === "work");
  assert.deepEqual(going.map((r) => [r.key, r.tag, r.actions.map((b) => b.label)]), [["work-a1", "", ["好了", "没好"]], ["work-b2", "", ["好了", "没好"]], ["work-c3", "", ["标为完成", "暂缓处理"]]]);
  assert.ok(rows.findIndex((r) => r.key === "work-a1") < rows.findIndex((r) => r.key === "step-bugfix-reproduce"), "before the steps");
  // Every step a piece of work stands at is shaded and says so: one by its title, several by how many.
  const bug = rows.filter((r) => r.kind === "step" && r.key.startsWith("step-bugfix-"));
  assert.deepEqual(bug.map((r) => [r.title, r.need, r.judge, r.here, r.on]), [["复现", "版本已确认", "模型", false, undefined], ["找根因", "说得出为什么坏", "模型", false, undefined], ["先写会失败的测试", "有一个现在会失败、能复现问题的测试", "模型", false, undefined], ["修", "一个猜测一版", "模型", false, undefined], ["验证", "测试通过", "事实", false, undefined], ["你确认", "你按过说对", "你", true, "← 2 件停在这"], ["完成", "", "", false, undefined]]);
  assert.equal(rows.find((r) => r.key === "step-design-mockup").on, "← 流程改成教练 停在这");
  assert.deepEqual(manualRows([item({ status: "held" }), item({ id: "b2" })], flows, [], t, { focus: null, expanded: null }).filter((r) => r.kind === "text" && r.text.startsWith("暂缓")).map((r) => r.text), ["暂缓 1 件"], "the work put aside, counted");
  assert.equal(bug[0].prevents, "防：修的不是真正出问题的那个版本或现象");
  assert.ok(rows.some((r) => r.kind === "text" && r.text === "↩ 你说没好，回到复现"));
  // The flows with none on the way: one line of their names, each a press that opens it.
  const idle = rows.find((r) => r.key === "manual-idle");
  assert.deepEqual([idle.kind, idle.lead, idle.items.map((b) => [b.label, b.action])], ["presses", "没有在走的：", [
    ["新功能 ▸", { op: "manual-open", flow: "feature", open: true }], ["优化 ▸", { op: "manual-open", flow: "optimize", open: true }],
    ["线上事故 ▸", { op: "manual-open", flow: "incident", open: true }], ["代码审查 ▸", { op: "manual-open", flow: "review", open: true }], ["调研选型 ▸", { op: "manual-open", flow: "research", open: true }],
    ["重构 ▸", { op: "manual-open", flow: "refactor", open: true }], ["文档 ▸", { op: "manual-open", flow: "docs", open: true }], ["数据分析 ▸", { op: "manual-open", flow: "analysis", open: true }],
  ]]);
  const none = manualRows([], flows, [], t, { focus: null, expanded: null });
  assert.deepEqual([none.filter((r) => r.kind === "section").length, none.find((r) => r.key === "manual-idle").items.length, none.some((r) => r.kind === "rule")], [0, flows.length, false], "nothing on the way: every flow a press");
  assert.equal(manualRows([], flows, [], t, { focus: null, expanded: ["optimize"] }).filter((r) => r.kind === "step").length, 5, "a flow opened shows whole");
});

test("a flow's growth, a day at a time, newest first: practices by how they came, steps put back or not taken out, rules; the flow opened, a line a day; folded, its latest day and a press", () => {
  // Noon UTC: the same local day on any machine from UTC-11 to UTC+11.
  const pr = (over) => ({ id: "g1", flow: "bugfix", step: "fix", text: "x", why: "", at: "2026-11-09T12:00:00Z", by: "model", layer: "project", ...over });
  const practices = [pr({ why: "2026-11-09 截图按钮猜错两版" }), pr({ id: "g2", step: "reproduce", at: "2026-10-26T12:00:00Z", by: "memory" }), pr({ id: "g3", at: "2026-10-26T13:00:00Z", by: "memory" }),
    pr({ id: "g4", step: "*", at: "2026-10-29T12:00:00Z" }), pr({ id: "g5", deleted: true, at: "2026-11-20T12:00:00Z" }), pr({ id: "g6", flow: "design", at: "2026-11-21T12:00:00Z" }), pr({ id: "g7", layer: "team", at: "2026-10-29T13:00:00Z" })];
  const step = (id, title) => ({ id, title, need: "", judge: "model", prevents: "" });
  const proposals = [
    { id: "q1", kind: "add-step", flow: "bugfix", after: "fix", step: step("verify", "验证"), why: "从参考加回来", at: "2026-11-25T12:00:00Z", by: "reference", status: "accepted" },
    { id: "q2", kind: "remove-step", flow: "bugfix", remove: "confirm", why: "", at: "2026-11-11T12:00:00Z", by: "gemworks", status: "declined" },
    { id: "q3", kind: "add-step", flow: "bugfix", after: "fix", step: step("gates", "过三道门"), why: "", at: "2026-11-11T13:00:00Z", by: "model", status: "open" },
    { id: "q4", kind: "add-step", flow: "bugfix", after: "fix", step: step("sync", "同步"), why: "", at: "2026-11-12T12:00:00Z", by: "model", status: "declined" },
  ];
  const rules = [{ id: "r1", flow: "bugfix", requires: "verify", key: "Bash(x)", text: "验证过了才同步", why: "", at: "2026-11-13T12:00:00Z", layer: "project" }];
  const days = growthDays(flow("bugfix"), practices, proposals, rules, t);
  assert.deepEqual(days.map((d) => [d.day, d.text]), [
    ["11-25", "加回「验证」"],
    ["11-13", "验证 挂上规定"],
    ["11-12", "提议加一步「同步」，你没要"],
    ["11-11", "提议去掉「你确认」，你留着"],
    ["11-09", "修 学到 1 条 — 截图按钮猜错两版"],
    ["10-29", "这类活都要 学到 1 条；修 团队加了 1 条"],
    ["10-26", "复现、修 从记忆搬来 2 条"],
  ], "an open proposal is no growth yet; a practice deleted, or another flow's, is none of it");
  // Folded (新设计 moved last, opened instead): its latest day, and a press that opens it.
  const items = [item({}), item({ id: "c3", flow: "design", met: [m("discuss")], at: "2026-10-23T11:00:00Z" })];
  const folded = manualRows(items, flows, practices, t, { focus: null, expanded: null, proposals, rules });
  assert.deepEqual(folded.find((r) => r.key === "manual-growth-bugfix"), { kind: "presses", key: "manual-growth-bugfix", lead: "长势：最近 11-25 加回「验证」", items: [{ key: "manual-growth-open-bugfix", label: "共 7 天 ▸", action: { op: "manual-open", flow: "bugfix", open: true } }] });
  assert.ok(folded.findIndex((r) => r.key === "manual-growth-bugfix") > folded.findIndex((r) => r.key === "step-bugfix-done"), "after its steps");
  // Opened: a line a day, at most GROWTH_SHOWN of them.
  const opened = manualRows(items, flows, practices, t, { focus: null, expanded: ["bugfix"], proposals, rules });
  const at = opened.findIndex((r) => r.kind === "text" && r.text === "长势");
  assert.deepEqual(opened.slice(at + 1, at + 3).map((r) => r.text), ["11-25  加回「验证」", "11-13  验证 挂上规定"]);
  assert.equal(opened.some((r) => r.key === "manual-growth-bugfix"), false);
  const many = Array.from({ length: GROWTH_SHOWN + 2 }, (_, n) => pr({ id: `m${n}`, at: `2026-10-${String(n + 1).padStart(2, "0")}T12:00:00Z` }));
  const long = manualRows(items, flows, many, t, { focus: null, expanded: ["bugfix"] });
  assert.equal(long.filter((r) => r.kind === "text" && /^\d\d-\d\d {2}/.test(r.text)).length, GROWTH_SHOWN);
  assert.ok(long.some((r) => r.kind === "text" && r.text === "更早还有 2 天"));
  assert.equal(manualRows(items, flows, [], t, { focus: null, expanded: null }).some((r) => r.key?.startsWith("manual-growth-")), false, "nothing grown: no line");
});

test("the flows this project grew stand on their own: the day each grew, why, whether any work went through it; a press opens it; not among the ones with none on the way", () => {
  const ui = readCoachFlow("ui", '=== meta\ntitle = "界面"\n===\n\n=== diagram {#flow format=geml-statechart caption="界面"}\n{"initial":"a","states":{"a":{"title":"先给样稿","description":"图已发"},"b":{"title":"位置定夺","description":"说明了位置"},"done":{"title":"完成","final":true}},"transitions":[{"from":"a","to":"b"},{"from":"b","to":"done"}]}\n===\n');
  const all = [...flows, ui];
  const proposals = [{ id: "n1", kind: "new-flow", flow: "ui", title: "界面", steps: [], why: "近 7 天纠正 36 次，没有流程可挂", at: "2026-10-30T12:00:00Z", by: "gemworks", status: "accepted" }];
  const rows = manualRows([item({})], all, [], t, { focus: null, expanded: null, proposals });
  assert.deepEqual(rows.find((r) => r.key === "manual-grown"), { kind: "section", key: "manual-grown", text: "本项目长出来的流程", note: "从你的纠正里长的" });
  assert.deepEqual(rows.find((r) => r.key === "manual-grown-ui"), { kind: "entry", key: "manual-grown-ui", title: "界面 · 2 步", tag: "10-30", tone: "normal", detail: "近 7 天纠正 36 次，没有流程可挂 · 还没有一件走过", action: { op: "manual-open", flow: "ui", open: true } });
  assert.equal(rows.find((r) => r.key === "manual-idle").items.some((b) => b.label.startsWith("界面")), false, "not again among the ones with none on the way");
  assert.ok(rows.findIndex((r) => r.key === "manual-grown") < rows.findIndex((r) => r.key === "manual-idle"));
  const used = manualRows([item({}), item({ id: "u1", flow: "ui", status: "done", met: [] })], all, [], t, { focus: null, expanded: ["ui"] });
  assert.deepEqual([used.find((r) => r.key === "manual-grown-ui").detail, used.find((r) => r.key === "manual-grown-ui").tag, used.find((r) => r.key === "manual-grown-ui").action.open], ["走过 1 件", "", false], "no proposal kept: no day; opened above, its press folds it");
  assert.ok(used.some((r) => r.key === "manual-ui"), "opened: listed above with its steps");
  assert.equal(manualRows([], flows, [], t, { focus: null, expanded: null }).some((r) => r.key === "manual-grown"), false, "none grown: no section");
});

test("所有时候的做法 unfolded lists a page of 20, a press for the next and one back to the start; a page past the end is the last", () => {
  const many = Array.from({ length: 45 }, (_, n) => ({ id: `a${n}`, flow: "*", step: "*", text: `第 ${n} 条`, why: "", at: "2026-10-01T00:00:00Z", by: "model", layer: "personal" }));
  const at = (from) => {
    const rows = manualRows([], flows, many, t, { focus: null, expanded: ["*"], ...(from !== undefined ? { anywhereFrom: from } : {}) });
    const i = rows.findIndex((r) => r.key === "manual-anywhere");
    return rows.slice(i + 1).filter((r) => r.kind !== "input").map((r) => (r.kind === "practice" ? r.key.slice("practice-".length) : [r.label, r.action]));
  };
  const first = at(undefined);
  assert.deepEqual([first.length, first[0], first[19], first[20]], [21, "a0", "a19", ["再看 20 条（共 45）", { op: "manual-anywhere", from: 20 }]], "the first 20, then a press for the next 20");
  const second = at(20);
  assert.deepEqual([second[0], second[1], second[20], second[21]], [["前 20 条已收起 · 回到开头", { op: "manual-anywhere", from: 0 }], "a20", "a39", ["再看 5 条（共 45）", { op: "manual-anywhere", from: 40 }]]);
  assert.deepEqual(at(40), [["前 40 条已收起 · 回到开头", { op: "manual-anywhere", from: 0 }], "a40", "a41", "a42", "a43", "a44"], "the last page: no press for more");
  assert.deepEqual(at(999)[1], "a40", "a page past the end (some deleted since): the last one");
  assert.equal(at(undefined).length, 21, "folded and unfolded: the first page");
  assert.deepEqual(manualRows([], flows, many.slice(0, 20), t, { focus: null, expanded: ["*"] }).filter((r) => r.kind === "button"), [], "20 or fewer: no presses");
});

test("the manual's practices: listed on the flow opened, each on its step, its tag and presses; the rest counted on their flow's heading; those for every flow at the end", () => {
  const pr = (over) => ({ id: "p1", flow: "bugfix", step: "fix", text: "同一现象再现，先回头读引擎契约", why: "10-22 页签连死四次", at: "2026-10-25T00:00:00Z", by: "model", layer: "project", ...over });
  const practices = [pr({}), pr({ id: "p2", step: "*", text: "修之前先复现", by: "memory", layer: "personal" }), pr({ id: "p3", flow: "design", step: "mockup", text: "用真实内容", by: "person" }),
    pr({ id: "p4", flow: "*", step: "*", text: "回复用中文", layer: "personal", by: "memory" }), pr({ id: "p5", deleted: true }), pr({ id: "p6", layer: "team", step: "verify", text: "过四道门", ref: "CLAUDE.md#build-and-check" })];
  const items = [item({}), item({ id: "c3", flow: "design", met: [m("discuss")], at: "2026-10-23T11:00:00Z" })];
  const rows = manualRows(items, flows, practices, t, { focus: null, expanded: null, now: "2026-10-26T00:00:00Z" });
  // A flow's heading is a heading: its name, the press that lists its practices or folds them (an icon), and one ⋯;
  // sharing and exporting are in its menu.
  const heads = rows.filter((r) => r.kind === "section").map((r) => [r.text, r.tucked, (r.actions ?? []).map((b) => [b.label, b.action])]);
  assert.deepEqual(heads, [["新设计", true, [["⋯", { op: "manual-menu", key: "flow:design" }]]], ["bugfix", true, [["⋯", { op: "manual-menu", key: "flow:bugfix" }]]], ["所有时候的做法", undefined, []]], "the flow moved last listed; the other folded");
  assert.deepEqual(rows.filter((r) => r.tucked === true).map((r) => [r.fold, r.open]), [
    [{ key: "manual-fold-design", label: "收起做法", action: { op: "manual-open", flow: "design", open: false } }, true],
    [{ key: "manual-fold-bugfix", label: "展开做法", action: { op: "manual-open", flow: "bugfix", open: true } }, false],
  ]);
  const opened = manualRows(items, flows, practices, t, { focus: null, expanded: ["bugfix"], now: "2026-10-26T00:00:00Z" }).find((r) => r.key === "manual-bugfix");
  assert.deepEqual([opened.fold.label, opened.fold.action, opened.open], ["收起做法", { op: "manual-open", flow: "bugfix", open: false }, true]);
  assert.equal(manualRows(items, flows, [], t, { focus: null, expanded: null }).find((r) => r.key === "manual-bugfix").fold, undefined, "no practices: nothing to fold");
  // A flow folded shows each step's newest practice alone; the flow opened, all of them.
  assert.deepEqual(rows.filter((r) => r.kind === "practice").map((r) => r.text), ["用真实内容", "修之前先复现", "同一现象再现，先回头读引擎契约", "过四道门"]);
  assert.deepEqual(rows.filter((r) => r.kind === "step" && r.more !== undefined), [], "one practice a step: nothing more to list");
  // Two on a step, folded: the newer, and a press under the step that lists them all.
  const two = manualRows(items, flows, [...practices, pr({ id: "p7", text: "一个猜测一版", at: "2026-10-25T09:00:00Z" })], t, { focus: null, expanded: null, now: "2026-10-26T00:00:00Z" });
  const fixAt = two.findIndex((r) => r.key === "step-bugfix-fix");
  assert.deepEqual([two[fixAt].more, two[fixAt + 1].key], [{ key: "manual-more-bugfix-fix", label: "还有 1 条 ▾", action: { op: "manual-open", flow: "bugfix", open: true } }, "practice-p7"]);
  const bug = manualRows(items, flows, practices, t, { focus: null, expanded: ["bugfix", "*"], now: "2026-10-26T00:00:00Z" });
  // (新设计 stays folded, its newest practice shown: left out here.)
  const listed = bug.filter((r) => r.kind === "practice" && r.key !== "practice-p3");
  // Beside its words, as the design has it: 改成规定 on a step's, × on one learned or moved in, and ⋯ for the rest.
  assert.deepEqual(listed.map((r) => [r.text, r.tag, r.actions.map((b) => b.label)]), [
    ["修之前先复现", "从记忆搬来", ["×", "⋯"]], ["同一现象再现，先回头读引擎契约", "新学到", ["改成规定", "×", "⋯"]], ["过四道门", "团队", []], ["回复用中文", "从记忆搬来", ["×", "⋯"]],
  ]);
  assert.equal(listed[2].why, "10-22 页签连死四次 · CLAUDE.md#build-and-check");
  assert.equal(manualRows(items, flows, practices, t, { focus: null, expanded: ["design"] }).find((r) => r.key === "practice-p3").tag, "做法", "one written by the person or the model: 做法");
  assert.deepEqual(listed[1].actions[1].action, { op: "practice-delete", id: "p1" });
  assert.deepEqual(listed[0].actions[1].action, { op: "manual-menu", key: "practice:p2" });
  // The block for the flow's own practices stands before its steps, its practices under it.
  const wide = bug.findIndex((r) => r.key === "step-bugfix-*");
  assert.deepEqual([bug[wide].title, bug[wide + 1].key], ["这类活都要：", "practice-p2"]);
  // ⋯ opens a menu under the row: a practice's layer and sharing; a flow's sharing and exporting. Its ⋯ then closes it.
  const menuOf = (menu, key) => { const r = manualRows(items, flows, practices, t, { focus: null, expanded: ["bugfix", "*"], now: "2026-10-26T00:00:00Z", menu }); const at = r.findIndex((x) => x.key === key); return [r[at + 1].kind, r[at + 1].items.map((b) => [b.label, b.action])]; };
  assert.deepEqual(menuOf("practice:p1", "practice-p1"), ["menu", [["改成个人", { op: "practice-layer", id: "p1", layer: "personal" }], ["分享给团队", { op: "practice-share", id: "p1" }], ["取消", { op: "manual-menu", key: null }]]]);
  assert.deepEqual(menuOf("practice:p4", "practice-p4")[1].map(([l]) => l), ["改成项目", "写进 CLAUDE.md", "取消"]);
  assert.deepEqual(menuOf("flow:bugfix", "manual-bugfix"), ["menu", [["分享给团队", { op: "flow-share", flow: "bugfix" }], ["导出", { op: "flow-export", flow: "bugfix" }], ["取消", { op: "manual-menu", key: null }]]]);
  assert.deepEqual(manualRows(items, flows, practices, t, { focus: null, expanded: ["bugfix"], now: "2026-10-26T00:00:00Z", menu: "practice:p1" }).find((r) => r.key === "practice-p1").actions.at(-1).action, { op: "manual-menu", key: null });
  const own = readCoachFlow("bugfix", readFileSync(new URL("../../coach/bugfix.geml", import.meta.url), "utf8").replace('"fix":', '"gates": { "title": "过三道门", "description": "三项都过" }, "fix":').replace(/"reproduce": \{[^}]*\},/, ""), flow("bugfix"));
  assert.deepEqual(own.diff, { added: ["过三道门"], removed: ["复现"] });
  // What the project changed is marked on the steps: one it added says so; one it took out stands crossed out where it
  // stood, with a press that puts it back after asking.
  assert.deepEqual(own.missing, [{ id: "reproduce", title: "复现", need: "版本已确认", judge: "model", prevents: "修的不是真正出问题的那个版本或现象", after: "rootcause" }], "with nothing before it, after the flow's first step");
  const changed = manualRows([item({})], flows.map((f) => (f.name === "bugfix" ? own : f)), [], t, { focus: null, expanded: null });
  assert.equal(changed.find((r) => r.key === "manual-bugfix").note, "", "nothing about it on the heading");
  assert.equal(changed.find((r) => r.key === "step-bugfix-gates").grown, "本项目加的");
  assert.equal(changed.find((r) => r.key === "step-bugfix-fix").grown, undefined);
  const back = changed.findIndex((r) => r.key === "step-bugfix-missing-reproduce");
  assert.equal(changed[back - 1].key, "step-bugfix-rootcause", "where it stood");
  assert.deepEqual([changed[back].title, changed[back].need, changed[back].judge, changed[back].missing], ["复现", "版本已确认", "参考里有", { key: "flow-step-back-bugfix-reproduce", label: "加回来", action: { op: "flow-step-back", flow: "bugfix", step: "reproduce", confirm: { question: "把「复现」加回bugfix？之后这类活都要过这一步。", yes: "加回来" } } }]);
  // Missing from the middle: after the nearest step before it that the project still has.
  const mid = readCoachFlow("bugfix", readFileSync(new URL("../../coach/bugfix.geml", import.meta.url), "utf8").replace(/"rootcause":\s*\{[^}]*\},/, "").replace(/"failtest":\s*\{[^}]*\},/, ""), flow("bugfix"));
  assert.deepEqual(mid.missing.map((x) => [x.id, x.after]), [["rootcause", "reproduce"], ["failtest", "reproduce"]]);
});

test("the band's line: what the last turn moved that waits on the person, with its two words and 暂缓处理; else this session's last item, what comes next and 好，做吧", () => {
  const items = [item({ id: "x9", session: "other", title: "别处的" }), item({})];
  const line = coachBand(items, flows, "s1", t);
  assert.deepEqual([line.verb, line.title, line.note, line.actions.map((b) => [b.label, b.action.op])], ["等你 · bugfix", "导出跳过不留", "你按一次跳过", [["好了", "work-meet"], ["没好", "work-meet"], ["暂缓处理", "work-hold"]]]);
  assert.deepEqual(line.more, { count: 1, detail: "别处的" }, "the others waiting on the person, any session");
  assert.equal(line.detail, "✓复现 ✓找根因 ✓先写会失败的测试 ✓修 ✓验证 ▸你确认 ·完成 · 最后：跳过不留文件", "hovered: its cells and what it ends as");
  assert.equal(coachBand(items, flows, "nobody", t), undefined);
  assert.equal(coachBand([item({ needs: "" })], flows, "s1", t).note, "你按过说对", "no needs: the step's own requirement");
  const next = coachBand([item({ met: [m("reproduce")], next: "改一处" })], flows, "s1", t);
  assert.deepEqual([next.verb, next.note, next.actions.map((b) => [b.label, b.action])], ["bugfix", "接下来我去：改一处", [["好，做吧", { op: "work-go-on", id: "a1", next: "改一处", at: "2026-10-23T10:00:00Z" }], ["暂缓处理", { op: "work-hold", id: "a1", held: true }]]]);
  const two = coachBand([item({ at: "2026-10-23T12:00:00Z" }), item({ id: "a2", title: "工具页对齐", at: "2026-10-23T12:01:00Z" })], flows, "s1", t, "2026-10-23T11:59:00Z");
  assert.deepEqual([two.verb, two.title, two.actions.map((b) => b.label)], ["等你", "这一轮 2 件等你：导出跳过不留 · 工具页对齐", ["逐个定"]]);
});

test("好，做吧 pressed gives way to 排队中 behind a running turn, then 进行中 until its own turn ends, on the band and on the row; once the item is reported again it is offered again", () => {
  const doing = item({ met: [m("reproduce")], next: "改一处" });
  const pressedBusy = [{ id: "a1", next: "改一处", at: doing.at, wait: 1, ends: 0 }];
  const queued = coachBand([doing], flows, "s1", t, undefined, pressedBusy);
  assert.deepEqual([queued.note, queued.actions], ["排队中 改一处", []], "no button to press a second time");
  const row = (gone) => workRows([doing], flows, t, { own: "s1", gone }).find((r) => r.key === "work-a1");
  assert.deepEqual([row(pressedBusy).detail, row(pressedBusy).actions.map((b) => b.label)], ["排队中 改一处", ["标为完成", "暂缓处理"]]);
  // The running turn ends: its own turn is under way.
  const under = goneOnAfterTurn(pressedBusy);
  assert.deepEqual(under, [{ id: "a1", next: "改一处", at: doing.at, wait: 1, ends: 1 }]);
  assert.deepEqual([coachBand([doing], flows, "s1", t, undefined, under).note, row(under).detail], ["进行中 改一处", "进行中 改一处"]);
  // Its own turn ends: the press is spent, and a next step still standing is offered again.
  assert.deepEqual(goneOnAfterTurn(under), []);
  assert.deepEqual(coachBand([doing], flows, "s1", t, undefined, goneOnAfterTurn(under)).actions.map((b) => b.label), ["好，做吧", "暂缓处理"]);
  // Pressed while idle: under way at once, spent at the end of the turn it opened.
  const idle = [{ id: "a1", next: "改一处", at: doing.at, wait: 0, ends: 0 }];
  assert.equal(coachBand([doing], flows, "s1", t, undefined, idle).note, "进行中 改一处");
  assert.deepEqual(goneOnAfterTurn(idle), []);
  // The item reported again (its record changed), or another next step: the press says nothing about it.
  assert.equal(goneOnNote(item({ ...doing, at: "2026-10-23T11:00:00Z" }), pressedBusy, t), undefined);
  assert.equal(goneOnNote(item({ ...doing, next: "再改一处" }), pressedBusy, t), undefined);
});

test("the item the person's own turn took up says 我在做 and offers no 好，做吧 on the band or its row, until the turn ends or reports it again", () => {
  const on = item({ met: [m("reproduce")], next: "改一处" });
  const other = item({ id: "a2", title: "工具页对齐", met: [m("reproduce")], next: "对齐中间列", at: "2026-10-23T09:30:00Z" });
  // The turn's item is this session's last on the way, the one whose practices go beside its prompt.
  assert.equal(turnItem([on, other], "s1"), on);
  assert.equal(turnItem([on, other], "s2"), undefined);
  assert.equal(turnItem([item({ status: "done" }), other], "s1"), other);
  const doing = { id: "a1", next: "改一处", at: on.at };
  const band = coachBand([on, other], flows, "s1", t, undefined, [], doing);
  assert.deepEqual([band.note, band.actions], ["我在做：改一处", []], "no button while it is being done");
  const rows = workRows([on, other], flows, t, { own: "s1", doing });
  const row = (id) => rows.find((r) => r.key === `work-${id}`);
  assert.deepEqual([row("a1").detail, row("a1").actions.map((b) => b.label)], ["我在做：改一处", ["标为完成", "暂缓处理"]]);
  assert.deepEqual([row("a2").detail, row("a2").actions.map((b) => b.label)], ["接下来我去：对齐中间列", ["好，做吧", "标为完成", "暂缓处理"]], "the other item keeps its button");
  // Reported again during the turn: what it says next is for after this turn, and is offered.
  const again = item({ ...on, next: "跑测试", at: "2026-10-23T10:05:00Z" });
  assert.equal(doingNote(again, doing, t), undefined);
  assert.deepEqual(coachBand([again], flows, "s1", t, undefined, [], doing).actions.map((b) => b.label), ["好，做吧", "暂缓处理"]);
  // No turn of the person's running: the button as before; a press under way says so first.
  assert.deepEqual(coachBand([on], flows, "s1", t, undefined, [], null).actions.map((b) => b.label), ["好，做吧", "暂缓处理"]);
  assert.equal(coachBand([on], flows, "s1", t, undefined, [{ id: "a1", next: "改一处", at: on.at, wait: 0, ends: 0 }], doing).note, "进行中 改一处");
});

test("the work items tab: a question about no item on the way stands in 等你定 at the top, one about an item under it; a press says question：answer, the band's own words", () => {
  const asks = [{ question: "装 geml 插件吗？", options: ["装", "先不装"], recommended: "装" }, { question: "logo 用哪版？", options: ["原版", "现在的"], item: "a1" }];
  const rows = workRows([item({})], flows, t, { asks });
  assert.deepEqual(rows.map((r) => r.kind), ["section", "card", "section", "work", "card"]);
  assert.deepEqual([rows[0].text, rows[0].count], ["等你定", 1]);
  assert.deepEqual([rows[1].title, rows[1].verb, rows[1].icon], ["装 geml 插件吗？", "定", "ask"]);
  assert.deepEqual(rows[1].actions[0], { key: "ask-0-0", label: "装", primary: true, action: { op: "say", text: "装 geml 插件吗？：装", decisions: ["装 geml 插件吗？：装"] } });
  assert.equal(rows[4].title, "logo 用哪版？", "under the item it is about");
  assert.deepEqual(workRows([item({ status: "done" })], flows, t, { asks: [asks[1]] }).map((r) => r.kind), ["section", "card"], "an item no longer on the way: its question in 等你定");
  assert.deepEqual(workRows([], flows, t, {}), [], "nothing waiting, nothing on the way: no rows");
});

test("a work item's history across sessions, and what a turn did in words: the steps it met and how, a way back, being put aside, the decisions, the practices learned", () => {
  const log = (id, lines) => summarize(parseLog([{ t: "session", id, host: "claude-code", at: "2026-10-26T09:00:00Z" }, ...lines].map((e) => JSON.stringify(e)).join("\n")));
  const ev = (turn, at, over) => ({ t: "item", turn, at, id: "d1", flow: "design", title: "流程手册", state: "discuss", needs: "", goal: "", status: "open", met: [], ...over });
  const one = log("s1", [
    { t: "prompt", turn: 1, at: "2026-10-26T09:04:00Z", text: "对得上" },
    ev(1, "2026-10-26T09:05:00Z", { state: "mockup", met: [{ step: "discuss", at: "2026-10-26T09:05:00Z", turn: 1, said: "对得上" }] }),
    { t: "decision", turn: 1, at: "2026-10-26T09:05:00Z", text: "进度放在工作项上" },
    { t: "decision", turn: 1, at: "2026-10-26T09:05:00Z", text: "流程手册先对一遍", by: "person", said: "对得上" },
  ]);
  const two = log("s2", [
    { t: "prompt", turn: 3, at: "2026-10-26T10:00:00Z", text: "要改" },
    ev(3, "2026-10-26T10:01:00Z", { state: "mockup", met: [{ step: "discuss", at: "2026-10-26T09:05:00Z", turn: 1, said: "对得上" }] }),
    { t: "prompt", turn: 4, at: "2026-10-26T11:00:00Z", text: "先放一放" },
    ev(4, "2026-10-26T11:01:00Z", { state: "mockup", status: "held", met: [{ step: "discuss", at: "2026-10-26T09:05:00Z", turn: 1, said: "对得上" }] }),
  ]);
  assert.deepEqual(itemHistory("d1", [one, two], flows, t).map((h) => h.text), ["✓讨论 · 你说「对得上」", "模型记：进度放在工作项上", "你定：流程手册先对一遍", "到「出样稿」", "已暂缓"]);
  const learned = [{ id: "p", flow: "design", step: "mockup", text: "用真实内容", why: "", at: "x", by: "model", layer: "project", session: "s1", turn: 1 }];
  assert.deepEqual(turnWords(one.turns[0], flows, learned, t), ["→ 流程手册 ✓讨论 · 你说「对得上」", "模型记：进度放在工作项上", "你定：流程手册先对一遍", "新学到：用真实内容"]);
  const rows = workRows([item({ id: "d1", flow: "design", title: "流程手册", met: [m("discuss")], goal: "一套流程" })], flows, t, { unfolded: "d1", sessions: [one, two] });
  const after = rows.slice(rows.findIndex((r) => r.key === "work-d1") + 1);
  assert.deepEqual(after.filter((r) => r.kind === "text").map((r) => r.text.replace(/^\d\d:\d\d {2}/, "")), ["✓讨论 · 你说「对得上」", "模型记：进度放在工作项上", "你定：流程手册先对一遍", "到「出样稿」", "已暂缓", "最后：一套流程"]);
  assert.deepEqual(after.find((r) => r.kind === "buttons").items.map((b) => [b.label, b.action.op]), [["看这件的提示词", "session-item"], ["看流程", "coach-go"], ["放下", "work-close"]]);
  assert.deepEqual(rows.find((r) => r.key === "work-d1").open.action, { op: "work-unfold", id: null }, "unfolded: its press folds it");
});

test("an item of a session that ended is the person's to move: taken over it is this session's and offers 好，做吧; closed it leaves the tab", () => {
  const other = item({ id: "x9", flow: "design", title: "别处的", met: [m("discuss")], next: "出样稿", session: "s2" });
  const silent = [{ id: "s2", last: "2026-10-28T00:00:00Z" }];
  const row = (rows) => rows.find((r) => r.key === "work-x9");
  assert.equal(row(workRows([other], flows, t, { own: "s1", sessions: silent, now: "2026-10-30T08:00:00Z" })).detail, "接下来我去：出样稿 · 在别的会话里（已结束）");
  assert.equal(row(workRows([other], flows, t, { own: "s1", sessions: silent, now: "2026-10-28T08:00:00Z" })).detail, "接下来我去：出样稿 · 在别的会话里", "silent less than a day: not said to be over");
  const taken = row(workRows([other], flows, t, { own: "s1" })).actions[0];
  assert.deepEqual([taken.label, taken.primary, taken.action], ["转到本会话", true, { op: "work-take", id: "x9" }]);
  // The press is one event in this session's log: the newest event names the session an item is on.
  const log = (id, events) => ({ id, host: "claude-code", started: "x", last: "x", turns: [], decisions: [], files: [], commits: [], items: events });
  const was = workItemsOf([log("s2", [{ ...holdEvent(other, false, "2026-10-26T00:00:00Z", 1), id: "x9" }])], flows)[0];
  const mine = workItemsOf([log("s2", [holdEvent(was, false, "2026-10-26T00:00:00Z", 1)]), log("s1", [closeEvent(was, "open", "2026-10-30T08:00:00Z", 2)])], flows)[0];
  assert.deepEqual([mine.session, mine.status, mine.next], ["s1", "open", "出样稿"]);
  assert.deepEqual(row(workRows([mine], flows, t, { own: "s1" })).actions.map((b) => b.label), ["好，做吧", "标为完成", "暂缓处理"]);
  for (const status of ["done", "dropped"]) {
    const closed = workItemsOf([log("s2", [holdEvent(was, false, "2026-10-26T00:00:00Z", 1)]), log("s1", [closeEvent(was, status, "2026-10-30T08:00:00Z", 2)])], flows)[0];
    assert.deepEqual([closed.status, closed.next], [status, ""]);
    assert.equal(row(workRows([closed], flows, t, { own: "s1" })), undefined, `${status}: off the tab`);
  }
});

test("the starter flows speak the person's language: every title, need, pitfall, answer and way back has its English and Japanese, ids stay", () => {
  for (const lang of ["en", "ja"]) {
    const shown = flowsIn(flows, wordsFor(lang));
    const cjk = /[一-鿿]/;
    for (const [i, f] of shown.entries()) {
      assert.equal(f.name, flows[i].name);
      for (const [j, st] of f.states.entries()) {
        assert.equal(st.id, flows[i].states[j].id, "a press still names the step it meant");
        if (lang === "en") for (const text of [f.title, st.title, st.need, st.prevents, ...(st.answers ?? [])]) assert.ok(!cjk.test(text), `${f.name}.${st.id}: ${text}`);
      }
      for (const [j, e] of f.edges.entries()) {
        assert.deepEqual([e.from, e.to, e.back], [flows[i].edges[j].from, flows[i].edges[j].to, flows[i].edges[j].back], "a way back still joins the steps it joined");
        if (lang === "en") assert.ok(!cjk.test(e.label), `${f.name} ${e.from}→${e.to}: ${e.label}`);
      }
    }
  }
  const docs = flowsIn(flows, wordsFor("en")).find((f) => f.name === "docs");
  const back = docs.edges.find((e) => e.back);
  assert.equal(back.label, "You want changes", "你要改, the words before 回到 on the flow tab");
  const opened = manualRows([], flowsIn(flows, t).filter((f) => f.name === "docs"), [], wordsFor("en"), { focus: null, expanded: ["docs"] });
  assert.ok(opened.some((r) => r.kind === "text" && r.text === `↩ You want changes: back to ${docs.states.find((s) => s.id === back.to).title}`), "the flow tab, opened on the flow, says it");
  const feature = flowsIn(flows, wordsFor("en")).find((f) => f.name === "feature");
  assert.deepEqual([feature.title, feature.states[0].title, feature.states[0].need, feature.states[0].answers], ["feature", "Mockup", "You've seen it and said yes", ["Yes", "Change it"]]);
  const grown = { ...flow("bugfix"), states: [{ ...flow("bugfix").states[0], title: "先截图", need: "截图贴进来" }] };
  assert.deepEqual(flowsIn([grown], wordsFor("en"))[0].states[0].title, "先截图", "a step the project grew keeps its own words");
  assert.deepEqual(flowsIn(flows, t), flows, "in Chinese nothing changes");
});

test("a practice the model rewrote says which it took the place of, by that one's first words; the one replaced is not listed", () => {
  const pr = (over) => ({ id: "n1", flow: "bugfix", step: "fix", text: "改之前先复现一遍再动手", why: "11-26 又修错了地方", at: "2026-11-26T00:00:00Z", by: "model", layer: "project", ...over });
  const practices = [pr({ id: "o1", text: "修之前先复现：同一个现象出现两次就回头读引擎契约", why: "10-22", at: "2026-10-22T00:00:00Z", deleted: true, replacedBy: "n1" }), pr({ replaces: "o1" })];
  const rows = manualRows([item({ state: "fix" })], flows, practices, t, { focus: null, expanded: ["bugfix"], now: "2026-11-26T01:00:00Z" });
  assert.deepEqual(rows.filter((r) => r.kind === "practice").map((r) => [r.key, r.tag, r.why]), [["practice-n1", "新学到", "11-26 又修错了地方 · 改写自「修之前先复现：同一个现象出现两次…」"]]);
  // One whose replaced practice is no longer there says nothing of it.
  assert.equal(manualRows([item({ state: "fix" })], flows, [pr({ replaces: "gone" })], t, { focus: null, expanded: ["bugfix"] }).find((r) => r.key === "practice-n1").why, "11-26 又修错了地方");
  // A short one is quoted whole.
  const short = [pr({ id: "o2", text: "先复现", deleted: true, replacedBy: "n1" }), pr({ replaces: "o2" })];
  assert.equal(manualRows([item({ state: "fix" })], flows, short, t, { focus: null, expanded: ["bugfix"] }).find((r) => r.key === "practice-n1").why, "11-26 又修错了地方 · 改写自「先复现」");
});

test("the work items tab: a fact step whose check is under way waits on its result with nothing to press; an item with nothing it needs says nothing, another session's says where it is", () => {
  const checking = item({ met: [m("reproduce"), m("rootcause"), m("failtest"), m("fix")], needs: "" });
  const waiting = workRows([checking], flows, t, { running: new Map([["a1", new Set(["verify"])]]) });
  assert.deepEqual(waiting.filter((r) => r.kind === "section").map((r) => r.text), ["等结果"]);
  const row = waiting.find((r) => r.key === "work-a1");
  assert.deepEqual([row.detail, row.actions], ["还差：测试通过", []]);
  assert.deepEqual(workRows([checking], flows, t).filter((r) => r.kind === "section").map((r) => r.text), ["我来"], "no check under way: the model's to run");
  const detail = (over, o = {}) => workRows([item({ flow: "gone", needs: "", ...over })], flows, t, { own: "s1", ...o }).find((r) => r.kind === "work").detail;
  assert.equal(detail({}), "", "its flow unread and nothing needed: nothing to say");
  assert.equal(detail({ session: "s2" }), "在别的会话里");
  assert.equal(detail({ session: "s2", needs: "先看日志" }), "还差：先看日志 · 在别的会话里");
  assert.equal(detail({ session: "s2", next: "出样稿" }, { now: "2026-10-30T08:00:00Z" }), "接下来我去：出样稿 · 在别的会话里", "no sessions read: not said to be over");
});

test("a work item unfolded: with no sessions read it has been nowhere yet; past eight moves the older ones are counted; put aside it is not dropped from there", () => {
  const bare = workRows([item({ goal: "" })], flows, t, { unfolded: "a1" });
  const after = bare.slice(bare.findIndex((r) => r.key === "work-a1") + 1);
  assert.deepEqual(after.map((r) => (r.kind === "text" ? r.text : r.items.map((b) => b.label).join(" "))), ["还没有经过", "看这件的提示词 看流程 放下"], "no goal: no 最后 line");
  const mv = (n) => ({ id: "a1", title: "导出跳过不留", flow: "bugfix", state: "fix", status: "open", met: [], at: `2026-10-23T09:${String(n).padStart(2, "0")}:00Z` });
  const session = { id: "s1", host: "claude-code", started: "x", last: "x", turns: Array.from({ length: 10 }, (_, n) => ({ turn: n + 1, at: mv(n).at, prompt: "p", decisions: [], moved: [mv(n)] })), decisions: [], files: [], commits: [] };
  const long = workRows([item({})], flows, t, { unfolded: "a1", sessions: [session] });
  assert.deepEqual(long.filter((r) => r.kind === "text").map((r) => r.text.replace(/^\d\d:\d\d {2}/, "")), ["…再往前 2 条", ...Array(8).fill("到「修」"), "最后：跳过不留文件"]);
  const held = workRows([item({ status: "held" })], flows, t, { open: ["held"], unfolded: "a1" });
  assert.deepEqual(held.find((r) => r.kind === "buttons").items.map((b) => b.label), ["看这件的提示词", "看流程"]);
});

test("what a turn did in words: a step the person pressed, an item dropped or finished with no step met, a step its flow does not know by its id; a turn that moved nothing says its decisions; an item's history is its own, oldest first", () => {
  const mv = (over) => ({ id: "a1", title: "导出", flow: "bugfix", state: "fix", status: "open", met: [], at: "2026-10-23T10:00:00Z", ...over });
  const turn = (moved, over = {}) => ({ turn: 1, at: "2026-10-23T10:00:00Z", prompt: "p", decisions: [], ...(moved !== undefined ? { moved } : {}), ...over });
  assert.deepEqual(turnWords(turn([mv({ met: [m("confirm", { pressed: true })] }), mv({ id: "b2", title: "对齐", status: "dropped" }), mv({ id: "c3", title: "收尾", status: "done" }), mv({ id: "d4", title: "别的", met: [m("gates")] })]), flows, [], t), [
    "→ 导出 ✓你确认 · 你按的", "→ 对齐 放下", "→ 收尾 完成", "→ 别的 ✓gates",
  ]);
  assert.deepEqual(turnWords(turn(undefined, { decisions: ["先跑 CI"] }), flows, [], t), ["模型记：先跑 CI"]);
  const s = (id, turns) => ({ id, host: "claude-code", started: "x", last: "x", turns, decisions: [], files: [], commits: [] });
  const sessions = [
    s("s2", [turn([mv({ at: "2026-10-23T11:00:00Z", status: "done" })]), turn(undefined, { decisions: ["无关"] }), turn([mv({ id: "zz" })])]),
    s("s1", [turn([mv({ at: "2026-10-23T09:00:00Z", met: [m("fix")] })], { decisions: ["一版一猜"] })]),
  ];
  assert.deepEqual(itemHistory("a1", sessions, flows, t).map((h) => h.text), ["✓修", "模型记：一版一猜", "完成"], "a turn that moved another item, or none, is not its history");
});

test("a flow's growth: a practice on a step the project took out by the shipped step's title, one on a step it does not know by its id, a long why cut; a step taken out or added as accepted", () => {
  const own = readCoachFlow("bugfix", readFileSync(new URL("../../coach/bugfix.geml", import.meta.url), "utf8").replace(/"reproduce": \{[^}]*\},/, ""), flow("bugfix"));
  assert.deepEqual(own.missing.map((x) => [x.id, x.title]), [["reproduce", "复现"]]);
  // Noon UTC: the same local day on any machine from UTC-11 to UTC+11.
  const pr = (over) => ({ id: "g1", flow: "bugfix", step: "reproduce", text: "x", why: "", at: "2026-11-09T12:00:00Z", by: "model", layer: "project", ...over });
  const practices = [pr({}), pr({ id: "g2", step: "ghost", at: "2026-11-10T12:00:00Z", why: `2026-11-10 ${"一".repeat(70)}` })];
  const proposals = [
    { id: "q1", kind: "remove-step", flow: "bugfix", remove: "verify", why: "", at: "2026-11-11T12:00:00Z", by: "gemworks", status: "accepted" },
    { id: "q2", kind: "add-step", flow: "bugfix", after: "fix", step: { id: "gates", title: "过三道门", need: "", judge: "model", prevents: "" }, why: "", at: "2026-11-12T12:00:00Z", by: "model", status: "accepted" },
  ];
  assert.deepEqual(growthDays(own, practices, proposals, [], t).map((d) => [d.day, d.text]), [
    ["11-12", "加了一步「过三道门」"],
    ["11-11", "去掉「验证」"],
    ["11-10", `ghost 学到 1 条 — ${"一".repeat(60)}…`],
    ["11-09", "复现 学到 1 条"],
  ]);
});

test("the ledger's cards: a practice still corrected, with a newer one instead or none; a correction said again with a practice only on a step the flow does not know, or said at no step; quotes a day a line, long ones cut", () => {
  const p = (over) => ({ id: "p1", flow: "bugfix", step: "fix", text: "先复现", why: "", at: "2026-10-20T00:00:00Z", by: "model", layer: "project", ...over });
  const cards = [
    { kind: "failing", key: "failing:p1", practice: p({}), n: 2, quotes: [{ at: "2026-10-28T09:00:00Z", text: "又没复现" }, { at: "2026-10-28T10:00:00Z", text: "这".repeat(45), day: "10-29" }], instead: p({ id: "p2", text: "先截图", at: "2026-10-25T00:00:00Z" }) },
    { kind: "failing", key: "failing:p3", practice: p({ id: "p3" }), n: 3, quotes: [] },
    { kind: "repeat", key: "repeat:t1", theme: "t1", rule: "先给样稿", n: 4, quotes: [], narrow: p({ id: "p4", step: "ghost" }) },
    { kind: "repeat", key: "repeat:t2", theme: "t2", rule: "回复用中文", n: 3, quotes: [] },
  ];
  const rows = ledgerCardRows(cards, flows, t);
  assert.deepEqual(rows.map((r) => [r.icon, r.verb, r.title, r.detail, r.actions.map((a) => `${a.label}${a.primary ? "*" : ""}`)]), [
    ["warn", "失效", "生效后仍纠正 2 次：先复现", ["10-28「又没复现」", `10-29「${"这".repeat(40)}…」`, "已有替代做法（10-25）：先截图"], ["删除*", "保留"]],
    ["warn", "失效", "生效后仍纠正 3 次：先复现", [], ["删除", "保留"]],
    ["ask", "提议", "重复纠正 4 次：先给样稿", ["现有做法仅限「ghost」"], ["设为通用做法*", "忽略"]],
    ["ask", "提议", "重复纠正 3 次：回复用中文", [], ["记为做法*", "忽略"]],
  ], "with a newer practice for it, deleting this one is the first answer");
  assert.deepEqual(rows[3].actions[0].action, { op: "practice-from-theme", theme: "t2", rule: "回复用中文", flow: "*", step: "*", why: "重复纠正 3 次" }, "said at no step: a practice for every time");
});

test("the flow tab's manual: the focused flow first wherever it stands, the rest by the one moved last; the work on a flow newest first; a new kind of work proposed with no title, steps or why; a step proposed after one the flow lost; a skipped step it does not know by its id", () => {
  const items = [item({ id: "c3", flow: "design", met: [m("discuss")], at: "2026-10-23T11:00:00Z" }), item({}), item({ id: "f4", flow: "feature", met: [m("mockup")], at: "2026-10-23T12:00:00Z" })];
  const heads = (focus) => manualRows(items, flows, [], t, { focus, expanded: null }).filter((r) => r.kind === "section").map((r) => r.text);
  assert.deepEqual(heads(null), ["新功能", "新设计", "bugfix"], "the one moved last first");
  assert.deepEqual(heads({ flow: "design", id: "c3" }), ["新设计", "新功能", "bugfix"], "the focused one first");
  assert.deepEqual(heads({ flow: "bugfix", id: "a1" }), ["bugfix", "新功能", "新设计"]);
  const three = [item({ id: "b1", at: "2026-10-23T08:00:00Z" }), item({ id: "b2", at: "2026-10-23T10:00:00Z" }), item({ id: "b3", at: "2026-10-23T09:00:00Z" })];
  assert.deepEqual(manualRows(three, flows, [], t, { focus: null, expanded: null }).filter((r) => r.kind === "work").map((r) => r.key), ["work-b2", "work-b3", "work-b1"]);
  const proposals = [
    { id: "n1", kind: "new-flow", flow: "ui", why: "", at: "2026-10-30T12:00:00Z", by: "gemworks", status: "open" },
    { id: "n2", kind: "new-flow", flow: "copy", title: "文案", steps: [{ id: "draft", title: "初稿", need: "", judge: "model", prevents: "" }, { id: "ok", title: "你看过", need: "", judge: "you", prevents: "" }], why: "近 7 天纠正 9 次", at: "2026-10-30T12:00:00Z", by: "gemworks", status: "open" },
    { id: "q1", kind: "add-step", flow: "bugfix", after: "ghost", step: { id: "x", title: "过门", need: "三项都过", judge: "model", prevents: "" }, why: "前两次漏了", at: "2026-10-30T12:00:00Z", by: "model", status: "open" },
  ];
  const rows = manualRows([item({})], flows, [], t, { focus: null, expanded: null, proposals, skipped: [{ flow: "bugfix", step: "ghost", skipped: 3 }] });
  const card = (key) => { const r = rows.find((x) => x.key === key); return [r.title, r.detail]; };
  assert.deepEqual(card("proposal-n1"), ["新的一类活「ui」：", []], "named by its flow");
  assert.deepEqual(card("proposal-n2"), ["新的一类活「文案」：初稿 → 你看过", ["近 7 天纠正 9 次"]]);
  assert.deepEqual(rows.find((r) => r.key === "proposal-n2").actions.map((a) => [a.label, a.action]), [["加上", { op: "proposal-answer", id: "n2", yes: true }], ["不用", { op: "proposal-answer", id: "n2", yes: false }]]);
  assert.deepEqual(card("proposal-q1"), ["在「ghost」后面加一步「过门」", ["三项都过", "前两次漏了"]]);
  assert.equal(rows.find((r) => r.key === "skipped-bugfix-ghost").title, "「ghost」最近 5 件里 3 件跳过了，删掉这一步吗？");
});

test("the band's line for an item whose flow cannot be read: its flow's name, where it stands by its state, nothing on hover; an item that is the model's with no next step says what it needs, or its step", () => {
  const lost = coachBand([item({ flow: "gone", needs: "", goal: "" })], flows, "s1", t);
  assert.deepEqual([lost.verb, lost.note, lost.detail, lost.actions], ["gone", "confirm", "", []]);
  assert.equal(coachBand([item({ flow: "gone", goal: "" })], flows, "s1", t).note, "还差：你按一次跳过");
  const idle = coachBand([item({ met: [m("reproduce")], needs: "" })], flows, "s1", t);
  assert.deepEqual([idle.verb, idle.note, idle.actions], ["bugfix", "找根因", []], "nothing next: no 好，做吧");
});
