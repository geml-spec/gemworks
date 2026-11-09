// The work loop on the hosts whose Gemworks runs in Node (src/loop.ts): the flows a project has, the work items,
// practices, proposals and questions the model reports with its tools, written into the project's shared record; and
// what the model hears once and beside each prompt.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { logName, parseLog } from "../dist/core/session-log.js";
import { answerProposal, callLoopTool, coachFlowsAt, gemlHome, isLoopTool, LOOP_TOOLS, loopContext, loopPrompt, proposalsAt, recordAsk, recordPractices, recordProposals, recordWork, workItemsAt } from "../dist/loop.js";
import { readPractices } from "../dist/practice-store.js";
import { readSessions, recordPrompt, sessionsDirOf } from "../dist/session-store.js";
import { gitRepo } from "./helpers/repo.mjs";

// The person's own practices live under the home directory: this machine's must not reach the tests.
const HOME = mkdtempSync(join(tmpdir(), "gemworks-loop-home-"));
process.env.HOME = HOME;
process.env.USERPROFILE = HOME;

const AT = "2026-11-09T08:00:00.000Z";
const events = (root, host, id) => parseLog(readFileSync(join(sessionsDirOf(root), logName(host, id)), "utf8"));

test("the flows: the shipped four, a project's own copy of one in its place, and a flow the project added after them", () => {
  const root = gitRepo();
  assert.deepEqual(coachFlowsAt(root).map((f) => f.name), ["design", "feature", "bugfix", "optimize"]);
  const own = join(root, ".geml", "coach");
  mkdirSync(own, { recursive: true });
  const shipped = readFileSync(new URL("../coach/feature.geml", import.meta.url), "utf8");
  writeFileSync(join(own, "feature.geml"), shipped.replace(/"title":\s*"样稿"/, '"title": "画样稿"'));
  writeFileSync(join(own, "writing.geml"), shipped.replace(/^title\s*=.*$/m, 'title = "写文章"'));
  const flows = coachFlowsAt(root);
  assert.deepEqual(flows.map((f) => f.name), ["design", "feature", "bugfix", "optimize", "writing"]);
  assert.equal(flows.find((f) => f.name === "feature").states[0].title, "画样稿", "the project's own copy, not the shipped one");
});

test("work: an item reported into this session's log, updated by its id; a step the person judges needs their words", () => {
  const root = gitRepo();
  recordPrompt(root, "codex", "cx1", "做个看板", AT);
  const made = recordWork(root, "codex", "cx1", { items: [{ title: "看板", flow: "feature", needs: "你看样稿" }] }, AT);
  assert.equal(made.ok, true, made.text);
  const [item] = workItemsAt(root, coachFlowsAt(root));
  assert.deepEqual([item.title, item.flow, item.state, item.session, item.needs], ["看板", "feature", "mockup", "cx1", "你看样稿"]);
  const refused = recordWork(root, "codex", "cx1", { items: [{ id: item.id, title: "看板", flow: "feature", met: ["mockup"] }] }, AT);
  assert.equal(refused.ok, false);
  assert.match(refused.text, /the person's to meet/);
  const met = recordWork(root, "codex", "cx1", { items: [{ id: `#${item.id}`, flow: "feature", met: ["mockup"], said: "好了" }] }, "2026-11-09T08:05:00.000Z");
  assert.equal(met.ok, true, met.text);
  const [now] = workItemsAt(root, coachFlowsAt(root));
  assert.deepEqual([now.id, now.state, now.met.map((m) => [m.step, m.said])], [item.id, "build", [["mockup", "好了"]]]);
  assert.equal(recordWork(root, "codex", "cx1", { items: [{ title: "x", flow: "nope" }] }, AT).ok, false, "a flow that is none of the project's");
});

test("practice: recorded on its step into the project's layer, and read back beside the next prompt of the session whose item stands there", () => {
  const root = gitRepo();
  recordWork(root, "dsh", "s1", { items: [{ title: "看板", flow: "feature" }] }, AT);
  const r = recordPractices(root, "dsh", "s1", { practices: [{ flow: "feature", step: "mockup", text: "样稿先画最简单的一版", layer: "project", why: "11-09 改了三遍" }] }, AT);
  assert.equal(r.ok, true, r.text);
  assert.deepEqual(readPractices(root).practices.filter((p) => p.layer === "project").map((p) => [p.flow, p.step, p.text]), [["feature", "mockup", "样稿先画最简单的一版"]]);
  const lines = loopContext(root, "s1");
  assert.equal(lines.length, 2);
  assert.match(lines[0], /^\[gemworks\] work items on the way: #\S+ «看板» \(feature: at mockup 样稿\)/);
  assert.match(lines[1], /the practices: \(1\) 样稿先画最简单的一版/);
  assert.deepEqual(loopContext(root, "another"), [lines[0]], "another session hears the items, not this one's step");
  assert.equal(recordPractices(root, "dsh", "s1", { practices: [] }, AT).ok, false);
});

test("propose and answer: a proposal kept open until the person's words answer it; a yes adds the flow as the project's own", () => {
  const root = gitRepo();
  const step = (title) => ({ title, need: `${title}已做`, judge: "you", prevents: "白做" });
  const p = recordProposals(root, { proposals: [{ kind: "new-flow", name: "spec", title: "写规范", steps: [step("定位项目"), step("交付确认")], why: "近 7 天纠正 10 次" }] }, AT);
  assert.equal(p.ok, true, p.text);
  const [open] = proposalsAt(root);
  assert.equal(open.status, "open");
  assert.equal(answerProposal(root, { proposal: open.id, yes: true }).ok, false, "never without the person's words");
  assert.equal(answerProposal(root, { proposal: "nope", yes: true, said: "加上" }).ok, false);
  const yes = answerProposal(root, { proposal: open.id, yes: true, said: "加上写规范" });
  assert.equal(yes.ok, true, yes.text);
  assert.equal(proposalsAt(root)[0].status, "accepted");
  const spec = coachFlowsAt(root).find((f) => f.name === "spec");
  assert.deepEqual(spec.states.filter((s) => !s.final).map((s) => s.title), ["定位项目", "交付确认"]);
  assert.ok(readFileSync(join(gemlHome(root), "coach", "spec.geml"), "utf8").includes("geml-statechart"));
  assert.equal(answerProposal(root, { proposal: open.id, yes: false, said: "不用" }).ok, false, "an answered proposal is not open");
});

test("ask: the question into the log, the recommended answer first, kept on the session until its next prompt", () => {
  const root = gitRepo();
  recordPrompt(root, "antigravity", "c1", "怎么做", AT);
  assert.equal(recordAsk(root, "antigravity", "c1", { question: "用哪个？", options: ["网页"] }, AT).ok, false);
  const r = recordAsk(root, "antigravity", "c1", { question: "用哪个？", options: ["网页", "GEML 页面"], recommended: "GEML 页面", item: "#8x" }, AT);
  assert.equal(r.ok, true, r.text);
  const ask = events(root, "antigravity", "c1").find((e) => e.t === "ask");
  assert.deepEqual([ask.turn, ask.question, ask.options, ask.recommended, ask.item], [1, "用哪个？", ["GEML 页面", "网页"], "GEML 页面", "8x"]);
  assert.equal(readSessions(root)[0].asks.length, 1);
  recordPrompt(root, "antigravity", "c1", "GEML 页面", "2026-11-09T08:10:00.000Z");
  assert.equal(readSessions(root)[0].asks, undefined, "the next prompt answered it");
});

test("the tools a host lists, called by name; what the model is told once names the flows' steps", async () => {
  const root = gitRepo();
  assert.deepEqual(LOOP_TOOLS.map((t) => t.name), ["work", "practice", "propose", "answer", "ask", "artifact"]);
  assert.ok(LOOP_TOOLS.every((t) => t.inputSchema.type === "object" && !/status band|flow tab/.test(t.description)), "no tool speaks of a band or tab this host has none of");
  assert.equal(isLoopTool("status"), false);
  assert.equal(await callLoopTool(root, "codex", "cx1", "status", {}), undefined);
  const r = await callLoopTool(root, "codex", "cx1", "artifact", { kind: "link", where: "https://example.com/x" });
  assert.equal(r.ok, false);
  assert.match(r.text, /no work item is on the way/);
  const told = loopPrompt(coachFlowsAt(root)).join("\n");
  assert.match(told, /feature 新功能: mockup 样稿 \(you\) → build/);
  assert.match(told, /`answer` tool/);
  assert.deepEqual(loopPrompt([]).length, 1, "with no flows, only the ask");
});
