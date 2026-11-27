import { type CoachFlow, type WorkItem } from "./work.js";
import { type Practice } from "./practices.js";
import { type PracticeCount } from "./corrections.js";
/** The tool the model records practices with. */
export declare const PRACTICE_TOOL: {
    readonly name: "practice";
    readonly description: "Record what this project has learned about doing its work, each on the step of a flow it belongs to, so it reminds whoever comes to that step next. Record one when a turn paid a price — a way back, a failed test or CI, the person saying it is not fixed, the person correcting you, a rule blocking a call — as what would have avoided it; or when the person tells you how they want something done. A practice reminds; it never blocks.";
    readonly inputSchema: {
        readonly type: "object";
        readonly properties: {
            readonly practices: {
                readonly type: "array";
                readonly items: {
                    readonly type: "object";
                    readonly properties: {
                        readonly flow: {
                            readonly type: "string";
                            readonly description: "The flow it belongs to, by its name; * for every flow.";
                        };
                        readonly step: {
                            readonly type: "string";
                            readonly description: "The step's id in that flow; * for every step (with flow *, any time).";
                        };
                        readonly text: {
                            readonly type: "string";
                            readonly description: "What to do, one short sentence in the person's language.";
                        };
                        readonly why: {
                            readonly type: "string";
                            readonly description: "The incident it came from: when, and what it cost, in a few words.";
                        };
                        readonly layer: {
                            readonly type: "string";
                            readonly enum: readonly ["personal", "project"];
                            readonly description: "personal for how this person wants work done in every project; project for this repository's own.";
                        };
                        readonly ref: {
                            readonly type: "string";
                            readonly description: "Where a file read every turn already keeps its text, as file#heading (CLAUDE.md#build-and-check); the text then stays there.";
                        };
                        readonly from: {
                            readonly type: "string";
                            readonly description: "Its source when it is moved, as memory:<file>.";
                        };
                        readonly new: {
                            readonly type: "boolean";
                            readonly description: "true when none of the closest practices the tool listed says this: it is new.";
                        };
                        readonly replaces: {
                            readonly type: "string";
                            readonly description: "The id of a listed practice this one rewrites (one not holding first): it takes that one's place, which is kept, taken out. Not the person's own or the team's.";
                        };
                    };
                    readonly required: readonly ["text", "layer"];
                    readonly additionalProperties: false;
                };
            };
            readonly memory: {
                readonly type: "boolean";
                readonly description: "true on the calls that move the project's memory in (asked once, on first start).";
            };
        };
        readonly required: readonly ["practices"];
        readonly additionalProperties: false;
    };
};
/** What the model is told once about practices. */
export declare const PRACTICE_PROMPT = "Gemworks: when a turn paid a price (a way back, a failed test or CI, the person saying it is not fixed, the person correcting you, a rule blocking a call), record what would have avoided it with the gemworks `practice` tool, on the step it happened at; also when the person tells you how they want something done. Before it writes one, the tool lists the closest practices already kept, with how each fared: call it again saying of each of yours new: true, or replaces: <id> to rewrite one in its place. Practices only remind. Beside a prompt you are shown the practices of the step your work item stands at, each with why it was learned and how often the person corrected the same thing before it was written and since: follow them, and one marked not holding most carefully.";
/** The most characters of a practice's why a reminder carries: the incident's first words, enough to know what it cost. */
export declare const WHY_SHOWN = 60;
/**
 * A practice as a reminder says it: its words and where a file keeps them; then why it was learned, clipped, and how
 * often the person corrected the same thing before it was written and since where it reminds (the ledger's count, the
 * flow tab's 纠正 n → m), marked not holding as the flow tab's 失效 card is. The evidence with the conclusion: a lesson
 * kept without what it cost and how it fared is easy to follow loosely. A count of nothing either side is left out.
 */
export declare function practiceWords(p: Practice, count?: PracticeCount): string;
/** How many of the closest practices kept the tool lists back before one is written. */
export declare const CLOSEST_SHOWN = 5;
/**
 * What the practice tool answers (newPractices's result): the ones written, and which each took the place of with how
 * that one fared; for each held back, the closest practices kept, on any step, with their why and how they fared, and
 * whose they are, then what to call it with; what was left out. Anything written makes it ok.
 */
export declare function practiceAnswer(r: {
    added: readonly Practice[];
    errors: readonly string[];
    replaced: readonly {
        id: string;
        by: string;
    }[];
    unreviewed: readonly {
        text: string;
    }[];
}, kept: readonly Practice[], counts?: Readonly<Record<string, PracticeCount>>): {
    ok: boolean;
    text: string;
};
/**
 * The line beside a prompt: the practices of the step this session's last work item on the way stands at, at most
 * three, each with its why and, where the ledger has been read, its count by practice id.
 */
export declare function practiceContext(items: readonly WorkItem[], flows: readonly CoachFlow[], practices: readonly Practice[], session: string, counts?: Readonly<Record<string, PracticeCount>>): string[];
/** The ask, once on a project's first start, to move the practices among the host's memory notes onto their steps. */
export declare function memoryMoveContext(dir: string, notes: readonly {
    file: string;
    title: string;
    hook: string;
}[]): string[];
