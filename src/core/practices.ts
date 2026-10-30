// Practices: what a project has learned about doing its work, each hung on the
// step of a flow it belongs to (or on every flow, every step: `*`), with where
// it came from. They remind; they never block (a rule is what blocks). Three
// layers keep them: the person's own (every project they work in), the
// project's (every session and host of this project, on this machine), and the
// team's (committed with the repository). A practice the person took out stays
// as a tombstone, so it is not learned again. Pure and Node-free.

export type PracticeLayer = "personal" | "project" | "team";
export const PRACTICE_LAYERS: readonly PracticeLayer[] = ["personal", "project", "team"];

/** Who wrote a practice: the model at a turn's end, the move from the host's memory, or the person. */
export type PracticeBy = "model" | "memory" | "person";

/**
 * A practice: the step it hangs on (`flow` and `step`, `*` for every one), what to do, why (the incident it came from),
 * when and by whom it was written, its layer; `ref` the address of the text where a file read every turn keeps it
 * (CLAUDE.md#build-and-check), `from` its source (memory:<file>), `deleted` once the person took it out.
 */
export interface Practice { id: string; flow: string; step: string; text: string; why: string; at: string; by: PracticeBy; layer: PracticeLayer; ref?: string; from?: string; deleted?: boolean; session?: string; turn?: number }

/** A layer's file read: its practices, and whether the host's memory was moved into it. */
export interface PracticeFile { practices: Practice[]; memoryMoved: boolean }

const OPEN = "=== data {#practices format=jsonl}";
const BY: readonly PracticeBy[] = ["model", "memory", "person"];

function isPractice(v: unknown): v is Omit<Practice, "layer"> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  const p = v as Record<string, unknown>;
  return ["id", "flow", "step", "text", "why", "at"].every((k) => typeof p[k] === "string") && p["text"] !== "" && BY.includes(p["by"] as PracticeBy)
    && (p["ref"] === undefined || typeof p["ref"] === "string") && (p["from"] === undefined || typeof p["from"] === "string") && (p["deleted"] === undefined || typeof p["deleted"] === "boolean")
    && (p["session"] === undefined || typeof p["session"] === "string") && (p["turn"] === undefined || typeof p["turn"] === "number");
}

/** A layer's file: its practices (a line that is none is left out), each given the layer; empty text, no practices. */
export function parsePractices(text: string, layer: PracticeLayer): PracticeFile {
  const lines = text.split(/\r?\n/);
  const open = lines.findIndex((l) => l.trim() === OPEN);
  const memoryMoved = /^memory\s*=\s*"moved"\s*$/m.test(text);
  if (open < 0) return { practices: [], memoryMoved };
  const close = lines.findIndex((l, i) => i > open && l.trim() === "===");
  const practices: Practice[] = [];
  for (const line of lines.slice(open + 1, close < 0 ? undefined : close)) {
    if (line.trim() === "") continue;
    try {
      const v: unknown = JSON.parse(line);
      if (isPractice(v)) practices.push({ ...v, layer });
    } catch { /* not a practice */ }
  }
  return { practices, memoryMoved };
}

/** A layer's file written: its meta (and whether the memory was moved), then one practice a line, without the layer it is in. */
export function practicesText(file: PracticeFile): string {
  const meta = `=== meta\ntitle = "做法"\n${file.memoryMoved ? 'memory = "moved"\n' : ""}===\n\n`;
  const lines = file.practices.map(({ layer: _layer, ...p }) => `${JSON.stringify(p)}\n`).join("");
  return `${meta}${OPEN}\n${lines}===\n`;
}

/**
 * The practices that remind at a step: not taken out, at most `limit`. The step's own come first, then the flow's
 * for every step, then the ones for any time, each the newest first: a practice for any time never crowds out the
 * step's own.
 */
export function practicesAt(list: readonly Practice[], flow: string, step: string, limit = 3): Practice[] {
  const rank = (p: Practice): number => (p.flow === flow && p.step === step ? 0 : p.flow === flow ? 1 : 2);
  return list
    .filter((p) => p.deleted !== true && (p.flow === flow || p.flow === "*") && (p.step === step || p.step === "*"))
    .sort((a, b) => rank(a) - rank(b) || (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
    .slice(0, limit);
}

const same = (a: string, b: string): boolean => a.replace(/\s+/g, "") === b.replace(/\s+/g, "");

/**
 * Practices given (the practice tool, the move from memory) checked against the ones kept: each needs its flow, step
 * and text; one already kept on the same step (or one the person took out) is not added again. `newId` names a new
 * one. What to write, and what was wrong with the rest.
 */
export function newPractices(given: readonly unknown[], kept: readonly Practice[], at: string, by: PracticeBy, newId: (n: number) => string, flows: readonly { name: string; steps: readonly string[] }[], where?: { session: string; turn: number }): { added: Practice[]; errors: string[] } {
  const added: Practice[] = [];
  const errors: string[] = [];
  given.forEach((v, n) => {
    if (typeof v !== "object" || v === null || Array.isArray(v)) { errors.push(`practice ${n + 1} is not an object`); return; }
    const x = v as Record<string, unknown>;
    const s = (k: string): string => (typeof x[k] === "string" ? (x[k] as string).trim() : "");
    const flow = s("flow") || "*";
    const step = s("step") || "*";
    const text = s("text");
    if (text === "") { errors.push(`practice ${n + 1} has no text`); return; }
    const f = flows.find((g) => g.name === flow);
    if (flow !== "*" && f === undefined) { errors.push(`practice ${n + 1}: flow must be * or one of ${flows.map((g) => g.name).join(", ")}`); return; }
    if (step !== "*" && f !== undefined && !f.steps.includes(step)) { errors.push(`practice ${n + 1}: ${flow} has no step "${step}" (${f.steps.join(", ")})`); return; }
    if (step !== "*" && flow === "*") { errors.push(`practice ${n + 1}: a step needs its flow`); return; }
    const layer: PracticeLayer = x["layer"] === "personal" ? "personal" : "project";
    const was = [...kept, ...added].find((p) => p.flow === flow && p.step === step && same(p.text, text));
    if (was !== undefined) { errors.push(was.deleted === true ? `practice ${n + 1}: the person took it out; not again` : `practice ${n + 1}: already kept`); return; }
    added.push({ id: newId(n), flow, step, text, why: s("why"), at, by, layer, ...(s("ref") !== "" ? { ref: s("ref") } : {}), ...(s("from") !== "" ? { from: s("from") } : {}), ...(where !== undefined ? { session: where.session, turn: where.turn } : {}) });
  });
  return { added, errors };
}

/** Whether a practice is new: written by the model in the last `days` days (新学到, with its ×). */
export function isNew(p: Practice, now: string, days = 7): boolean {
  return p.by === "model" && Date.parse(now) - Date.parse(p.at) < days * 86_400_000;
}
