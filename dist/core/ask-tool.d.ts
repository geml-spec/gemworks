/** A question the model registered: the whole question, its answers (the recommended one first), which it recommends, the work item it is about (its id), when it is about one, and when it was asked. */
export interface Asked {
    question: string;
    options: string[];
    recommended?: string;
    item?: string;
    at?: string;
}
export declare const ASK_TOOL: {
    readonly name: "ask";
    readonly description: "Register a question this turn ends with, for the person to answer from the status band: the question in full, its real answers (two to four, short, in the reply's language), and the one you recommend. Call it once per question, before the turn ends, whenever the reply asks the person to decide something; several questions are asked one by one. Do not register a question you answered yourself or one that needs no answer.";
    readonly inputSchema: {
        readonly type: "object";
        readonly properties: {
            readonly question: {
                readonly type: "string";
                readonly description: "The question, whole, as the person should read it.";
            };
            readonly options: {
                readonly type: "array";
                readonly items: {
                    readonly type: "string";
                };
                readonly minItems: 2;
                readonly maxItems: 4;
                readonly description: "The answers the person can give, each a few words.";
            };
            readonly recommended: {
                readonly type: "string";
                readonly description: "The answer you recommend: one of options.";
            };
            readonly item: {
                readonly type: "string";
                readonly description: "The work item on the way this question is about, by its id; leave it out when it is about none. The question then stands under that item on the board until answered.";
            };
        };
        readonly required: readonly ["question", "options"];
        readonly additionalProperties: false;
    };
};
/** What the model is told once, in the system prompt, about registering its questions. */
export declare const ASK_PROMPT = "Gemworks: when a turn ends asking the person to decide something, register each question with the gemworks `ask` tool before the turn ends: the question in full, its real answers (two to four, short, in the reply's language) and the one you recommend. The status band shows a registered question with its answers as buttons; a question you do not register shows only as a grey hint with no buttons.";
/** A tool call's input as a question, or why it is none. */
export declare function askedOf(input: Readonly<Record<string, unknown>>): Asked | {
    error: string;
};
