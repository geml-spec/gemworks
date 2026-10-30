/**
 * Where the ledger of corrections is kept (core/corrections.ts): the person's own ~/.gemworks/corrections.geml, for
 * every project they work in, never in a repository — it holds their words. Written under a lock, as several sessions
 * label at once. The prompts not labelled yet are read from the host's transcripts (~/.claude/projects).
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { withLock, writeAtomic } from "./host-fs.js";
import { addPrompts, EMPTY_LEDGER, hasPrompt, KINDS, ledgerText, parseLedger, promptId, SUBS, typedWords, WORKS, type CorrectionSub, type LabelledPrompt, type Ledger, type PromptKind, type WorkKind } from "./core/corrections.js";

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export const CORRECTIONS_FILE = "corrections.geml";

/** The ledger's file. */
export const correctionsPath = (home: string = homedir()): string => join(home, ".gemworks", CORRECTIONS_FILE);

/** The ledger as its file holds it; none yet, an empty one. */
export function readLedger(home?: string): Ledger {
  const path = correctionsPath(home);
  if (!existsSync(path)) return EMPTY_LEDGER;
  try { return parseLedger(readFileSync(path, "utf8")); } catch { return EMPTY_LEDGER; }
}

/** The ledger changed under its lock and written back; what it became. */
export function updateLedger(change: (l: Ledger) => Ledger, home?: string): Ledger {
  const path = correctionsPath(home);
  return withLock(path, () => {
    const next = change(readLedger(home));
    writeAtomic(path, ledgerText(next));
    return next;
  });
}

/** Labelled prompts given by an agent or a file (`gemworks corrections label`), checked; what was wrong with the rest. */
export function labelledRows(given: readonly unknown[], by: LabelledPrompt["by"]): { rows: LabelledPrompt[]; errors: string[] } {
  const rows: LabelledPrompt[] = [];
  const errors: string[] = [];
  given.forEach((v, n) => {
    if (!isObj(v)) { errors.push(`line ${n + 1} is not an object`); return; }
    const s = (k: string): string | undefined => (typeof v[k] === "string" && v[k] !== "" ? (v[k] as string) : undefined);
    const [id, at, session, text] = [s("id"), s("at"), s("session"), s("text")];
    if (id === undefined || at === undefined || session === undefined || text === undefined || !Number.isFinite(Date.parse(at))) { errors.push(`line ${n + 1} needs id, at, session and text`); return; }
    const kind = v["kind"];
    if (!(KINDS as readonly unknown[]).includes(kind)) { errors.push(`line ${n + 1}: kind must be one of ${KINDS.join(", ")}`); return; }
    const sub = v["sub"];
    if (kind === "correct" && !(SUBS as readonly unknown[]).includes(sub)) { errors.push(`line ${n + 1}: a correction's sub must be one of ${SUBS.join(", ")}`); return; }
    const work = v["work"];
    if (work !== undefined && work !== null && !(WORKS as readonly unknown[]).includes(work)) { errors.push(`line ${n + 1}: work must be one of ${WORKS.join(", ")}`); return; }
    rows.push({
      id, at, session, text, kind: kind as PromptKind, by,
      ...(kind === "correct" ? { sub: sub as CorrectionSub } : {}), ...(typeof work === "string" ? { work: work as WorkKind } : {}),
      ...(s("project") !== undefined ? { project: s("project") as string } : {}), ...(s("flow") !== undefined ? { flow: s("flow") as string } : {}), ...(s("step") !== undefined ? { step: s("step") as string } : {}),
    });
  });
  return { rows, errors };
}

/** Labelled prompts added to the ledger; how many were new. */
export function addLabelled(rows: readonly LabelledPrompt[], home?: string): number {
  let added = 0;
  updateLedger((l) => { const r = addPrompts(l, rows); added = r.added; return r.ledger; }, home);
  return added;
}

/** A prompt the person typed that the ledger has no label for: where and when, its words, the end of the reply before it. */
export interface Unlabelled { id: string; at: string; session: string; project: string; text: string; before: string }

type Rec = { type?: unknown; timestamp?: unknown; sessionId?: unknown; cwd?: unknown; isSidechain?: unknown; isMeta?: unknown; isCompactSummary?: unknown; turnOrigin?: unknown; origin?: { kind?: unknown } | null; message?: { content?: unknown } | null; attachment?: { type?: unknown; prompt?: unknown; timestamp?: unknown; origin?: { kind?: unknown } | null } };

const textOf = (content: unknown): { text: string; results: boolean } => {
  if (typeof content === "string") return { text: content, results: false };
  const blocks = Array.isArray(content) ? content.filter((b): b is { type?: unknown; text?: unknown } => typeof b === "object" && b !== null) : [];
  return { text: blocks.filter((b) => b.type === "text").map((b) => (typeof b.text === "string" ? b.text : "")).join("\n"), results: blocks.some((b) => b.type === "tool_result") };
};

/**
 * The prompts the person typed in one transcript, each with the last reply they had seen: a user record the host
 * marks as the person's (`turnOrigin` or `origin` human; a record of an older host, with neither, by its words), its
 * reminders stripped; and the lines typed while a turn ran. A brief another session started this one with is not the
 * person's, nor a notice.
 */
export function typedPrompts(text: string): { at: string; session: string; cwd: string; text: string; before: string }[] {
  const out: { at: string; session: string; cwd: string; text: string; before: string }[] = [];
  let answer = "";
  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === "") continue;
    let o: Rec;
    try { o = JSON.parse(line) as Rec; } catch { continue; }
    if (typeof o !== "object" || o === null || o.isSidechain === true) continue;
    const at = typeof o.timestamp === "string" ? o.timestamp : "";
    const session = typeof o.sessionId === "string" ? o.sessionId : "";
    const cwd = typeof o.cwd === "string" ? o.cwd : "";
    if (o.type === "assistant") {
      const said = textOf(o.message?.content).text.trim();
      if (said !== "") answer = said;
      continue;
    }
    if (o.type === "attachment" && o.attachment?.type === "queued_command" && typeof o.attachment.prompt === "string" && (o.attachment.origin?.kind === undefined || o.attachment.origin.kind === "human")) {
      const words = typedWords(o.attachment.prompt);
      const when = typeof o.attachment.timestamp === "string" ? o.attachment.timestamp : at;
      if (words !== undefined && when !== "") out.push({ at: when, session, cwd, text: words, before: answer });
      continue;
    }
    if (o.type !== "user" || o.isMeta === true || o.isCompactSummary === true) continue;
    if (typeof o.turnOrigin === "string" && o.turnOrigin !== "human") continue;
    if (o.origin?.kind !== undefined && o.origin.kind !== "human") continue;
    const { text: raw, results } = textOf(o.message?.content);
    if (results) continue;
    const words = typedWords(raw);
    if (words === undefined || at === "") continue;
    out.push({ at, session, cwd, text: words, before: answer });
  }
  return out;
}

/**
 * The prompts the person typed in the host's transcripts since `since` (an ISO time; by default the ledger's newest
 * prompt, or thirty days back) that the ledger has no label for, oldest first, at most `limit`. A transcript not
 * written since is not read.
 */
export function unlabelledPrompts(ledger: Ledger, transcripts: string, o: { since?: string; limit?: number; now?: string } = {}): Unlabelled[] {
  const now = o.now ?? new Date().toISOString();
  const since = o.since ?? ledger.prompts[ledger.prompts.length - 1]?.at ?? new Date(Date.parse(now) - 30 * 86_400_000).toISOString();
  const from = Date.parse(since);
  const out: Unlabelled[] = [];
  const taken = new Set(ledger.prompts.map((p) => p.id));
  const list = (dir: string): string[] => { try { return readdirSync(dir); } catch { return []; } };
  for (const folder of list(transcripts)) {
    const dir = join(transcripts, folder);
    for (const name of list(dir).filter((n) => n.endsWith(".jsonl"))) {
      const file = join(dir, name);
      try { if (statSync(file).mtimeMs < from) continue; } catch { continue; }
      let text: string;
      try { text = readFileSync(file, "utf8"); } catch { continue; }
      for (const t of typedPrompts(text).sort((a, b) => (a.at < b.at ? -1 : 1))) {
        if (Date.parse(t.at) <= from) continue;
        const session = t.session !== "" ? t.session : basename(name, ".jsonl");
        const id = promptId(session, t.at, taken);
        const row = { id, at: t.at, session, text: t.text };
        if (hasPrompt(ledger, row) || hasPrompt({ prompts: out }, row)) continue;
        taken.add(id);
        out.push({ ...row, project: t.cwd, before: t.before.slice(-600) });
      }
    }
  }
  return out.sort((a, b) => (a.at < b.at ? -1 : 1)).slice(0, o.limit ?? Infinity);
}
