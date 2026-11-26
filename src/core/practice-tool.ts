// The model's side of practices (core/practices.ts): the tool it records one
// with at a turn's end, what it is told about it once, the reminder beside a
// prompt — the practices of the step this session's work item stands at — and,
// on a project's first start, the ask to move the practices in the host's
// memory onto their steps. Pure.
import { itemProgress, turnItem, type CoachFlow, type WorkItem } from "./work.js";
import { closestPractices, practicesAt, type Practice } from "./practices.js";
import { FAILING_AFTER, type PracticeCount } from "./corrections.js";

/** The tool the model records practices with. */
export const PRACTICE_TOOL = {
  name: "practice",
  description: "Record what this project has learned about doing its work, each on the step of a flow it belongs to, so it reminds whoever comes to that step next. Record one when a turn paid a price — a way back, a failed test or CI, the person saying it is not fixed, the person correcting you, a rule blocking a call — as what would have avoided it; or when the person tells you how they want something done. A practice reminds; it never blocks.",
  inputSchema: {
    type: "object",
    properties: {
      practices: {
        type: "array",
        items: {
          type: "object",
          properties: {
            flow: { type: "string", description: "The flow it belongs to, by its name; * for every flow." },
            step: { type: "string", description: "The step's id in that flow; * for every step (with flow *, any time)." },
            text: { type: "string", description: "What to do, one short sentence in the person's language." },
            why: { type: "string", description: "The incident it came from: when, and what it cost, in a few words." },
            layer: { type: "string", enum: ["personal", "project"], description: "personal for how this person wants work done in every project; project for this repository's own." },
            ref: { type: "string", description: "Where a file read every turn already keeps its text, as file#heading (CLAUDE.md#build-and-check); the text then stays there." },
            from: { type: "string", description: "Its source when it is moved, as memory:<file>." },
            new: { type: "boolean", description: "true when none of the closest practices the tool listed says this: it is new." },
            replaces: { type: "string", description: "The id of a listed practice this one rewrites (one not holding first): it takes that one's place, which is kept, taken out. Not the person's own or the team's." },
          },
          required: ["text", "layer"],
          additionalProperties: false,
        },
      },
      memory: { type: "boolean", description: "true on the calls that move the project's memory in (asked once, on first start)." },
    },
    required: ["practices"],
    additionalProperties: false,
  },
} as const;

/** What the model is told once about practices. */
export const PRACTICE_PROMPT = "Gemworks: when a turn paid a price (a way back, a failed test or CI, the person saying it is not fixed, the person correcting you, a rule blocking a call), record what would have avoided it with the gemworks `practice` tool, on the step it happened at; also when the person tells you how they want something done. Before it writes one, the tool lists the closest practices already kept, with how each fared: call it again saying of each of yours new: true, or replaces: <id> to rewrite one in its place. Practices only remind. Beside a prompt you are shown the practices of the step your work item stands at, each with why it was learned and how often the person corrected the same thing before it was written and since: follow them, and one marked not holding most carefully.";

/** The most characters of a practice's why a reminder carries: the incident's first words, enough to know what it cost. */
export const WHY_SHOWN = 60;

/**
 * A practice as a reminder says it: its words and where a file keeps them; then why it was learned, clipped, and how
 * often the person corrected the same thing before it was written and since where it reminds (the ledger's count, the
 * flow tab's 纠正 n → m), marked not holding as the flow tab's 失效 card is. The evidence with the conclusion: a lesson
 * kept without what it cost and how it fared is easy to follow loosely. A count of nothing either side is left out.
 */
export function practiceWords(p: Practice, count?: PracticeCount): string {
  const why = p.why.trim();
  const clipped = [...why].length > WHY_SHOWN ? `${[...why].slice(0, WHY_SHOWN - 1).join("")}…` : why;
  const said = count !== undefined && count.before + count.after > 0
    ? `corrected ${count.before} before, ${count.after} since${count.after >= FAILING_AFTER ? ": not holding" : ""}` : "";
  const tail = [clipped, said].filter((x) => x !== "").join("; ");
  return `${p.text}${p.ref !== undefined ? ` [${p.ref}]` : ""}${tail !== "" ? ` — ${tail}` : ""}`;
}

/** How many of the closest practices kept the tool lists back before one is written. */
export const CLOSEST_SHOWN = 5;

/** How a practice fared, said short: not holding, or its counts; nothing when nothing was counted. */
function fared(count: PracticeCount | undefined): string {
  if (count === undefined || count.before + count.after === 0) return "";
  return count.after >= FAILING_AFTER ? `not holding: corrected ${count.after} since` : `corrected ${count.before} before, ${count.after} since`;
}

/**
 * What the practice tool answers (newPractices's result): the ones written, and which each took the place of with how
 * that one fared; for each held back, the closest practices kept, on any step, with their why and how they fared, and
 * whose they are, then what to call it with; what was left out. Anything written makes it ok.
 */
export function practiceAnswer(r: { added: readonly Practice[]; errors: readonly string[]; replaced: readonly { id: string; by: string }[]; unreviewed: readonly { text: string }[] }, kept: readonly Practice[], counts: Readonly<Record<string, PracticeCount>> = {}): { ok: boolean; text: string } {
  const parts: string[] = [];
  if (r.added.length > 0) {
    parts.push(`Recorded ${r.added.length} practice${r.added.length === 1 ? "" : "s"}; they remind at their steps.`);
    for (const x of r.replaced) { const f = fared(counts[x.id]); parts.push(`[${x.by}] takes the place of [${x.id}]${f !== "" ? ` (${f})` : ""}.`); }
  }
  if (r.unreviewed.length > 0) {
    const pool = kept.filter((p) => p.replacedBy === undefined).length;
    for (const u of r.unreviewed) {
      const closest = closestPractices(kept, u.text, CLOSEST_SHOWN).map((p) => {
        const whose = p.deleted === true ? " (taken out by the person)" : p.layer === "team" ? " (the team's)" : p.by === "person" ? " (the person's)" : "";
        return `[${p.id}] ${p.flow} ${p.step}: ${practiceWords(p, counts[p.id])}${whose}`;
      });
      parts.push(`Not recorded yet: «${u.text}». Say first whether it is new or rewrites one already kept. The closest of the project's ${pool} practices:\n${closest.join("\n")}`);
    }
    parts.push("Call practice again with replaces: <id> (yours takes that one's place; it is kept, taken out) or new: true (about something none of these says). The person's own and the team's are not replaced: give yours as new.");
  }
  if (r.errors.length > 0) parts.push(`Left out: ${r.errors.join("; ")}.`);
  return { ok: r.added.length > 0, text: parts.length > 0 ? parts.join("\n") : "Nothing recorded: practices is a list." };
}

/**
 * The line beside a prompt: the practices of the step this session's last work item on the way stands at, at most
 * three, each with its why and, where the ledger has been read, its count by practice id.
 */
export function practiceContext(items: readonly WorkItem[], flows: readonly CoachFlow[], practices: readonly Practice[], session: string, counts: Readonly<Record<string, PracticeCount>> = {}): string[] {
  const i = turnItem(items, session);
  const flow = flows.find((f) => f.name === i?.flow);
  if (i === undefined || flow === undefined) return [];
  const here = itemProgress(i, flow).here;
  if (here === null) return [];
  const at = practicesAt(practices, flow.name, here);
  if (at.length === 0) return [];
  const step = flow.states.find((s) => s.id === here)?.title ?? here;
  return [`[gemworks] at ${flow.name} ${here} ${step} for «${i.title}», the practices: ${at.map((p, n) => `(${n + 1}) ${practiceWords(p, counts[p.id])}`).join(" ")}`];
}

/** The ask, once on a project's first start, to move the practices among the host's memory notes onto their steps. */
export function memoryMoveContext(dir: string, notes: readonly { file: string; title: string; hook: string }[]): string[] {
  if (notes.length === 0) return [];
  const listed = notes.map((n) => `${n.file} (${n.title}: ${n.hook})`).join("; ");
  return [`[gemworks] First start: this project's memory in ${dir} holds ${notes.length} notes. Read the ones that are practices — how to work, each with its why; not decisions or facts about the project — and record each with the gemworks \`practice\` tool on the step it belongs to (flow and step ids as the work tool lists them; * for every flow or step), layer personal for how the person wants work done everywhere, project for this repository's own, why the incident it came from, from memory:<file>, and memory: true on the call. Leave the memory files as they are. The notes: ${listed}`];
}
