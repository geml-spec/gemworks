import type { Practice } from "./practices.js";
export declare const KINDS: readonly ["task", "decide", "correct", "status", "nudge", "inform", "interrupt"];
export type PromptKind = (typeof KINDS)[number];
export declare const SUBS: readonly ["verify", "show", "scope", "irreversible", "process", "visual", "domain", "judgment", "misread", "other"];
export type CorrectionSub = (typeof SUBS)[number];
export declare const WORKS: readonly ["ui", "spec", "writing", "business", "other"];
export type WorkKind = (typeof WORKS)[number];
/** The corrections a written check on a step could catch. */
export declare const FIXED_SUBS: readonly CorrectionSub[];
/** The corrections only the person's judgment or knowledge could have made: the control the fixed ones are read against. */
export declare const PERSON_SUBS: readonly CorrectionSub[];
/**
 * A prompt the person typed, labelled: when, in which session (and project), its words (clipped), its kind, for a
 * correction its sub, the kind of work it is about; the flow and step the session's work item stood at, when there was
 * one; the theme it shares with corrections that say the same thing; who labelled it.
 */
export interface LabelledPrompt {
    id: string;
    at: string;
    session: string;
    text: string;
    kind: PromptKind;
    sub?: CorrectionSub;
    work?: WorkKind;
    project?: string;
    flow?: string;
    step?: string;
    theme?: string;
    by: "model" | "agent" | "import";
}
/** What corrections that say the same thing ask for, as one short rule; the practices that state it. */
export interface Theme {
    id: string;
    rule: string;
    at: string;
    practices: string[];
}
/** A card the person put away (忽略, 保留), with how many corrections it counted then: it comes back two later. */
export interface Dismissed {
    key: string;
    n: number;
    at: string;
}
/**
 * The ledger: the prompts, the themes, the cards put away; `linked` the practices the themes were last linked against;
 * `claim` the session putting corrections in themes and when it last asked (`<session>@<time>`), so one does at a time.
 */
export interface Ledger {
    prompts: LabelledPrompt[];
    themes: Theme[];
    dismissed: Dismissed[];
    linked: string;
    claim: string;
}
export declare const EMPTY_LEDGER: Ledger;
/** How long a session's claim to put corrections in themes holds once it stops asking. */
export declare const CLAIM_MS: number;
/** The ledger claimed for `session` to put corrections in themes, unless another session asked within CLAIM_MS; whether it got it. */
export declare function claimThemes(l: Ledger, session: string, now: string): {
    ledger: Ledger;
    mine: boolean;
};
/** How long a prompt's words are kept: enough to quote, not the whole paste. */
export declare const TEXT_KEPT = 300;
/**
 * The words the person typed in a prompt: the host's reminders stripped. Undefined when nothing typed is left — a
 * notice, or another session's report, which arrives as a prompt that is one reminder.
 */
export declare function typedWords(text: string): string | undefined;
/** Whether a labelled prompt counts as one the person typed: an interruption alone does not. */
export declare const isTyped: (p: LabelledPrompt) => boolean;
/** Whether it is a correction, and counts. */
export declare const isCorrection: (p: LabelledPrompt) => boolean;
/** The ledger's file read; a line that is no record is left out, and no file is an empty ledger. */
export declare function parseLedger(text: string): Ledger;
/** The ledger as its file holds it. */
export declare function ledgerText(l: Ledger): string;
/** A prompt's id: its session's first eight characters and its second, `#2` and on for a second one in the same second. */
export declare function promptId(session: string, at: string, taken: ReadonlySet<string>): string;
/** Whether the ledger has this prompt already: by id, the same words in the same session within ten minutes, or in a fork at the same time. */
export declare function hasPrompt(l: {
    prompts: readonly Pick<LabelledPrompt, "id" | "session" | "at" | "text">[];
}, p: Pick<LabelledPrompt, "id" | "session" | "at" | "text">): boolean;
/** Prompts added, a prompt the ledger has already left out, the words clipped; the prompts kept in time order. */
export declare function addPrompts(l: Ledger, given: readonly LabelledPrompt[]): {
    ledger: Ledger;
    added: number;
};
/** The guide every label follows, the same the two months of hand-checked labels followed. */
export declare const LABEL_GUIDE: string;
/** One prompt to label: its words and the end of the agent's reply before it. */
export interface ToLabel {
    text: string;
    before: string;
}
/** What a label says of one prompt. */
export interface Label {
    kind: PromptKind;
    sub?: CorrectionSub;
    work?: WorkKind;
}
/** The request for a batch of prompts, numbered from 1: the guide as the system prompt, each prompt with its context. */
export declare function labelRequest(items: readonly ToLabel[]): {
    system: string;
    prompt: string;
};
/** The model's reply read: a label for each of the `count` prompts, undefined where it gave none that holds. */
export declare function readLabels(reply: string, count: number): (Label | undefined)[];
/** The most corrections one theme request carries. */
export declare const THEMES_ASKED = 60;
/**
 * The request that puts corrections into themes and links the themes to the practices that state them. Short handles
 * (c1, t1, p1) stand for the ids. Every theme is listed so a correction joins one when it says the same thing; every
 * practice is listed so a theme names the ones that state its rule, whenever written.
 */
export declare function themeRequest(corrections: readonly LabelledPrompt[], themes: readonly Theme[], practices: readonly Practice[]): {
    system: string;
    prompt: string;
    handles: {
        c: string[];
        t: string[];
        p: string[];
    };
};
/** What a theme reply says: each correction's theme (an id, a new rule, or none), and each theme's practices. */
export interface ThemeAnswer {
    assign: {
        id: string;
        theme: string | {
            rule: string;
        } | null;
    }[];
    links: {
        theme: string | {
            rule: string;
        };
        practices: string[];
    }[];
}
/** The model's theme reply read against the handles it was given; what does not hold is left out. */
export declare function readThemes(reply: string, handles: {
    c: readonly string[];
    t: readonly string[];
    p: readonly string[];
}): ThemeAnswer;
/**
 * A theme answer applied: new themes made (a rule already kept joins its theme), each correction given its theme
 * (`""` where it has none, so it is not asked again), the themes' practices set from the links; `linked` the practices
 * these links were made against. `newId` names a new theme.
 */
export declare function applyThemes(l: Ledger, answer: ThemeAnswer, at: string, linked: string, newId: (n: number) => string): Ledger;
/**
 * The corrections not yet put in a theme (`theme` absent; `""` was asked and has none), the newest `limit` of them in
 * time order: what the cards and counts read first is themed first, a backlog after.
 */
export declare function unthemed(l: Ledger, limit?: number): LabelledPrompt[];
/** The practices the themes are linked against, as one string: when it changes, the links are made again. */
export declare const linkKey: (practices: readonly Practice[]) => string;
/** A practice's record: the corrections of its themes before it was written and after. */
export interface PracticeCount {
    before: number;
    after: number;
}
/**
 * For each practice linked to a theme: how many of the theme's corrections came before it was written (anywhere), how
 * many after where it reminds. One said after it on another step is not the practice failing: it is a repeat card's.
 */
export declare function practiceCounts(l: Ledger, practices: readonly Practice[]): Record<string, PracticeCount>;
/** A correction as a card quotes it: when (`day` the local date, MM-DD, where the bridge knows it), and the words. */
export interface Quote {
    at: string;
    text: string;
    day?: string;
}
/**
 * A card on the flow tab, each with what the person can do about it. `repeat`: the same thing said `n` times in the
 * window, with no practice for it, or only practices on other steps than where it was said (`narrow`); `where` the step
 * most of it was said at. `failing`: a practice whose rule was said `n` times since it was written; `instead` a newer
 * practice for the same theme.
 */
export type LedgerCard = {
    kind: "repeat";
    key: string;
    theme: string;
    rule: string;
    n: number;
    quotes: Quote[];
    narrow?: Practice;
    where?: {
        flow: string;
        step: string;
    };
} | {
    kind: "failing";
    key: string;
    practice: Practice;
    n: number;
    quotes: Quote[];
    instead?: Practice;
    insteadDay?: string;
};
/** How a card is counted and when it shows: corrections within `days`, a repeat from `least` on, at most `shown` cards. */
export interface CardOptions {
    days?: number;
    least?: number;
    shown?: number;
}
/** The cards the ledger shows, the failing practices first, then the repeats, the most said first; a card put away stays away until two more are said. */
export declare function ledgerCards(l: Ledger, practices: readonly Practice[], now: string, o?: CardOptions): LedgerCard[];
/** A card put away: what it counted then. */
export declare function dismiss(l: Ledger, key: string, n: number, at: string): Ledger;
/**
 * The kinds of work corrected often in the last `days` with no work item on a flow: how many, how many of them
 * judgment. Only a prompt the plugin labelled as it was typed knows whether a work item stood on a flow; one imported
 * or labelled from a transcript later does not, and is not counted.
 */
export declare function flowless(l: Ledger, now: string, days?: number, least?: number): {
    work: WorkKind;
    n: number;
    judgment: number;
}[];
/** The request for a flow for a kind of work that has none: its corrections quoted; the reply a title and three to five steps. */
export declare function flowRequest(work: WorkKind, quotes: readonly Quote[]): {
    system: string;
    prompt: string;
};
/** A flow reply read: its title and steps as the propose tool takes them (growth.ts newProposals checks them); undefined when it is none. */
export declare function readFlowDraft(reply: string): {
    title: string;
    steps: unknown[];
} | undefined;
/** Counts over a set of prompts: how many typed, corrected, of the fixed and the judgment kinds, each sub, in how many sessions. */
export interface Tally {
    prompts: number;
    corrections: number;
    fixed: number;
    person: number;
    by: Record<CorrectionSub, number>;
    sessions: number;
}
export declare function tally(xs: readonly LabelledPrompt[]): Tally;
/** Per 100 prompts, one decimal; "–" for none. */
export declare const per100: (n: number, of: number) => string;
/** The local date of a time, at `offset` minutes east of UTC. */
export declare const localDay: (at: string, offset: number) => string;
/** The Monday of a local date's week. */
export declare function mondayOf(day: string): string;
/** A period of local dates, both ends in. */
export interface Period {
    from: string;
    to: string;
}
/** `2026-08-30..2026-10-25` read as a period; undefined when it is not one. */
export declare function parsePeriod(s: string): Period | undefined;
/** The periods compared when none are given: this week so far, against the eight weeks before it. */
export declare function defaultPeriods(today: string): {
    baseline: Period;
    trial: Period;
};
/** What the research tables hold: the span read, the two periods' tallies (and by kind of work), and each week's. */
export interface Report {
    first: string;
    last: string;
    all: Tally;
    baseline: Period & Tally;
    trial: Period & Tally;
    weeks: (Tally & {
        week: string;
    })[];
    byWork?: {
        work: WorkKind;
        baseline: Tally;
        trial: Tally;
    }[];
}
/** The tables over the ledger's prompts since `since` (a local date), at `offset` minutes east of UTC. */
export declare function report(l: Ledger, o: {
    baseline: Period;
    trial: Period;
    offset: number;
    since?: string;
    byWork?: boolean;
}): Report;
export declare const SUB_NAMES: Readonly<Record<CorrectionSub, string>>;
export declare const WORK_NAMES: Readonly<Record<WorkKind, string>>;
/** The tables as text: a column of names (CJK counted two cells wide) and right-aligned numbers per 100 prompts. */
export declare function reportText(r: Report, cells: (s: string) => number, unlabelled?: number): string;
