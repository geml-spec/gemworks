import { type CoachFlow, type WorkItem } from "./coach.js";
import { type Practice } from "../../core/practices.js";
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
export declare const PRACTICE_PROMPT = "Gemworks: when a turn paid a price (a way back, a failed test or CI, the person saying it is not fixed, the person correcting you, a rule blocking a call), record what would have avoided it with the gemworks `practice` tool, on the step it happened at; also when the person tells you how they want something done. Practices only remind. Beside a prompt you are shown the practices of the step your work item stands at: follow them.";
/** The line beside a prompt: the practices of the step this session's last work item on the way stands at, at most three. */
export declare function practiceContext(items: readonly WorkItem[], flows: readonly CoachFlow[], practices: readonly Practice[], session: string): string[];
/** The ask, once on a project's first start, to move the practices among the host's memory notes onto their steps. */
export declare function memoryMoveContext(dir: string, notes: readonly {
    file: string;
    title: string;
    hook: string;
}[]): string[];
