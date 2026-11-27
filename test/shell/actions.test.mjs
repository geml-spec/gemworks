import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Every press the pure modules can build (BoardAction, src/shell/actions.ts) has a branch in the hooks
// module's act() (hooks/act.tsx). act()'s switches end in `default`, so an op added to the union with no case
// type-checks and runs, and the press does nothing; hooks.test.ts presses buttons by their key, never by their op.
// Both are read as they are laid out: the union one member a line, `| { op: "…"; … }`, up to the next line that starts
// at column 0; act() up to its closing brace at column 0.

const read = (path) => readFileSync(fileURLToPath(new URL(`../../${path}`, import.meta.url)), "utf8").replace(/\r\n/g, "\n");

/** The union's ops, and its member lines that name none (a member this reader cannot see). */
function unionOps(source) {
  const start = source.indexOf("export type BoardAction =");
  assert.notEqual(start, -1, "no BoardAction union");
  const lines = source.slice(start).split("\n").slice(1);
  const end = lines.findIndex((l) => /^\S/.test(l));
  const members = (end === -1 ? lines : lines.slice(0, end)).filter((l) => /^\s*\|/.test(l));
  const ops = [];
  const odd = [];
  for (const line of members) {
    const m = /^\s*\|\s*\{\s*op:\s*"([a-z-]+)"/.exec(line);
    if (m !== null) ops.push(m[1]);
    else odd.push(line.trim());
  }
  return { ops, odd };
}

/** The ops act() has a case for. */
function handledOps(source) {
  const start = source.indexOf("export async function act(");
  assert.notEqual(start, -1, "no act()");
  const rest = source.slice(start);
  const end = rest.indexOf("\n}");
  const body = end === -1 ? rest : rest.slice(0, end);
  return new Set([...body.matchAll(/case\s+(['"])([a-z-]+)\1\s*:/g)].map((m) => m[2]));
}

test("the reader sees each member's op, a member it cannot read, and only act()'s cases", () => {
  const union = [
    "export type BoardAction =",
    "  /** A comment line. */",
    '  | { op: "advance"; to: string }',
    '  | { op: "share-pick"; what?: string };',
    "  | Other",
    "",
    "export interface Pressable { op: \"after\" }",
  ].join("\n");
  assert.deepEqual(unionOps(union), { ops: ["advance", "share-pick"], odd: ["| Other"] });
  const act = [
    "export async function act($, action) {",
    "  switch (action.op) {",
    "    case 'advance': return",
    "    default: return",
    "  }",
    "}",
    "function other(action) {",
    "  switch (action.op) { case 'share-pick': return }",
    "}",
  ].join("\n");
  const handled = handledOps(act);
  assert.deepEqual([...handled], ["advance"]);
  assert.deepEqual(unionOps(union).ops.filter((op) => !handled.has(op)), ["share-pick"]);
});

test("every press the pure modules can build has a case in the hooks module's act()", () => {
  const { ops, odd } = unionOps(read("src/shell/actions.ts"));
  assert.ok(ops.length > 0, "no ops read from BoardAction");
  assert.deepEqual(odd, [], "BoardAction members this test cannot read: write each as `| { op: \"…\"; … }` on one line");
  const handled = handledOps(read("hooks/act.tsx"));
  const missing = ops.filter((op) => !handled.has(op));
  assert.deepEqual(missing, [], `ops with no case in act() (hooks/act.tsx), so pressing them does nothing: ${missing.join(", ")}`);
});
