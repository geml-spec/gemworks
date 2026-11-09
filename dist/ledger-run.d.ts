/** The borrowed model: a system text and a prompt in, the reply's text out; undefined when it did not answer. */
export type Complete = (system: string, prompt: string, maxTokens: number) => Promise<string | undefined>;
/** A prompt to label: its words, the reply it answers, when and in which session, and the step the session's work item stood at. */
export interface ToLabelPrompt {
    text: string;
    before: string;
    at: string;
    session: string;
    flow?: string;
    step?: string;
}
/** One typed prompt labelled into the ledger; a correction, or themes left waiting, then put into themes. Whether it was labelled. */
export declare function labelPrompt(root: string, p: ToLabelPrompt, complete: Complete, locale?: string): Promise<boolean>;
/** The ledger's corrections put into themes, a batch a request, by the session that holds the claim; then flows proposed. */
export declare function themeLedger(root: string, session: string, complete: Complete, locale?: string): Promise<void>;
/** A flow proposed, once, for each kind of work corrected often in the last days with none of its own: its steps drafted by the model. */
export declare function proposeFlows(root: string, complete: Complete, locale?: string): Promise<void>;
