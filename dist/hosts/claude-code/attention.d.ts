import type { Pressable } from "./actions.js";
import type { Asked } from "../../core/ask-tool.js";
import type { BoardRow } from "./board.js";
import { type T } from "./text.js";
/** What the repository says, for the steps only the person can take. */
export interface AttentionFacts {
    /** Local branches with commits their upstream does not have; `newestAt`, the newest of those commits. */
    ahead: {
        branch: string;
        ahead: number;
        newestAt?: string;
    }[];
    /** Open pull requests: `green` when every check passed, `failing` the checks that failed. */
    prs: {
        number: number;
        branch: string;
        green: boolean;
        failing: string[];
    }[];
    /** The lists the repository could not be asked for (git or gh failed): empty above, and no hold on them is let go. */
    unread?: ("ahead" | "prs")[];
    /** Something changed that takes a reload to see (the plugin's own folder, while it is being developed). */
    reload?: boolean;
    /** The version the session runs and the one its folder holds, when they differ: what the reload brings. */
    versions?: {
        running: string;
        synced: string;
    };
    /** A version bumped in the checkout (a package.json or plugin.json) and not committed: the band keeps a step for it until it is. */
    bump?: {
        version: string;
        path: string;
    };
    /** The branches another open session works on and this one does not, each with where that session works (its checkout's folder). */
    elsewhere?: {
        branch: string;
        where: string;
    }[];
}
export declare const NO_FACTS: AttentionFacts;
/** What the band remembers between turns. */
export interface AttentionMemory {
    /** Standing conditions that already led. */
    shown: string[];
    /** Turns each standing condition has held. */
    age: Record<string, number>;
    /** The line that led last turn. */
    lastLead: string;
    /** Older asks the replies still remind of. */
    backlog: string[];
}
export declare const NO_MEMORY: AttentionMemory;
/** `maybe`: a question guessed from the reply, not registered — a grey hint with no answers. */
export type LeadKind = "ask" | "broken" | "you" | "maybe";
/** `step`: one of several asks in one reply, settled one by one — which, of how many. */
/** `full`: an ask's line with the whole question, where `text` may be cut to fit; `question`: a registered question, which its answers are said with. */
export interface Lead {
    key: string;
    kind: LeadKind;
    text: string;
    options: string[];
    step?: {
        index: number;
        of: number;
    };
    full?: string;
    question?: string;
}
export interface Standing {
    key: string;
    kind: "broken" | "you";
    short: string;
    text: string;
    options: string[];
    quiet?: boolean;
}
/** `steps`: the other steps only the person can take now, each a button of its own beside the lead's options. `full`: a question led, whole, for a band that wraps it. */
export interface BandLine {
    text: string;
    options: string[];
    lead: LeadKind | null;
    steps: Standing[];
    full?: string;
}
/** A standing condition rides at the end of the line for this many turns, then only the board shows it. */
export declare const FADE = 3;
/** The band's room, in cells (a CJK character takes two). */
export declare const WIDTH = 90;
/** Away this long, the band says what became of the last request. */
export declare const AWAY_MS: number;
/** Short enough for its room: emphasis, code marks, a heading's or quote's lead come off ("#32" stays). */
export declare const clip: (s: string, n: number) => string;
/** Lines first (a list item is its own sentence), then sentence ends within each. */
export declare const sentences: (text: string) => string[];
/**
 * This reply's own asks (not its reminders of older ones), from its last part,
 * where a turn ends asking. A short ask ("推吗？") takes the sentence before
 * it, which says what it is about; a line that heads a list ("还有两处要你定：")
 * stands for the list's items.
 */
export declare function asksOf(reply: string): string[];
/** The answers an ask likely takes, as buttons: the first is the one it leans to. */
export declare function optionsFor(ask: string, t?: T): string[];
/** The older asks a reply says still wait. */
export declare const remindersOf: (reply: string) => string[];
/** What became of a request: the reply's first whole sentence. A reply cut from the front starts at its first whole line. */
export declare function outcomeOf(reply: string, cutFromFront?: boolean): string | undefined;
/** A local branch ahead of its upstream, and an open pull request, as the repository facts carry them. */
export type AheadFact = AttentionFacts["ahead"][number];
export type PrFact = AttentionFacts["prs"][number];
/**
 * What the person holds back — a 暂不 on a 待推送 card put
 * `unpushed:<branch>` in the project's dismissed list, one on a 可合并 card
 * `green:<number>` — and is still there: the branches still ahead, the pull
 * requests still open, red or green (by number); and that list without the
 * holds whose branch is no longer ahead (pushed, or gone) or whose pull
 * request is no longer open (merged, or closed), so the next time it comes up
 * it is asked about again. A list the repository could not be asked for lets
 * nothing go.
 */
export declare function heldSteps(dismissed: readonly string[], facts: AttentionFacts): {
    branches: AheadFact[];
    prs: PrFact[];
    dismissed: string[];
};
/** The steps only the person can take now: from the repository, and from what the reply leaves to them. */
export declare function standingOf(reply: string, facts: AttentionFacts, now: number, t?: T, o?: {
    reloadHere?: boolean;
}): Standing[];
/** This turn's lead: the reply's asks, then a failure new to the person, then a new step only they can take. */
export declare function leadOf(o: {
    reply: string;
    standing: readonly Standing[];
    memory: AttentionMemory;
    picks?: readonly (string | null)[];
    asked?: readonly Asked[];
    t?: T;
}): Lead | null;
/** The memory after a turn whose lead was `lead`: what led, how long each condition has held, the asks still reminded of. */
export declare function remember(memory: AttentionMemory, o: {
    reply: string;
    standing: readonly Standing[];
    lead: Lead | null;
}): AttentionMemory;
/** The person's own words end the oldest ask still reminded of, when they read as an answer (short). */
export declare function answered(memory: AttentionMemory, said: string): AttentionMemory;
/**
 * The band's line: the lead (or, back after a while, what became of the last
 * request), the steps still owed, the asks still waiting; fitted to one row by
 * dropping the away note, then counting the owed steps instead of naming them,
 * then shortening the lead. Nothing to say, no line.
 */
export declare function bandLine(o: {
    lead: Lead | null;
    standing: readonly Standing[];
    memory: AttentionMemory;
    reply: string;
    /** Milliseconds since the reply; null when unknown. */
    awayMs: number | null;
    t?: T;
    width?: number;
}): BandLine | null;
/** What happened since the last reply that the model should hear of, so the person need not say it. */
export declare function newsOf(before: AttentionFacts | null, now: AttentionFacts, t?: T): string[];
/**
 * What a band button does: an answer or a step is sent as the person's own
 * words — whole, so "合并" on a green pull request says which one and "暂不"
 * which step it puts off; "详情" opens the board; a reload is copied, since
 * only the person can run it.
 */
export declare function pressablesFor(lead: Lead | null, options: readonly string[], t?: T): Pressable[];
/**
 * The registered questions a prompt leaves open, before any judgement. A line that starts with a question and its
 * colon answers it: a press on the band says that, and the person may paste it back. A question picked on the band is
 * answered. Every other question stays open; which of them a typed prompt settles is the turn's judgement (judge.ts).
 */
export declare function openAfter(asks: readonly Asked[], picks: readonly (string | null)[], said: string): Asked[];
/**
 * The questions the next reply's band asks: the state the turn leaves is the state before it and the turn's change.
 * Several work items run side by side, each its own state machine with its own open questions; the band leads with
 * this turn's own questions, then those still open on the item this turn worked on, then the other items'. A question
 * asked again is asked once, as now worded; one answered while the turn ran is not asked.
 */
export declare function asksAfterTurn(fresh: readonly Asked[], carried: readonly Asked[], answered: readonly string[], item?: string): Asked[];
/** The steps beside the lead as presses: said as the person's words (merging and pushing ask first), a reload run as the command. */
export declare function stepPressables(steps: readonly Standing[], t?: T): Pressable[];
/** Several asks' answers as one prompt, one line each: the ask, then what was picked. */
export declare function picksText(asks: readonly string[], picks: readonly (string | null)[]): string;
/** A step the person pressed, by what it says (`合并 #32`, `/reload-plugins`): queued until the session is idle, then entered and being done. */
export interface Queued {
    text: string;
    entered: boolean;
}
/** What a press says into the session: the words of a `say`, the typed form of a `command`; nothing for a press that acts on the board. */
export declare function spokenOf(action: Pressable["action"]): string | undefined;
/** The press among these that was already made, if one was: its queue entry. */
export declare function pressedOf(actions: readonly Pressable[], queued: readonly Queued[]): Queued | undefined;
/** What a pressed step shows in place of its buttons. */
export declare function pendingNote(q: Queued, t?: T): string;
/**
 * The board's 此刻 rows, at the top of the work items: everything the band has
 * room for one of — the reply's asks with their answers, every step only the
 * person can take, the older asks still waiting.
 */
export declare function nowRows(o: {
    reply: string;
    standing: readonly Standing[];
    memory: AttentionMemory;
    queued?: readonly Queued[];
    picks?: readonly (string | null)[];
    asked?: readonly Asked[];
    t?: T;
}): BoardRow[];
