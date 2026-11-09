import type { GitFacts } from "./core/signals.js";
/**
 * What git says about the project. `noCommits`: HEAD names a branch that has no
 * commit yet, so there is no history to compare and no work to track; `branch`
 * is still that branch's name.
 */
/** What git says of the checkout; `unanswered` when git did not answer at all (a busy machine): nothing is known then, not even that there is no branch. */
export interface RepoFacts {
    branch?: string;
    defaultBranch?: string;
    committed?: boolean;
    noCommits?: boolean;
    unanswered?: boolean;
}
export type GhFacts = ({
    available: true;
} & GitFacts) | {
    available: false;
    reason: string;
};
/** Forget what was remembered: the next question goes to git (a test that answers several requests in one process, as several processes would). */
export declare function forgetGitFacts(): void;
export declare function beginGitRequest(): void;
export declare function endGitRequest(): void;
export declare function repoFacts(root: string): RepoFacts;
/**
 * What a checkout holds, as one id (an `until = change` signal's evidence):
 * the git tree of its working content — every tracked and untracked file git
 * does not ignore, as it is on disk — written from a copy of the index, so the
 * real index is never touched and only changed files are hashed. A commit
 * changes nothing (same content, same tree); an edit, a rebase or a pull does.
 * Paths under .geml and node_modules are left out, so Gemworks's own writes
 * change nothing. Undefined when git cannot say (no repository, git missing).
 */
export declare function treeFingerprint(root: string): string | undefined;
/** A commit: its hash, committer time, subject, and the files it changed, `/`-separated and relative to the directory git ran in. */
export interface CommitFacts {
    sha: string;
    at: string;
    subject: string;
    files: string[];
}
/**
 * The commits on HEAD a work item's window holds, newest first, at most
 * `limit`: with `ownBranch`, the ones the default branch has not (a
 * branch's own); otherwise the ones committed since `since` and until
 * `until`, only those that touch `paths` when given. Empty when git cannot
 * say: no repository, no default branch, no commits.
 */
export declare function commitsOf(root: string, w: {
    ownBranch?: boolean;
    since?: string;
    until?: string;
    paths?: readonly string[];
}, limit?: number): CommitFacts[];
/** Whether `name` is an existing local branch of the repository at `root`. */
export declare function isLocalBranch(root: string, name: string): boolean;
/** The git checkout a directory is in, as real paths. */
export interface Checkout {
    /** The working tree's top directory. */
    top: string;
    /** The repository's common directory, the same from every checkout of it. */
    common: string;
    /** The main working tree; absent when the common directory is no `.git` directory inside one (a bare repository, a separate git directory). */
    main?: string;
}
/**
 * The checkout `dir` is in: `git -C <dir> rev-parse --show-toplevel` and the
 * common directory, whose parent is the main working tree when it is a `.git`
 * directory — a worktree's `.git` file points into it. Undefined outside any
 * working tree: no repository, a bare one, git missing, the directory gone.
 */
export declare function checkoutOf(dir: string): Checkout | undefined;
/**
 * The directory whose `.geml/journals/` holds a project's journals: the main
 * working tree's copy of the project's directory, which every checkout of the
 * repository shares — a branch has one journal whichever checkout it is worked
 * in, and removing a worktree loses none of it. A project in no repository, or
 * in one with no main working tree to share, keeps its own (`root`, as given).
 * git is asked only when the nearest `.git` at or above the root is a file (a
 * worktree's): a `.git` directory there makes the root part of the main
 * working tree already.
 */
export declare function journalBaseOf(root: string): string;
/** The files git tracks under `dir`, absolute; none where `dir` is in no repository; undefined when git cannot say. */
export declare function trackedUnder(dir: string): Set<string> | undefined;
/**
 * Which of `paths` (relative to `root`) git does not keep: the ones it
 * ignores and does not track, every one where `root` is in no repository;
 * undefined when git cannot say.
 */
export declare function unkeptOf(root: string, paths: readonly string[]): Set<string> | undefined;
/**
 * The pull request of `branch` and the CI runs on its head, as `gh` reports
 * them. The binary is `o.gh`, else `GEMWORKS_GH`, else `gh`. The pull request is
 * the newest one whose head is the branch (`pr list --head`, which never reads
 * a branch named `123` as pull request 123 the way `pr view` does); a branch
 * with none is a fact (not open, not merged); a gh that is missing, not logged
 * in, or has no GitHub remote to ask is `available: false` with a reason, so
 * the signals stay not established rather than turning false. Of the runs on
 * the head each workflow counts by its newest run alone. A binary ending in
 * `.js`, `.mjs` or `.cjs` is a stand-in run by this Node, which Windows needs:
 * it starts no script from its shebang.
 */
export declare function ghFacts(root: string, branch: string, o?: {
    gh?: string;
    fresh?: boolean;
}): GhFacts;
/**
 * Local branches with commits their upstream does not have, across the
 * repository — a worktree's branch too, since worktrees share it. `newestAt`
 * is the branch tip's commit time. A branch with no upstream is not listed: it
 * was never pushed, so nothing is "not pushed yet" about it. Undefined when
 * git cannot say.
 */
export declare function branchesAhead(root: string): {
    branch: string;
    ahead: number;
    newestAt?: string;
}[] | undefined;
/**
 * A version bump not yet committed: among the checkout's uncommitted changes,
 * the first package.json or plugin.json whose `version` is above the one
 * HEAD holds — a release-like change waiting for its commit. Undefined when
 * there is none, or git cannot say.
 */
export declare function uncommittedBump(root: string): {
    path: string;
    version: string;
    was: string;
} | undefined;
/**
 * The open pull requests the person opened, with their checks: `green` when
 * every check finished and passed, `failing` the checks that finished and
 * failed. Undefined when gh cannot be asked — the band then says nothing of
 * pull requests, and a hold on one is not let go. The binary is chosen as
 * ghFacts chooses it.
 */
export declare function openPullRequests(root: string, o?: {
    gh?: string;
}): {
    number: number;
    branch: string;
    green: boolean;
    failing: string[];
}[] | undefined;
/** A local branch as the outline reads it: its tip, how far ahead of the default branch, whether the default branch holds it, where it is checked out. */
export interface BranchFact {
    tip: string;
    ahead?: number;
    inDefault: boolean;
    worktree?: string;
}
/**
 * Every local branch at once — a few git runs for all of them, not one per
 * work item — and the default branch's ref they are measured against.
 */
export declare function branchesFacts(root: string): {
    ok: boolean;
    base?: string;
    branches: Map<string, BranchFact>;
};
/** Every working tree of the repository `root` is in, the main one first, as git names them; none when git cannot say. */
export declare function worktreesOf(root: string): string[];
/** Whether the default branch `base` holds commit `sha`; undefined when git cannot say (a commit it no longer has). */
export declare function holdsCommit(root: string, base: string, sha: string): boolean | undefined;
/** The project's pull requests by the branch each was opened from, the newest of a branch's; none when gh cannot be asked. */
export declare function pullRequestsByBranch(root: string, o?: {
    gh?: string;
}): Map<string, {
    number: number;
    state: "open" | "merged" | "closed";
}>;
/** ghFacts, asked at most once per branch by the function this returns: one request or tool call may read gh's facts twice (a refresh, then the status). `fresh`: past what gh said in the last minute. */
export declare function ghOncePerBranch(o?: {
    fresh?: boolean;
}): (root: string, branch: string) => GhFacts;
