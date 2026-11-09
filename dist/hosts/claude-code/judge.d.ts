import type { BoardAction } from "./actions.js";
import type { InboxItem } from "./inbox.js";
import type { T } from "./text.js";
/** An option the judgement may pick: the thing waiting, the option's words, and what pressing it does. */
export interface JudgeOption {
    key: string;
    title: string;
    verb: string;
    label: string;
    action: BoardAction;
}
/** What the judgement found: the option picked, whether it was sure, why in a few words, and when. */
export interface Judgement {
    at: string;
    /** The prompt's first line, for the band's hover. */
    said: string;
    option: JudgeOption;
    /** When it was not sure: the other picks it found likely, at most three, likeliest first. */
    alternatives?: JudgeOption[];
    sure: boolean;
    why: string;
    /** Taken already (a sure one, or a person's 对); how to take it back, when it can be. */
    taken: boolean;
    undo?: {
        file?: string;
        rev: number;
    };
}
/** The options the pending list offers a judgement: the ways out of a work item, and a work item to come back to. */
export declare function judgeOptions(pending: readonly InboxItem[]): JudgeOption[];
/** The request: a system line and the prompt, the options numbered from 1. */
export declare function judgeRequest(options: readonly JudgeOption[], lastAnswer: string, prompt: string): {
    system: string;
    prompt: string;
};
/** The model's reply read: the option it picked and how sure, or undefined for none (or a reply that is no such answer). */
export declare function readJudgement(reply: string, options: readonly JudgeOption[]): {
    option: JudgeOption;
    alternatives: JudgeOption[];
    sure: boolean;
    why: string;
} | undefined;
/**
 * The request for every question still open when the person typed: the open questions are state, what the person has
 * written since they were asked is the change, and the model reads which questions it settles. A question is settled
 * when a message written after it was asked answers it (by one of its answers or in its own words) or leaves it behind
 * (decides otherwise, moves the work past it, says it no longer matters); the others still stand. `said` is oldest
 * first, the newest last; a question with no time was asked before all of them.
 */
export declare function asksJudgeRequest(asks: readonly {
    question: string;
    options: readonly string[];
    at?: string;
}[], said: readonly {
    at: string;
    text: string;
}[]): {
    system: string;
    prompt: string;
};
/** The model's reply to asksJudgeRequest: the places (from 0) of the questions it settles, or undefined for a reply that is no such answer. */
export declare function readAsksJudgement(reply: string, count: number): number[] | undefined;
/** How long a judgement stands on the band. */
export declare const JUDGEMENT_MS: number;
/** The band's line for a judgement: taken, with an undo when it has one; unsure, a question with 对 and 不是. */
export declare function judgementLine(j: Judgement, t: T): {
    title: string;
    note: string;
    actions: {
        key: string;
        label: string;
        primary?: true;
        action: BoardAction;
    }[];
};
