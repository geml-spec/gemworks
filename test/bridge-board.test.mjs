// The board and the band's repository facts as the bridge answers them: the work items with journals, what the
// current one made, the backlog, and the attention op's pull requests and version bump.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gitRepo, hook, withWorkflow } from "./helpers/repo.mjs";

const WS_DEV = fileURLToPath(new URL("./fixtures/ws-dev/", import.meta.url));
const MATTER = fileURLToPath(new URL("../flows/strict/matter/", import.meta.url));
const NO_GH = { GEMWORKS_GH: "gh-definitely-not-installed" };
const git = (root, args, env = {}) => spawnSync("git", ["-C", root, ...args], { encoding: "utf8", env: { ...process.env, ...env } });
const commit = (root, file, text, subject, env = {}) => {
  mkdirSync(join(root, file, ".."), { recursive: true });
  writeFileSync(join(root, file), text);
  git(root, ["add", file]);
  git(root, ["commit", "-qm", subject], env);
};
const project = (branch = "feat/x") => {
  const root = gitRepo(branch);
  withWorkflow(root, WS_DEV, "dev");
  return root;
};
const BACKLOG = '=== meta\ntitle = "Backlog"\nprofile = "geml-statechart/v1"\n===\n\n=== table {#backlog}\n| id | title | branch |\n|---|---|---|\n| dark-mode | 设置页支持深色模式 | |\n===\n';

/** A flow of one step a person approves, its way out unlabelled; `unit` names its work items' files, else they are branches. */
const tinyFlow = (unit) => `=== meta
title = "Tiny"
profile = "geml-statechart/v1"
${unit !== undefined ? `flow-unit = "file:${unit}"\n` : ""}===

=== diagram {#flow format=geml-statechart}
{
  "initial": "draft",
  "states": {
    "draft": { "title": "Draft", "rules": ["edit"] },
    "out": { "title": "Shipped", "final": true }
  },
  "transitions": [
    { "from": "draft", "to": "out", "approval": true }
  ]
}
===
`;
const withTiny = (root, unit) => {
  mkdirSync(join(root, ".geml", "workflows", "tiny"), { recursive: true });
  writeFileSync(join(root, ".geml", "workflows", "tiny", "flow.geml"), tinyFlow(unit));
  writeFileSync(join(root, ".geml", "project.geml"), '=== meta\nprofile = "geml-statechart/v1"\nflow-workflow = "tiny"\n===\n');
};

test("board on a branch that is no work item: no journals to list, no timeline, nothing made", () => {
  const root = project("main");
  const r = hook(root, { op: "board" }, NO_GH);
  assert.equal(r.ok, true, r.error);
  assert.deepEqual(r.shell.status.item, { kind: "inactive", reason: "main · not tracked (work items are branches)" });
  assert.deepEqual([r.board.items, r.board.timeline, r.board.artifacts], [[], [], undefined]);
  assert.equal(r.board.states.length, 5, "the graph is drawn all the same");
});

test("board: the backlog's to-dos come with the graph", () => {
  const root = project();
  writeFileSync(join(root, ".geml", "backlog.geml"), BACKLOG);
  assert.deepEqual(hook(root, { op: "board" }, NO_GH).board.backlog, { key: "branch", items: [{ id: "dark-mode", title: "设置页支持深色模式", target: "" }] });
});

test("board: a journal with no revision is left out; one whose workflow is gone names it, with no flow or stage of its own", () => {
  const root = project();
  hook(root, { op: "status" });
  const journal = readFileSync(join(root, ".geml", "journals", "feat", "x.geml"), "utf8");
  writeFileSync(join(root, ".geml", "journals", "feat", "gone.geml"), journal.replace('"item":"feat/x"', '"item":"feat/gone"').replace(".geml/workflows/dev/flow.geml", ".geml/workflows/gone.geml"));
  writeFileSync(join(root, ".geml", "journals", "feat", "empty.geml"), '=== meta\ntitle = "gemworks journal"\n===\n');
  const items = hook(root, { op: "board" }, NO_GH).board.items;
  assert.deepEqual(items.map((i) => i.id), ["feat/gone", "feat/x"], "the journal with no revision is no work item");
  const gone = items[0];
  assert.deepEqual([gone.workflow, gone.state, gone.flow, gone.stateTitle, gone.asks], ["gone", "build", undefined, undefined, undefined], "its workflow named, no statechart to read a stage title or ways out from");
  assert.equal(items[1].flow, "开发流程");
});

test("board: a document two of the branch's commits changed counts both; deleted since, the made tab opens where it was", () => {
  const root = project();
  hook(root, { op: "status" });
  commit(root, "README.md", "# one\n", "docs: one");
  commit(root, "README.md", "# two\n", "docs: two");
  const art = hook(root, { op: "board" }, NO_GH).board.artifacts;
  assert.deepEqual(art.commits.map((c) => c.subject), ["docs: two", "docs: one"]);
  assert.deepEqual(art.made.docs.map((d) => [d.path, d.commits]), [["README.md", 2]], "one document, changed by two commits");
  assert.deepEqual(art.made.code, { commits: 2, files: 1 });
  rmSync(join(root, "README.md"));
  const made = hook(root, { op: "made" }).made.entries;
  assert.deepEqual(made.map((e) => [e.item, e.kind, e.name, e.versions]), [["feat/x", "doc", "README.md", 1]]);
  assert.equal(made[0].open, join(root, "README.md"), "no copy of a document git keeps: it opens where it was");
});

test("board: a GEML file recorded twice keeps one copy, the newest; its older version is in the copy's history", () => {
  const root = project();
  writeFileSync(join(root, ".gitignore"), "out/\n");
  mkdirSync(join(root, "out"));
  hook(root, { op: "status" });
  writeFileSync(join(root, "out", "notes.geml"), '=== meta\ntitle = "notes"\n===\n\none\n');
  assert.match(hook(root, { op: "artifact", kind: "file", where: "out/notes.geml" }).text, /^Recorded out\/notes\.geml \(version 1\)/);
  writeFileSync(join(root, "out", "notes.geml"), '=== meta\ntitle = "notes"\n===\n\none, and then two\n');
  assert.match(hook(root, { op: "artifact", kind: "file", where: "out/notes.geml" }).text, /\(version 2\)/);
  const [file] = hook(root, { op: "board" }, NO_GH).board.artifacts.made.files;
  assert.equal(file.name, "out/notes.geml");
  assert.deepEqual(file.versions.map((v) => [v.version, v.copy !== undefined]), [["2", true], ["1", false]], "the newest has the copy; the older lives in its history");
  assert.equal(typeof file.history, "string");
  assert.match(readFileSync(file.versions[0].copy, "utf8"), /one, and then two/);
});

test("board: an approval with no label of its own is offered under its target state's title", () => {
  const root = gitRepo();
  withTiny(root);
  hook(root, { op: "status" });
  const [item] = hook(root, { op: "board" }, NO_GH).board.items;
  assert.deepEqual(item.asks.map((a) => [a.to, a.label, a.final]), [["out", "Shipped", true]]);
});

test("board, a file work item: a commit found both since the journal began and by the item's file is listed once", () => {
  const root = gitRepo();
  withTiny(root, "notes/*.geml");
  const earlier = new Date(Date.now() - 3_600_000).toISOString();
  commit(root, "notes/a.geml", '=== meta\ntitle = "A note"\n===\n\nfirst\n', "notes: start a", { GIT_AUTHOR_DATE: earlier, GIT_COMMITTER_DATE: earlier });
  const lastFile = { lastFile: "notes/a.geml" };
  assert.equal(hook(root, { op: "status", ...lastFile }).shell.status.item.id, "notes/a");
  const later = new Date(Date.now() + 3_600_000).toISOString();
  commit(root, "notes/a.geml", '=== meta\ntitle = "A note"\n===\n\nsecond\n', "notes: grow a", { GIT_AUTHOR_DATE: later, GIT_COMMITTER_DATE: later });
  const art = hook(root, { op: "board", ...lastFile }, NO_GH).board.artifacts;
  assert.equal(art.file, "notes/a.geml");
  assert.deepEqual(art.commits.map((c) => [c.subject, c.ours]), [["notes: grow a", true]], "one commit, once");
});

test("board, file work items beside the branch: an item's about comes along; one it depends on that has no journal is waited for, unnamed", () => {
  const root = project();
  cpSync(MATTER, join(root, ".geml", "workflows", "matter"), { recursive: true });
  mkdirSync(join(root, ".geml", "matters"));
  const styles = ".geml/matters/styles.geml";
  writeFileSync(join(root, styles), '=== meta\ntitle = "样式"\nabout = "画布换上新标志"\ndepends = ".geml/matters/logo"\n===\n');
  hook(root, { op: "status", lastFile: styles });
  const items = hook(root, { op: "board" }, NO_GH).board.items;
  const s = items.find((i) => i.id === ".geml/matters/styles");
  assert.equal(s.about, "画布换上新标志");
  assert.deepEqual(s.depends, [{ id: ".geml/matters/logo", done: false }], "no work item of that id: no title, no time");
  assert.equal(s.asks, undefined, "waiting is nobody's turn");
});

/** A gh stand-in for the attention op: one open pull request of feat/x, green, merged since by the list of all. */
function attentionGh() {
  const dir = mkdtempSync(join(tmpdir(), "gemworks-gh-attention-"));
  const bin = join(dir, "gh-attention.cjs");
  writeFileSync(bin, `#!/usr/bin/env node
const a = process.argv.slice(2).join(" ");
const say = (v) => process.stdout.write(JSON.stringify(v) + "\\n");
if (a.startsWith("pr list --state open")) say([{ number: 7, headRefName: "feat/x", statusCheckRollup: [{ name: "ci", status: "COMPLETED", conclusion: "SUCCESS" }] }]);
else if (a.startsWith("pr list --state all")) say([{ number: 7, state: "MERGED", headRefName: "feat/x" }]);
else if (a.startsWith("pr list --head")) say([{ state: "MERGED", number: 7 }]);
else if (a.startsWith("run list")) say([]);
else process.exit(1);
`);
  chmodSync(bin, 0o755);
  return { GEMWORKS_GH: bin };
}

test("attention with gh answering: the open pull requests, nothing unread, a version bumped and not committed; the merged pull request reaches the board's outline", () => {
  const root = project();
  commit(root, "package.json", '{ "name": "p", "version": "1.0.0" }\n', "chore: package");
  hook(root, { op: "status" });
  writeFileSync(join(root, "package.json"), '{ "name": "p", "version": "1.0.1" }\n');
  const gh = attentionGh();
  const r = hook(root, { op: "attention" }, gh);
  assert.equal(r.ok, true, r.error);
  assert.deepEqual(r.attention.prs, [{ number: 7, branch: "feat/x", green: true, failing: [] }]);
  assert.deepEqual(r.attention.ahead, []);
  assert.equal(r.attention.unread, undefined, "git and gh both answered: nothing is named unread");
  assert.deepEqual(r.attention.bump, { version: "1.0.1", path: "package.json" });
  const [item] = hook(root, { op: "board" }, gh).board.items;
  assert.equal(item.pr?.number, 7, "the outline learned the branch's pull request");
});
