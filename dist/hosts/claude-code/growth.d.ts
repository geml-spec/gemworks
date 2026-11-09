import type { CoachFlow, WorkItem } from "./coach.js";
import type { Judge } from "../../core/progress.js";
/** A step as a proposal names it. */
export interface ProposedStep {
    id: string;
    title: string;
    need: string;
    judge: Judge;
    prevents: string;
}
/**
 * A change to the flows waiting on the person: a step to add after another, a step to take out, a new kind of work
 * with its steps. `by` who saw it; `status` once answered (a declined one is not proposed again).
 */
export interface Proposal {
    id: string;
    kind: "add-step" | "remove-step" | "new-flow";
    flow: string;
    why: string;
    at: string;
    by: "model" | "gemworks" | "reference";
    status: "open" | "accepted" | "declined";
    after?: string;
    step?: ProposedStep;
    remove?: string;
    title?: string;
    steps?: ProposedStep[];
    /** A proposal from an imported reference: its name. */
    ref?: string;
}
export declare const parseProposals: (text: string) => Proposal[];
export declare const proposalsText: (list: readonly Proposal[]) => string;
/** A step id from its title: ascii letters and digits kept, else a short hash of the title. */
export declare function stepId(title: string, taken: readonly string[]): string;
/** Proposals the model gave (the propose tool), checked against the flows and the ones kept; `newId` names a new one. */
export declare function newProposals(given: readonly unknown[], flows: readonly CoachFlow[], kept: readonly Proposal[], at: string, newId: (n: number) => string): {
    added: Proposal[];
    errors: string[];
};
/**
 * The steps gemworks would take out: in a flow's last `window` finished work items, a step skipped (left unmet) in at
 * least `least` of them. One declined before is not proposed again.
 */
export declare function skippedSteps(items: readonly WorkItem[], flows: readonly CoachFlow[], kept: readonly Proposal[], window?: number, least?: number): {
    flow: string;
    step: string;
    skipped: number;
}[];
/** A flow with a step added after another (the ways on rewired through it) or one taken out (its ways joined around it). */
export declare function applyToFlow(flow: CoachFlow, p: Pick<Proposal, "kind" | "after" | "step" | "remove">): CoachFlow;
/** A new kind of work as a flow: its steps in order, then 完成. */
export declare function newFlow(p: Pick<Proposal, "flow" | "title" | "steps">): CoachFlow;
/** A flow written as the project's own geml-statechart/v1 document. */
export declare function flowText(flow: CoachFlow): string;
/** A rule: a tool key it holds (`Bash(npm run deploy*)`), the step of a flow that must be met first, its words, whose it is, how often it held. */
export interface Rule {
    id: string;
    flow: string;
    requires: string;
    key: string;
    text: string;
    why: string;
    at: string;
    layer: "project" | "team";
    from?: string;
    held?: number;
}
export declare const parseRules: (text: string, layer: Rule["layer"]) => Rule[];
export declare const rulesText: (list: readonly Rule[]) => string;
/** Whether a path is one of the files that keep rules: rules are the person's to change, not the model's. */
export declare function isRulesFile(path: string): boolean;
/**
 * Why a tool call is refused, if a rule holds it: one of its keys matches a rule of the flow this session's work item
 * is on (or of every flow), and the step the rule requires is unmet on that item.
 */
export declare function ruleRefusal(rules: readonly Rule[], item: WorkItem | undefined, flows: readonly CoachFlow[], keys: readonly string[]): {
    rule: Rule;
    reason: string;
} | undefined;
/** Whether a work item stands past a step (it is met): what a rule reads. */
export declare const metOn: (item: WorkItem, step: string) => boolean;
/** The step a fact expires at once the work changes after it: met steps of the item's flow marked `expires`. */
export declare function expiring(item: WorkItem, flow: CoachFlow): string[];
/** The tool the model proposes a change to the flows with; nothing changes until the person nods on the flow tab. */
export declare const PROPOSE_TOOL: {
    readonly name: "propose";
    readonly description: "Propose a change to how the project's work goes, for the person to accept or decline on the flow tab: a step to add to a flow, when the same thing keeps being done at the same place in that kind of work and it prevents a pitfall; or a new kind of work, when several work items in a row fit none of the flows. Nothing changes until the person accepts.";
    readonly inputSchema: {
        readonly type: "object";
        readonly properties: {
            readonly proposals: {
                readonly type: "array";
                readonly items: {
                    readonly type: "object";
                    readonly properties: {
                        readonly kind: {
                            readonly type: "string";
                            readonly enum: readonly ["add-step", "new-flow"];
                        };
                        readonly flow: {
                            readonly type: "string";
                            readonly description: "add-step: the flow, by its name.";
                        };
                        readonly after: {
                            readonly type: "string";
                            readonly description: "add-step: the step it comes after, by id.";
                        };
                        readonly title: {
                            readonly type: "string";
                            readonly description: "add-step: the new step's title; new-flow: the kind of work's title.";
                        };
                        readonly need: {
                            readonly type: "string";
                            readonly description: "add-step: what it needs to be left, a few words.";
                        };
                        readonly judge: {
                            readonly type: "string";
                            readonly enum: readonly ["fact", "you", "model"];
                            readonly description: "add-step: who judges that requirement.";
                        };
                        readonly prevents: {
                            readonly type: "string";
                            readonly description: "add-step: the pitfall it prevents.";
                        };
                        readonly name: {
                            readonly type: "string";
                            readonly description: "new-flow: a short ascii name for it.";
                        };
                        readonly steps: {
                            readonly type: "array";
                            readonly items: {
                                readonly type: "object";
                                readonly properties: {
                                    readonly title: {
                                        readonly type: "string";
                                    };
                                    readonly need: {
                                        readonly type: "string";
                                    };
                                    readonly judge: {
                                        readonly type: "string";
                                        readonly enum: readonly ["fact", "you", "model"];
                                    };
                                    readonly prevents: {
                                        readonly type: "string";
                                    };
                                };
                                readonly required: readonly ["title"];
                                readonly additionalProperties: false;
                            };
                            readonly description: "new-flow: its steps in order, as the work items that fit none actually went.";
                        };
                        readonly why: {
                            readonly type: "string";
                            readonly description: "What you saw: the work items or the incidents behind it.";
                        };
                    };
                    readonly required: readonly ["kind", "why"];
                    readonly additionalProperties: false;
                };
            };
        };
        readonly required: readonly ["proposals"];
        readonly additionalProperties: false;
    };
};
/** The tool the model writes a rule with, only once the person pressed 改成规定 on a practice. */
export declare const RULE_TOOL: {
    readonly name: "rule";
    readonly description: "Write down the rule the person asked for when they pressed 改成规定 on a practice: the tool key it holds (as the tool dictionary writes keys, e.g. Bash(node scripts/sync-dev.mjs*)) and the step that must be met first. Only after that press; a rule then refuses matching calls while the step is unmet.";
    readonly inputSchema: {
        readonly type: "object";
        readonly properties: {
            readonly practice: {
                readonly type: "string";
                readonly description: "The practice's id, as the request named it.";
            };
            readonly key: {
                readonly type: "string";
                readonly description: "The tool key the rule holds, a pattern with * as the dictionary writes it.";
            };
            readonly requires: {
                readonly type: "string";
                readonly description: "The step of the practice's flow that must be met first, by id.";
            };
            readonly text: {
                readonly type: "string";
                readonly description: "The rule in a few words, in the person's language.";
            };
        };
        readonly required: readonly ["practice", "key", "requires", "text"];
        readonly additionalProperties: false;
    };
};
/** What the model is told once about proposals. */
export declare const GROWTH_PROMPT = "Gemworks: the flows grow from what happens here. When the same thing keeps being done at the same place in a kind of work, or several work items in a row fit none of the flows, propose it with the gemworks `propose` tool; the person accepts or declines on the flow tab.";
/** What is said for the person when they press 改成规定: the model writes the rule with the rule tool. */
export declare function ruleAsk(practice: {
    id: string;
    flow: string;
    step: string;
    text: string;
}, flowTitle: string, stepTitle: string): string;
/** A work item with the facts that expire taken back: the work changed after them, so they are to be met again. */
export declare function expireEvent(item: WorkItem, steps: readonly string[], needs: string, at: string, turn: number): Extract<import("../../core/session-log.js").SessionEvent, {
    t: "item";
}>;
/**
 * A flow exported as one GEML document: its route (the flow), its practices with where each came from, its rules —
 * the flow tab's manual for it. The person's own layer stays home.
 */
export declare function exportText(flow: CoachFlow, practices: readonly import("../../core/practices.js").Practice[], rules: readonly Rule[]): string;
/** The name an exported flow goes by: its file's name without .geml, ascii; else the flow's own. */
export declare function referenceName(file: string, fallback: string): string;
/**
 * What a reference offers the project's flow: each step it has that the flow lacks, as a proposal to take it back
 * (after the step before it in the reference, when the flow has that one); a reference of a kind of work the project
 * does not have, as a new kind of work. One proposed or answered before is not offered again.
 */
export declare function referenceProposals(ref: CoachFlow, refName: string, flows: readonly CoachFlow[], kept: readonly Proposal[], at: string, newId: (n: number) => string): Proposal[];
