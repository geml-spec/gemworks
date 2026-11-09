import { canonical } from "./core/snapshot.js";
const ORDER = { snapshot: 0, refused: 1 };
/** The variables a revision changed against the one before it, with their new values. */
export function changedVars(prev, s) {
    const out = {};
    for (const [k, v] of Object.entries(s.vars))
        if (prev === undefined || canonical(prev.vars[k] ?? null) !== canonical(v))
            out[k] = v;
    return Object.keys(out).length > 0 ? out : undefined;
}
export function timelineOf(j) {
    const sorted = [...j.snapshots].sort((a, b) => a.rev - b.rev);
    const entries = [
        ...sorted.map((s, i) => {
            const changed = changedVars(sorted[i - 1], s);
            return {
                kind: "snapshot", rev: s.rev, at: s.at, state: s.state, cause: s.cause,
                ...(s.by ? { by: s.by } : {}), ...(s.signal ? { signal: s.signal } : {}), ...(s.from !== undefined ? { from: s.from } : {}),
                ...(s.restores !== undefined ? { restores: s.restores } : {}), ...(s.call !== undefined ? { call: s.call } : {}), ...(s.tree !== undefined ? { tree: s.tree } : {}),
                ...(changed !== undefined ? { changed } : {}),
            };
        }),
        ...j.refusals.map((r) => ({ kind: "refused", n: r.n, rev: r.rev, at: r.at, tool: r.tool, reason: r.reason, ...(r.call !== undefined ? { call: r.call } : {}), ...(r.key !== undefined ? { key: r.key } : {}) })),
    ];
    return entries.sort((a, b) => a.rev - b.rev || ORDER[a.kind] - ORDER[b.kind]);
}
