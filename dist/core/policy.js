import { declaredUses, outgoing, statesDeclaring, varsBySource } from "./statechart.js";
import { stageEntryRev } from "./snapshot.js";
/** The variables a machine guard on one of the state's outgoing transitions reads. */
export function relevantVars(sc, stateId) {
    const read = new Set();
    for (const t of outgoing(sc, stateId))
        for (const name of t.reads)
            read.add(name);
    return [...read];
}
export function policyOf(sc, dict, run) {
    const fences = {};
    for (const use of declaredUses(sc))
        fences[use] = statesDeclaring(sc, use);
    const base = {
        unit: sc.unit, fences, rules: [...sc.rules], rows: dict.rows, files: varsBySource(sc, "file").map((v) => v.source.glob), git: varsBySource(sc, "git").length > 0,
        evidence: [...new Set(varsBySource(sc, "tool").map((v) => v.source.use))],
    };
    if (!run)
        return { ...base, active: false, state: "", uses: [], relevant: [], written: [] };
    const state = sc.states.get(run.snapshot.state);
    const since = stageEntryRev(run.history);
    const written = run.writeLog.filter((w) => w.rev >= since).map((w) => w.path);
    return { ...base, active: true, state: run.snapshot.state, uses: state?.uses ?? [], relevant: relevantVars(sc, run.snapshot.state), written };
}
/** The policy as the dictionary's decisions read it. */
export function scopeOf(p) {
    return { state: p.state, uses: p.uses, declaring: (use) => p.fences[use] ?? [], fenced: (use) => (p.rules ?? []).includes(use) };
}
/** The statechart as the dictionary's decisions read it, in `stateId`. */
export function scopeIn(sc, stateId) {
    return { state: stateId, uses: sc.states.get(stateId)?.uses ?? [], declaring: (use) => statesDeclaring(sc, use), fenced: (use) => sc.rules.has(use) };
}
