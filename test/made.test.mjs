// The 产物 tab (made.ts): every artifact the project's work made, whichever work item made it and whether that item
// has ended; a work item's row on the work items tab presses through to its own.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MADE_MOST, MADE_PAGE, MADE_VIEW, madePress, madeTabRows } from "../dist/hosts/claude-code/made.js";
import { COACH_FLOWS, readCoachFlow, workRows } from "../dist/hosts/claude-code/coach.js";
import { paneRows } from "../dist/hosts/claude-code/board.js";
import { wordsFor } from "../dist/hosts/claude-code/text.js";

const t = wordsFor("zh");
const flows = COACH_FLOWS.map((name) => readCoachFlow(name, readFileSync(new URL(`../coach/${name}.geml`, import.meta.url), "utf8")));
const entry = (over) => ({ item: "a1", kind: "file", name: ".geml/design/x.html", open: "/p/.geml/design/x.html", versions: 1, version: "1", at: "2026-10-29T10:00:00.000Z", ...over });
const item = (over) => ({ id: "a1", flow: "bugfix", title: "产物看不到了", state: "confirm", needs: "", goal: "", status: "open", at: "2026-10-29T09:00:00Z", session: "s1", met: [], next: "", ...over });
const none = () => undefined;
const NOW = "2026-10-29T12:00:00.000Z";

test("the 产物 tab: a press per kind that has some, by day newest first, each saying the work item it came from — ✓ when it has ended — or that it came before work items; the documents in git only on their own press", () => {
  const all = { entries: [
    entry({ item: "a1", name: ".geml/design/x.html", versions: 2, at: "2026-10-29T10:00:00.000Z" }),
    entry({ item: "d9", kind: "link", name: "样稿", open: "https://claude.ai/artifact/X", version: "8", at: "2026-10-29T08:00:00.000Z" }),
    entry({ item: "main", kind: "doc", name: "README.md", open: "/p/README.md", versions: 4, at: "2026-10-26T11:14:00.000Z" }),
  ] };
  const words = (id) => ({ a1: "产物看不到了", d9: "✓ 好，做吧没反应" })[id];
  const rows = madeTabRows(all, MADE_VIEW, words, t, NOW);
  assert.equal(rows[0].kind, "buttons", "the list at once: nothing folded, nothing to press first");
  assert.deepEqual(rows[0].items.map((b) => [b.label, b.primary === true]), [["全部 2", true], ["文件 1", false], ["链接 1", false], ["文档 1", false]], "全部 leaves the documents in git out; no press for a kind with none");
  assert.deepEqual(rows.filter((r) => r.kind === "text").map((r) => r.text), ["今天"]);
  const entries = rows.filter((r) => r.kind === "entry");
  assert.deepEqual(entries.map((r) => [r.title, r.tag, r.detail.split(" · ")[0]]), [["x.html", "文件", "产物看不到了"], ["样稿", "", "✓ 好，做吧没反应"]]);
  assert.match(entries[0].detail, / · 2 版 · /);
  assert.deepEqual(entries[0].action, { op: "open-file", path: "/p/.geml/design/x.html" }, "a file opens on a press on its row");
  assert.deepEqual(entries[1].link, { href: "https://claude.ai/artifact/X", label: "链接 ↗" }, "a link opens its address");
  const docs = madeTabRows(all, { ...MADE_VIEW, kind: "doc" }, words, t, NOW);
  const doc = docs.filter((r) => r.kind === "entry");
  assert.deepEqual(doc.map((r) => [r.title, r.tag, r.detail.split(" · ")[0]]), [["README.md", "文档", "工作项之前"]], "the documents on their own press");
  assert.match(doc[0].detail, / · 4 次提交 · /);
  assert.deepEqual(docs.filter((r) => r.kind === "text").map((r) => r.text), ["10 月 26 日"]);
  assert.equal(docs[0].items.find((b) => b.primary).label, "文档 1");
});

test("nothing but documents in git: the 产物 tab lists those rather than nothing, and a work item's 产物 n counts them", () => {
  const all = { entries: [entry({ kind: "doc", name: "README.md" }), entry({ kind: "doc", name: "a.md" })] };
  const rows = madeTabRows(all, MADE_VIEW, none, t, NOW);
  assert.deepEqual(rows[0].items.map((b) => [b.label, b.primary === true]), [["文档 2", true]]);
  assert.equal(rows.filter((r) => r.kind === "entry").length, 2);
  assert.equal(madePress(all.entries, "a1", t).label, "产物 2 ›");
  assert.equal(madePress([...all.entries, entry({ name: "x.html" })], "a1", t).label, "产物 1 ›", "with something else, the documents are left out of the count as of the list");
});

test("the 产物 tab before the list was read says so; with none made, says that", () => {
  assert.deepEqual(madeTabRows(null, MADE_VIEW, none, t, NOW), [{ kind: "text", text: "正在读取产物…", tone: "dim" }]);
  assert.deepEqual(madeTabRows({ entries: [] }, MADE_VIEW, none, t, NOW), [{ kind: "text", text: "还没有产物", tone: "dim" }]);
});

test("one work item's artifacts alone: which, the press back to every one's, and no item named on each", () => {
  const all = { entries: [entry({ item: "a1", name: "a.html" }), entry({ item: "b2", name: "b.html" })] };
  const rows = madeTabRows(all, { ...MADE_VIEW, item: "a1" }, (id) => ({ a1: "产物看不到了" })[id], t, NOW);
  assert.deepEqual([rows[0].title, rows[0].extra], ["只看：产物看不到了", { key: "made-only-all", label: "×", action: { op: "made-item", id: null } }]);
  const entries = rows.filter((r) => r.kind === "entry" && r.key !== "made-only");
  assert.deepEqual(entries.map((r) => r.title), ["a.html"]);
  assert.doesNotMatch(entries[0].detail, /产物看不到了/, "the item is said once, above");
  assert.equal(rows.find((r) => r.kind === "buttons").items[0].label, "全部 1", "the counts are that item's");
});

test("the 产物 tab lists a page at a time, and never more than MADE_MOST at once: older pages fold the newest away, and a press goes back", () => {
  const all = { entries: Array.from({ length: 104 }, (_, n) => entry({ name: `f${n}.html`, at: new Date(Date.parse(NOW) - n * 60000).toISOString() })) };
  const first = madeTabRows(all, MADE_VIEW, none, t, NOW);
  assert.equal(first.filter((r) => r.kind === "entry").length, MADE_PAGE);
  assert.deepEqual(first.at(-1), { kind: "button", key: "made-more", label: "再看 20 件（共 104）", action: { op: "made-more" } });
  const deep = madeTabRows(all, { ...MADE_VIEW, shown: 100 }, none, t, NOW);
  const listed = deep.filter((r) => r.kind === "entry");
  assert.equal(listed.length, MADE_MOST);
  assert.deepEqual([listed[0].title, listed.at(-1).title], ["f40.html", "f99.html"], "the window ends at the page asked for");
  assert.deepEqual(deep.find((r) => r.key === "made-newest"), { kind: "button", key: "made-newest", label: "较新的 40 件已收起 · 回到最新", action: { op: "made-kind", kind: "all" } });
  assert.equal(deep.at(-1).label, "再看 4 件（共 104）");
  assert.equal(madeTabRows(all, { ...MADE_VIEW, shown: 120 }, none, t, NOW).some((r) => r.key === "made-more"), false, "all listed: no press");
});

test("a work item's row presses through to what it made (产物 n ›): the 产物 tab with its own alone; none made, no press", () => {
  const made = [entry({}), entry({ name: "b.html" }), entry({ item: "other" })];
  assert.deepEqual(madePress(made, "a1", t), { key: "work-made-a1", label: "产物 2 ›", action: { op: "made-item", id: "a1" } });
  assert.equal(madePress(made, "z", t), undefined);
  assert.deepEqual(workRows([item({})], flows, t, { made }).find((r) => r.kind === "work").made, madePress(made, "a1", t));
  assert.equal(workRows([item({ id: "z" })], flows, t, { made }).find((r) => r.kind === "work").made, undefined);
});

test("the board: the work items tab carries each row's press and no list; the 产物 tab keeps an ended work item's artifacts, its title marked ✓", () => {
  const madeAll = { entries: [entry({ item: "a1" }), entry({ item: "main", name: "old.html" })] };
  const base = { board: null, problem: null, shell: null, columns: 80, maxRows: 40, t, now: NOW, root: "/p", inbox: [], filter: "all", expanded: null, evidence: null, prompts: [], doneOpen: false, sessionRuns: [], flowState: null, switching: false, workflows: null, usage: null, dismissed: [], toolQuery: "", toolMenu: null, toolNaming: null, toolsOpen: [], madeAll, madeView: MADE_VIEW };
  const open = paneRows({ ...base, tab: "items", coach: { items: [item({})], flows, focus: null } });
  assert.equal(open.find((r) => r.kind === "work").made.label, "产物 1 ›");
  assert.equal(open.some((r) => r.kind === "entry" && r.key.startsWith("made-")), false, "the work items tab lists none of them");
  const ended = paneRows({ ...base, tab: "made", coach: { items: [item({ status: "done" })], flows, focus: null } });
  assert.deepEqual(ended.filter((r) => r.kind === "entry").map((r) => r.detail.split(" · ")[0]), ["✓ 产物看不到了", "工作项之前"]);
});
