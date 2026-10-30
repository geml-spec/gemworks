/**
 * Where the practices of a project are kept (core/practices.ts): the person's own in ~/.gemworks/practices.geml, the
 * project's in the main working tree's .geml/practices.geml (beside its sessions, out of git), the team's in the
 * repository's .gemworks/practices.geml (committed by the person, never written here but by sharing). Reading a layer
 * whose file is missing gives none; a layer the person cannot write keeps what it had.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { journalBaseOf } from "./host-git.js";
import { parsePractices, practicesText, type Practice, type PracticeFile, type PracticeLayer } from "./core/practices.js";

export const PRACTICES_FILE = "practices.geml";

/** The file of each layer for a checkout. */
export function practicePaths(root: string, home: string = homedir()): Record<PracticeLayer, string> {
  return {
    personal: join(home, ".gemworks", PRACTICES_FILE),
    project: join(journalBaseOf(root), ".geml", PRACTICES_FILE),
    team: join(root, ".gemworks", PRACTICES_FILE),
  };
}

function readLayer(path: string, layer: PracticeLayer): PracticeFile {
  if (!existsSync(path)) return { practices: [], memoryMoved: false };
  try { return parsePractices(readFileSync(path, "utf8"), layer); } catch { return { practices: [], memoryMoved: false }; }
}

function writeLayer(path: string, file: PracticeFile): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, practicesText(file));
}

/** Every layer's practices, the team's first; whether this project's memory was moved in. */
export function readPractices(root: string, home?: string): { practices: Practice[]; memoryMoved: boolean } {
  const paths = practicePaths(root, home);
  const team = readLayer(paths.team, "team");
  const project = readLayer(paths.project, "project");
  const personal = readLayer(paths.personal, "personal");
  return { practices: [...team.practices, ...project.practices, ...personal.practices], memoryMoved: project.memoryMoved };
}

/** Practices written into their layers (personal or project); `memory` marks the project's memory moved. */
export function writePractices(root: string, added: readonly Practice[], memory: boolean, home?: string): void {
  const paths = practicePaths(root, home);
  for (const layer of ["personal", "project"] as const) {
    const mine = added.filter((p) => p.layer === layer);
    if (mine.length === 0 && !(layer === "project" && memory)) continue;
    const file = readLayer(paths[layer], layer);
    writeLayer(paths[layer], { practices: [...file.practices, ...mine], memoryMoved: file.memoryMoved || (layer === "project" && memory) });
  }
}

/**
 * One practice changed: taken out (kept as a tombstone, so it is not learned again), moved to the other of the
 * person's and the project's layers, or hung on every flow and step (`everywhere`: what it asks was said off its step
 * too). A team practice is changed in the repository, not here. False when there is no such practice it can change.
 */
export function changePractice(root: string, id: string, change: { deleted?: boolean; layer?: "personal" | "project"; everywhere?: boolean }, home?: string): boolean {
  const paths = practicePaths(root, home);
  const changed = (p: Practice): Practice => ({ ...p, ...(change.deleted !== undefined ? { deleted: change.deleted } : {}), ...(change.everywhere === true ? { flow: "*", step: "*" } : {}) });
  for (const layer of ["personal", "project"] as const) {
    const file = readLayer(paths[layer], layer);
    const p = file.practices.find((x) => x.id === id);
    if (p === undefined) continue;
    if (change.layer !== undefined && change.layer !== layer) {
      writeLayer(paths[layer], { ...file, practices: file.practices.filter((x) => x.id !== id) });
      const to = readLayer(paths[change.layer], change.layer);
      writeLayer(paths[change.layer], { ...to, practices: [...to.practices, { ...changed(p), layer: change.layer }] });
      return true;
    }
    writeLayer(paths[layer], { ...file, practices: file.practices.map((x) => (x.id === id ? changed(x) : x)) });
    return true;
  }
  return false;
}

/** Practices moved from the person's or the project's layer into the team's (the repository's .gemworks/practices.geml); how many moved. */
export function sharePractices(root: string, ids: readonly string[], home?: string): number {
  const paths = practicePaths(root, home);
  const moving: Practice[] = [];
  for (const layer of ["personal", "project"] as const) {
    const file = readLayer(paths[layer], layer);
    const going = file.practices.filter((p) => ids.includes(p.id) && p.deleted !== true);
    if (going.length === 0) continue;
    moving.push(...going);
    writeLayer(paths[layer], { ...file, practices: file.practices.filter((p) => !going.includes(p)) });
  }
  if (moving.length === 0) return 0;
  const team = readLayer(paths.team, "team");
  writeLayer(paths.team, { ...team, practices: [...team.practices, ...moving.map(({ session: _session, turn: _turn, ...p }) => ({ ...p, layer: "team" as const }))] });
  return moving.length;
}
