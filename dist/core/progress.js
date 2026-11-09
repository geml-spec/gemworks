// Where a work item stands on a light flow, worked out from which steps' leave
// requirements are met rather than kept as a state someone has to move: it
// stands at the first unmet step after the furthest met one; an unmet step
// before that was skipped, which reminds and holds nothing. Whose turn it is
// follows from who judges the step it stands at. Pure, importing nothing.
/**
 * Where an item stands: `met` the steps whose requirement is met, `running`
 * the fact steps a check is under way for. A final step is met once every
 * other step is; until then it is ahead.
 */
export function progressOf(steps, met, running = new Set()) {
    const work = steps.filter((s) => !s.final);
    let furthest = -1;
    work.forEach((s, i) => { if (met.has(s.id))
        furthest = i; });
    const at = work.findIndex((s, i) => i > furthest && !met.has(s.id));
    const here = at < 0 ? null : work[at];
    const cells = steps.map((s) => {
        if (s.final)
            return { id: s.id, cell: (here === null ? "met" : "ahead") };
        const i = work.indexOf(s);
        const cell = met.has(s.id) ? "met" : i === at ? "here" : i < furthest ? "skipped" : "ahead";
        return { id: s.id, cell };
    });
    if (here === null)
        return { cells, here: null, whose: "done" };
    const whose = here.judge === "you" ? "you" : here.judge === "fact" && running.has(here.id) ? "wait" : "me";
    return { cells, here: here.id, whose };
}
