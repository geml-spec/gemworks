// Where a work item stands on a light flow, worked out from which steps' leave
// requirements are met rather than kept as a state someone has to move: it
// stands at the first unmet step after the furthest met one; an unmet step
// before that was skipped, which reminds and holds nothing. Whose turn it is
// follows from who judges the step it stands at. Pure, importing nothing.

/** Who judges a step's leave requirement: a fact the plugin can check, the person, or the model. */
export type Judge = "fact" | "you" | "model";

/** What working out where an item stands reads of a step. */
export interface ProgressStep { id: string; judge: Judge; final: boolean }

/** A step as the item stands: met, the one it stands at, not reached yet, or passed with its requirement unmet. */
export type Cell = "met" | "here" | "ahead" | "skipped";

/** Whose turn: the person's (a step they judge), the model's (its own, or a fact nothing is checking yet), a check's under way, or none (every step met). */
export type Whose = "you" | "me" | "wait" | "done";

export interface Progress { cells: { id: string; cell: Cell }[]; here: string | null; whose: Whose }

/**
 * Where an item stands: `met` the steps whose requirement is met, `running`
 * the fact steps a check is under way for. A final step is met once every
 * other step is; until then it is ahead.
 */
export function progressOf(steps: readonly ProgressStep[], met: ReadonlySet<string>, running: ReadonlySet<string> = new Set()): Progress {
  const work = steps.filter((s) => !s.final);
  let furthest = -1;
  work.forEach((s, i) => { if (met.has(s.id)) furthest = i; });
  const at = work.findIndex((s, i) => i > furthest && !met.has(s.id));
  const here = at < 0 ? null : (work[at] as ProgressStep);
  const cells = steps.map((s) => {
    if (s.final) return { id: s.id, cell: (here === null ? "met" : "ahead") as Cell };
    const i = work.indexOf(s);
    const cell: Cell = met.has(s.id) ? "met" : i === at ? "here" : i < furthest ? "skipped" : "ahead";
    return { id: s.id, cell };
  });
  if (here === null) return { cells, here: null, whose: "done" };
  const whose: Whose = here.judge === "you" ? "you" : here.judge === "fact" && running.has(here.id) ? "wait" : "me";
  return { cells, here: here.id, whose };
}
