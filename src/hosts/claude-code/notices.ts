// What waits on the person when a turn ends, said as a desktop notification:
// a question the band asks, and a work item of this session standing at a step
// the person judges. Each is said once — `seen` holds the keys said before, and
// the answer's `keys` are what stands now, kept for the next turn. Pure.

import type { Asked } from "../../core/ask-tool.js";
import { itemProgress, type CoachFlow, type WorkItem } from "./coach.js";
import type { T } from "./text.js";

export interface Waiting {
  /** Every key that stands now: the next turn's `seen`. */
  keys: string[];
  /** The notification for the questions not said before; absent when there is none. */
  ask?: string;
  /** The notification for the work items newly at the person's step; absent when there is none. */
  confirm?: string;
}

export function waitingNotices(asks: readonly Asked[], items: readonly WorkItem[], flows: readonly CoachFlow[], session: string, seen: readonly string[], t: T): Waiting {
  const askKeys = asks.map((a) => ({ key: `ask:${a.question}`, text: a.question }));
  const confirmKeys: { key: string; text: string }[] = [];
  for (const item of items) {
    if (item.status !== "open" || item.session !== session) continue;
    const flow = flows.find((f) => f.name === item.flow);
    if (flow === undefined) continue;
    const progress = itemProgress(item, flow);
    if (progress.whose !== "you" || progress.here === null) continue;
    const step = flow.states.find((s) => s.id === progress.here);
    confirmKeys.push({ key: `confirm:${item.id}@${progress.here}`, text: t("等你确认：{0} · {1}", item.title, step?.title ?? progress.here) });
  }
  const freshAsks = askKeys.filter((a) => !seen.includes(a.key));
  const freshConfirms = confirmKeys.filter((c) => !seen.includes(c.key));
  const first = freshAsks[0];
  const ask = first === undefined ? undefined
    : freshAsks.length === 1 ? t("等你定：{0}", first.text)
    : t("等你定：{0}（另有 {1} 个问题）", first.text, freshAsks.length - 1);
  const confirm = freshConfirms.length === 0 ? undefined : freshConfirms.map((c) => c.text).join("\n");
  return { keys: [...askKeys, ...confirmKeys].map((k) => k.key), ...(ask !== undefined ? { ask } : {}), ...(confirm !== undefined ? { confirm } : {}) };
}
