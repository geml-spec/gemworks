import type { Lesson } from "./dictionary.js";
/** What an answer means for the call: let it through, write lessons and judge again, or refuse it as it stands. */
export type Answered = {
    kind: "pass";
} | {
    kind: "learn";
    lessons: Lesson[];
} | {
    kind: "deny";
    reason: string;
};
export interface Question {
    question: string;
    options: string[];
}
/** The question for a tool that is bound to a use but is not the use's preferred tool. */
export declare function preferQuestion(key: string, use: string, preferredTool: string): Question;
export declare function preferAnswer(answer: string | undefined, key: string, use: string, preferredTool: string): Answered;
