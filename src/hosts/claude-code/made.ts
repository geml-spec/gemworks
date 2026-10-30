// The board's 产物 tab (protocol.ts, MadeAll): every artifact the project's work made, whichever work item made it
// and whether that item has ended — newest first, by day, a page at a time, by kind, or one work item's alone.
// Pure: rows only.
import type { Pressable } from "./actions.js";
import type { BoardRow } from "./board.js";
import type { MadeAll, MadeAllEntry } from "./protocol.js";
import type { T } from "./text.js";
import { dayText, hhmm } from "./time.js";

/** What the list is narrowed to: every kind but the documents in git (listed on their own press), or one kind. */
export type MadeKind = "all" | MadeAllEntry["kind"];

/** Whether an entry is listed under a kind: under all, anything but a document in git, which git keeps already. */
const isOf = (e: MadeAllEntry, k: MadeKind): boolean => (k === "all" ? e.kind !== "doc" : e.kind === k);
/** The kinds the list can be narrowed to, in the order their presses stand. */
export const MADE_KINDS: readonly MadeKind[] = ["all", "file", "link", "image", "doc"];
/** How many entries one more press lists, and the most listed at once: a pane fails past about 1,100 elements. */
export const MADE_PAGE = 20;
export const MADE_MOST = 60;

/** The list's state: the kind it is narrowed to, how many it lists, and the one work item it shows alone (null: every one). */
export interface MadeView { kind: MadeKind; shown: number; item: string | null }
export const MADE_VIEW: MadeView = { kind: "all", shown: 0, item: null };

/** The words for the work item an entry came from; undefined for one no work item names (made before there were any). */
export type ItemWords = (id: string) => string | undefined;

const kindWord = (k: MadeAllEntry["kind"], t: T): string => (k === "link" ? t("链接") : k === "doc" ? t("文档") : k === "image" ? t("图片") : t("文件"));

/** An entry's name as shown: a link's title; a file's last segment (what opens it says where it is). */
const shownName = (e: MadeAllEntry): string => (e.kind === "link" ? e.name : e.name.split(/[\\/]/).filter((x) => x !== "").at(-1) ?? e.name);

/**
 * One artifact: its name and its kind — a link's kind is its press (链接 ↗), a file opens on a press on the row — and
 * under it the work item it came from (left out when the list shows one item's alone), how many versions, and when.
 */
export function madeEntry(e: MadeAllEntry, t: T, o: { item?: string; when: string }): BoardRow {
  const versions = e.versions > 1 ? (e.kind === "doc" ? t("{0} 次提交", e.versions) : t("{0} 版", e.versions)) : "";
  const detail = [o.item ?? "", versions, o.when].filter((x) => x !== "").join(" · ");
  const key = `made-${e.item}-${e.kind}-${e.name}`;
  const under = detail !== "" ? { detail } : {};
  return e.kind === "link"
    ? { kind: "entry", key, title: shownName(e), tag: "", tone: "normal", ...under, link: { href: e.open, label: t("链接 ↗") } }
    : { kind: "entry", key, title: shownName(e), tag: kindWord(e.kind, t), tone: "normal", ...under, action: { op: "open-file", path: e.open } };
}

/**
 * A work item's press to its artifacts (产物 n ›, beside its arrow): the 产物 tab with its own alone, counted as that
 * list shows them — its documents in git only when it has nothing else. None when it made none.
 */
export function madePress(all: readonly MadeAllEntry[] | undefined, id: string, t: T): Pressable | undefined {
  const own = (all ?? []).filter((e) => e.item === id);
  const n = own.filter((e) => isOf(e, "all")).length || own.length;
  return n > 0 ? { key: `work-made-${id}`, label: t("产物 {0} ›", n), action: { op: "made-item", id } } : undefined;
}

/**
 * The 产物 tab: a press per kind that has some (the one it is narrowed to marked); when it shows one work item's
 * alone, which, and the press back to every one; then the newest first under each day, a page at a time (never more
 * than MADE_MOST at once: older pages fold the newest away, and a press goes back to them), and a press for the next.
 */
export function madeTabRows(all: MadeAll | null | undefined, view: MadeView, words: ItemWords, t: T, now?: string): BoardRow[] {
  if (all === null || all === undefined) return [{ kind: "text", text: t("正在读取产物…"), tone: "dim" }];
  const rows: BoardRow[] = [];
  const mine = view.item === null ? all.entries : all.entries.filter((e) => e.item === view.item);
  if (view.item !== null) {
    rows.push({ kind: "entry", key: "made-only", title: t("只看：{0}", words(view.item) ?? t("工作项之前")), tag: "", tone: "normal", extra: { key: "made-only-all", label: "×", action: { op: "made-item", id: null } } });
  }
  if (mine.length === 0) return [...rows, { kind: "text", text: t("还没有产物"), tone: "dim" }];
  const count = (k: MadeKind): number => mine.filter((e) => isOf(e, k)).length;
  // Nothing but documents in git: those, rather than an empty list.
  const kind: MadeKind = view.kind === "all" && count("all") === 0 ? "doc" : view.kind;
  rows.push({
    kind: "buttons",
    items: MADE_KINDS.filter((k) => count(k) > 0).map((k): Pressable => ({
      key: `made-kind-${k}`, label: `${k === "all" ? t("全部") : kindWord(k, t)} ${count(k)}`, ...(kind === k ? { primary: true } : {}), action: { op: "made-kind", kind: k },
    })),
  });
  const list = mine.filter((e) => isOf(e, kind));
  const end = Math.min(list.length, Math.max(MADE_PAGE, view.shown));
  const start = Math.max(0, end - MADE_MOST);
  const page = list.slice(start, end);
  if (start > 0) rows.push({ kind: "button", key: "made-newest", label: t("较新的 {0} 件已收起 · 回到最新", start), action: { op: "made-kind", kind } });
  let day = "";
  for (const e of page) {
    const d = now !== undefined ? dayText(e.at, now, t) : e.at.slice(0, 10);
    if (d !== day) rows.push({ kind: "text", text: d, tone: "dim" });
    day = d;
    rows.push(madeEntry(e, t, { ...(view.item === null ? { item: words(e.item) ?? t("工作项之前") } : {}), when: hhmm(e.at) }));
  }
  if (end < list.length) {
    rows.push({ kind: "button", key: "made-more", label: t("再看 {0} 件（共 {1}）", Math.min(MADE_PAGE, list.length - end), list.length), action: { op: "made-more" } });
  }
  return rows;
}
