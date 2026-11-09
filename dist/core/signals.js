// Evidence: the variables with a `source` (spec §4.2, §5.2), written from
// facts the host observed — a finished tool call bound to a use, whether a
// glob matches, what git and gh say. Pure: the host gathers the facts, these
// functions say which variables now read what, and the supervisor writes them.
import { evidenceKeys as keysOfLine, usesOf } from "./dictionary.js";
import { scopeIn } from "./policy.js";
import { checkpointRev } from "./snapshot.js";
import { varsBySource } from "./statechart.js";
export { MAX_SIGNAL_COMMAND_LENGTH, personOnlyReason, personOnlyRefusal, runsGitOrGh, signalHeads, simpleCommands } from "./command-line.js";
/**
 * The keys of a finished command line that may speak for evidence: one
 * `Bash(<command>)` per simple command this work item takes, and only when
 * the line is a plain `&&` chain — otherwise its exit status says nothing
 * about the command that matched. Null when the line speaks for none.
 */
export function commandKeys(o) {
    return keysOfLine(o.command, o.commands);
}
/** The `tool` evidence a finished call speaks for: the variables whose use one of its keys is bound to, in the current state, reading `ok`. */
export function toolSignals(sc, dict, stateId, keys, ok) {
    const uses = new Set(usesOf(dict, scopeIn(sc, stateId), keys));
    return varsBySource(sc, "tool").filter((v) => uses.has(v.source.use)).map((v) => ({ id: v.name, value: ok }));
}
/** The `tool` evidence of a finished command line: its keys (evidenceKeys), reading the exit status. */
export function commandSignals(sc, dict, stateId, o) {
    if (o.exitCode === null)
        return [];
    const keys = commandKeys(o);
    return keys === null ? [] : toolSignals(sc, dict, stateId, keys, o.exitCode === 0);
}
/** `exists` answers undefined when the host could not establish it (a walk that gave up): that variable is left as it was. */
export function fileSignals(sc, exists) {
    const out = [];
    for (const v of varsBySource(sc, "file")) {
        const value = exists(v.source.glob);
        if (value !== undefined)
            out.push({ id: v.name, value });
    }
    return out;
}
export function gitSignals(sc, f) {
    const out = [];
    for (const v of varsBySource(sc, "git")) {
        let value;
        switch (v.source.fact) {
            case "committed":
                value = f.committed;
                break;
            case "pr-open":
                value = f.prOpen;
                break;
            case "pr-merged":
                value = f.prMerged;
                break;
            case "ci-success":
                value = f.ci === undefined ? undefined : f.ci.length > 0 && f.ci.every((r) => r.success);
                break;
        }
        if (value !== undefined)
            out.push({ id: v.name, value });
    }
    return out;
}
/** Whether any variable reads git, and whether one reads gh (a git fact other than `committed`). */
export function readsGit(sc) {
    const facts = varsBySource(sc, "git").map((v) => v.source.fact);
    return { git: facts.length > 0, gh: facts.some((f) => f !== "committed") };
}
/**
 * The clock's evidence (spec §3.6): each `elapsed` variable is true once the
 * current state has been held at least its duration — from the revision that
 * entered the state (checkpointRev) to `now`. Every such variable is returned;
 * writing one that holds its value already adds no revision.
 */
export function elapsedSignals(sc, history, now) {
    const vars = varsBySource(sc, "elapsed");
    if (vars.length === 0)
        return [];
    const entered = history.find((s) => s.rev === checkpointRev(history))?.at;
    const held = entered === undefined ? NaN : Date.parse(now) - Date.parse(entered);
    if (!Number.isFinite(held))
        return [];
    return vars.map((v) => ({ id: v.name, value: held >= v.source.ms }));
}
