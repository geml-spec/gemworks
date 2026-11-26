// The bridge's other ops, each as the hooks module sends it: status with what the last answer reported, bind, export
// and import, the memory, the practices, the outward actions, sign-off sheets, learn and before beyond the session's
// checkout, the handoff an answer on another work item carries, and where the session runs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { hostname, tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gitRepo, hook, withWorkflow } from "./helpers/repo.mjs";
import { recordWork, workItemsAt, coachFlowsAt } from "../dist/loop.js";
import { signoffPath } from "../dist/store/signoffs.js";

const WS_DEV = fileURLToPath(new URL("./fixtures/ws-dev/", import.meta.url));
const NO_GH = { GEMWORKS_GH: "gh-definitely-not-installed" };
const project = (branch = "feat/x") => {
  const root = gitRepo(branch);
  withWorkflow(root, WS_DEV, "dev");
  return root;
};
/** A home folder of its own: what the bridge keeps under ~ (trash, the person's practices) goes there, not into the machine's. */
const ownHome = () => {
  const home = mkdtempSync(join(tmpdir(), "gemworks-home-"));
  return { home, env: { HOME: home, USERPROFILE: home } };
};
const switchTo = (root, ...args) => spawnSync("git", ["-C", root, "switch", "-q", ...args]);

test("status: the gh availability the last answer reported comes back unasked, its reason with it", () => {
  const r = hook(project(), { op: "status", gh: { available: false, reason: "gh is not logged in" } });
  assert.deepEqual(r.shell.status.gh, { available: false, reason: "gh is not logged in" });
});

test("status: a context document that is not one gives no context key", () => {
  const root = project("main");
  writeFileSync(join(root, ".geml", "context.geml"), "not a context document\n");
  assert.equal(hook(root, { op: "status" }).shell.contextKey, null);
});

test("status with migrate: a workflow directory of the earlier layout becomes one file, the directory kept in the trash", () => {
  const root = project();
  const { home, env } = ownHome();
  const r = hook(root, { op: "status", migrate: true }, env);
  assert.equal(r.ok, true, r.error);
  assert.equal(r.shell.status.workflow.path, ".geml/workflows/dev.geml");
  assert.ok(existsSync(join(root, ".geml", "workflows", "dev.geml")));
  assert.ok(!existsSync(join(root, ".geml", "workflows", "dev")), "the directory moved out");
  assert.match(readdirSync(join(home, ".gemworks", "trash")).join(), /-layout$/);
});

test("bind: a branch that is no work item, or a project with no backlog, is an error answer", () => {
  const main = project("main");
  assert.deepEqual(hook(main, { op: "bind", id: "dark-mode" }).error, "main · not tracked (work items are branches)");
  assert.deepEqual(hook(project(), { op: "bind", id: "dark-mode" }).error, "no .geml/backlog.geml");
});

test("export on a branch that is no work item: a text is a share of no item; a journal there is none of is an error answer", () => {
  const root = project("main");
  const text = hook(root, { op: "export", kind: "text", format: "md", text: "hi" });
  assert.match(text.exported.path, /^\.geml\/exports\/share-no-item-\d{8}T\d{6}Z\.md$/);
  const journal = hook(root, { op: "export", kind: "journal", format: "md" });
  assert.deepEqual([journal.ok, journal.error], [false, "main · not tracked (work items are branches)"]);
});

test("export: a name with no letter in it is named item; a workflow with no name is named by its own, and one in a single file goes as a directory another project imports", () => {
  const root = project();
  assert.equal(hook(root, { op: "export", kind: "text", format: "md", text: "hi", name: "???" }).exported.path, ".geml/exports/item.md");
  assert.match(hook(root, { op: "export", kind: "workflow", format: "geml" }).exported.path, /^\.geml\/exports\/workflow-dev-\d{8}T\d{6}Z$/);
  const single = gitRepo();
  assert.equal(hook(single, { op: "add", workflow: "coding" }).added.name, "coding");
  const out = hook(single, { op: "export", kind: "workflow", format: "geml", name: "coding-copy" });
  assert.deepEqual(readdirSync(join(single, out.exported.path)).sort(), ["flow.geml", "tools.geml"]);
  assert.equal(readFileSync(join(single, out.exported.path, "flow.geml"), "utf8"), out.exported.text);
  const other = gitRepo();
  const imported = hook(other, { op: "import", path: join(single, out.exported.path) });
  assert.deepEqual([imported.ok, imported.added, imported.shell.status.workflow.name], [true, { name: "coding-copy", activated: true }, "coding-copy"]);
  assert.ok(imported.workflows.includes("coding") && imported.installed.includes("coding-copy"));
  const refused = hook(other, { op: "import", path: "notes.txt" });
  assert.deepEqual([refused.ok, refused.error, refused.shell.status.workflow.name], [false, "notes.txt is neither a workflow directory nor a .geml file", "coding-copy"]);
});

test("memory: the project's Claude Code memory listed; a hook rewritten and a memory deleted, the index kept in the trash first; one not listed is an error answer", () => {
  const root = gitRepo();
  const { home, env } = ownHome();
  const transcripts = mkdtempSync(join(tmpdir(), "gemworks-transcripts-"));
  const none = hook(root, { op: "memory", transcripts });
  assert.deepEqual([none.ok, none.memory.entries], [true, []]);
  const dir = none.memory.dir;
  assert.ok(dir.startsWith(transcripts) && dir.endsWith("memory"), "under the projects folder named");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "MEMORY.md"), "- [Reply in Chinese](reply.md) — every message\n- [Old](old.md) — gone soon\n");
  writeFileSync(join(dir, "reply.md"), "---\ntype: feedback\n---\nreply in Chinese\n");
  writeFileSync(join(dir, "old.md"), "old\n");
  assert.deepEqual(hook(root, { op: "memory", transcripts }).memory.entries.map((e) => [e.file, e.title, e.hook]).sort(), [["old.md", "Old", "gone soon"], ["reply.md", "Reply in Chinese", "every message"]]);
  const set = hook(root, { op: "memory-set", file: "reply.md", hook: "progress, questions and summaries", transcripts }, env);
  assert.deepEqual(set.memory.entries.find((e) => e.file === "reply.md").hook, "progress, questions and summaries");
  const gone = hook(root, { op: "memory-delete", file: "old.md", transcripts }, env);
  assert.deepEqual(gone.memory.entries.map((e) => e.file), ["reply.md"]);
  assert.ok(!existsSync(join(dir, "old.md")));
  const trash = join(home, ".gemworks", "trash");
  assert.ok(readdirSync(trash).every((d) => /-memory$/.test(d) && existsSync(join(trash, d, "MEMORY.md"))), "the index copied before each change");
  assert.deepEqual(hook(root, { op: "memory-set", file: "nope.md", hook: "x", transcripts }, env).error, "no memory nope.md to change");
  assert.deepEqual(hook(root, { op: "memory-delete", file: "nope.md", transcripts }, env).error, "no memory nope.md to delete");
});

test("practice-set: a practice moved to the person's layer and made one for any time", () => {
  const root = gitRepo();
  const { env } = ownHome();
  const p = { id: "z", flow: "bugfix", step: "fix", text: "同一现象再现，先回头读引擎契约", why: "10-22", at: "2026-10-22T10:00:00Z", by: "model", layer: "project" };
  hook(root, { op: "practice-add", practices: [p] }, env);
  const r = hook(root, { op: "practice-set", id: "z", layer: "personal", everywhere: true }, env);
  assert.equal(r.ok, true, r.error);
  const z = r.practices.list.find((x) => x.id === "z");
  assert.deepEqual([z.layer, z.flow, z.step, z.deleted], ["personal", "*", "*", undefined]);
});

test("outward: an action forgotten is no longer let through", () => {
  const root = gitRepo();
  assert.deepEqual(hook(root, { op: "outward", allow: ["Bash(git push*)", "Bash(npm publish)"] }).outward, ["Bash(git push*)", "Bash(npm publish)"]);
  assert.deepEqual(hook(root, { op: "outward", forget: ["Bash(npm publish)"] }).outward, ["Bash(git push*)"]);
});

test("signoff: a work item's sheet written again from the record, in the language asked", () => {
  const root = project();
  assert.equal(recordWork(root, "claude-code", "s1", { items: [{ title: "导出", flow: "feature", met: ["mockup"], said: "行", needs: "实现" }] }, "2026-11-09T08:00:00.000Z").ok, true);
  const [item] = workItemsAt(root, coachFlowsAt(root));
  const sheet = signoffPath(root, item.id);
  rmSync(sheet);
  const r = hook(root, { op: "signoff", ids: [item.id], lang: "en" });
  assert.equal(r.ok, true, r.error);
  const text = readFileSync(sheet, "utf8");
  assert.ok(text.includes("导出") && !/状态|进行中/.test(text), "the item's own title, the sheet's words in English");
});

test("signoff with no workflow, the light flows alone as a project starts: the sheet is written just the same", () => {
  const root = gitRepo("feat/x");
  assert.equal(recordWork(root, "claude-code", "s1", { items: [{ title: "导出", flow: "feature", met: ["mockup"], said: "行", needs: "实现" }] }, "2026-11-09T08:00:00.000Z").ok, true);
  const [item] = workItemsAt(root, coachFlowsAt(root));
  const sheet = signoffPath(root, item.id);
  rmSync(sheet);
  const r = hook(root, { op: "signoff", ids: [item.id], lang: "en" });
  assert.deepEqual([r.ok, r.shell.status], [true, null], "no workflow");
  assert.ok(readFileSync(sheet, "utf8").includes("导出"), "the item's sheet, written again");
});

test("learn for a call that acts outside any project with a workflow is an error answer: no work item to learn it for", () => {
  const root = project();
  const away = mkdtempSync(join(tmpdir(), "gemworks-away-"));
  const r = hook(root, { op: "learn", lessons: [{ kind: "deny", key: "WebFetch", where: "build" }], tool: "Bash", input: { command: "ls" }, cwd: away });
  assert.deepEqual([r.ok, r.error], [false, "the call acts in no work item's project; nothing to learn it for"]);
});

test("before in another checkout whose work item cannot judge (its journal will not resume) lets the call through, recorded nowhere", () => {
  const root = project();
  const other = project();
  const deploy = { tool: "Bash", input: { command: "npx wrangler deploy --env production" }, cwd: other };
  assert.match(hook(root, { op: "before", callId: "c1", ...deploy }).refusal, /deploy-prod/, "the other checkout's work item judges it");
  writeFileSync(join(other, ".geml", "journals", "feat", "x.geml"), '=== meta\ntitle = "broken"\n===\n');
  const r = hook(root, { op: "before", callId: "c2", ...deploy });
  assert.deepEqual([r.ok, r.refusal, r.recorded], [true, undefined, false]);
});

test("handoff: a verb's answer on another work item hands it over; returning to one whose evidence holds shows it ticked", () => {
  const root = project();
  hook(root, { op: "after", tool: "Bash", callId: "c1", input: { command: "npm test" }, isError: false, exitCode: 0, gitOperation: false });
  const read = hook(root, { op: "status" }).shell.contextKey;
  switchTo(root, "-c", "feat/y");
  const there = hook(root, { op: "verb", name: "status", args: {}, delivered: read });
  assert.equal(there.handoff, "[gemworks] now on feat/y · #build (new work item)");
  switchTo(root, "feat/x");
  const back = hook(root, { op: "after", tool: "Bash", callId: "c2", input: { command: "ls" }, isError: false, exitCode: 0, gitOperation: false, delivered: there.shell.contextKey });
  assert.match(back.handoff, /^\[gemworks\] back on feat\/x · #build · rev 1 · /);
  assert.ok(back.handoff.includes("tests-pass ✓") && back.handoff.includes("pr-open ✗"));
});

test("handoff: a variable that is no yes or no is shown with its value", () => {
  const root = gitRepo();
  mkdirSync(join(root, ".geml", "workflows", "goal"), { recursive: true });
  writeFileSync(join(root, ".geml", "workflows", "goal", "flow.geml"), `=== meta
title = "Goal"
profile = "geml-statechart/v1"
===

=== diagram {#flow format=geml-statechart}
{
  "initial": "aim",
  "states": { "aim": { "title": "Aim" }, "hit": { "title": "Hit", "final": true } },
  "vars": { "goal": { "default": "" } },
  "transitions": [ { "from": "aim", "to": "hit", "guard": { "properties": { "goal": { "const": "ship" } } } } ]
}
===
`);
  writeFileSync(join(root, ".geml", "project.geml"), '=== meta\nprofile = "geml-statechart/v1"\nflow-workflow = "goal"\n===\n');
  const read = hook(root, { op: "status" }).shell.contextKey;
  switchTo(root, "-c", "feat/y");
  const there = hook(root, { op: "verb", name: "status", args: {}, delivered: read });
  switchTo(root, "feat/x");
  const back = hook(root, { op: "verb", name: "status", args: {}, delivered: there.shell.contextKey });
  assert.equal(back.handoff, '[gemworks] back on feat/x · #aim · rev 0 · goal=""');
});

test("attention in a folder that is no repository: the machine comes back with no branch", () => {
  const dir = mkdtempSync(join(tmpdir(), "gemworks-plain-"));
  const r = hook(dir, { op: "attention" }, NO_GH);
  assert.deepEqual([r.ok, r.host.name, r.host.platform, "branch" in r.host], [true, hostname(), process.platform, false]);
});
