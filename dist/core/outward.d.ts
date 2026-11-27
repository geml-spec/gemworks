/** What kind of outward action a call is, in the words the question says it (translated where it is shown). */
export type OutwardKind = "推到远端" | "GitHub 写操作" | "发包" | "推镜像" | "部署" | "往外发数据" | "远程登录" | "传到远端" | "MCP 写操作";
/**
 * An outward action a call makes: the dictionary key 以后都放行 writes (`key`), the keys a row written by hand may
 * match as well (`keys`, the first the action's own), and what kind it is.
 */
export interface Outward {
    key: string;
    keys: string[];
    what: OutwardKind;
}
/** One command, a launcher's words skipped, as an outward action: the words it is learned by and what kind it is; undefined when it is none. */
export declare function outwardCommand(argv: readonly string[]): {
    pattern: string;
    what: OutwardKind;
} | undefined;
/** Whether an MCP tool writes somewhere beyond this machine: a server not kept local, and a name with a word that changes something. */
export declare function mcpOutward(tool: string): boolean;
/**
 * The outward actions a call makes, one each: an MCP tool that writes, or the outward commands of a shell tool's
 * command line (`shells`: the tools whose `command` is one), learned by their words (`Bash(git push*)`).
 */
export declare function outwardOf(tool: string, input: Readonly<Record<string, unknown>> | undefined, shells: readonly string[]): Outward[];
/** Whether a row's key (`allowed`: the dictionary's keys allowed in every state) lets an outward action through. */
export declare function allowedOutward(allowed: readonly string[], o: Outward): boolean;
/** Whether a dictionary key is one 以后都放行 writes, or a hand-written one for an outward action: what the tools tab lists as let through. */
export declare function isOutwardKey(key: string): boolean;
/** The answers, as the question offers them (translated where they are shown). */
export declare const ALLOW_ONCE = "\u8FD9\u6B21\u653E\u884C";
export declare const ALLOW_ALWAYS = "\u4EE5\u540E\u90FD\u653E\u884C";
export declare const HOLD = "\u4E0D\u653E\u884C";
/** The translation of the words a question uses: the host's own. */
export type Words = (key: string, ...args: readonly (string | number)[]) => string;
/** The question put to the person before a call with outward actions runs: what they are, the call as it stands, and the three answers. */
export declare function outwardQuestion(found: readonly Outward[], shown: string, t: Words): {
    question: string;
    options: string[];
    header: string;
};
/** What an answer does: lets the call through, lets it through and writes its keys into the dictionary, or holds it. */
export type OutwardAnswer = {
    kind: "pass";
} | {
    kind: "allow";
    keys: string[];
} | {
    kind: "hold";
    reason: string;
};
/** An answer read: only 这次放行 and 以后都放行, as the question words them, let the call through; anything else holds it — 不放行, a question put away, words typed instead. */
export declare function outwardAnswer(answer: string | undefined, found: readonly Outward[], t: Words): OutwardAnswer;
