// The run's state: one immutable Snapshot per revision, hash-chained. Each way
// of advancing it — the verbs (move, set), a person's rollback, evidence
// written or expired — computes a candidate, validates it, and either returns
// it or a Refusal; a refused change produces no snapshot, so the journal never
// holds a bad one.
import { createHash } from "node:crypto";
import { defaultsOf, validate } from "./schema.js";
import { modelVars, outgoing, varsBySource } from "./statechart.js";
/**
 * Compare two strings by Unicode CODE POINT, not UTF-16 code unit: an astral
 * character's lead surrogate can sort below a BMP character with a higher code
 * point, which is backwards for exactly the characters "sorted by code point"
 * exists to place. Spreading a string iterates by code point.
 */
function compareByCodePoint(a, b) {
    const as = [...a];
    const bs = [...b];
    const len = Math.min(as.length, bs.length);
    for (let i = 0; i < len; i++) {
        const diff = as[i].codePointAt(0) - bs[i].codePointAt(0);
        if (diff !== 0)
            return diff;
    }
    return as.length - bs.length;
}
/** Canonical JSON: keys sorted by code point, no whitespace. The hashed form. */
export function canonical(value) {
    if (value === null || typeof value !== "object")
        return JSON.stringify(value);
    if (Array.isArray(value))
        return "[" + value.map(canonical).join(",") + "]";
    const keys = Object.keys(value).sort(compareByCodePoint);
    return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonical(value[k])).join(",") + "}";
}
/** The hash of a revision: the sha256 of its canonical JSON without `hash` (spec §5.5). */
export function hashSnapshot(s) {
    const { hash: _hash, ...rest } = s;
    const payload = canonical(rest);
    return "sha256:" + createHash("sha256").update(payload, "utf8").digest("hex");
}
function seal(s) {
    return { ...s, hash: hashSnapshot(s) };
}
function child(prev, meta, fields) {
    const base = { rev: prev.rev + 1, parent: prev.hash, at: meta.at, ...fields };
    if (meta.call !== undefined)
        base.call = meta.call;
    if (meta.by !== undefined)
        base.by = meta.by;
    if (meta.signal !== undefined)
        base.signal = meta.signal;
    return seal(base);
}
/** Revision 0: the initial state, or `state` when the run starts where its work item says it stands. */
export function initialSnapshot(sc, at, state = sc.initial) {
    return seal({ rev: 0, state, vars: defaultsOf(sc.varsSchema), cause: "enter", parent: null, at });
}
/** `clear`: a fresh start recorded on the same chain. */
export function reenterSnapshot(sc, prev, at) {
    return child(prev, { at }, { state: sc.initial, vars: defaultsOf(sc.varsSchema), cause: "enter", from: prev.state });
}
const refuse = (tool, reason, diagnostics = []) => ({ ok: false, refusal: { tool, reason, diagnostics } });
/** The model's `set`: only variables without a source, each of its default's type. */
export function applyPatch(sc, snap, patch, meta) {
    if (!sc.states.has(snap.state))
        return refuse("set", `current state ${snap.state} is not in the statechart`);
    const writable = new Set(modelVars(sc));
    for (const k of Object.keys(patch)) {
        if (!sc.vars.has(k))
            return refuse("set", `"${k}" is not a variable of the workflow`);
        if (!writable.has(k))
            return refuse("set", `"${k}" is evidence (it has a source); the model cannot write it`);
    }
    const merged = { ...snap.vars, ...patch };
    const diagnostics = validate(sc.varsSchema, merged);
    if (diagnostics.length)
        return refuse("set", "a value is not of the variable's type", diagnostics);
    return { ok: true, next: child(snap, meta, { state: snap.state, vars: merged, cause: "patch" }) };
}
/**
 * Evidence observed: write the variable. Null when it already holds the
 * value, so repeated observations add no revision. A variable without a
 * source is a refusal (a host passing a bad name gets a journaled refusal)
 * rather than a throw. `by` and `signal` are always set here.
 */
export function applySignal(sc, snap, name, value, meta, tree) {
    if (!sc.states.has(snap.state))
        return refuse("signal", `current state ${snap.state} is not in the statechart`);
    const v = sc.vars.get(name);
    if (v?.source === undefined)
        return refuse("signal", `"${name}" is not a variable with a source`);
    if (snap.vars[name] === value)
        return null;
    const merged = { ...snap.vars, [name]: value };
    // `tool` evidence other than the default carries the content it was observed on, so a later change can expire it.
    const stamped = tree !== undefined && v.source.kind === "tool" && value !== v.default;
    return { ok: true, next: child(snap, { ...meta, by: "signal", signal: name }, { state: snap.state, vars: merged, cause: "patch", ...(stamped ? { tree } : {}) }) };
}
/** The content fingerprint of the revision at which `name` took the value it holds now; undefined when that revision carries none. */
function treeOfValue(history, name) {
    const now = canonical(history[history.length - 1]?.vars[name] ?? null);
    for (let i = history.length - 1; i >= 0; i--) {
        const prev = history[i - 1];
        if (prev === undefined || canonical(prev.vars[name] ?? null) !== now)
            return history[i].tree;
    }
    return undefined;
}
/**
 * Evidence expiry (spec §5.2): every `tool` variable that still holds a value
 * other than its default, written on another content fingerprint than `tree`,
 * returns to its default, all in one revision (`cause=expire by=signal
 * signal=<the first such variable>`). Null when none has expired.
 */
/** Whether any `tool` variable holds a value written on some content: only then can a change of content expire it, and only then is the content read. */
export function hasExpirable(sc, history) {
    const snap = history[history.length - 1];
    if (!snap)
        return false;
    return varsBySource(sc, "tool").some((v) => {
        const value = snap.vars[v.name];
        return value !== undefined && canonical(value) !== canonical(v.default) && treeOfValue(history, v.name) !== undefined;
    });
}
export function applyExpiry(sc, history, tree, meta) {
    const snap = history[history.length - 1];
    if (!snap || !sc.states.has(snap.state))
        return null;
    const reset = {};
    let first;
    for (const v of varsBySource(sc, "tool")) {
        const value = snap.vars[v.name];
        if (value === undefined || canonical(value) === canonical(v.default))
            continue;
        const written = treeOfValue(history, v.name);
        if (written === undefined || written === tree)
            continue;
        reset[v.name] = v.default;
        first ??= v.name;
    }
    if (first === undefined)
        return null;
    return child(snap, { ...meta, by: "signal", signal: first }, { state: snap.state, vars: { ...snap.vars, ...reset }, cause: "expire" });
}
/** Whether a machine-judged transition's guard holds for `vars`. A transition judged by the model or by nobody has no guard to hold. */
export function guardHolds(sc, t, vars) {
    if (t.judge !== "machine" || t.guard === undefined || t.guard.kind === "text")
        return true;
    const schema = t.guard.schema;
    return schema === null || schema === undefined ? false : validate(schema, vars).length === 0;
}
export function applyTransition(sc, snap, to, meta) {
    const t = outgoing(sc, snap.state).find((x) => x.to === to);
    if (!t)
        return refuse("move", `no transition ${snap.state}→${to}`);
    if (!guardHolds(sc, t, snap.vars))
        return refuse("move", `${t.name}: the guard does not hold (${t.reads.map((r) => `${r}=${JSON.stringify(snap.vars[r] ?? null)}`).join(", ")})`);
    // The guard read the variables as they were; the resets go back to their defaults in this same revision, and so does
    // every `elapsed` variable: entering a state restarts its clock.
    const resets = [...t.resets, ...varsBySource(sc, "elapsed").map((v) => v.name)];
    const vars = resets.length > 0 ? { ...snap.vars, ...Object.fromEntries(resets.map((v) => [v, sc.vars.get(v)?.default ?? null])) } : snap.vars;
    return { ok: true, next: child(snap, meta, { state: t.to, vars, cause: "transition", from: snap.state }) };
}
/** The revision at which the current state was entered: the last revision that is neither a patch, an expiry, nor a hold. */
export function checkpointRev(history) {
    for (let i = history.length - 1; i >= 0; i--) {
        const cause = history[i].cause;
        if (cause !== "patch" && cause !== "expire" && cause !== "pause" && cause !== "resume")
            return history[i].rev;
    }
    return 0;
}
/** Whether a person holds the work item (spec §5.5): the latest pause or resume decides; a fresh entry lifts a hold. */
export function isPaused(history) {
    for (let i = history.length - 1; i >= 0; i--) {
        const cause = history[i].cause;
        if (cause === "pause")
            return true;
        if (cause === "resume" || cause === "enter")
            return false;
    }
    return false;
}
/**
 * A person holds the work item or lets it go (spec §5.5): a revision in the
 * same state with the same variables, `cause=pause` or `cause=resume`,
 * `by=human`. Holding a held item, or releasing a free one, is a refusal.
 */
export function applyHold(sc, history, hold, meta) {
    const verb = hold ? "pause" : "resume";
    const snap = history[history.length - 1];
    if (!snap)
        return refuse(verb, "no revision to hold");
    if (!sc.states.has(snap.state))
        return refuse(verb, `current state ${snap.state} is not in the statechart`);
    if (isPaused(history) === hold)
        return refuse(verb, hold ? "the work item is already paused" : "the work item is not paused");
    return { ok: true, next: child(snap, { ...meta, by: "human" }, { state: snap.state, vars: snap.vars, cause: verb }) };
}
/**
 * The revision at which the current stage was entered: the last `enter` or
 * `transition` (a self-loop is an entry), or the last rollback that restored
 * a state other than the one it left. A patch, and a rollback inside the
 * same state, stay in the stage they were in.
 */
export function stageEntryRev(history) {
    for (let i = history.length - 1; i >= 0; i--) {
        const s = history[i];
        if (s.cause === "enter" || s.cause === "transition")
            return s.rev;
        if (s.cause === "rollback" && history[i - 1]?.state !== s.state)
            return s.rev;
    }
    return 0;
}
export function applyRollback(sc, history, target, meta) {
    const current = history[history.length - 1];
    if (!current)
        return refuse("rollback", "no revision to roll back from");
    const rev = target === "checkpoint" ? checkpointRev(history) : target;
    const found = history.find((s) => s.rev === rev);
    if (!found)
        return refuse("rollback", `revision ${rev} does not exist`);
    if (!sc.states.has(found.state))
        return refuse("rollback", `revision ${rev} is in state ${found.state}, which the statechart no longer has`);
    // A rollback enters its state now: the `elapsed` variables start from their defaults, whatever the restored revision held.
    const vars = { ...found.vars, ...Object.fromEntries(varsBySource(sc, "elapsed").map((v) => [v.name, v.default])) };
    return { ok: true, next: child(current, meta, { state: found.state, vars, cause: "rollback", from: current.state, restores: rev }) };
}
