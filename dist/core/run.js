import { applyExpiry, applyHold, applyPatch, applyRollback, applySignal, applyTransition, initialSnapshot, isPaused, reenterSnapshot, stageEntryRev, } from "./snapshot.js";
import { readJournal, renderJournalHead, renderRefusedBlock, renderSnapshotBlock, renderWroteBlock, verifyJournal } from "./journal.js";
class RunState {
    sc;
    log;
    refused;
    refLog;
    wroteLog;
    constructor(sc, history, refusals, refusalLog = [], wroteLog = []) {
        this.sc = sc;
        this.log = history;
        this.refused = refusals;
        this.refLog = refusalLog;
        this.wroteLog = wroteLog;
    }
    get writeLog() {
        return this.wroteLog;
    }
    wrote(tool, path, meta) {
        const since = stageEntryRev(this.log);
        if (this.wroteLog.some((w) => w.path === path && w.rev >= since))
            return null;
        const n = this.wroteLog.reduce((max, w) => (w.n > max ? w.n : max), 0) + 1;
        this.wroteLog.push({ n, rev: this.snapshot.rev, path });
        return renderWroteBlock({ n, rev: this.snapshot.rev, at: meta.at, tool, ...(meta.call !== undefined ? { call: meta.call } : {}), path });
    }
    get snapshot() {
        // The log is never empty: every constructor path seeds it with one revision.
        return this.log[this.log.length - 1];
    }
    get history() {
        return this.log;
    }
    get refusals() {
        return this.refused;
    }
    get refusalLog() {
        return this.refLog;
    }
    get paused() {
        return isPaused(this.log);
    }
    refuse(refusal, meta) {
        this.refused += 1;
        this.refLog.push({ n: this.refused, rev: this.snapshot.rev, ...(meta.call !== undefined ? { call: meta.call } : {}), ...(refusal.key !== undefined ? { key: refusal.key } : {}) });
        return renderRefusedBlock({
            n: this.refused,
            rev: this.snapshot.rev,
            at: meta.at,
            tool: refusal.tool,
            ...(meta.call !== undefined ? { call: meta.call } : {}),
            reason: refusal.reason,
            diagnostics: refusal.diagnostics,
            ...(refusal.key !== undefined ? { key: refusal.key } : {}),
        });
    }
    /** Commit an outcome: extend the chain on success, only number it on refusal. */
    settle(outcome, meta) {
        if (outcome.ok) {
            this.log.push(outcome.next);
            return { ok: true, snapshot: outcome.next, block: renderSnapshotBlock(outcome.next) };
        }
        return { ok: false, refusal: outcome.refusal, block: this.refuse(outcome.refusal, meta) };
    }
    transition(to, meta) {
        return this.settle(applyTransition(this.sc, this.snapshot, to, meta), meta);
    }
    set(patch, meta) {
        return this.settle(applyPatch(this.sc, this.snapshot, patch, meta), meta);
    }
    signal(name, value, meta, tree) {
        const outcome = applySignal(this.sc, this.snapshot, name, value, meta, tree);
        return outcome === null ? null : this.settle(outcome, meta);
    }
    expire(tree, meta) {
        const next = applyExpiry(this.sc, this.log, tree, meta);
        if (next === null)
            return null;
        this.log.push(next);
        return { snapshot: next, block: renderSnapshotBlock(next) };
    }
    rollback(target, meta) {
        return this.settle(applyRollback(this.sc, this.log, target, meta), meta);
    }
    hold(paused, meta) {
        return this.settle(applyHold(this.sc, this.log, paused, meta), meta);
    }
    reenter(at) {
        const next = reenterSnapshot(this.sc, this.snapshot, at);
        this.log.push(next);
        return { snapshot: next, block: renderSnapshotBlock(next) };
    }
}
/** Open a fresh run: the journal head plus revision 0, in the initial state or in `state`. */
export function startRun(sc, meta, at, state = sc.initial) {
    const first = initialSnapshot(sc, at, state);
    return {
        run: new RunState(sc, [first], 0),
        head: renderJournalHead(meta),
        block: renderSnapshotBlock(first),
    };
}
/**
 * Reopen a run from its journal. The chain is verified BEFORE it is trusted:
 * a self-contradicting journal is more dangerous than no journal at all.
 * Verification runs without the statechart so that a chain problem and a
 * statechart problem report separately.
 */
export function resumeRun(sc, journalSource) {
    const journal = readJournal(journalSource);
    const errors = verifyJournal(journal);
    if (errors.length)
        return { ok: false, reason: errors.join("; ") };
    const history = [...journal.snapshots].sort((a, b) => a.rev - b.rev);
    const current = history[history.length - 1];
    if (current === undefined)
        return { ok: false, reason: "the journal holds no revision" };
    if (!sc.states.has(current.state))
        return { ok: false, reason: `the statechart no longer has state ${current.state}` };
    const refusals = journal.refusals.reduce((max, r) => (r.n > max ? r.n : max), 0);
    const run = new RunState(sc, history, refusals, journal.refusals.map((r) => ({ n: r.n, rev: r.rev, ...(r.call !== undefined ? { call: r.call } : {}), ...(r.key !== undefined ? { key: r.key } : {}) })), journal.writes.map((w) => ({ n: w.n, rev: w.rev, path: w.path })));
    return journal.meta.workflowHash === sc.hash
        ? { ok: true, run }
        : { ok: true, run, note: `workflow changed: ${journal.meta.workflowHash} → ${sc.hash}` };
}
