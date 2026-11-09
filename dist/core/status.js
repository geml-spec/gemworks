// The status a host shell shows (spec §8.1, §8.2): the work item, the state,
// every variable with where it reads from, and each way out with whether its
// guard holds — built from a statechart and a run by every host alike: the
// workspace over a work item's journal, the DeepSeek Harness adapter over a
// session's. Pure.
import { guardText } from "@geml/geml/dist/statechart.js";
import { checkpointRev, guardHolds } from "./snapshot.js";
import { outgoing, sourceLabel } from "./statechart.js";
/** A variable holds for a machine guard's `missing` list when it is not false, null or absent. */
export const truthy = (v) => v !== undefined && v !== null && v !== false;
/** The status of a run — or, with none, of a work item nothing has recorded yet. */
export function statusOf(sc, base, run) {
    const sources = {};
    for (const v of sc.vars.values())
        if (v.source !== undefined)
            sources[v.name] = sourceLabel(v.source);
    const head = { ...base, sources };
    if (run === undefined)
        return { ...head, vars: {}, next: [], refusals: 0, paused: false };
    const snap = run.snapshot;
    const state = sc.states.get(snap.state);
    return {
        ...head,
        ...(state ? { state: { id: state.id, title: state.title, rev: snap.rev, uses: state.uses, final: state.final, since: run.history.find((s) => s.rev === checkpointRev(run.history))?.at ?? snap.at } } : {}),
        vars: snap.vars,
        next: outgoing(sc, snap.state).map((t) => ({
            name: t.name, to: t.to, judge: t.judge, approval: t.approval,
            ...(t.guard !== undefined ? { guard: guardText(t.guard) } : {}),
            reads: t.reads,
            missing: t.judge === "machine" ? t.reads.filter((r) => !truthy(snap.vars[r])) : [],
            holds: guardHolds(sc, t, snap.vars),
            note: t.note,
            label: t.label ?? sc.states.get(t.to)?.title ?? t.to,
            toFinal: sc.states.get(t.to)?.final === true,
            toStart: t.to === sc.initial,
        })),
        refusals: run.refusals,
        paused: run.paused,
    };
}
