// The board's element budget: the desktop draws a pane of some 1,500 elements and none past it, so the body is cut and says so.
import { test } from "node:test";
import assert from "node:assert/strict";
import { BODY_NODES, BODY_SIZE, elementsIn, fitToBudget, stepDown } from "../dist/hosts/claude-code/budget.js";

const el = (children = []) => ({ type: "Box", props: {}, children });

test("elements are counted with everything under them; strings and nothing are not elements", () => {
  assert.equal(elementsIn("words"), 0);
  assert.equal(elementsIn(null), 0);
  assert.equal(elementsIn(el()), 1);
  assert.equal(elementsIn(el([el(["a"]), "b", el([el()])])), 4);
  assert.equal(elementsIn([el(), el()]), 2, "a list is its elements");
  assert.equal(elementsIn({ type: "Text", props: { children: [el()] } }), 2, "children under props are counted too");
});

test("the body keeps the leading rows that fit the budget and says how many it left out", () => {
  const rows = Array.from({ length: 400 }, () => el([el(["line"]), el(["tag"])]));
  const cut = fitToBudget(rows, 1_100);
  assert.equal(cut.kept.length, 366, "three elements a row: 366 fit in 1,100");
  assert.equal(cut.left, 34);
  assert.ok(cut.drawn <= 1_100);
  const all = fitToBudget(rows.slice(0, 10));
  assert.deepEqual([all.kept.length, all.left, all.drawn], [10, 0, 30], "what fits is drawn whole");
  assert.ok(BODY_NODES < 1_476, "under what the desktop was seen to draw");
});

test("a tab's body is drawn one text size down: each Text without a size of its own, and a label-only button's label as such a Text", () => {
  const text = (props, children) => ({ type: "Text", props, children });
  const tree = el([
    text({ dimColor: true }, ["dim", text({ bold: true }, ["inner"])]),
    text({ size: "heading" }, ["kept"]),
    { type: "Button", props: { key: "b", label: "go", plain: true }, press: { plugin: "gemworks", handle: 1 } },
    { type: "Button", props: { key: "c", label: "title" }, press: { plugin: "gemworks", handle: 2 }, children: [text({ bold: true }, ["title"])] },
  ]);
  const down = stepDown(tree);
  assert.deepEqual(down.children[0].props, { dimColor: true, size: BODY_SIZE });
  assert.deepEqual(down.children[0].children[1].props, { bold: true }, "a Text inside a Text follows it");
  assert.deepEqual(down.children[1].props, { size: "heading" }, "a size given is kept");
  assert.deepEqual(down.children[2].children, [{ type: "Text", props: { size: BODY_SIZE }, children: ["go"] }]);
  assert.deepEqual(down.children[2].props, { key: "b", label: "go", plain: true });
  assert.deepEqual(down.children[3].children[0].props, { bold: true, size: BODY_SIZE });
  assert.equal(elementsIn(down), elementsIn(tree) + 1, "the label drawn as a Text is one element more, counted");
  assert.deepEqual(tree.children[0].props, { dimColor: true }, "the tree given is not changed");
});
