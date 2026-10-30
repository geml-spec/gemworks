// The model's side of practices (core/practices.ts): the tool it records one
// with at a turn's end, what it is told about it once, the reminder beside a
// prompt — the practices of the step this session's work item stands at — and,
// on a project's first start, the ask to move the practices in the host's
// memory onto their steps. Pure.
import { itemProgress, turnItem, type CoachFlow, type WorkItem } from "./coach.js";
import { practicesAt, type Practice } from "../../core/practices.js";

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
export const PRACTICE_PROMPT = "Gemworks: when a turn paid a price (a way back, a failed test or CI, the person saying it is not fixed, the person correcting you, a rule blocking a call), record what would have avoided it with the gemworks `practice` tool, on the step it happened at; also when the person tells you how they want something done. Practices only remind. Beside a prompt you are shown the practices of the step your work item stands at: follow them.";

/** The line beside a prompt: the practices of the step this session's last work item on the way stands at, at most three. */
export function practiceContext(items: readonly WorkItem[], flows: readonly CoachFlow[], practices: readonly Practice[], session: string): string[] {
  const i = turnItem(items, session);
  const flow = flows.find((f) => f.name === i?.flow);
  if (i === undefined || flow === undefined) return [];
  const here = itemProgress(i, flow).here;
  if (here === null) return [];
  const at = practicesAt(practices, flow.name, here);
  if (at.length === 0) return [];
  const step = flow.states.find((s) => s.id === here)?.title ?? here;
  return [`[gemworks] at ${flow.name} ${here} ${step} for «${i.title}», the practices: ${at.map((p, n) => `(${n + 1}) ${p.text}${p.ref !== undefined ? ` [${p.ref}]` : ""}`).join(" ")}`];
}

/** The ask, once on a project's first start, to move the practices among the host's memory notes onto their steps. */
export function memoryMoveContext(dir: string, notes: readonly { file: string; title: string; hook: string }[]): string[] {
  if (notes.length === 0) return [];
  const listed = notes.map((n) => `${n.file} (${n.title}: ${n.hook})`).join("; ");
  return [`[gemworks] First start: this project's memory in ${dir} holds ${notes.length} notes. Read the ones that are practices — how to work, each with its why; not decisions or facts about the project — and record each with the gemworks \`practice\` tool on the step it belongs to (flow and step ids as the work tool lists them; * for every flow or step), layer personal for how the person wants work done everywhere, project for this repository's own, why the incident it came from, from memory:<file>, and memory: true on the call. Leave the memory files as they are. The notes: ${listed}`];
}
