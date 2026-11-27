// The work loop on the hosts whose Gemworks runs in Node (src/loop.ts): the flows a project has, the work items,
// practices, proposals and questions the model reports with its tools, written into the project's shared record; and
// what the model hears once and beside each prompt.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { logName, parseLog } from "../dist/core/session-log.js";
import { answerProposal, callLoopTool, coachFlowsAt, gemlHome, isLoopTool, LOOP_TOOLS, loopContext, loopPrompt, proposalsAt, recordArtifact, recordAsk, recordPractices, recordProposals, recordWork, workItemsAt } from "../dist/loop.js";
import { readArtifactRows } from "../dist/store/artifacts.js";
import { readPractices } from "../dist/store/practices.js";
import { updateLedger } from "../dist/store/corrections.js";
import { readSessions, recordPrompt, sessionsDirOf } from "../dist/store/sessions.js";
import { gitRepo } from "./helpers/repo.mjs";

// The person's own practices live under the home directory: this machine's must not reach the tests.
const HOME = mkdtempSync(join(tmpdir(), "gemworks-loop-home-"));
process.env.HOME = HOME;
process.env.USERPROFILE = HOME;

// A GEMWORKS_STATECHART in the developer's shell would pick the workflow for the artifact tests.
delete process.env.GEMWORKS_STATECHART;

const AT = "2026-11-09T08:00:00.000Z";
const events = (root, host, id) => parseLog(readFileSync(join(sessionsDirOf(root), logName(host, id)), "utf8"));

test("the flows: the shipped ten, a project's own copy of one in its place, and a flow the project added after them", () => {
  const root = gitRepo();
  assert.deepEqual(coachFlowsAt(root).map((f) => f.name), ["design", "feature", "bugfix", "optimize", "incident", "review", "research", "refactor", "docs", "analysis"]);
  const own = join(root, ".geml", "coach");
  mkdirSync(own, { recursive: true });
  const shipped = readFileSync(new URL("../flows/starter/feature.geml", import.meta.url), "utf8");
  writeFileSync(join(own, "feature.geml"), shipped.replace(/"title":\s*"样稿"/, '"title": "画样稿"'));
  writeFileSync(join(own, "writing.geml"), shipped.replace(/^title\s*=.*$/m, 'title = "写文章"'));
  const flows = coachFlowsAt(root);
  assert.deepEqual(flows.map((f) => f.name), ["design", "feature", "bugfix", "optimize", "incident", "review", "research", "refactor", "docs", "analysis", "writing"]);
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
  let lines = loopContext(root, "s1");
  assert.equal(lines.length, 2);
  assert.match(lines[0], /^\[gemworks\] work items on the way: #\S+ «看板» \(feature: at mockup 样稿\)/);
  assert.match(lines[1], /the practices: \(1\) 样稿先画最简单的一版 — 11-09 改了三遍$/, "with why it was learned; no ledger, no count");
  // The person's ledger (under the home directory): a correction of the same theme said before the practice was written.
  const id = readPractices(root).practices.find((p) => p.text === "样稿先画最简单的一版").id;
  updateLedger((l) => ({ ...l, prompts: [{ id: "c1", at: "2026-11-01T00:00:00.000Z", session: "s0", text: "样稿太复杂了", kind: "correct", sub: "process", theme: "t1", by: "model" }], themes: [{ id: "t1", rule: "样稿从简", at: AT, practices: [id] }] }), HOME);
  lines = loopContext(root, "s1");
  assert.match(lines[1], /样稿先画最简单的一版 — 11-09 改了三遍; corrected 1 before, 0 since$/, "the ledger's count, read beside the prompt");
  assert.deepEqual(loopContext(root, "another"), [lines[0]], "another session hears the items, not this one's step");
  assert.equal(recordPractices(root, "dsh", "s1", { practices: [] }, AT).ok, false);
  // Another, with one kept: the closest shown first, with how it fared; nothing written until it says new or which it rewrites.
  const LATER = "2026-11-09T08:10:00.000Z";
  const again = { flow: "feature", step: "mockup", text: "样稿先画最简单的那一版", layer: "project" };
  const held = recordPractices(root, "dsh", "s1", { practices: [again] }, LATER);
  assert.equal(held.ok, false);
  assert.match(held.text, new RegExp(`^Not recorded yet: «样稿先画最简单的那一版».*\\n\\[${id}\\] feature mockup: 样稿先画最简单的一版 — 11-09 改了三遍; corrected 1 before, 0 since\\n`));
  assert.equal(readPractices(root).practices.filter((p) => p.layer === "project").length, 1);
  const rewrote = recordPractices(root, "dsh", "s1", { practices: [{ ...again, replaces: id }] }, LATER);
  assert.equal(rewrote.ok, true, rewrote.text);
  assert.match(rewrote.text, new RegExp(`takes the place of \\[${id}\\] \\(corrected 1 before, 0 since\\)`));
  assert.deepEqual(readPractices(root).practices.filter((p) => p.layer === "project").map((p) => [p.text, p.deleted === true, p.replacedBy !== undefined]), [["样稿先画最简单的一版", true, true], ["样稿先画最简单的那一版", false, false]]);
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

test("the flows beside an empty shipped folder: the project's own copy, else the team's in the checkout; an entry that does not read is left out", () => {
  const root = gitRepo();
  const none = mkdtempSync(join(tmpdir(), "gemworks-loop-shipped-"));
  assert.deepEqual(coachFlowsAt(root, none), [], "no shipped flow and none of the project's: no flows");
  assert.deepEqual(loopContext(root, "s1", []), [], "no flows: nothing beside the prompt");
  mkdirSync(join(root, ".gemworks", "flows"), { recursive: true });
  const bugfix = readFileSync(new URL("../flows/starter/bugfix.geml", import.meta.url), "utf8");
  writeFileSync(join(root, ".gemworks", "flows", "bugfix.geml"), bugfix.replace('"title": "复现"', '"title": "先复现"'));
  const own = join(root, ".geml", "coach");
  mkdirSync(join(own, "broken.geml"), { recursive: true });
  writeFileSync(join(own, "feature.geml"), readFileSync(new URL("../flows/starter/feature.geml", import.meta.url), "utf8"));
  assert.deepEqual(coachFlowsAt(root, none).map((f) => f.name), ["feature", "bugfix"]);
  assert.equal(coachFlowsAt(root).find((f) => f.name === "bugfix").states[0].title, "先复现", "the team's copy in the shipped one's place");
});

test("work: an empty report records nothing; a bad item beside a good one is left out by name; a finished item is said done", () => {
  const root = gitRepo();
  assert.deepEqual(recordWork(root, "codex", "cx1", { items: [] }, AT), { ok: false, text: "Nothing recorded: items is a list of work items." });
  const mixed = recordWork(root, "codex", "cx1", { items: [{ title: "看板", flow: "feature" }, { title: "x", flow: "nope" }] }, AT);
  assert.equal(mixed.ok, true, mixed.text);
  assert.match(mixed.text, /^Recorded #\S+ «看板» \(feature: mockup\)\. Left out: item 2: flow must be one of design, feature/);
  const [item] = workItemsAt(root, coachFlowsAt(root));
  const done = recordWork(root, "codex", "cx1", { items: [{ id: item.id, flow: "feature", status: "done" }] }, "2026-11-09T08:05:00.000Z");
  assert.equal(done.text, `Recorded #${item.id} «看板» (feature: mockup, done).`);
});

test("practice: a call with no list records nothing; one moved in from memory is marked so, and the project's memory with it", () => {
  const root = gitRepo();
  assert.deepEqual(recordPractices(root, "dsh", "s1", { practices: "样稿先画" }, AT), { ok: false, text: "Nothing recorded: practices is a list." });
  const moved = recordPractices(root, "dsh", "s1", { memory: true, practices: [{ flow: "feature", step: "mockup", text: "样稿先画最简单的一版", layer: "project" }] }, AT);
  assert.equal(moved.ok, true, moved.text);
  const read = readPractices(root);
  assert.deepEqual(read.practices.filter((p) => p.layer === "project").map((p) => [p.text, p.by]), [["样稿先画最简单的一版", "memory"]]);
  assert.equal(read.memoryMoved, true);
});

test("propose: a call with no list records nothing; a bad proposal beside a good one is left out by name", () => {
  const root = gitRepo();
  assert.deepEqual(recordProposals(root, { proposals: "加一步" }, AT), { ok: false, text: "Nothing recorded: proposals is a list." });
  const r = recordProposals(root, { proposals: [{ kind: "add-step", flow: "feature", after: "mockup", title: "评审样稿", why: "样稿改了三遍" }, { kind: "rename" }] }, AT);
  assert.equal(r.ok, true, r.text);
  assert.match(r.text, /^Proposed 1 \(q\S+\); the person answers in the conversation\. Left out: proposal 2: kind must be add-step or new-flow\.$/);
});

test("answer: yes is true or false; a yes to a new step changes the flow as the project's own; a no declines one and leaves the other as it was", () => {
  const root = gitRepo();
  recordProposals(root, { proposals: [
    { kind: "add-step", flow: "feature", after: "mockup", title: "评审样稿", judge: "you", why: "样稿改了三遍" },
    { kind: "add-step", flow: "bugfix", after: "fix", title: "回归", why: "修了又坏" },
  ] }, AT);
  const [step, other] = proposalsAt(root);
  assert.deepEqual(answerProposal(root, { proposal: step.id, said: "加上" }), { ok: false, text: "Nothing done: yes is true or false." });
  assert.match(answerProposal(root, { proposal: 7, yes: true, said: "加上" }).text, /^Nothing done: no open proposal  \(open: /, "a proposal named by no string is none");
  assert.deepEqual(answerProposal(root, { proposal: `#${step.id}`, yes: true, said: "加上评审样稿" }), { ok: true, text: `Accepted ${step.id}: the flow feature is changed.` });
  assert.deepEqual(coachFlowsAt(root).find((f) => f.name === "feature").states.slice(0, 2).map((s) => s.title), ["样稿", "评审样稿"]);
  assert.deepEqual(answerProposal(root, { proposal: other.id, yes: false, said: "不用" }), { ok: true, text: `Declined ${other.id}; it is not proposed again.` });
  assert.deepEqual(proposalsAt(root).map((p) => [p.id, p.status]), [[step.id, "accepted"], [other.id, "declined"]]);
});

test("answer: a yes to a step of a flow the project no longer has changes nothing and leaves the proposal open", () => {
  const root = gitRepo();
  const own = join(gemlHome(root), "coach");
  mkdirSync(own, { recursive: true });
  writeFileSync(join(own, "writing.geml"), readFileSync(new URL("../flows/starter/feature.geml", import.meta.url), "utf8").replace(/^title\s*=.*$/m, 'title = "写文章"'));
  assert.equal(recordProposals(root, { proposals: [{ kind: "add-step", flow: "writing", after: "mockup", title: "列提纲", why: "x" }] }, AT).ok, true);
  const [p] = proposalsAt(root);
  rmSync(join(own, "writing.geml"));
  assert.deepEqual(answerProposal(root, { proposal: p.id, yes: true, said: "加上" }), { ok: false, text: "Nothing done: there is no flow writing to change." });
  assert.equal(proposalsAt(root)[0].status, "open");
});

test("ask: a question for no work item is kept without one", () => {
  const root = gitRepo();
  recordPrompt(root, "antigravity", "c1", "怎么做", AT);
  assert.equal(recordAsk(root, "antigravity", "c1", { question: "先做哪个？", options: ["看板", "页签"] }, AT).ok, true);
  const ask = events(root, "antigravity", "c1").find((e) => e.t === "ask");
  assert.deepEqual([ask.question, "item" in ask], ["先做哪个？", false]);
});

test("artifact: refused without a kind it knows or a where; recorded under this session's item with its name and version; a link that is no address is refused with why", async () => {
  const root = gitRepo();
  const refusal = { ok: false, text: "Nothing recorded: kind is link, image or file, and where is the address or the path." };
  assert.deepEqual(await recordArtifact(root, "cx1", { kind: "video", where: "a.mp4" }), refusal);
  assert.deepEqual(await recordArtifact(root, "cx1", { kind: "image", where: 7 }), refusal);
  recordWork(root, "codex", "cx1", { items: [{ title: "看板", flow: "feature" }] }, AT);
  const [item] = workItemsAt(root, coachFlowsAt(root));
  assert.deepEqual(await recordArtifact(root, "cx1", { kind: "link", where: " https://example.com/board ", name: "看板页", version: "v2" }), { ok: true, text: `Recorded the link under ${item.id}'s artifacts.` });
  writeFileSync(join(root, "shot.png"), "png");
  const file = await recordArtifact(root, "cx1", { kind: "image", where: "shot.png" });
  assert.equal(file.ok, true, file.text);
  assert.match(file.text, /^Recorded shot\.png /);
  const rows = readArtifactRows(dirname(gemlHome(root))).map((r) => [r.item, r.kind, r.name, r.version]);
  assert.deepEqual(rows[0], [item.id, "link", "看板页", "v2"]);
  assert.deepEqual(rows[1].slice(0, 3), [item.id, "image", "shot.png"]);
  assert.deepEqual(await recordArtifact(root, "cx1", { kind: "link", where: "ftp://example.com/x" }), { ok: false, text: "Nothing recorded: a link's where is its http(s) address" });
});

test("artifact: in a project that runs a workflow, recorded under the workflow's current work item", async () => {
  const root = gitRepo();
  const dir = join(root, ".geml", "workflows", "refund");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "flow.geml"), readFileSync(new URL("./fixtures/refund.geml", import.meta.url), "utf8"));
  writeFileSync(join(dir, "tools.geml"), readFileSync(new URL("./fixtures/refund-tools.geml", import.meta.url), "utf8"));
  assert.deepEqual(await recordArtifact(root, "no-item", { kind: "link", where: "https://example.com/spec" }), { ok: true, text: "Recorded the link under feat/x's artifacts." });
});

test("the loop's tools called by name answer as the functions do; a record that cannot be written is answered with why, never thrown", async () => {
  const root = gitRepo();
  assert.deepEqual(await callLoopTool(root, "codex", "cx1", "practice", {}, AT), { ok: false, text: "Nothing recorded: practices is a list." });
  assert.deepEqual(await callLoopTool(root, "codex", "cx1", "propose", {}, AT), { ok: false, text: "Nothing recorded: proposals is a list." });
  assert.deepEqual(await callLoopTool(root, "codex", "cx1", "answer", { proposal: "q1", said: "好" }), { ok: false, text: "Nothing done: yes is true or false." });
  mkdirSync(join(gemlHome(root), "proposals.geml"), { recursive: true });
  const r = await callLoopTool(root, "codex", "cx1", "propose", { proposals: [{ kind: "add-step", flow: "feature", after: "mockup", title: "评审样稿", why: "x" }] }, AT);
  assert.equal(r.ok, false);
  assert.match(r.text, /^gemworks: E[A-Z]+: /);
});

test("a rule of the light flows holds a call on a Node host, workflow or none: its key matched while the step it requires is unmet on the session's work item; a project rule counts what it held", async () => {
  const { ruleHold } = await import("../dist/loop.js");
  const { CLAUDE_CODE_TOOLS, CODEX_TOOLS, PI_TOOLS } = await import("../dist/core/host-tools.js");
  const { parseRules, RULES_FILE_HELD } = await import("../dist/core/growth.js");
  const { HELD, ruledProject } = await import("./helpers/rules.mjs");
  const root = gitRepo();
  assert.equal(ruleHold(root, "s1", "Bash", { command: "npm publish" }), undefined, "no rules: nothing holds");
  const file = ruledProject(root, "s1");
  assert.match(ruleHold(root, "s1", "Bash", { command: "npm test && npm publish --dry-run" }) ?? "", HELD);
  assert.match(ruleHold(root, "s1", "bash", { command: "npm publish" }, PI_TOOLS) ?? "", HELD, "a host's shell is read as Bash");
  assert.equal(parseRules(readFileSync(file, "utf8"), "project")[0].held, 2, "each hold counted in the project's rules");
  assert.equal(ruleHold(root, "s1", "Bash", { command: "npm test" }), undefined, "a call the rule's key does not match");
  assert.equal(ruleHold(root, "s2", "Bash", { command: "npm publish" }), undefined, "a session with no work item of its own");
  assert.equal(ruleHold(root, "s1", "Bash", { command: "npm publish" }, CLAUDE_CODE_TOOLS), ruleHold(root, "s1", "Bash", { command: "npm publish" }));
  // The rules files are the person's: a write to one is refused whoever writes, item or none.
  assert.equal(ruleHold(root, "s2", "Write", { file_path: join(root, ".geml", "rules.geml") }), RULES_FILE_HELD);
  assert.equal(ruleHold(root, "s2", "apply_patch", { files: ["src/a.ts", ".gemworks/rules.geml"] }, CODEX_TOOLS), RULES_FILE_HELD);
  assert.equal(ruleHold(root, "s2", "edit", { path: ".gemworks/rules.geml" }, PI_TOOLS), RULES_FILE_HELD);
  assert.equal(ruleHold(root, "s1", "Read", { file_path: join(root, ".geml", "rules.geml") }), undefined, "reading one is no write");
  // A write's key is the host's write tool under Claude Code's name, with each path it writes.
  const other = gitRepo();
  ruledProject(other, "s1", "Write(dist/*)");
  assert.match(ruleHold(other, "s1", "write", { path: "dist/a.js" }, PI_TOOLS) ?? "", HELD);
  assert.equal(ruleHold(other, "s1", "edit", { path: "dist/a.js" }, PI_TOOLS), undefined, "an edit is Edit, not Write");
  const patched = gitRepo();
  ruledProject(patched, "s1", "Edit(dist/*)");
  assert.match(ruleHold(patched, "s1", "apply_patch", { files: ["src/a.ts", "dist/a.js"] }, CODEX_TOOLS) ?? "", HELD, "a patch: one key for each file");
  assert.equal(ruleHold(patched, "s1", "apply_patch", { files: ["src/a.ts"] }, CODEX_TOOLS), undefined);
});

test("a team rule holds as well and is not rewritten; once the step it requires is met, the call goes through", async () => {
  const { ruleHold } = await import("../dist/loop.js");
  const { rulesText } = await import("../dist/core/growth.js");
  const { HELD, RULE_TEXT } = await import("./helpers/rules.mjs");
  const root = gitRepo();
  assert.equal(recordWork(root, "test", "s1", { items: [{ title: "发布", flow: "feature" }] }).ok, true);
  const team = join(root, ".gemworks", "rules.geml");
  mkdirSync(dirname(team), { recursive: true });
  const text = rulesText([{ id: "t1", flow: "*", requires: "verify", key: "Bash(npm publish*)", text: RULE_TEXT, why: "", at: AT, layer: "team" }]);
  writeFileSync(team, text, "utf8");
  assert.match(ruleHold(root, "s1", "Bash", { command: "npm publish" }) ?? "", HELD);
  assert.equal(readFileSync(team, "utf8"), text, "the team's file is the repository's: not counted in");
  const items = workItemsAt(root, coachFlowsAt(root));
  assert.equal(recordWork(root, "test", "s1", { items: [{ id: items[0].id, title: "发布", flow: "feature", met: ["mockup", "build", "verify"], said: "好了", evidence: "`npm test` exit 0" }] }).ok, true);
  assert.equal(ruleHold(root, "s1", "Bash", { command: "npm publish" }), undefined);
});
