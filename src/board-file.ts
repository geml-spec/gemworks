// The GEML board on disk (core/board-page.ts): `.geml/board.geml` in the
// project's main working tree, written again whenever a host with no panel of
// its own records something or a turn ends there, and opened once when such a
// session starts. Out of git, as all of `.geml/` is. Nothing here throws at a
// caller and nothing waits on the opener: a board that cannot be written or
// opened is a board the person does not see this time, never a stopped turn.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join } from "node:path";
import { GEML_DIR } from "./core/layout.js";
import { boardPage, type BoardAsk } from "./core/board-page.js";
import type { ArtifactRow } from "./core/artifacts.js";
import { BROWSER_PROGID_ARGV, browserCommandArgv, browserExeOf, fileUrl, openersFor, progIdOf } from "./hosts/claude-code/open-file.js";
import { readArtifactRows } from "./artifacts-store.js";
import { journalBaseOf } from "./host-git.js";
import { coachFlowsAt, gemlHome, proposalsAt, workItemsAt } from "./loop.js";
import { readPractices } from "./practice-store.js";
import { decisionsFor, hostLabel, readSessions } from "./session-store.js";
import { langOf, wordsFor, type Lang } from "./hosts/claude-code/text.js";
import { flowsIn } from "./hosts/claude-code/coach.js";

export const BOARD_FILE = "board.geml";

/**
 * The language the page is written in: `GEMWORKS_LANG` (zh, en or ja) when set, else the locale the environment
 * names, else the system's own. A host with no panel has no settings of its own to ask.
 */
export function boardLang(env: Readonly<Record<string, string | undefined>> = process.env): Lang {
  let system: string | undefined;
  try { system = Intl.DateTimeFormat().resolvedOptions().locale; } catch { /* none known */ }
  return langOf(env["GEMWORKS_LANG"], env["LC_ALL"] || env["LC_MESSAGES"] || env["LANG"] || system);
}

/** Where a project's GEML board is. */
export const boardPath = (root: string): string => join(gemlHome(root), BOARD_FILE);

const pad = (n: number): string => String(n).padStart(2, "0");
const clock = (iso: string): string => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? "" : `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const day = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

/**
 * Where an artifact's link goes: its address, else its file as a `file:` URL — the copy beside the board, the
 * repository's file, or where it was written. A relative link would be a reference GEML checks, and an error once the
 * file is gone; a URL is only a link.
 */
function linkOf(row: ArtifactRow, home: string): string | undefined {
  if (row.kind === "link") return /^https?:\/\//i.test(row.where) ? row.where : undefined;
  if (row.where === "git") return fileUrl(join(home, row.name.replace(/`/g, "")));
  if (row.where.startsWith("artifacts/")) return fileUrl(join(home, GEML_DIR, row.where));
  return isAbsolute(row.where) ? fileUrl(row.where) : undefined;
}

/** The page as the project's record stands now: what `writeBoard` writes. */
export function boardText(root: string, now: Date = new Date(), lang: Lang = boardLang()): string {
  const home = journalBaseOf(root);
  const flows = coachFlowsAt(root);
  const t = wordsFor(lang);
  const sessions = readSessions(root).sort((a, b) => (a.last < b.last ? 1 : a.last > b.last ? -1 : 0));
  const asks: BoardAsk[] = sessions.flatMap((s) => (s.asks ?? []).map((q) => ({ question: q.question, options: q.options, ...(q.item !== undefined ? { item: q.item } : {}) })));
  let practices: ReturnType<typeof readPractices>["practices"] = [];
  try { practices = readPractices(root).practices; } catch { /* the page without them */ }
  let artifacts: ArtifactRow[] = [];
  try { artifacts = readArtifactRows(home); } catch { /* the page without them */ }
  return boardPage({
    project: basename(home), updated: day(now), flows: flowsIn(flows, t), items: workItemsAt(root, flows), asks, proposals: proposalsAt(root), practices, artifacts,
    decisions: decisionsFor(root, "", null, now.toISOString()), linkOf: (row) => linkOf(row, home), clock, hostName: hostLabel, t,
  });
}

/** The board written again when what it says changed; its path, or undefined when it could not be. */
export function writeBoard(root: string, now: Date = new Date(), lang: Lang = boardLang()): string | undefined {
  try {
    const path = boardPath(root);
    const text = boardText(root, now, lang);
    let was = "";
    try { was = readFileSync(path, "utf8"); } catch { /* the first */ }
    // The time it was written changes every turn; the rest decides whether a viewer has anything new to show.
    const body = (s: string): string => s.replace(/^updated = .*$/m, "");
    if (body(was) !== body(text)) {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, text, "utf8");
    }
    return path;
  } catch {
    return undefined;
  }
}

/** The person's default browser on Windows, which shows a `.geml` page through its GEML viewer; undefined elsewhere or unknown. */
function windowsBrowser(): string | undefined {
  try {
    const id = progIdOf(spawnSync(BROWSER_PROGID_ARGV[0] as string, BROWSER_PROGID_ARGV.slice(1), { encoding: "utf8", timeout: 3000, windowsHide: true }).stdout ?? "");
    if (id === undefined) return undefined;
    const argv = browserCommandArgv(id);
    return browserExeOf(spawnSync(argv[0] as string, argv.slice(1), { encoding: "utf8", timeout: 3000, windowsHide: true }).stdout ?? "");
  } catch {
    return undefined;
  }
}

/** Whether the board has work on it: a work item on the way. A session starting on a project with none opens no empty page. */
export function boardHasWork(root: string): boolean {
  try { return workItemsAt(root, coachFlowsAt(root)).some((i) => i.status === "open"); } catch { return false; }
}

/**
 * The board written, and opened the first time a session asks (its hooks at its start, or its MCP server at its first
 * record, whichever comes first: a mark per session in the temp directory says it was). GEMWORKS_OPEN_BOARD=0 never
 * opens it (the tests). Returns the path when it was opened now.
 */
export function openBoardOnce(root: string, session: string, platform: string = process.platform): string | undefined {
  if (process.env["GEMWORKS_OPEN_BOARD"] === "0") { writeBoard(root); return undefined; }
  const mark = join(tmpdir(), "gemworks-board", `${session.replace(/[^A-Za-z0-9._-]/g, "_")}.opened`);
  if (existsSync(mark)) { writeBoard(root); return undefined; }
  try { mkdirSync(dirname(mark), { recursive: true }); writeFileSync(mark, new Date().toISOString(), "utf8"); } catch { /* opened again next time */ }
  return openBoard(root, platform);
}

/**
 * The board written and opened on this machine, the way a board's artifact opens (open-file.ts): its first opener,
 * started on its own, not waited for. Returns the path, or undefined when nothing was opened.
 */
export function openBoard(root: string, platform: string = process.platform): string | undefined {
  const path = writeBoard(root);
  if (path === undefined) return undefined;
  try {
    const [first] = openersFor(platform, path, false, platform === "win32" ? windowsBrowser() : undefined);
    if (first === undefined) return undefined;
    const child = spawn(first.argv[0] as string, first.argv.slice(1), { detached: true, stdio: "ignore", windowsHide: true, env: { ...process.env, ...(first.env ?? {}) } });
    child.on("error", () => { /* no opener here: the board is still on disk */ });
    child.unref();
    return path;
  } catch {
    return undefined;
  }
}
