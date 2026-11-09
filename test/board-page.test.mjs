// The GEML board (src/core/board-page.ts, src/board-file.ts): the workbench on a host with no panel of its own, as one
// GEML page — what waits on the person, the work items and their step's practices, their artifacts, the flows, the
// other sessions' decisions — written into the main working tree's .geml/board.geml.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "@geml/geml";
import { boardPage, literal } from "../dist/core/board-page.js";
import { boardPath, boardText, writeBoard } from "../dist/board-file.js";
import { coachFlowsAt, recordAsk, recordProposals, recordWork, workItemsAt } from "../dist/loop.js";
import { recordDecisions, recordPrompt } from "../dist/session-store.js";
import { gitRepo } from "./helpers/repo.mjs";

const HOME = mkdtempSync(join(tmpdir(), "gemworks-board-home-"));
process.env.HOME = HOME;
process.env.USERPROFILE = HOME;

const AT = "2026-11-09T08:00:00.000Z";
const errorsOf = (text) => (parse(text).diagnostics ?? []).filter((d) => d.severity === "error");
const fixed = { clock: () => "16:00", hostName: (h) => (h === "claude-code" ? "Claude" : h), linkOf: () => undefined };

test("an empty project's board: every part says there is nothing, and it parses with no error", () => {
  const root = gitRepo();
  const flows = coachFlowsAt(root);
  const page = boardPage({ project: "p", updated: "2026-11-09 16:00", flows, items: [], asks: [], proposals: [], practices: [], artifacts: [], decisions: [], ...fixed });
  for (const words of ["没有要你定的事。", "没有进行中的工作项。", "还没有产物。", "没有工作项在流程上。", "还没有。"]) assert.ok(page.includes(words), words);
  assert.deepEqual(errorsOf(page), []);
});

test("what waits on the person: the question with what to say, the step they judge, the proposal; the items with their steps, the step's practices, the flow's picture", () => {
  const root = gitRepo();
  recordPrompt(root, "codex", "cx1", "做个看板", AT);
  recordWork(root, "codex", "cx1", { items: [{ title: "看板 | *粗* [x]", flow: "feature", needs: "你看样稿", next: "等你定" }] }, AT);
  const flows = coachFlowsAt(root);
  const [item] = workItemsAt(root, flows);
  recordAsk(root, "codex", "cx1", { question: "用哪个？", options: ["网页", "GEML 页面"], recommended: "GEML 页面", item: item.id }, AT);
  const step = { title: "定位项目", need: "已确认", judge: "you", prevents: "找错" };
  recordProposals(root, { proposals: [{ kind: "new-flow", name: "spec", title: "写规范", steps: [step], why: "近 7 天纠正 10 次" }] }, AT);
  recordDecisions(root, "claude-code", "other", ["看板用 GEML 页面"], new Date().toISOString());
  const practices = [{ id: "p1", flow: "feature", step: "mockup", text: "样稿先画最简单的一版", why: "", at: AT, by: "model", layer: "project" }];
  const page = boardText(root).replace(/^updated = .*$/m, "");
  assert.deepEqual(errorsOf(page), [], "the page parses with no error, whatever the titles hold");
  const t = `\\#${item.id} ${literal("看板 | *粗* [x]")}`;
  assert.ok(page.includes(`| ${t} | 用哪个？ | 「GEML 页面」或「网页」 |`), "the question, its recommended answer first");
  assert.ok(page.includes(`| ${t} | 样稿：你看过说行 | 「行」或「要改」 |`), "the step the person judges, what it needs, and the step's own answers to say");
  assert.match(page, /\| 提议 \S+ \| 新的一类活「写规范」：定位项目（近 7 天纠正 10 次） \| 「加上写规范」或「不用写规范」 \|/);
  assert.ok(page.includes(`| ${t} | 新功能 | **样稿** → 实现 → 验证 → 你确认 | 你看样稿 | 等你定 |`));
  assert.match(page, /=== diagram \{#flow-feature format=mermaid caption="新功能：#\S+ 在样稿"\}/);
  assert.match(page, /s0\["样稿 · 你判"\]:::here --> s1\["实现 · 模型判"\]/);
  assert.match(page, /- 看板用 GEML 页面（Claude，\d\d:\d\d）/);
  const withPractice = boardPage({ project: "p", updated: "", flows, items: workItemsAt(root, flows), asks: [], proposals: [], practices, artifacts: [], decisions: [], ...fixed });
  assert.match(withPractice, /## 这一步的做法 \{#practices\}\n\n\\#\S+ .* 在「样稿」：\n\n1\. 样稿先画最简单的一版/);
});

test("artifacts: a file named by its file's name, linked by a file: URL that GEML does not check; at most five an item", () => {
  const root = gitRepo();
  recordWork(root, "codex", "cx1", { items: [{ title: "看板", flow: "feature" }] }, AT);
  const flows = coachFlowsAt(root);
  const items = workItemsAt(root, flows);
  const rows = Array.from({ length: 7 }, (_, n) => ({ item: items[0].id, kind: "file", name: `C:/far/away/out${n}.txt`, where: `artifacts/${n}.txt`, version: "1", size: 1, at: `2026-11-09T08:0${n}:00.000Z`, sha256: "" }));
  const page = boardPage({ project: "p", updated: "", flows, items, asks: [], proposals: [], practices: [], artifacts: rows, decisions: [], ...fixed, linkOf: (r) => `file:///C:/p/.geml/${r.where}` });
  assert.match(page, /\| \[out6\.txt\]\(file:\/\/\/C:\/p\/\.geml\/artifacts\/6\.txt\) \| 1 \| 16:00 \|/);
  assert.equal((page.match(/\]\(file:/g) ?? []).length, 5);
  assert.deepEqual(errorsOf(page), []);
});

test("written into the main working tree's .geml, from a worktree too, and not again when only its time would change", () => {
  const main = gitRepo("main");
  const wt = join(mkdtempSync(join(tmpdir(), "gemworks-board-wt-")), "wt");
  assert.equal(spawnSync("git", ["-C", main, "worktree", "add", "-q", "-b", "feat/b", wt]).status, 0);
  recordWork(wt, "codex", "cx1", { items: [{ title: "看板", flow: "feature" }] }, AT);
  const path = writeBoard(wt, new Date("2026-11-09T08:00:00Z"));
  assert.equal(path, boardPath(main));
  assert.ok(readFileSync(path, "utf8").includes("看板"));
  writeFileSync(path, readFileSync(path, "utf8").replace(/^updated = .*$/m, 'updated = "kept"'));
  const before = statSync(path).mtimeMs;
  writeBoard(wt, new Date("2026-11-09T09:00:00Z"));
  assert.ok(readFileSync(path, "utf8").includes('updated = "kept"'), "nothing new to show: the file stays");
  assert.equal(statSync(path).mtimeMs, before);
  recordWork(wt, "codex", "cx1", { items: [{ title: "另一件", flow: "bugfix" }] }, AT);
  writeBoard(wt);
  assert.ok(readFileSync(path, "utf8").includes("另一件"), "something new: written again");
});
