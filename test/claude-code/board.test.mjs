import { test } from "node:test";
import assert from "node:assert/strict";
import { cellWidth } from "../../dist/hosts/claude-code/band.js";
import { stepsOf, BOARD_ID, DIALOG_ID, HOME_TAB, ICON_CHAR, ICON_SVG, TAB_IDS, entryDetail, entryWords, flowRows, heldRows, inputAction, itemRows, journalRows, paneRows, projectPath, artifactsTag, rowFor, sessionRows, sourceWords, tabs, toolRows, toolSuggestions } from "../../dist/hosts/claude-code/board.js";
import { wordsFor } from "../../dist/hosts/claude-code/text.js";
import { artifactRows, decisionRows, hostName, lastSegment, memoryRows, othersRows, sessionLabel, sizeText } from "../../dist/hosts/claude-code/board.js";
import { COACH_FLOWS, readCoachFlow } from "../../dist/hosts/claude-code/coach.js";
import { readFileSync } from "node:fs";

const row = (tool, over = {}) => ({ tool, allow: [], deny: [], default: false, row: 0, ...over });
const ROWS = [
  row("Read", { allow: ["*"], row: 1 }),
  row("Edit", { for: "edit", default: true, row: 2 }),
  row("Bash(npm test)", { for: "test", default: true, row: 3 }),
  row("Bash(wrangler deploy)", { for: "deploy-prod", default: true, row: 4 }),
  row("WebFetch", { allow: ["build"], deny: ["review"], row: 5 }),
  row("mcp__img__*", { for: "image", default: true, params: { ratio: "9:16" }, row: 6 }),
  row("TodoWrite", { allow: ["build"], row: 7 }),
];
const NOW = "2026-10-12T09:10:00Z";
const BOARD = {
  unit: "branch",
  states: [
    { id: "build", title: "构建", description: "写代码和测试，直到测试通过。", initial: true, final: false, uses: ["edit", "test"] },
    { id: "review", title: "review", description: "", initial: false, final: false, uses: ["edit"] },
    { id: "deploy", title: "deploy", description: "", initial: false, final: false, uses: ["deploy-prod"] },
    { id: "done", title: "done", description: "", initial: false, final: true, uses: [] },
  ],
  transitions: [
    { name: "build→review", from: "build", to: "review", judge: "machine", approval: false, guard: "ready = true", note: "" },
    { name: "review→deploy", from: "review", to: "deploy", judge: "machine", approval: false, guard: "pr-merged = true and ci-pass = true", note: "" },
    { name: "review→build", from: "review", to: "build", judge: "model", approval: false, guard: "review 要求改动", note: "" },
    { name: "deploy→done", from: "deploy", to: "done", judge: "machine", approval: true, guard: "deployed = true", note: "" },
  ],
  fences: [{ use: "edit", states: ["build", "review"] }, { use: "test", states: ["build"] }, { use: "deploy-prod", states: ["deploy"] }, { use: "image", states: [] }],
  tools: ROWS,
  backlog: { key: "branch", items: [
    { id: "rate-limit", title: "登录接口加限流", target: "feat/rate-limit" },
    { id: "dark-mode", title: "设置页支持深色模式和高对比度主题", target: "" },
  ] },
  items: [{ id: "feat/rate-limit", state: "review", rev: 7, at: "2026-10-12T08:00:00Z", paused: false }, { id: "feat/x", state: "review", rev: 3, at: "2026-10-12T09:04:00Z", paused: false }],
  timeline: [
    { kind: "snapshot", rev: 0, at: "2026-10-12T09:00:00Z", state: "build", cause: "enter", changed: { "tests-pass": false, "pr-open": false } },
    { kind: "snapshot", rev: 1, at: "2026-10-12T09:01:02Z", state: "build", cause: "patch", by: "signal", signal: "tests-pass", call: "c7", tree: "tree:a1b2c3f", changed: { "tests-pass": true } },
    { kind: "refused", n: 1, rev: 1, at: "2026-10-12T09:03:00Z", tool: "Bash", reason: "`gemworks mark reviewed` is for a person", call: "c8" },
    { kind: "snapshot", rev: 3, at: "2026-10-12T09:04:00Z", state: "review", cause: "transition", by: "signal", signal: "pr-open", from: "build", changed: { "pr-open": true } },
  ],
  clocks: [{ name: "review-waited", iso: "PT2H", ms: 7_200_000 }],
  tree: "tree:a1b2c3f",
  picture: {
    flow: {
      ranks: [["build"], ["review"], ["deploy"], ["done"]],
      edges: [
        { name: "build→review", from: "build", to: "review", kind: "forward", label: "ready", sentence: false, marks: [] },
        { name: "review→deploy", from: "review", to: "deploy", kind: "forward", label: "ci-pass, pr-merged", sentence: false, marks: [] },
        { name: "review→build", from: "review", to: "build", kind: "lane", label: "review 要求改动", sentence: true, marks: [] },
        { name: "deploy→done", from: "deploy", to: "done", kind: "forward", label: "deployed", sentence: false, marks: ["approval"] },
      ],
    },
    overlay: { current: "review", holds: { "review→deploy": false }, counts: { review: 2 }, taken: ["build→review"], pressable: ["review→build"] },
    svg: "<svg/>",
  },
};
const next = (over) => ({ judge: "machine", approval: false, reads: [], missing: [], holds: true, note: "", ...over });
const status = (item = { kind: "item", id: "feat/x" }, over = {}) => ({
  workflow: { name: "dev", path: ".geml/workflows/dev/flow.geml", title: "开发流程" }, item,
  state: { id: "review", title: "review", rev: 3, uses: ["edit"], final: false, since: "2026-10-12T09:04:00Z" },
  vars: { "review-done": false, "pr-merged": false, "ci-pass": false },
  sources: { "review-done": "human", "pr-merged": "git:pr-merged", "ci-pass": "git:ci-success" },
  next: [
    next({ name: "review→deploy", to: "deploy", guard: "pr-merged = true and ci-pass = true", reads: ["pr-merged", "ci-pass"], missing: ["pr-merged", "ci-pass"], holds: false }),
    next({ name: "review→build", to: "build", judge: "model", guard: "review 要求改动" }),
  ],
  refusals: 1, paused: false, gh: { available: true }, ...over,
});
const shell = (st) => ({ status: st, policy: { relevant: ["pr-merged", "ci-pass"] }, contextKey: "feat/x@3" });
const buttons = (rows) => rows.flatMap((r) => (r.kind === "button" ? [r] : r.kind === "buttons" ? r.items : []));
const widths = (rows) => rows.filter((r) => r.kind === "text" || r.kind === "button").map((r) => cellWidth(r.kind === "text" ? r.text : r.label));
const pane = (over = {}) => paneRows({
  board: BOARD, problem: null, shell: shell(status()), tab: "flow", columns: 100, maxRows: 20, t: wordsFor("zh"), now: NOW, root: "/w/app",
  inbox: [], filter: "all", expanded: null, evidence: null, prompts: [], menu: null, sessionItem: null, sessionRuns: [], doneOpen: false, flowState: null, switching: false, workflows: null,
  usage: {}, dismissed: [], toolQuery: "", toolMenu: null, toolNaming: null, toolsOpen: [], ...over,
});
/** A work items tab's rows in a line each: a heading, a card, a list entry (→ when it can be pressed), a line, a button. */
const look = (rows) => rows.map((r) => r.kind === "section" ? `§ ${r.text}${r.count !== undefined ? ` ${r.count}` : ""}${r.fold !== undefined ? ` [${r.fold.label}]` : ""}`
  : r.kind === "card" ? `${r.icon} ${r.verb} ${r.title}${r.tag !== undefined ? ` (${r.tag})` : ""} | ${r.detail.join(" / ")} | ${r.actions.map((a) => a.label).join(" ")}`
  : r.kind === "entry" ? `${r.action !== undefined ? "→ " : ""}${r.title} (${r.tag})`
  : r.kind === "text" ? r.text : r.kind === "button" ? `[${r.label}]` : r.kind);
const flow = (over = {}) => flowRows({ board: BOARD, status: status(), columns: 100, t: wordsFor("zh"), now: NOW, selected: null, switching: false, workflows: null, ...over });
const pic = (rows) => rows.find((r) => r.kind === "flow");
const items = (over = {}) => itemRows({ board: BOARD, status: status(), inbox: [], columns: 80, t: wordsFor("zh"), now: NOW, doneOpen: false, ...over });

test("the board's id, the dialog's, and its five tabs in order, opening on the work items (spec §8.2)", () => {
  assert.equal(BOARD_ID, "gemworks-board");
  assert.equal(DIALOG_ID, "gemworks-dialog");
  assert.deepEqual(TAB_IDS, ["sessions", "items", "made", "flow", "tools"], "记录 is gone; 产物 has its own");
  assert.equal(HOME_TAB, "items");
  assert.deepEqual(tabs().map((x) => [x.id, x.label]), [["sessions", "会话"], ["items", "工作项"], ["made", "产物"], ["flow", "流程"], ["tools", "工具"]]);
  assert.deepEqual(tabs(wordsFor("en")).map((x) => x.label), ["Session", "Work items", "Artifacts", "Flow", "Tools"]);
});

test("流程: the flow by its title, the picture, a row of its states, and the one picked — its uses and their tools, what it may not use, what runs everywhere", () => {
  const rows = flow();
  const p = pic(rows);
  assert.equal(p.key, "flow-picture");
  assert.equal(p.svg, "<svg/>", "the markup travels for a host that inlines it");
  assert.deepEqual(p.ranks, [
    [{ id: "build", title: "构建", initial: true, final: false, current: false, count: 0, uses: ["edit", "test"] }],
    [{ id: "review", title: "review", initial: false, final: false, current: true, count: 2, uses: ["edit"] }],
    [{ id: "deploy", title: "deploy", initial: false, final: false, current: false, count: 0, uses: ["deploy-prod"] }],
    [{ id: "done", title: "done", initial: false, final: true, current: false, count: 0, uses: [] }],
  ], "the parser's ranks joined with the board's words; two items in the current state are a badge, one would not be");
  assert.deepEqual(p.edges, [
    { name: "build→review", from: "build", to: "review", kind: "forward", back: false, text: "自动  要求 ready = true", approval: false, taken: true },
    { name: "review→deploy", from: "review", to: "deploy", kind: "forward", back: false, text: "自动  要求 pr-merged = true and ci-pass = true（未满足）", holds: false, approval: false, taken: false },
    { name: "review→build", from: "review", to: "build", kind: "lane", back: true, text: "手动  当 review 要求改动", approval: false, taken: false, press: { n: 1, action: { op: "advance", to: "build" } } },
    { name: "deploy→done", from: "deploy", to: "done", kind: "forward", back: false, text: "需批准  要求 deployed = true", approval: true, taken: false },
  ], "a way out whose condition does not hold is drawn, not offered: the advance would be refused");
  const look = (rs) => rs.map((r) => r.kind === "heading" ? `# ${r.text}${r.sub ? ` (${r.sub})` : ""}${r.action ? ` [${r.action.label}]` : ""}`
    : r.kind === "section" ? `§ ${r.text}` : r.kind === "entry" ? `${r.title} | ${r.tag}` : r.kind === "buttons" ? r.items.map((b) => `${b.label}${b.primary ? "*" : ""}`).join(" ")
    : r.kind === "text" ? r.text : r.kind);
  assert.deepEqual(look(rows), [
    "# 开发流程 (dev) [添加一类活 ▾]",
    "flow",
    "构建 review* deploy done",
    "# review (此刻在这里)",
    "§ 这里能用",
    "改文件 | Edit",
    "哪里都能用 | Read",
    "§ 这里不能用",
    "跑测试 | 只在构建",
    "部署到 production | 只在deploy",
    "出图 | 哪一格都没有",
    "WebFetch | 词典里拒绝",
    "没归类的工具哪里都照常能用。",
    "review-waited：停留满 PT2H  还有 1 小时 54 分",
  ], "the current state is picked at first; its clock, counted from its entry");
  assert.deepEqual(rows[2].items.map((b) => b.action), ["build", "review", "deploy", "done"].map((id) => ({ op: "flow-state", id })));
  assert.deepEqual(look(flow({ selected: "build" })).slice(2, 11), [
    "构建* review deploy done", "# 构建", "写代码和测试，直到测试通过。", "§ 这里能用", "改文件 | Edit", "跑测试 | npm test", "哪里都能用 | Read", "§ 这里不能用", "部署到 production | 只在deploy",
  ], "another state, picked: its description, its uses with the commands bound to them");
  assert.equal(rows[0].action.action.op, "flow-switch");
});

test("流程: switching — the installed workflows to use, the bundled ones to add, a path to import; the suggestions about the flow on top; a person's ticks on the current state", () => {
  const look = (rs) => rs.map((r) => r.kind === "buttons" ? r.items.map((b) => `${b.label}${b.primary ? "*" : ""}`).join(" ") : r.kind === "text" ? r.text : r.kind === "input" ? `[${r.placeholder}]` : r.kind === "heading" ? `# ${r.text} [${r.action?.label}]` : r.kind);
  assert.deepEqual(look(flow({ switching: true, workflows: { bundled: ["dev", "matter", "video"], installed: ["dev", "matter"] } })).slice(0, 4), [
    "# 开发流程 [收起]", "dev* matter 添加 video", "添加以后，新的工作项走它；已经开始的照旧。", "[导入：流程文件或目录的路径]",
  ]);
  const opened = flow({ switching: true, workflows: { bundled: ["dev", "matter"], installed: ["dev"] } })[1].items.map((b) => b.action);
  assert.deepEqual(opened, [{ op: "use", workflow: "dev" }, { op: "add", workflow: "matter" }]);
  assert.deepEqual(look(flow({ switching: true })).slice(1, 3), ["正在读取…", "[导入：流程文件或目录的路径]"], "the workflows not read yet");
  const board = { ...BOARD, items: [...BOARD.items, { id: ".geml/matters/mock", state: "deciding", rev: 2, at: NOW, paused: false, file: ".geml/matters/mock.geml", title: "开发流程在构建前加一格「样稿」", about: "flow", gist: "先给你看样子，点头再实现。", asks: [{ to: "doing", label: "按方案做", note: "", final: false }] }] };
  const card = flow({ board }).find((r) => r.kind === "card");
  assert.deepEqual([card.verb, card.title, card.tag, card.detail, card.actions.map((a) => a.label)], ["决定", "开发流程在构建前加一格「样稿」", "建议 · 流程", ["先给你看样子，点头再实现。"], ["按方案做"]]);
  const gate = status(undefined, { next: [next({ name: "review→done", to: "done", reads: ["review-done"], missing: ["review-done"], holds: false })] });
  const ticks = flow({ status: gate });
  const at = ticks.findIndex((r) => r.key === "ticks");
  assert.deepEqual([ticks[at].text, ticks[at + 1].items.map((b) => [b.label, b.action])], ["你来勾", [["[ ] review-done", { op: "mark", variable: "review-done", checked: true }]]]);
  assert.ok(!flow({ status: { ...gate, paused: true } }).some((r) => r.key === "ticks"), "a held work item takes no tick");
  assert.ok(flow({ status: gate, selected: "build" }).every((r) => r.key !== "ticks"), "ticks belong to the current state");
  assert.equal(projectPath("C:\\w\\app", ".geml/workflows/dev/flow.geml"), "C:/w/app/.geml/workflows/dev/flow.geml");
  assert.equal(projectPath("/w/app", "/Users/me/Downloads/session-abc.geml"), "/Users/me/Downloads/session-abc.geml", "a path outside the project is its own");
  assert.equal(projectPath("C:\\w\\app", "D:/out/s.geml"), "D:/out/s.geml");
});

test("the flow picture: held, or no item, nothing is pressable; the words follow the language; a state the board does not know is left out", () => {
  const held = pic(flow({ status: status(undefined, { paused: true }) }));
  assert.ok(held.edges.every((e) => e.press === undefined), "a person holds the work: no way out is offered");
  const none = pic(flow({ status: null }));
  assert.ok(none.ranks.flat().every((s) => !s.current) && none.edges.every((e) => e.press === undefined));
  assert.equal(pic(flow({ t: wordsFor("en") })).edges[2].text, "manual  when review 要求改动");
  const stray = { ...BOARD, picture: { ...BOARD.picture, flow: { ranks: [["build", "ghost"], ["review"], ["deploy"], ["done"]], edges: [...BOARD.picture.flow.edges, { name: "ghost→done", from: "ghost", to: "done", kind: "lane", label: "", sentence: false, marks: [] }] } } };
  const rows = pic(flow({ board: stray }));
  assert.deepEqual(rows.ranks[0].map((s) => s.id), ["build"]);
  assert.ok(!rows.edges.some((e) => e.name === "ghost→done"));
  assert.deepEqual(flow({ board: stray }).find((r) => r.kind === "buttons").items.map((b) => b.label), ["构建", "review", "deploy", "done"], "a state the board does not know has no button");
});

test("工作项: what waits on the person on top, one card each with its options; then the work items by where they ended up — being worked on, merged, closed and dropped counted and listed on a press; then the backlog", () => {
  const approve = { kind: "approve", key: "approve-review", verb: "决定", title: "feat/x", detail: ["review · pr-merged ✓"], since: "2026-10-12T08:58:00Z", actions: [{ key: "approve-deploy", label: "部署", primary: true, action: { op: "advance", to: "deploy", say: "部署：feat/x" } }] };
  const stuck = { kind: "stuck", key: "stuck-wrangler", verb: "被拦", title: "Bash(wrangler deploy)", detail: ["x"], actions: [] };
  const board = { ...BOARD, items: [
    { id: "feat/x", state: "review", rev: 3, at: "2026-10-12T09:04:00Z", paused: false },
    { id: ".geml/matters/pi", state: "build", rev: 2, at: "2026-10-12T08:30:00Z", paused: false, file: ".geml/matters/pi.geml", title: "pi 和 DSH 也记下写过的文件吗",
      asks: [{ to: "deploy", label: "直接做", note: "小事", final: false }, { to: "review", label: "先放着", note: "", final: false }] },
    { id: "feat/other", state: "deploy", rev: 9, at: "2026-10-12T08:20:00Z", paused: false, asks: [{ to: "done", label: "通过", note: "人验收通过。", final: true }] },
    { id: "feat/rate-limit", state: "review", rev: 7, at: "2026-10-12T08:00:00Z", paused: false },
    { id: ".geml/matters/old", state: "build", rev: 1, at: "2026-10-12T07:00:00Z", paused: true, file: ".geml/matters/old.geml", by: "model" },
    { id: "feat/shipped", state: "done", rev: 12, at: "2026-10-12T08:10:00Z", paused: false },
  ] };
  const rows = items({ board, inbox: [approve, stuck] });
  assert.deepEqual(look(rows), [
    "§ 待处理",
    "ask 决定 feat/x | review · pr-merged ✓ | 部署",
    "ask 决定 pi 和 DSH 也记下写过的文件吗 (构建) | 直接做：小事 | 直接做 先放着",
    "done 验收 feat/other (deploy) | 通过：人验收通过。 | ",
    "warn 被拦 Bash(wrangler deploy) | x | ",
    "§ 在做 2",
    "feat/rate-limit (review)",
    "→ .geml/matters/old (模型提出 · 构建 · 已暂停)",
    "§ 已合并 0",
    "§ 已收尾 1 [展开]",
    "§ 放下 0",
    "§ 待办与进行中",
    "  rate-limit  登录接口加限流 → feat/rate-limit · #review",
    "backlog 中 1 项未关联工作项",
    "[绑定 dark-mode（设置页支持深色模式和高对比度主题）到 feat/x]",
  ], "the current work item waits on the person, so it is a card and not in the queue; a work item with no file is shown without options");
  const pi = rows.find((r) => r.key === "asks-.geml/matters/pi");
  assert.deepEqual(pi.actions.map((a) => [a.key, a.primary ?? false, a.action]), [
    ["asks-.geml/matters/pi-deploy", true, { op: "advance", to: "deploy", file: ".geml/matters/pi.geml", say: "直接做：pi 和 DSH 也记下写过的文件吗" }],
    ["asks-.geml/matters/pi-review", false, { op: "advance", to: "review", file: ".geml/matters/pi.geml", say: "先放着：pi 和 DSH 也记下写过的文件吗" }],
  ], "another work item's option is taken on its file, and says what was chosen");
  assert.equal(rows.find((r) => r.key === "item-.geml/matters/old").action.op, "switch-file");
  assert.equal(rows.find((r) => r.key === "item-.geml/matters/old").tone, "warning");
  const open = items({ board, inbox: [approve, stuck], doneOpen: true });
  assert.deepEqual(look(open).slice(9, 11), ["§ 已收尾 1 [收起]", "feat/shipped (done)"]);
  assert.deepEqual(open.find((r) => r.kind === "section" && r.key === "done").fold.action, { op: "fold", what: "done", open: false });
  const working = look(items({ board, inbox: [stuck] }));
  assert.deepEqual(working.slice(4, 6), ["§ 在做 3", "feat/x (当前 · review)"], "nothing of the current work item waits on the person: it heads the queue, being worked on");
  const made = { ...board, artifacts: { item: "feat/x", written: [], commits: [{ sha: "053f317c9d0e1f2a", at: NOW, subject: "feat: band", files: [], ours: true }] } };
  assert.equal(look(items({ board: made, inbox: [approve] }))[1], "ask 决定 feat/x (053f317c) | review · pr-merged ✓ | 部署", "the work the current item made, as the tag of its card");
  assert.equal(look(items({ board: made, inbox: [] })).find((x) => x.startsWith("feat/x")), "feat/x (当前 · review · 053f317c)");
  assert.deepEqual(look(items({ board: { ...board, items: [], backlog: null }, status: null })), ["§ 待处理", "暂无", "§ 在做 0", "  没有", "§ 已合并 0", "§ 已收尾 0", "§ 放下 0"]);
  assert.deepEqual(look(items({ board: null, inbox: [stuck] })), ["§ 待处理", "warn 被拦 Bash(wrangler deploy) | x | "], "before the board is read, what waits on the person still shows");
  const accept = { ...approve, verb: "验收", closes: true };
  assert.equal(items({ board, inbox: [accept] })[1].icon, "done", "accepting the work has its own icon");
  const said = { ...board, items: board.items.map((i) => (i.id === "feat/x" ? { ...i, gist: "状态带加了看板按钮。" } : i)) };
  assert.deepEqual(items({ board: said, inbox: [approve] })[1].detail, ["状态带加了看板按钮。"], "the current work item's card says what it says of itself");
});

test("what the work made, in a word: its one commit, how many, or how many files it wrote", () => {
  const commit = (sha, ours = true) => ({ sha, at: NOW, subject: "s", files: [], ours });
  assert.equal(artifactsTag({ item: "x", written: [], commits: [commit("053f317c9d0e"), commit("1111111122", false)] }), "053f317c");
  assert.equal(artifactsTag({ item: "x", written: [], commits: [commit("a"), commit("b")] }, wordsFor("en")), "2 commits");
  assert.equal(artifactsTag({ item: "x", written: [{ path: "a", rev: 1, at: NOW, tool: "Edit" }], commits: [] }), "1 个文件");
  assert.equal(artifactsTag({ item: "x", written: [], commits: [] }), undefined);
  assert.equal(artifactsTag(undefined), undefined);
});

test("the icons: a line drawing each in its own colour, and a character for a surface without pictures", () => {
  for (const k of ["ask", "done", "warn"]) assert.match(ICON_SVG[k], /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 24 24"[^>]* stroke="#[0-9a-f]{6}"[^>]*><circle /);
  assert.deepEqual(ICON_CHAR, { ask: "?", done: "✓", warn: "!" });
});

test("工具: every tool by kind, with its use and how often it ran — the ones that ran first, nothing folded; a press opens its menu", () => {
  const usage = { "Bash(node --test)": 46, "Bash(git commit)": 18, "Bash(npm test)": 7, Edit: 139, "mcp__gemworks__*": 3, "mcp__visualize__*": 11 };
  const tools = (over = {}) => toolRows({ board: BOARD, columns: 100, t: wordsFor("zh"), usage, suggestions: [], query: "", menu: null, naming: null, open: [], ...over });
  const look = (rows) => rows.map((r) => r.kind === "tool" ? [r.name, r.use, r.guess, r.count].filter((x) => x !== "").join(" | ")
    : r.kind === "section" ? `§ ${r.text}` : r.kind === "button" ? `[${r.label}]` : r.kind === "buttons" ? r.items.map((b) => `${b.label}${b.primary ? "*" : ""}`).join(" ") : r.kind === "input" ? `[${r.placeholder}]` : r.text);
  assert.deepEqual(look(tools()), [
    "[找工具]",
    "§ 命令行",
    "node --test | 没归类 | 像跑测试？ | 46 次",
    "git commit | 没归类 | 18 次",
    "npm test | 跑测试（首选） | 7 次",
    "wrangler deploy | 部署到 production（首选） | 0",
    "§ 文件",
    "Edit | 改文件（首选） | 139 次",
    "Read | 哪里都能用 | 0",
    "§ MCP",
    "visualize | 没归类 | 11 次",
    "gemworks | gemworks 自己的 | 3 次",
    "img | 出图（首选） | 0",
    "§ 网页请求",
    "WebFetch | 没归类 | 0",
    "§ 其他",
    "TodoWrite | 没归类 | 0",
    "§ Skill · 模型服务",
    "这两天都没用过",
    "次数是这两天真实用过的。没归类的工具在每个阶段都照常能用；点一行可以给它归类。",
  ], "what ran first, by how often; a use's preferred tool that did not run next; every other one after, nothing folded");
  const rows = tools();
  assert.deepEqual(rows.find((r) => r.name === "node --test").action, { op: "tool-menu", key: "Bash(node --test)" });
  assert.equal(rows.find((r) => r.name === "gemworks").action, undefined, "gemworks's own tools take no classifying");
  const menu = tools({ menu: "Bash(npm test)" });
  const at = menu.findIndex((r) => r.name === "npm test");
  assert.deepEqual(look(menu.slice(at + 1, at + 4)), ["  归类为", "改文件 跑测试* 部署到 production 出图 新用途…", "删掉这一行 取消"], "classify as any of the flow's uses or a new one; a preferred row is not made preferred again");
  assert.deepEqual(menu[at + 2].items[0].action, { op: "learn", lessons: [{ kind: "use", key: "Bash(npm test)", use: "edit" }] });
  assert.deepEqual(menu[at + 3].items[0].action, { op: "learn", lessons: [{ kind: "forget", key: "Bash(npm test)" }], confirm: { question: "删掉 Bash(npm test) 这一行？之后它按没归类的工具处理。", yes: "删掉" } }, "deleting a row asks first");
  const loose = tools({ menu: "Bash(git commit)", naming: "Bash(git commit)" });
  const lat = loose.findIndex((r) => r.name === "git commit");
  assert.deepEqual(loose[lat + 3], { kind: "input", key: "new-use-Bash(git commit)", placeholder: "git commit 的新用途", field: "new-use", target: "Bash(git commit)" });
  assert.deepEqual(look([loose[lat + 4]]), ["取消"], "a tool with no row has nothing to prefer or take out");
  assert.deepEqual(inputAction("new-use", " commit ", "Bash(git commit)"), { op: "learn", lessons: [{ kind: "use", key: "Bash(git commit)", use: "commit" }] });
  assert.deepEqual(inputAction("tool-search", "git"), { op: "tool-search", query: "git" });
  assert.deepEqual(inputAction("add-tool", " Bash(cargo test) | test "), { op: "learn", lessons: [{ kind: "use", key: "Bash(cargo test)", use: "test" }] });
  assert.deepEqual(inputAction("add-tool", "Read"), { op: "learn", lessons: [{ kind: "allow", key: "Read", where: "*" }] });
  assert.equal(inputAction("add-tool", "  "), undefined);
  const busy = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`Bash(tool${i})`, 20 - i]));
  const many = look(toolRows({ board: { ...BOARD, tools: [] }, columns: 100, t: wordsFor("zh"), usage: busy, suggestions: [], query: "", menu: null, naming: null, open: [] }));
  assert.deepEqual(many.slice(2, 11), ["tool0 | 没归类 | 20 次", "tool1 | 没归类 | 19 次", "tool2 | 没归类 | 18 次", "tool3 | 没归类 | 17 次", "tool4 | 没归类 | 16 次", "tool5 | 没归类 | 15 次", "tool6 | 没归类 | 14 次", "tool7 | 没归类 | 13 次", "tool8 | 没归类 | 12 次"], "all of them, the most run first: none folded");
  assert.deepEqual(look(tools({ query: "GIT" })).slice(1, 3), ["§ 命令行", "git commit | 没归类 | 18 次"], "the search narrows to what matches, folded ones too");
  assert.equal(look(tools({ query: "nothing-like-this" })).at(-2), "没有对得上的工具");
});

test("工具: a command that ran with no row to take it, looking like the flow's test, is a suggestion to count it so; one put away is not asked again", () => {
  const usage = { "Bash(node --test)": 46, "Bash(npx vitest)": 2, "Bash(git commit)": 18, "Bash(npm test)": 7 };
  const [s, ...rest] = toolSuggestions(BOARD, usage, [], wordsFor("zh"));
  assert.deepEqual(rest, [], "two runs are not enough; a command with a row, or that looks like nothing, is no suggestion");
  assert.deepEqual([s.kind, s.verb, s.title, s.tag, s.detail], ["suggest", "决定", "node --test 算作跑测试", "建议 · 工具", ["这两天跑了 46 次，一次都没记成跑测试。"]]);
  assert.deepEqual(s.actions.map((a) => [a.label, a.action]), [["算", { op: "learn", lessons: [{ kind: "use", key: "Bash(node --test)", use: "test" }] }], ["不算", { op: "dismiss", key: "Bash(node --test)" }]]);
  assert.deepEqual(toolSuggestions(BOARD, usage, ["Bash(node --test)"], wordsFor("zh")), []);
  assert.equal(toolRows({ board: BOARD, columns: 100, t: wordsFor("zh"), usage, suggestions: [s], query: "", menu: null, naming: null, open: [] })[1].kind, "card", "the tools tab shows its own suggestions under the search");
  assert.deepEqual(look2(items({ suggestions: [s] })), "决定 node --test 算作跑测试", "the work items tab's pending group too");
  assert.equal(rowFor("Bash(wrangler deploy --env staging)", [{ tool: "Bash(wrangler deploy*--env staging)", allow: [], deny: [], default: false, row: 1 }, { tool: "Bash(wrangler deploy*)", allow: [], deny: [], default: false, row: 2 }]).row, 1, "the longest literal pattern takes it");
  assert.equal(rowFor("Bash(npm test)", BOARD.tools).tool, "Bash(npm test)");
  assert.equal(rowFor("Bash(npm run build)", BOARD.tools), undefined);
});
const look2 = (rows) => { const c = rows.find((r) => r.kind === "card"); return `${c.verb} ${c.title}`; };

test("工作项 by the outline: each with where it is and what it has; a merged one still checked out is a card to close, which asks first and can be left; the dropped listed on a press", () => {
  const board = { ...BOARD, backlog: null, items: [
    { id: "feat/x", state: "review", rev: 3, at: "2026-10-12T09:04:00Z", paused: false, end: "doing", worktree: "../geml-gemworks", commits: 36 },
    { id: "feat/runtime", state: "build", rev: 2, at: "2026-10-09T09:00:00Z", paused: false, end: "merged", worktree: "../geml-agent-runtime", commits: 13, pr: { number: 32, state: "merged" } },
    { id: "claude/try", state: "build", rev: 0, at: "2026-10-12T01:42:00Z", paused: false, end: "dropped", commits: 0 },
    { id: "feat/old", state: "deploy", rev: 9, at: "2026-10-01T08:00:00Z", paused: false, end: "closed", commits: 4 },
  ] };
  const rows = items({ board, dismissed: [] });
  assert.deepEqual(look(rows), [
    "§ 待处理",
    "done  feat/runtime 已合并 | 已合入 main（PR #32） / 收尾将删除 worktree geml-agent-runtime 及本地分支（仅当提交已全部合入 main）。 | 收尾 保留",
    "§ 在做 1",
    "feat/x (当前 · review)",
    "§ 已合并 1",
    "feat/runtime ()",
    "§ 已收尾 1 [展开]",
    "§ 放下 1 [展开]",
  ]);
  const card = rows.find((r) => r.key === "close-feat/runtime");
  assert.deepEqual(card.actions.map((a) => a.action), [{ op: "close-item", id: "feat/runtime", worktree: "../geml-agent-runtime" }, { op: "dismiss", key: "close-feat/runtime" }]);
  assert.deepEqual(rows.filter((r) => r.kind === "entry").map((r) => [r.title, r.detail, r.current ?? false]), [
    ["feat/x", "geml-gemworks · 36 个提交 · 6 分钟前", true],
    ["feat/runtime", "geml-agent-runtime · 13 个提交 · PR #32 已合并 · 3 天前", false],
  ]);
  assert.equal(look(items({ board, dismissed: ["close-feat/runtime"] }))[1], "暂无", "left as it is: not asked again");
  const open = items({ board, droppedOpen: true, dismissed: [] });
  assert.deepEqual(open.filter((r) => r.kind === "entry").at(-1), { kind: "entry", key: "item-claude/try", title: "claude/try", tag: "构建", tone: "dim", detail: "分支已删除 · 无提交 · 7 小时前" });
  assert.deepEqual(open.find((r) => r.key === "dropped").fold.action, { op: "fold", what: "dropped", open: false });
});

test("记录: the work item and its flow, then what happened — no refusals, no evidence, no stage changes, no export; the filter row only with more than 全部", () => {
  const st = status(undefined, { sources: { "tests-pass": "tool:test", "pr-open": "git:pr-open", "review-done": "human" } });
  const prompts = [{ id: "p1", at: "2026-10-12T09:00:30Z", text: "把测试补上", tools: 3, refusals: 1, entered: [], signals: [] }];
  const journal = (over = {}) => journalRows({ board: BOARD, status: st, filter: "all", menu: null, evidence: null, prompts, columns: 100, maxRows: 40, t: wordsFor("zh"), now: NOW, ...over });
  const look = (rows) => rows.map((r) => r.kind === "event" ? r.label : r.kind === "buttons" ? r.items.map((b) => b.label).join(" ") : r.kind === "text" ? r.text : r.kind);
  assert.deepEqual(look(journal()), ["feat/x · 开发流程", "暂无"], "the refusal in the timeline is not listed; the stage's own revisions are the journal file's");
  for (const filter of ["refusals", "moves", "artifacts"]) assert.deepEqual(look(journal({ filter })), ["feat/x · 开发流程", "暂无"], `a filter the tab no longer has (${filter}) shows everything`);
  assert.ok(journal({ maxRows: 4 }).length <= 4, "the entries fit the rows");
  assert.ok(!journal().some((r) => r.kind === "buttons"), "no filter row with only 全部, no export");
});

test("记录: commits are git's, so the journal lists none, whatever the work item made", () => {
  const artifacts = { item: "feat/x", written: [], commits: [{ sha: "7a38c1fd00000000", at: "2026-10-12T09:02:40Z", subject: "feat: x", files: ["src/board.ts"], ours: true }, { sha: "1111111122222222", at: "2026-10-12T09:02:20Z", subject: "docs: other", files: ["README.md"], ours: false }] };
  const rows = journalRows({ board: { ...BOARD, artifacts }, status: status(), filter: "all", menu: null, evidence: null, prompts: [], columns: 100, maxRows: 40, t: wordsFor("zh"), now: NOW });
  assert.ok(!rows.some((r) => r.kind === "event" && r.label === "产物"), "no commit entry");
  assert.ok(!rows.some((r) => r.kind === "text" && /同期另有/.test(r.text)), "no count of the other commits");
});

test("记录: where a value came from, and what an entry says, in the flow's words", () => {
  const t = wordsFor("zh");
  assert.deepEqual(["tool:test", "git:pr-open", "git:committed", "file:out/*.mp4", "human", "elapsed:PT2H", undefined].map((s) => sourceWords(s, t)), ["跑 test 得来", "gh 查到的", "git 查到的", "文件 out/*.mp4 已生成", "你勾的", "已到期", "模型写的"]);
  const words = (e, sources = { "review-ready": "human" }) => entryWords({ kind: "snapshot", rev: 5, at: NOW, ...e }, BOARD, sources, t);
  assert.deepEqual(words({ state: "review", cause: "transition", by: "signal", signal: "review-ready", from: "build", changed: { "review-ready": true } }), { label: "阶段变更", text: "构建 → review · 自动", why: "凭：review-ready 被勾上", tone: "normal" });
  assert.equal(words({ state: "build", cause: "transition", by: "model", from: "review" }).text, "review → 构建 · 模型判「review 要求改动」");
  assert.equal(words({ state: "deploy", cause: "transition", by: "human", from: "review" }).text, "review → deploy · 你");
  assert.deepEqual(words({ state: "build", cause: "rollback", by: "human", restores: 2 }), { label: "阶段变更", text: "回到构建 · 你", why: "恢复第 2 条修订", tone: "normal" });
  assert.deepEqual(words({ state: "review", cause: "patch", by: "human", changed: { "review-ready": false } }), { label: "凭据", text: "review-ready 被取消", why: "你勾的", tone: "normal" });
  assert.deepEqual(words({ state: "review", cause: "expire", changed: { "tests-pass": false } }), { label: "凭据", text: "tests-pass 已失效", why: "内容已变更", tone: "dim" });
  assert.deepEqual(entryWords({ kind: "refused", n: 2, rev: 5, at: NOW, tool: "Bash", key: "Bash(git push*)", reason: "push is release, used only in #release; switching the work item is always allowed: x" }, BOARD, {}, t), { label: "被拦", text: "Bash(git push*)", why: "push is release, used only in #release", tone: "error" });
  assert.deepEqual(entryDetail({ kind: "refused", n: 2, rev: 5, at: NOW, tool: "Bash", reason: "r", call: "c9" }, BOARD, t), ["r", "哪次调用：c9"]);
});

test("会话: every prompt newest first under its day, with what its turn did and its icons; a press unfolds it, the one unfolded before folds", () => {
  const prompts = [
    { id: "p0", at: "2026-10-11T03:10:00Z", text: "昨天的事", tools: 2, refusals: 0, entered: [], signals: [], did: "改好了。" },
    { id: "p1", at: "2026-10-12T09:00:10Z", text: "把限流中间件的测试补上，然后开 PR。\n第二行", state: "build", tools: 7, refusals: 0, entered: [], signals: [], did: "测试补上了，PR 已开。" },
    { id: "p2", at: "2026-10-12T09:03:10Z", text: "并发那个用例用 fake timer。", state: "build", tools: 4, refusals: 0, entered: ["review"], signals: ["tests-pass"] },
    { id: "p3", at: "2026-10-12T09:05:00Z", text: "顺手部署一下。", state: "review", tools: 0, refusals: 0, entered: [], signals: [] },
  ];
  const commits = [{ sha: "e18b116d00000000", at: "2026-10-12T09:04:00Z" }, { sha: "7a38c1fd00000000", at: "2026-10-12T09:02:00Z" }, { sha: "053f317c9d0e1f2a", at: "2026-10-12T09:01:00Z" }];
  const rows = sessionRows(prompts, commits, wordsFor("zh"), 100, NOW, { flow: null, runs: [], expanded: { id: "p2", answer: "用了 fake timer。" } });
  const look = rows.map((r) => r.kind === "section" ? `§ ${r.text}` : r.kind === "turn" ? `${r.text} | ${r.did}${r.open ? " ▾" : ""}` : r.kind === "prose" ? `> ${r.text}` : r.kind);
  assert.deepEqual(look, [
    "§ 今天",
    "顺手部署一下。 | 进行中…",
    "并发那个用例用 fake timer。 | e18b116d 4 次工具调用 · tests-pass ✓ · 进 #review ▾",
    "menu",
    "> 并发那个用例用 fake timer。",
    "> 用了 fake timer。",
    "把限流中间件的测试补上，然后开 PR。 | 053f317c 7a38c1fd 测试补上了，PR 已开。",
    "§ 昨天",
    "昨天的事 | 改好了。",
  ], "the commits made while a turn ran, then the first sentence of its answer; the turn still running says so; the unfolded one shows its card, its prompt and its answer whole");
  const turns = rows.filter((r) => r.kind === "turn");
  assert.deepEqual(turns.map((r) => r.action), [{ op: "expand-turn", id: "p3" }, { op: "expand-turn", id: null }, { op: "expand-turn", id: "p1" }, { op: "expand-turn", id: "p0" }], "a press unfolds a turn, or folds the unfolded one");
  assert.match(turns[0].at, /^\d\d:\d\d$/);
  assert.ok(turns.every((r) => r.fold === true), "every turn folds: a triangle says whether it is unfolded, the row's press turns it");
  assert.deepEqual(turns[1].icons.map((i) => [i.glyph, i.button.key, i.button.label, i.button.action]), [["locate", "locate-p2", "跳转", { op: "locate", id: "p2" }]], "the one icon at a row's right: the scroll to it, where the conversation scrolls");
  assert.deepEqual(rows.find((r) => r.kind === "menu").items.map((b) => [b.key, b.label, b.tone, b.action]), [
    ["split-p2", "拆成新会话", undefined, { op: "split", id: "p2" }], ["remove-p2", "删除这一轮", "danger", { op: "remove", id: "p2" }],
  ], "what can be done to a turn is a card under the unfolded one, not icons on every row");
  assert.ok(sessionRows(prompts, commits, wordsFor("zh"), 100, NOW, { flow: null, runs: [], scrolls: false, expanded: null }).filter((r) => r.kind === "turn").every((r) => r.icons.length === 0), "where nothing scrolls, a folded row carries no press but its own");
  const located = sessionRows(prompts.map((p) => ({ ...p, uuid: `row-${p.id}` })), commits, wordsFor("zh"), 100, NOW).filter((r) => r.kind === "turn")[1];
  assert.deepEqual(located.icons[0].button.action, { op: "locate", id: "p2", uuid: "row-p2" }, "跳转 carries the row, so the press scrolls before it awaits anything");
  assert.deepEqual(rows.map((r, i) => (r.kind === "menu" ? rows[i - 1].key : null)).filter((k) => k !== null), ["prompt-p2"], "one card, under the unfolded turn alone");
  assert.ok(rows.every((r) => r.kind !== "buttons"), "no export among the turns");
  assert.deepEqual(sessionRows([], [], wordsFor("zh"), 100), [{ kind: "text", text: "还没有 prompt", tone: "dim" }]);
});

test("流程: the ways out a person may take are numbered in the picture's order, one number each; a condition that holds is offered", () => {
  const board = { ...BOARD, transitions: [...BOARD.transitions, { name: "review→done", from: "review", to: "done", judge: "none", approval: true, note: "" }] };
  const st = { ...status(), next: [...status().next.map((x) => (x.to === "deploy" ? { ...x, holds: true, missing: [] } : x)), next({ name: "review→done", to: "done", judge: "none", approval: true })] };
  const picture = { ...board.picture, flow: { ...board.picture.flow, edges: [...board.picture.flow.edges, { name: "review→done", from: "review", to: "done", kind: "lane", label: "", sentence: false, marks: [] }] } };
  const rows = flow({ board: { ...board, picture }, status: st, columns: 60 });
  assert.deepEqual(pic(rows).edges.filter((e) => e.press !== undefined).map((e) => [e.name, e.press.n, e.press.action.to]), [["review→deploy", 1, "deploy"], ["review→build", 2, "build"], ["review→done", 3, "done"]], "numbered in the picture's order");
});

test("the pane: rows for the tab, a problem above them, and the reason when there is no board; the sessions tab needs none, and the work items tab shows what waits before it has one", () => {
  const wait = { kind: "text", text: "正在读取看板…", tone: "dim" };
  assert.deepEqual(pane({ board: null }), [wait]);
  assert.deepEqual(pane({ board: null, problem: "这个项目还没有流程。用 /gemworks add 选一个内置流程。" }), [{ kind: "text", text: "这个项目还没有流程。用 /gemworks add 选一个内置流程。", tone: "error" }]);
  assert.deepEqual(pane({ board: null, tab: "items" }), [{ kind: "section", key: "waiting", text: "待处理" }, { kind: "text", text: "暂无", tone: "dim" }, wait]);
  assert.deepEqual(pane({ board: null, tab: "items", problem: "x" }).at(-1), { kind: "text", text: "暂无", tone: "dim" }, "under a problem, no wait line");
  assert.deepEqual(pane({ board: null, tab: "sessions" }), [{ kind: "section", key: "own", text: "本会话", fold: { key: "export-own", label: "导出", action: { op: "export", session: "own" } } }, { kind: "text", text: "还没有 prompt", tone: "dim" }], "this session's heading carries its export even with nothing under it");
  const env = ["运行于 GEORGE-PC", "user-story-review-split-440292", "claude/user-story-review-split-440292", "远程控制"];
  assert.equal(pane({ board: null, tab: "sessions", env, columns: 140 }).at(0).note, "运行于 GEORGE-PC · user-story-review-split-440292 · claude/user-story-review-split-440292 · 远程控制", "where it runs, after the heading");
  const narrow = pane({ board: null, tab: "sessions", env, columns: 40 }).at(0).note;
  assert.ok(narrow.startsWith("运行于 GEORGE-PC · ") && narrow.endsWith("…") && cellWidth(narrow) <= 40 - cellWidth("本会话") - cellWidth("导出") - 4, `one line beside 导出: ${narrow}`);
  const at = "2026-10-20T08:00:00Z";
  const one = (id, over = {}) => ({ id, host: "claude-code", started: at, last: at, turns: [], decisions: [], files: [], commits: [], ...over });
  const project = { sessions: [one("me"), one("other", { branch: "feat/y", decisions: [{ turn: 1, at, text: "先跑 CI" }] })], own: "me", open: null };
  assert.deepEqual(pane({ board: null, tab: "sessions", project }).filter((r) => r.kind === "section").map((r) => r.key), ["own", "others", "decisions"], "the sessions tab: this session, the others, what every session decided");
  assert.deepEqual(pane({ board: null, tab: "sessions", project, memory: { list: { dir: "/h/m", entries: [{ file: "a.md", title: "甲", hook: "一", type: "feedback", at }] }, group: null, menu: null, edit: null, shown: 10 } }).filter((r) => r.kind === "section").map((r) => r.key), ["own", "others", "memory", "decisions"], "the sessions tab: this session, the others, then memory and decisions, which 记录 had");
  assert.deepEqual(pane(), flow(), "a host that draws no light flows: the workflow alone");
  assert.deepEqual(pane({ coach: { items: [], flows: [], focus: null } }).slice(3), [{ kind: "section", key: "strict", text: "固化流程", note: "只能你把事放进去，挂着的规定会真拦" }, ...flow()], "beside the light flows' manual: the project's own workflow under 固化流程");
  const outward = [{ kind: "section", key: "outward", text: "对外动作" }, { kind: "text", text: "推送、发布、部署、发消息之前都先问你；还没有放行过的。", tone: "dim" }];
  assert.deepEqual(pane({ tab: "tools" }), [...toolRows({ board: BOARD, columns: 100, t: wordsFor("zh"), usage: {}, suggestions: [], query: "", menu: null, naming: null, open: [] }), ...outward], "the dictionary's tools, then the outward actions let through");
  // No workflow: the tools that ran these two days still show, with nothing to classify them as; then the outward actions.
  const bare = pane({ board: null, tab: "tools", usage: { "Bash(grep)": 72, "PowerShell(git log)": 24, Read: 59, "mcp__gemworks__*": 7, "mcp__Claude_Browser__*": 5 } });
  assert.deepEqual(bare.map((r) => r.kind === "tool" ? [r.name, r.use, r.guess, r.count].filter((x) => x !== "").join(" | ") : r.kind === "input" ? `[${r.placeholder}]` : r.kind === "section" ? `§ ${r.text}` : r.text), [
    "[找工具]",
    "§ 命令行", "grep | 72 次", "git log · PowerShell | 24 次",
    "§ 文件", "Read | 59 次",
    "§ MCP", "gemworks | gemworks 自己的 | 7 次", "Claude_Browser | 5 次",
    "§ Skill · 网页请求 · 模型服务", "这两天都没用过",
    "次数是这两天真实用过的。",
    "§ 对外动作", "推送、发布、部署、发消息之前都先问你；还没有放行过的。",
  ], "no workflow: every tool that ran, the most first, no use beside it, then the outward actions let through");
  assert.equal(bare.some((r) => r.kind === "tool" && r.action !== undefined), false, "no workflow: no row opens a menu, there is no use to classify it as");
  assert.deepEqual(pane({ board: null, tab: "tools", usage: { "Bash(grep)": 2 }, toolMenu: "Bash(grep)" }).filter((r) => r.kind === "buttons"), [], "a menu left open from a workflow opens no menu without one");
  const stale = pane({ problem: "gemworks：桥接没有应答（timed out）", tab: "items", doneOpen: true });
  assert.deepEqual(stale[0], { kind: "text", text: "gemworks：桥接没有应答（timed out）", tone: "error" }, "the last board stays, under why it is not fresh");
  assert.deepEqual(stale.slice(1), items({ columns: 100, doneOpen: true }));
  assert.ok(pane({ problem: "x", tab: "journal", maxRows: 4 }).length <= 4, "the journal fits the rows the problem leaves");
  assert.deepEqual(pane({ problem: "x", tab: "journal", maxRows: 5 }).map((r) => r.kind).slice(-1), ["text"], "no dependency and no refusals listed: the journal says 暂无 under the problem");
});

test("two flows in play: the jumped-into work item's steps and where it came from; the queue by flow, the waiting one marked; the flow tab says who waits", () => {
  const logo = { id: ".geml/logo/mark", state: "review", rev: 4, at: "2026-10-15T11:03:00Z", paused: false, file: ".geml/logo/mark.geml", title: "gemworks 标志", flow: "标志设计", stateTitle: "review", since: "2026-10-15T09:30:00Z" };
  const styles = { id: ".geml/matters/styles", state: "noted", rev: 1, at: "2026-10-15T09:29:00Z", paused: false, file: ".geml/matters/styles.geml", title: "样式：画布换上新标志", flow: "开发流程", stateTitle: "记下", since: "2026-10-15T09:00:00Z", workflow: "matter", depends: [{ id: ".geml/logo/mark", title: "gemworks 标志", done: false, at: logo.at }] };
  const other = { id: ".geml/matters/lanes", state: "noted", rev: 1, at: "2026-10-15T08:00:00Z", paused: false, file: ".geml/matters/lanes.geml", title: "几条流程并排与依赖", flow: "开发流程", stateTitle: "记下", since: "2026-10-15T08:00:00Z", workflow: "matter" };
  const board = { ...BOARD, items: [logo, styles, other], backlog: null };
  const st = status({ kind: "item", id: ".geml/logo/mark" }, { title: "gemworks 标志" });
  const rows = items({ board, status: st });
  const look = (rs) => rs.map((r) => r.kind === "section" ? `§ ${r.text}` : r.kind === "steps" ? r.steps.map((s) => `${s.title}${s.passed ? " ✓" : ""}${s.current ? " ●" : ""}`).join(" → ") : r.kind === "entry" ? `${r.title} (${r.tag})` : r.kind === "text" ? r.text : r.kind);
  assert.deepEqual(look(rows).slice(2), [
    "§ 标志设计 · gemworks 标志",
    "构建 ✓ → review ● → deploy → done",
    rows[4].text,
    "§ 在做 · 标志设计",
    "gemworks 标志 (当前 · review)",
    "§ 在做 · 开发流程",
    "样式：画布换上新标志 (记下 · ⏳ 等「gemworks 标志」完成)",
    "几条流程并排与依赖 (记下)",
    "§ 已合并",
    "§ 已收尾",
    "§ 放下",
  ]);
  assert.match(rows[4].text, /^\d\d:\d\d 由开发流程「样式：画布换上新标志」转入，完成后返回。$/);
  assert.deepEqual(stepsOf(BOARD, "review").map((s) => [s.title, s.passed, s.current]), [["构建", true, false], ["review", false, true], ["deploy", false, false], ["done", false, false]], "a state the journal entered is passed, the current one marked");
  const f = flow({ board, status: st }).filter((r) => r.kind === "text").map((r) => r.text);
  assert.deepEqual(f.slice(0, 2), ["开发流程 · 记下 · 等「gemworks 标志」", "由「样式：画布换上新标志」转入，完成后返回「样式：画布换上新标志」。"]);
});

test("记录: what the current work item waits for — put aside, the other done with what it brought back, taken up again — under its own filter", () => {
  const st = status(undefined, { title: "样式：画布换上新标志", depends: [{ id: "m/logo", title: "gemworks 标志", flow: "标志设计", done: true, since: "2026-10-12T09:01:30Z", at: "2026-10-12T09:03:30Z", wrote: ["brand/gemworks_mark.svg", "brand/banner.png"] }] });
  const prompts = [{ id: "p1", at: "2026-10-12T09:01:00Z", text: "这个 logo 可能不能直接用 geml 的", tools: 1, refusals: 0, entered: [], signals: [] }];
  const rows = journalRows({ board: BOARD, status: st, filter: "depends", menu: null, evidence: null, prompts, columns: 100, maxRows: 40, t: wordsFor("zh"), now: NOW });
  assert.deepEqual(rows[0].items.map((b) => b.label), ["全部", "依赖"], "the filter shows once there is a dependency");
  assert.deepEqual(rows.filter((r) => r.kind === "event").map((r) => [r.label, r.text, r.why, r.turn.replace(/\d\d:\d\d/, "HH:MM")]), [
    ["恢复", "样式：画布换上新标志", "", "提示词 HH:MM「这个 logo 可…」"],
    ["依赖完成", "标志设计「gemworks 标志」完成", "产物：gemworks_mark.svg · banner.png", ""],
    ["挂起", "样式：画布换上新标志，等「gemworks 标志」", "另开标志设计，工作项 gemworks 标志", "提示词 HH:MM「这个 logo 可…」"],
  ]);
  assert.ok(!journalRows({ board: BOARD, status: status(), filter: "all", menu: null, evidence: null, prompts: [], columns: 100, maxRows: 40, t: wordsFor("zh"), now: NOW }).some((r) => r.kind === "buttons"), "no dependency: no filter row");
  const menu = journalRows({ board: BOARD, status: st, filter: "depends", menu: "back-m/logo", evidence: null, prompts, columns: 100, maxRows: 40, t: wordsFor("zh"), now: NOW });
  const at = menu.findIndex((r) => r.key === "back-m/logo");
  assert.deepEqual(menu[at + 1].items.map((b) => [b.label, b.action]), [["跳到对话", { op: "locate", id: "p1" }], ["取消", { op: "expand", entry: null }]], "a press opens the entry's menu under it");
  const shown = journalRows({ board: BOARD, status: st, filter: "depends", menu: "done-m/logo", evidence: "done-m/logo", prompts, columns: 100, maxRows: 40, t: wordsFor("zh"), now: NOW });
  assert.deepEqual(shown.find((r) => r.key === "done-m/logo").detail, ["brand/gemworks_mark.svg", "brand/banner.png"], "its evidence, shown on 详情");
});

test("会话: each turn says what it moved, decided and learned; a run of three or more on another work item folds into one line; one work item's prompts on its own", () => {
  const p = (id, at) => ({ id, at, text: `${id} 的提示词`, tools: 1, refusals: 0, entered: [], signals: [], did: `${id} 做了` });
  const prompts = [p("a", "2026-10-12T08:00:00Z"), p("b", "2026-10-12T08:10:00Z"), p("c", "2026-10-12T08:20:00Z"), p("d", "2026-10-12T08:30:00Z"), p("e", "2026-10-12T09:00:00Z"), p("f", "2026-10-12T09:10:00Z")];
  const logo = { id: "l1", title: "gemworks 标志" };
  const style = { id: "s1", title: "样式" };
  const by = { a: [["→ 样式 ✓样稿"], style], b: [["→ gemworks 标志 ✓讨论", "定：海蓝在上"], logo], c: [["→ gemworks 标志 ✓出样稿"], logo], d: [["→ gemworks 标志 到「出样稿」"], logo], e: [["→ 样式 ✓实现"], style], f: [[], undefined] };
  const moved = (x) => ({ words: by[x.id][0], ...(by[x.id][1] !== undefined ? { item: by[x.id][1] } : {}) });
  const look = (rows) => rows.map((r) => r.kind === "turn" ? `${r.text}${r.did ? ` | ${r.did}` : ""}` : r.kind === "buttons" ? r.items.map((x) => x.label).join(" ") : r.kind === "section" ? `§ ${r.text}` : r.kind);
  const folded = sessionRows(prompts, [], wordsFor("zh"), 100, NOW, { runs: [], moved });
  assert.deepEqual(look(folded), ["§ 今天", "f 的提示词 | f 做了", "e 的提示词 | → 样式 ✓实现", "gemworks 标志 · 3 条提示词", "a 的提示词 | → 样式 ✓样稿"], "no flow filter: the turns by what they moved");
  assert.deepEqual(folded[3].action, { op: "session-run", id: "b", open: true });
  const open = sessionRows(prompts, [], wordsFor("zh"), 100, NOW, { runs: ["b"], moved });
  assert.deepEqual(look(open).slice(3, 7), ["gemworks 标志 · 3 条提示词", "d 的提示词 | → gemworks 标志 到「出样稿」", "c 的提示词 | → gemworks 标志 ✓出样稿", "b 的提示词 | → gemworks 标志 ✓讨论 · 定：海蓝在上"]);
  const only = sessionRows(prompts, [], wordsFor("zh"), 100, NOW, { item: "l1", runs: [], moved });
  assert.deepEqual(look(only), ["看全部提示词", "§ 今天", "d 的提示词 | → gemworks 标志 到「出样稿」", "c 的提示词 | → gemworks 标志 ✓出样稿", "b 的提示词 | → gemworks 标志 ✓讨论 · 定：海蓝在上"]);
  assert.deepEqual(only[0].items[0].action, { op: "session-item", id: null });
});

test("会话 across the project: the decisions shown whole, newest first; the other sessions after this one's turns, each with its export and a triangle saying whether it is unfolded", async () => {
  const { decisionRows, othersRows, sessionLabel } = await import("../../dist/hosts/claude-code/board.js");
  const t = wordsFor("zh");
  const s = (id, host, branch, decisions, files, last) => ({ id, host, branch, started: "2026-10-12T07:00:00Z", last, turns: [{ turn: 1, at: "2026-10-12T08:00:00Z", prompt: `${id} 问的`, decisions: decisions.map(([, text]) => text) }], decisions: decisions.map(([at, text]) => ({ turn: 1, at, text })), files: files.map((path) => ({ path, at: "2026-10-12T08:30:00Z" })), commits: [] });
  const sessions = [
    s("me", "claude-code", "feat/x", [["2026-10-12T08:05:00Z", "每会话一个文件"]], ["hooks/register.tsx", "src/board.ts"], "2026-10-12T09:00:00Z"),
    s("cx", "codex", "feat/y", [["2026-10-12T08:10:00Z", "合并前先跑三平台 CI"]], ["hooks/register.tsx"], "2026-10-12T08:40:00Z"),
  ];
  const hhmm = (x) => x.replace(/\d\d:\d\d/, "hh:mm");
  const look = (rows) => rows.map((r) => r.kind === "section" ? `§ ${r.text}` : r.kind === "note" ? `${r.lines.join("⏎")} | ${r.tag}` : r.kind === "entry" ? `${r.title} | ${r.tag} ${r.open ? "▾" : "▸"}${r.extra !== undefined ? ` [${r.extra.label}]` : ""}` : r.kind === "turn" ? `> ${r.text} | ${r.did}` : r.kind);
  const exports = { button: (id) => ({ key: `export-${id}`, label: "导出", action: { op: "export", session: id } }), under: () => [] };
  const head = decisionRows({ sessions, own: "me", open: null }, t, 100, NOW);
  assert.deepEqual(look(head).map(hhmm), ["§ 决定", "模型记：合并前先跑三平台 CI | Codex · feat/y hh:mm", "模型记：每会话一个文件 | 本会话 hh:mm"]);
  assert.deepEqual(head[1].action, { op: "use-decision", text: "合并前先跑三平台 CI", from: "Codex · feat/y" }, "a press puts the decision in the prompt box, without whose it is");
  const theirs = decisionRows({ sessions: [{ ...sessions[1], decisions: [{ ...sessions[1].decisions[0], by: "person", pressed: true }] }, sessions[0]], own: "me", open: null }, t, 100, NOW);
  assert.deepEqual(look(theirs).map(hhmm).slice(1), ["你定：合并前先跑三平台 CI | Codex · feat/y hh:mm", "模型记：每会话一个文件 | 本会话 hh:mm"], "the person's own says so");
  const tail = othersRows({ sessions, own: "me", open: null }, t, 100, NOW, exports);
  assert.deepEqual(look(tail).map(hhmm), ["§ 其他会话", "Codex · feat/y | hh:mm ▸ [导出]"]);
  assert.deepEqual(tail[1].action, { op: "session-open", id: "cx" });
  const open = othersRows({ sessions, own: "me", open: "cx" }, t, 100, NOW, exports);
  assert.deepEqual(look(open).slice(1, 3).map(hhmm), ["Codex · feat/y | hh:mm ▾ [导出]", "> cx 问的 | 合并前先跑三平台 CI"], "unfolded: its turns, each with what it decided");
  const long = decisionRows({ sessions: [{ ...sessions[0], decisions: [{ turn: 1, at: "2026-10-12T08:05:00Z", text: "一".repeat(60) }] }], own: "me", open: null }, t, 40, NOW);
  assert.deepEqual(long[1].lines.map((l) => l.length), [18, 18, 18, 10], "a long decision wraps to the width with whose it is, none of it cut");
  assert.deepEqual(decisionRows({ sessions: sessions.map((x) => ({ ...x, decisions: [] })), own: "me", open: null }, t, 100, NOW), [], "nothing decided: no heading");
  assert.deepEqual(othersRows({ sessions: [sessions[0]], own: "me", open: null }, t, 100, NOW, exports), [], "alone: no other sessions");
  assert.equal(sessionLabel({ ...sessions[1], branch: undefined, checkout: ["C:", "w", "geml-agent-runtime"].join(String.fromCharCode(92)) }, "me"), "Codex · geml-agent-runtime", "a Windows checkout: its folder");
  assert.equal(sessionLabel({ ...sessions[1], branch: undefined, checkout: "/home/g/geml-agent-runtime" }, "me"), "Codex · geml-agent-runtime", "a POSIX one too");
});

test("会话 where the conversation cannot be scrolled: no 跳转 at the row; the unfolded turn shows its whole prompt, then its answer — 正在读取… until the record answers, 没有记下回答 when it holds none", () => {
  const p = { id: "p1", at: "2026-10-12T08:00:00Z", text: "把会话页改成整行可点\n第二行", tools: 1, refusals: 0, entered: [], signals: [], did: "改好了" };
  const turnOf = (rows) => rows.find((r) => r.kind === "turn");
  const desk = sessionRows([p], [], wordsFor("zh"), 100, NOW, { flow: null, runs: [], scrolls: false });
  assert.deepEqual(turnOf(desk).icons.map((i) => i.glyph), [], "a folded row carries no press but its own");
  assert.deepEqual(turnOf(sessionRows([p], [], wordsFor("zh"), 100, NOW, { flow: null, runs: [] })).icons.map((i) => i.glyph), ["locate"], "the terminal scrolls");
  const open = sessionRows([p], [], wordsFor("zh"), 100, NOW, { flow: null, runs: [], scrolls: false, expanded: { id: "p1", answer: "**改好了**，整行都能点。" } });
  assert.deepEqual([turnOf(open).open, turnOf(open).action], [true, { op: "expand-turn", id: null }]);
  assert.deepEqual(open.filter((r) => r.kind === "prose").map((r) => [r.text, r.markdown === true]), [["把会话页改成整行可点\n第二行", false], ["**改好了**，整行都能点。", true]]);
  const reading = sessionRows([p], [], wordsFor("zh"), 100, NOW, { flow: null, runs: [], scrolls: false, expanded: { id: "p1", answer: null } });
  assert.equal(reading.filter((r) => r.kind === "prose").at(-1).text, "正在读取…");
  const none = sessionRows([p], [], wordsFor("zh"), 100, NOW, { flow: null, runs: [], scrolls: false, expanded: { id: "p1", answer: "" } });
  assert.equal(none.filter((r) => r.kind === "prose").at(-1).text, "没有记下回答");
});

test("已暂缓: the pull requests and branches held back, counted together and folded; unfolded, pull requests first, each with where it stands and a press that brings its card back", () => {
  const t = wordsFor("zh");
  const branches = [{ branch: "feat/geml-agent-runtime", ahead: 96, newestAt: "2026-10-09T08:00:00Z" }, { branch: "feat/typst-pdf", ahead: 1 }];
  const prs = [{ number: 32, branch: "feat/a", green: false, failing: ["scan", "CI"] }, { number: 41, branch: "feat/c", green: true, failing: [] }, { number: 50, branch: "feat/d", green: false, failing: [] }];
  assert.deepEqual(heldRows({ branches: [], prs: [] }, false, t, NOW), [], "nothing held, nothing shown");
  assert.deepEqual(heldRows({ branches, prs }, false, t, NOW), [{ kind: "section", key: "held", text: "已暂缓", count: 5, fold: { key: "fold-held", label: "展开", action: { op: "fold", what: "held", open: true } } }]);
  const open = heldRows({ branches, prs }, true, t, NOW);
  assert.deepEqual(open[0].fold.label, "收起");
  assert.deepEqual(open.slice(1).map((r) => [r.kind, r.title, r.tag, r.extra.key, r.extra.label, r.extra.action]), [
    ["entry", "#32", "feat/a · scan、CI 失败", "restore-pr-32", "取消暂缓", { op: "undismiss", key: "green:32" }],
    ["entry", "#41", "feat/c · 检查全部通过", "restore-pr-41", "取消暂缓", { op: "undismiss", key: "green:41" }],
    ["entry", "#50", "feat/d · 检查中", "restore-pr-50", "取消暂缓", { op: "undismiss", key: "green:50" }],
    ["entry", "feat/geml-agent-runtime", "96 个提交 · 3 天前", "restore-feat/geml-agent-runtime", "取消暂缓", { op: "undismiss", key: "unpushed:feat/geml-agent-runtime" }],
    ["entry", "feat/typst-pdf", "1 个提交", "restore-feat/typst-pdf", "取消暂缓", { op: "undismiss", key: "unpushed:feat/typst-pdf" }],
  ]);
});

test("a field's text: a path imports a workflow or a reference; a new use and a memory's summary need what they are for; a use with no tool is nothing", () => {
  assert.deepEqual(inputAction("import-workflow", " ./flows/dev "), { op: "import", path: "./flows/dev" });
  assert.deepEqual(inputAction("import-reference", "../other/.gemworks"), { op: "reference-import", path: "../other/.gemworks" });
  assert.equal(inputAction("new-use", "commit"), undefined, "a new use with no tool to give it to");
  assert.deepEqual(inputAction("memory-hook", " 一句话说清 ", "a.md"), { op: "memory-set", file: "a.md", hook: "一句话说清" });
  assert.equal(inputAction("memory-hook", "一句话说清"), undefined, "a summary with no memory to give it to");
  assert.equal(inputAction("add-tool", " | test"), undefined, "a use with no tool before it");
});

test("流程: who waits is named by what it has — no flow, no stage words, no title, the current item by its id; a use with no tool bound says so", () => {
  const waiter = { id: ".geml/matters/w", state: "noted", rev: 1, at: NOW, paused: false, depends: [{ id: "feat/x", done: false }] };
  const texts = flow({ board: { ...BOARD, items: [...BOARD.items, waiter] } }).filter((r) => r.kind === "text").map((r) => r.text);
  assert.deepEqual(texts.slice(0, 2), [" · noted · 等「feat/x」", "由「.geml/matters/w」转入，完成后返回「.geml/matters/w」。"]);
  const noted = { ...BOARD, states: BOARD.states.map((s) => (s.id === "review" ? { ...s, uses: ["edit", "note"] } : s)) };
  assert.deepEqual(flow({ board: noted }).filter((r) => r.kind === "entry" && r.key.startsWith("use-")).map((r) => [r.title, r.tag]), [["改文件", "Edit"], ["写事项", "没有绑工具"], ["哪里都能用", "Read"]]);
});

test("流程: a state with nothing to use and nothing barred says 没有 and lists no 这里不能用; a fence on a state the board does not know names it by its id", () => {
  const bare = { ...BOARD, tools: ROWS.filter((r) => r.tool !== "Read" && r.tool !== "WebFetch"), fences: [] };
  const rows = flow({ board: bare, selected: "done" });
  const below = rows.slice(rows.findIndex((r) => r.key === "state-title") + 1).map((r) => (r.kind === "section" ? `§ ${r.text}` : r.kind === "text" ? r.text : r.kind));
  assert.deepEqual(below, ["§ 这里能用", "  没有", "没归类的工具哪里都照常能用。"]);
  const ghost = { ...BOARD, fences: [{ use: "image", states: ["ghost"] }] };
  assert.equal(flow({ board: ghost, selected: "build" }).find((r) => r.key === "fence-image").tag, "只在ghost");
});

test("流程: a tick already set shows ticked and its press clears it; a clock with no entry time says no time left, one run out says so", () => {
  const ticked = status(undefined, { vars: { "review-done": true }, next: [next({ name: "review→done", to: "done", reads: ["review-done"] })] });
  const ticks = flow({ status: ticked });
  const at = ticks.findIndex((r) => r.key === "ticks");
  assert.deepEqual(ticks[at + 1].items.map((b) => [b.label, b.action]), [["[x] review-done", { op: "mark", variable: "review-done", checked: false }]]);
  const { since, ...unstamped } = status().state;
  assert.equal(since, "2026-10-12T09:04:00Z");
  assert.equal(flow({ status: status(undefined, { state: unstamped }) }).at(-1).text, "review-waited：停留满 PT2H", "no entry time: nothing to count from");
  assert.equal(flow({ status: status(undefined, { state: { ...unstamped, since: "2026-10-12T06:00:00Z" } }) }).at(-1).text, "review-waited：停留满 PT2H  已到");
});

test("流程: a current state the board does not know draws the picture and the states, and nothing below them", () => {
  const lost = status(undefined, { state: { id: "ghost", title: "ghost", rev: 1, uses: [], final: false } });
  const rows = flow({ status: lost });
  assert.equal(rows.at(-1).kind, "buttons");
  assert.deepEqual(rows.at(-1).items.map((b) => [b.label, b.primary ?? false]), [["构建", false], ["review", false], ["deploy", false], ["done", false]], "none picked");
  assert.ok(!rows.some((r) => r.key === "state-title"));
  assert.ok(pic(rows).ranks.flat().every((s) => !s.current));
});

test("流程: with no work item the flow tab has no 固化流程 heading over the workflow", () => {
  const rows = pane({ shell: shell(null), coach: { items: [], flows: [], focus: null } });
  assert.ok(!rows.some((r) => r.key === "strict"));
  assert.ok(!rows.some((r) => r.key === "flow-title"), "no workflow named either");
  assert.ok(rows.some((r) => r.kind === "flow"));
});

test("工作项 without a clock: no line under an item that has nothing else to say; none or an open or closed pull request, a current item merged, a stage the board does not know by its id, the backlog's loose items as text once one is bound", () => {
  const board = { ...BOARD, backlog: { key: "branch", items: [{ id: "x", title: "甲", target: "feat/x" }, { id: "z", title: "丙", target: "feat/gone" }, { id: "y", title: "乙", target: "" }] }, items: [
    { id: "feat/x", state: "review", rev: 3, at: "2026-10-12T09:04:00Z", paused: false, end: "merged", commits: 2 },
    { id: "feat/a", state: "build", rev: 1, at: "2026-10-12T08:00:00Z", paused: false, end: "doing", commits: 0, pr: { number: 3, state: "open" }, by: "gemworks" },
    { id: "feat/b", state: "triage", rev: 1, at: "2026-10-12T07:00:00Z", paused: false, end: "doing", pr: { number: 4, state: "closed" } },
    { id: "feat/c", state: "done", rev: 1, at: "2026-10-12T06:00:00Z", paused: false, end: "closed" },
    { id: "feat/d", state: "build", rev: 1, at: "2026-10-12T05:00:00Z", paused: false, end: "doing" },
  ] };
  const rows = items({ board, now: undefined, doneOpen: true });
  assert.deepEqual(look(rows), [
    "§ 待处理", "暂无",
    "§ 在做 3", "feat/a (gemworks 记的 · 构建)", "feat/b (triage)", "feat/d (构建)",
    "§ 已合并 1", "feat/x (当前)",
    "§ 已收尾 1 [收起]", "feat/c (done)",
    "§ 放下 0",
    "§ 待办与进行中", "  x  甲 → feat/x · #review", "  z  丙 → feat/gone", "backlog 中 1 项未关联工作项", "  y  乙（待办）",
  ], "the current work item is bound already: the loose one is listed, not offered to bind");
  const entries = Object.fromEntries(rows.filter((r) => r.kind === "entry").map((r) => [r.title, [r.detail, r.current ?? false]]));
  assert.deepEqual(entries, { "feat/a": ["暂无提交 · PR #3 开着", false], "feat/b": ["PR #4 已关闭", false], "feat/d": [undefined, false], "feat/x": ["2 个提交", true], "feat/c": [undefined, false] });
  assert.deepEqual(rows.filter((r) => r.kind === "text" && r.text.includes("→")).map((r) => r.tone), ["success", "normal"], "the line bound to the current work item stands out");
  assert.deepEqual(look(items({ board, status: null, now: undefined })).slice(-2), ["backlog 中 1 项未关联工作项", "  y  乙（待办）"], "no current work item to bind it to");
});

test("工作项: merged work items with no pull request or worktree are cards, the newest first, closing the local branch alone", () => {
  const merged = (id, at) => ({ id, state: "done", rev: 1, at, paused: false, end: "merged" });
  const board = { ...BOARD, backlog: null, items: [merged("feat/m1", "2026-10-12T08:00:00Z"), merged("feat/m2", "2026-10-12T09:00:00Z")] };
  const rows = itemRows({ board, status: status(), inbox: [], columns: 80, t: wordsFor("zh"), doneOpen: false });
  assert.deepEqual(look(rows).slice(0, 3), [
    "§ 待处理",
    "done  feat/m2 已合并 | 已合入 main / 收尾将删除本地分支（仅当提交已全部合入 main）。 | 收尾 保留",
    "done  feat/m1 已合并 | 已合入 main / 收尾将删除本地分支（仅当提交已全部合入 main）。 | 收尾 保留",
  ]);
  assert.deepEqual(rows[1].actions[0].action, { op: "close-item", id: "feat/m2" }, "no worktree to remove");
});

test("工作项: the jumped-into work item with no flow or start time, the one waiting with no words of its own; the queue by flow with no current work item, the flowless first", () => {
  const me = { id: "feat/x", state: "review", rev: 3, at: "2026-10-12T09:04:00Z", paused: false };
  const waiter = { id: "feat/w", state: "build", rev: 1, at: "2026-10-12T09:00:00Z", paused: false, depends: [{ id: "feat/x", done: false }] };
  const jumped = items({ board: { ...BOARD, backlog: null, items: [me, waiter] } });
  const at = jumped.findIndex((r) => r.key === "jumped");
  assert.deepEqual([jumped[at].text, jumped[at + 2].text], [" · feat/x", "由「feat/w」转入，完成后返回。"]);
  assert.equal(jumped.find((r) => r.key === "item-feat/w").tag, "构建 · ⏳ 等「feat/x」完成", "the work item it waits for, by its id");
  const stray = { ...BOARD, backlog: null, items: [me, waiter], picture: { ...BOARD.picture, flow: { ...BOARD.picture.flow, ranks: [["build", "ghost"], ["review"], ["deploy"], ["done"]] } } };
  assert.deepEqual(items({ board: stray }).find((r) => r.key === "steps").steps.map((s) => s.title), ["构建", "review", "deploy", "done"], "a state the board does not know is no step");
  const flowed = { id: "feat/f", state: "build", rev: 1, at: "2026-10-12T09:00:00Z", paused: false, flow: "开发流程" };
  const loose = { id: "feat/l", state: "build", rev: 1, at: "2026-10-12T08:00:00Z", paused: false };
  const queue = items({ board: { ...BOARD, backlog: null, items: [flowed, loose] }, status: null });
  assert.deepEqual(queue.filter((r) => r.kind === "section" && r.key.startsWith("queued-")).map((r) => [r.text, r.count]), [["在做", 1], ["在做 · 开发流程", 1]]);
  assert.deepEqual(queue.filter((r) => r.kind === "entry").map((r) => r.title), ["feat/l", "feat/f"]);
});

test("产物 under the work items: nothing made is no section; a link with no version or none at all, a file the person gave with no copy yet and its history in its menu", () => {
  const t = wordsFor("zh");
  const empty = { links: [], files: [], images: [], docs: [], code: { commits: 0, files: 0 }, folder: "" };
  assert.deepEqual(artifactRows({ item: "feat/x", written: [], commits: [], made: empty }, "feat/x", { t, columns: 80, menu: null, docsOpen: false }), []);
  const made = { ...empty,
    links: [{ kind: "link", name: "设计稿", open: "https://example.com/d", versions: [{ version: "", at: NOW, size: null }] }, { kind: "link", name: "看板", open: "https://example.com/b", versions: [] }],
    files: [{ kind: "file", name: "uploads/brief.pdf", open: "/w/app/uploads/brief.pdf", versions: [], history: "/w/app/uploads/brief.pdf.gemlhistory", given: true }],
  };
  const rows = artifactRows({ item: "feat/x", written: [], commits: [], made }, "feat/x", { t, columns: 80, menu: "file:uploads/brief.pdf", docsOpen: false });
  assert.deepEqual(rows.filter((r) => r.kind === "entry").map((r) => [r.title, r.detail]), [["设计稿", ""], ["看板", ""], ["brief.pdf", "uploads · 用户提供 · 0 版"]]);
  assert.deepEqual(rows.find((r) => r.kind === "links").items.map((x) => [x.label, x.action]), [
    ["打开", { op: "open-file", path: "/w/app/uploads/brief.pdf" }],
    ["查看历史", { op: "open-file", path: "/w/app/uploads/brief.pdf.gemlhistory" }],
    ["在文件夹里显示", { op: "open-file", path: "/w/app/uploads/brief.pdf", reveal: true }],
  ]);
  const shot = { kind: "image", name: "shots/a.png", open: "/w/app/shots/a.png", versions: [{ version: "2", at: NOW, size: 2048, copy: "/w/copies/a-2.png" }] };
  const pictured = artifactRows({ item: "feat/x", written: [], commits: [], made: { ...empty, images: [shot] } }, "feat/x", { t, columns: 80, now: NOW, menu: "image:shots/a.png", docsOpen: false });
  assert.deepEqual(pictured.find((r) => r.kind === "links").items.map((x) => x.label), ["打开", "打开第 2 版副本", "在文件夹里显示"], "no history kept: none offered");
  assert.equal(sizeText(null), "", "a size not known says nothing");
  assert.deepEqual([lastSegment("../geml-gemworks"), lastSegment("feat/x/"), lastSegment("./")], ["geml-gemworks", "x", "./"], "a path with no name in it is kept whole");
});

test("工具: tools that ran as often as each other stand by name; a classified tool that is not its use's preferred one can be made so", () => {
  const tools = [...ROWS, row("Bash(pnpm test)", { for: "test", row: 8 })];
  const rows = toolRows({ board: { ...BOARD, tools }, columns: 100, t: wordsFor("zh"), usage: { "Bash(zz-check)": 5, "Bash(aa-check)": 5 }, suggestions: [], query: "", menu: "Bash(pnpm test)", naming: null, open: [] });
  assert.deepEqual(rows.filter((r) => r.kind === "tool").slice(0, 2).map((r) => r.name), ["aa-check", "zz-check"]);
  const at = rows.findIndex((r) => r.name === "pnpm test");
  assert.equal(rows[at].use, "跑测试");
  assert.deepEqual(rows[at + 3].items.map((b) => [b.label, b.action]), [
    ["设为同类首选", { op: "learn", lessons: [{ kind: "default", key: "Bash(pnpm test)", use: "test" }] }],
    ["删掉这一行", { op: "learn", lessons: [{ kind: "forget", key: "Bash(pnpm test)" }], confirm: { question: "删掉 Bash(pnpm test) 这一行？之后它按没归类的工具处理。", yes: "删掉" } }],
    ["取消", { op: "tool-menu", key: null }],
  ]);
});

test("记录: an entry's evidence — what it was judged on, which call, on which content and whether that still holds; a refusal with no call is its reason alone", () => {
  const t = wordsFor("zh");
  const snap = (over) => ({ kind: "snapshot", rev: 5, at: NOW, state: "review", cause: "patch", ...over });
  assert.deepEqual(entryDetail(snap({ changed: { "tests-pass": true, n: 2 }, call: "c7", tree: "tree:a1b2c3f" }), BOARD, t), ["凭什么：tests-pass=true n=2", "哪次调用：c7", "在哪份内容上：tree:a1b2c3f", "之后没改过，还算数"]);
  assert.deepEqual(entryDetail(snap({ tree: "tree:0123456789abcdef0123456789abcdef" }), BOARD, t), ["在哪份内容上：tree:0123456789abcdef012…", "内容变了，过期"], "a long tree cut; changed since");
  assert.deepEqual(entryDetail(snap({ tree: "tree:x" }), { ...BOARD, tree: undefined }, t), ["在哪份内容上：tree:x"], "the content now not known: nothing said of it");
  assert.deepEqual(entryDetail(snap({}), BOARD, t), []);
  assert.deepEqual(entryDetail({ kind: "refused", n: 2, rev: 5, at: NOW, tool: "Bash", reason: "r" }, BOARD, t), ["r"]);
  assert.equal(sourceWords("mcp:checker", t), "mcp:checker", "a source of a kind it does not know, as it is");
});

test("记录: what each kind of entry says — a start, a model's move without a judged condition, a signal's value, a rollback, a pause and a resume, evidence by a signal and by the model, a cause it does not know", () => {
  const t = wordsFor("zh");
  const words = (e, sources = {}) => entryWords({ kind: "snapshot", rev: 5, at: NOW, ...e }, BOARD, sources, t);
  assert.deepEqual(words({ state: "build", cause: "enter" }), { label: "开始", text: "进入构建", why: "", tone: "normal" });
  assert.deepEqual(words({ state: "review", cause: "transition", by: "model", from: "build" }), { label: "阶段变更", text: "构建 → review · 模型", why: "", tone: "normal" }, "a machine-judged way out the model took");
  assert.deepEqual(words({ state: "review", cause: "transition", by: "signal", signal: "ci-pass", from: "build" }), { label: "阶段变更", text: "构建 → review · 自动", why: "凭：ci-pass ✓", tone: "normal" }, "a signal's value not in the entry counts as set");
  assert.equal(words({ state: "ghost", cause: "transition", by: "signal" }).text, " → ghost · 自动", "a state it does not know by its id; no from, nothing before the arrow");
  assert.deepEqual(words({ state: "build", cause: "rollback", by: "human" }), { label: "阶段变更", text: "回到构建 · 你", why: "", tone: "normal" });
  assert.deepEqual(words({ state: "review", cause: "pause" }), { label: "阶段变更", text: "已暂停", why: "", tone: "warning" });
  assert.deepEqual(words({ state: "review", cause: "resume" }), { label: "阶段变更", text: "已继续", why: "", tone: "normal" });
  assert.deepEqual(words({ state: "review", cause: "patch", by: "signal", signal: "tests-pass", changed: { "tests-pass": true } }, { "tests-pass": "tool:test" }), { label: "凭据", text: "tests-pass ✓", why: "跑 test 得来", tone: "normal" });
  assert.deepEqual(words({ state: "review", cause: "patch", by: "model", changed: { notes: "x", "tests-pass": false } }), { label: "凭据", text: 'notes="x"、tests-pass ✗', why: "模型写的", tone: "normal" });
  assert.deepEqual(words({ state: "review", cause: "import" }), { label: "import", text: "review", why: "", tone: "normal" });
  assert.equal(entryWords({ kind: "refused", n: 1, rev: 1, at: NOW, tool: "Bash", reason: "r" }, BOARD, {}, t).text, "Bash", "a refusal with no key: its tool");
});

test("记录: a dependency with no title, flow, prompt or files; with no clock no day headings; a day's heading never stands alone at the bottom", () => {
  const t = wordsFor("zh");
  const st = status(undefined, { depends: [{ id: "m/logo", done: true, since: "2026-10-12T09:01:30Z", at: "2026-10-12T09:03:30Z", wrote: [] }] });
  const journal = (over = {}) => journalRows({ board: BOARD, status: st, filter: "all", menu: null, evidence: null, prompts: [], columns: 100, maxRows: 40, t, now: NOW, ...over });
  const bare = journal({ now: undefined });
  assert.deepEqual(bare.filter((r) => r.kind === "event").map((r) => [r.label, r.text, r.why, r.turn]), [
    ["恢复", "feat/x", "", ""], ["依赖完成", "「m/logo」完成", "", ""], ["挂起", "feat/x，等「m/logo」", "", ""],
  ], "named by its id, with no turn to point at");
  assert.ok(!bare.some((r) => r.kind === "section"), "no clock: no day headings");
  assert.deepEqual(journal({ maxRows: 4 }).map((r) => r.kind), ["buttons", "text", "section", "event"]);
  assert.deepEqual(journal({ maxRows: 3 }).map((r) => r.kind), ["buttons", "text"], "no room for an entry under its heading: neither");
  const waiting = status(undefined, { depends: [{ id: "m/next", done: false, wrote: [] }] });
  assert.deepEqual(journalRows({ board: BOARD, status: waiting, filter: "depends", menu: null, evidence: null, prompts: [], columns: 100, maxRows: 40, t, now: NOW }).at(-1), { kind: "text", text: "暂无", tone: "dim" }, "waiting with nothing happened yet");
});

test("记录: an entry's menu jumps to its turn's row; its evidence shows on 详情, and 收起 hides it again", () => {
  const t = wordsFor("zh");
  const st = status(undefined, { depends: [{ id: "m/logo", title: "标志", done: true, since: "2026-10-12T09:01:30Z", at: "2026-10-12T09:03:30Z", wrote: ["brand/mark.svg"] }] });
  const prompts = [{ id: "p1", uuid: "row-p1", at: "2026-10-12T09:01:00Z", text: "做个标志", tools: 1, refusals: 0, entered: [], signals: [] }];
  const journal = (menu, evidence) => journalRows({ board: BOARD, status: st, filter: "all", menu, evidence, prompts, columns: 100, maxRows: 40, t, now: NOW });
  const waits = journal("waits-m/logo", null);
  assert.deepEqual(waits[waits.findIndex((r) => r.key === "waits-m/logo") + 1].items[0].action, { op: "locate", id: "p1", uuid: "row-p1" });
  const hidden = journal("done-m/logo", null);
  assert.deepEqual(hidden[hidden.findIndex((r) => r.key === "done-m/logo") + 1].items[0], { key: "evidence-done-m/logo", label: "详情", action: { op: "evidence", entry: "done-m/logo" } });
  const shown = journal("done-m/logo", "done-m/logo");
  assert.deepEqual(shown[shown.findIndex((r) => r.key === "done-m/logo") + 1].items.map((b) => [b.label, b.action]), [["收起", { op: "evidence", entry: null }], ["取消", { op: "expand", entry: null }]]);
});

test("会话 on the pane: where it runs beside 整理, a turn's moves as what it did, the newest turns alone with a press for the rest, the file last exported under the session it was of", () => {
  const p = (id, at, did) => ({ id, at, text: `${id} 的提示词`, tools: 1, refusals: 0, entered: [], signals: [], did });
  const prompts = [p("p1", "2026-10-12T09:00:10Z", "好了"), p("p2", "2026-10-12T09:05:00Z", "也好了")];
  const rows = pane({ board: null, tab: "sessions", prompts, env: ["运行于 PC"], moved: () => ({ words: ["→ 甲 ✓讨论"] }), scrolls: false, unfolded: { id: "p2", answer: "答" }, sessionLimit: 1, picked: ["p1"], exported: "out/s.geml" });
  assert.deepEqual([rows[0].note, rows[0].actions.map((b) => b.label)], ["运行于 PC", ["整理"]]);
  assert.deepEqual(rows[1], { kind: "buttons", items: [{ key: "exported", label: "已导出 out/s.geml", action: { op: "open-file", path: "/w/app/out/s.geml" } }] });
  const turns = rows.filter((r) => r.kind === "turn");
  assert.deepEqual(turns.map((r) => [r.key, r.did, r.open, r.icons.length, r.check]), [["prompt-p2", "→ 甲 ✓讨论", true, 0, undefined]], "the newest alone; picked turns show no box until 整理");
  assert.deepEqual(rows.at(-1), { kind: "buttons", items: [{ key: "turns-more", label: "还有 1 轮", action: { op: "turns-more" } }] });
  const committed = { ...BOARD, artifacts: { item: "feat/x", written: [], commits: [{ sha: "e18b116d00000000", at: "2026-10-12T09:06:00Z", subject: "s", files: [], ours: true }] } };
  assert.equal(pane({ board: committed, tab: "sessions", prompts }).find((r) => r.key === "prompt-p2").did, "e18b116d 也好了", "the commits the board knows, under the turn they were made in");
  for (const exported of ["", null]) assert.ok(!pane({ board: null, tab: "sessions", prompts, exported }).some((r) => r.kind === "buttons" && r.items[0].key === "exported"), `nothing exported (${JSON.stringify(exported)})`);
  const at = "2026-10-20T08:00:00Z";
  const project = { sessions: [{ id: "me", host: "claude-code", started: at, last: at, turns: [], decisions: [], files: [], commits: [] }, { id: "cx", host: "codex", started: at, last: at, turns: [], decisions: [], files: [], commits: [] }], own: "me", open: null };
  const theirs = pane({ board: null, tab: "sessions", project, exported: "D:/exports/cx.geml", exportedFor: "cx" });
  assert.ok(!theirs.slice(0, 2).some((r) => r.kind === "buttons"), "not under this session");
  assert.deepEqual(theirs[theirs.findIndex((r) => r.key === "session-cx") + 1].items[0].action, { op: "open-file", path: "D:/exports/cx.geml" }, "under the session it was of; a path outside the project as it is");
});

test("会话: one work item's prompts with no record of what each moved lists none; with no clock no day headings", () => {
  const p = (id, at) => ({ id, at, text: `${id} 的提示词`, tools: 1, refusals: 0, entered: [], signals: [], did: "好了" });
  const prompts = [p("p1", "2026-10-11T09:00:00Z"), p("p2", "2026-10-12T09:00:00Z")];
  assert.deepEqual(sessionRows(prompts, [], wordsFor("zh"), 100, NOW, { item: "l1", runs: [] }).map((r) => r.kind), ["buttons"], "only the way back to all");
  assert.deepEqual(sessionRows(prompts, [], wordsFor("zh"), 100).map((r) => r.kind), ["turn", "turn"], "two days, no headings without a clock");
});

test("会话 across the project with no clock: times as times; decisions made at once keep their order, the newest first; sessions last heard at once too; a turn with no decision or gist says nothing", () => {
  const t = wordsFor("zh");
  const one = (id, over = {}) => ({ id, host: "claude-code", started: "2026-10-12T07:00:00Z", last: "2026-10-12T08:00:00Z", turns: [], decisions: [], files: [], commits: [], ...over });
  const d = (at, text) => ({ turn: 1, at, text });
  const decided = decisionRows({ sessions: [one("me", { decisions: [d("2026-10-12T08:00:00Z", "甲"), d("2026-10-12T09:00:00Z", "乙"), d("2026-10-12T09:00:00Z", "丙")] })], own: "me", open: null }, t, 100);
  assert.deepEqual(decided.slice(1).map((r) => [r.lines.join(""), r.tag.replace(/\d\d:\d\d/, "hh:mm")]), [["模型记：乙", "本会话 hh:mm"], ["模型记：丙", "本会话 hh:mm"], ["模型记：甲", "本会话 hh:mm"]]);
  const sessions = [one("me"), one("b", { branch: "feat/b" }), one("c", { branch: "feat/c" }), one("old", { branch: "feat/old", last: "2026-10-12T07:30:00Z" }), one("g", { host: "gemini", branch: "feat/g", last: "2026-10-12T08:30:00Z", turns: [{ turn: 1, at: "2026-10-12T08:30:00Z", prompt: "问一句", decisions: [] }] })];
  const others = othersRows({ sessions, own: "me", open: "g" }, t, 100);
  assert.deepEqual(others.filter((r) => r.kind === "entry").map((r) => r.title), ["Gemini · feat/g", "Claude · feat/b", "Claude · feat/c", "Claude · feat/old"], "the latest first; heard at once, as they were");
  assert.deepEqual(others.filter((r) => r.kind === "turn").map((r) => [r.text, r.did]), [["问一句", ""]]);
  assert.deepEqual(["claude-code", "codex", "gemini", "dsh", "pi", "cursor"].map(hostName), ["Claude", "Codex", "Gemini", "DeepSeek", "pi", "cursor"], "a host it does not know by its own name");
  assert.equal(sessionLabel(one("p", { host: "pi" }), "me"), "pi", "nowhere said: the host alone");
});

test("记忆: one with no date has no tag; its summary being edited, the press beside it closes the field", () => {
  const t = wordsFor("zh");
  const list = { dir: "/h/m", entries: [{ file: "a.md", title: "甲", hook: "一", type: "feedback", at: "" }] };
  const rows = memoryRows({ list, group: null, menu: "a.md", edit: "a.md", shown: 10 }, t, 100);
  const entry = rows.find((r) => r.key === "memory-a.md");
  assert.deepEqual([entry.tag, entry.open], ["", true]);
  assert.deepEqual(rows.find((r) => r.key === "memory-edit-a.md"), { kind: "input", key: "memory-edit-a.md", field: "memory-hook", placeholder: "摘要", value: "一", target: "a.md" });
  assert.deepEqual(rows.find((r) => r.kind === "menu").items.map((b) => [b.label, b.action]), [
    ["打开", { op: "open-file", path: "/h/m/a.md" }], ["改摘要", { op: "memory-edit", file: null }], ["删除", { op: "memory-delete", file: "a.md" }],
  ]);
  const opened = memoryRows({ list, group: null, menu: "a.md", edit: null, shown: 10 }, t, 100);
  assert.ok(!opened.some((r) => r.kind === "input"), "not being edited: no field");
  assert.deepEqual(opened.find((r) => r.kind === "menu").items[1].action, { op: "memory-edit", file: "a.md" }, "改摘要 opens the field");
});

const coachFlows = COACH_FLOWS.map((name) => readCoachFlow(name, readFileSync(new URL(`../../coach/${name}.geml`, import.meta.url), "utf8")));
const wi = (over = {}) => ({ id: "a1", flow: "design", title: "流程手册", state: "mockup", needs: "", goal: "", status: "open", at: "2026-10-12T09:00:00Z", session: "s1", met: [{ step: "discuss", at: "2026-10-12T09:00:00Z", turn: 1 }], next: "出样稿", ...over });

test("工作项 on the pane with the coach: the groups listed whole, the item unfolded, a press on its way, what it made beside its arrow", () => {
  const madeAll = { entries: [{ item: "a1", kind: "file", name: "mock.png", open: "/w/app/mock.png", versions: 1, version: "1", at: NOW }] };
  const gone = [{ id: "a1", next: "出样稿", at: wi().at, wait: 1, ends: 0 }];
  const rows = pane({ tab: "items", madeAll, coach: { items: [wi(), wi({ id: "h1", title: "放着的", status: "held" })], flows: coachFlows, focus: null, own: "s1", open: ["held"], unfolded: "a1", sessions: [], gone, doing: null } });
  const a1 = rows.find((r) => r.key === "work-a1");
  assert.deepEqual([a1.detail, a1.made.label, a1.open.action], ["排队中 出样稿", "产物 1 ›", { op: "work-unfold", id: null }]);
  assert.equal(rows[rows.indexOf(a1) + 1].text, "还没有经过");
  assert.deepEqual(rows.find((r) => r.key === "work-held").fold.label, "收起");
  assert.ok(rows.some((r) => r.key === "work-h1"));
});

test("流程 on the pane with the coach: the work under its flow as the person's turn has it, the cards and changes waiting, the rules on its steps, a later page of the practices for every time", () => {
  const anywhere = Array.from({ length: 25 }, (_, n) => ({ id: `w${n}`, flow: "*", step: "*", text: `第 ${n} 条`, why: "", at: "2026-10-01T00:00:00Z", by: "person", layer: "personal" }));
  const proposals = [{ id: "q1", kind: "add-step", flow: "design", after: "discuss", step: { id: "brief", title: "写简报", need: "", judge: "model", prevents: "" }, why: "", at: NOW, by: "model", status: "open" }];
  const rules = [{ id: "r1", flow: "design", requires: "mockup", key: "Bash(x)", text: "样稿过了才写", why: "", at: NOW, layer: "project" }];
  const ledger = { cards: [{ kind: "repeat", key: "repeat:t1", theme: "t1", rule: "先给样稿", n: 3, quotes: [] }], counts: {} };
  const rows = pane({ coach: { items: [wi()], flows: coachFlows, focus: null, practices: anywhere, expanded: ["design", "*"], anywhereFrom: 20, own: "s1", unfolded: null, sessions: [], gone: [], doing: { id: "a1", next: "出样稿", at: wi().at }, proposals, rules, skipped: [{ flow: "design", step: "mockup", skipped: 4 }], ledger } });
  assert.equal(rows.find((r) => r.key === "work-a1").detail, "我在做：出样稿");
  assert.equal(rows.find((r) => r.key === "ledger-repeat:t1").title, "重复纠正 3 次：先给样稿");
  assert.equal(rows.find((r) => r.key === "proposal-q1").title, "在「讨论」后面加一步「写简报」");
  assert.deepEqual(rows.find((r) => r.key === "step-design-mockup").rules, ["规定：样稿过了才写"]);
  assert.equal(rows.find((r) => r.key === "skipped-design-mockup").title, "「出样稿」最近 5 件里 4 件跳过了，删掉这一步吗？");
  assert.equal(rows.find((r) => r.key === "manual-anywhere-first").label, "前 20 条已收起 · 回到开头");
});

test("产物 on the pane: an artifact's work item by its title, ✓ once done; a flow's work item by its title or id; one no work item names, and one picked with no coach or board", () => {
  const e = (item, name) => ({ item, kind: "file", name, open: `/w/app/${name}`, versions: 1, version: "1", at: NOW });
  const madeAll = { entries: [e("a1", "a.png"), e("a2", "b.png"), e("feat/x", "c.png"), e(".geml/m/t", "d.png"), e("zz", "e.png")] };
  const board = { ...BOARD, items: [...BOARD.items, { id: ".geml/m/t", state: "build", rev: 1, at: NOW, paused: false, title: "标题事项" }] };
  const rows = pane({ tab: "made", board, madeAll, coach: { items: [wi({ status: "done" }), wi({ id: "a2", title: "还在做的" })], flows: coachFlows, focus: null } });
  assert.deepEqual(rows.filter((r) => r.kind === "entry").map((r) => [r.title, r.detail.split(" · ")[0]]), [["a.png", "✓ 流程手册"], ["b.png", "还在做的"], ["c.png", "feat/x"], ["d.png", "标题事项"], ["e.png", "工作项之前"]]);
  const picked = pane({ tab: "made", board: null, madeAll, madeView: { kind: "all", shown: 0, item: "a1" } });
  assert.equal(picked[0].title, "只看：工作项之前", "no coach and no board to name it");
});
