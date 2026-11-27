// A project with a rule of the light flows standing: what the hosts' before-call checks are tried on (loop.ts ruleHold).
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { rulesText } from "../../dist/core/growth.js";
import { gemlHome, recordWork } from "../../dist/loop.js";

/** What the rule says, and what a call it holds is refused with. */
export const RULE_TEXT = "验证过了才发布";
export const HELD = /规定：验证过了才发布（「发布」的「验证」还没满足）/;

/**
 * Session `session` of `root` has a feature work item open at its first step, and the project keeps one rule: `key`
 * (`npm publish` by default) is held until that item's 验证 step is met. The rules file's path.
 */
export function ruledProject(root, session, key = "Bash(npm publish*)") {
  const r = recordWork(root, "test", session, { items: [{ title: "发布", flow: "feature" }] });
  if (!r.ok) throw new Error(r.text);
  const file = join(gemlHome(root), "rules.geml");
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, rulesText([{ id: "r1", flow: "feature", requires: "verify", key, text: RULE_TEXT, why: "", at: "2026-11-27T00:00:00Z", layer: "project" }]), "utf8");
  return file;
}
