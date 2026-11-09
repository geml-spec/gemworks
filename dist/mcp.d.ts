/** What one server keeps between calls: when its host last read the other sessions' decisions. */
export interface McpState {
    decisionsSeen: string | null;
}
export interface McpOptions {
    root: string;
    host: string;
    state?: McpState;
}
type Reply = Record<string, unknown>;
/** One parsed message in; the reply, or undefined for a notification. */
export declare function answer(msg: unknown, o: McpOptions): Promise<Reply | undefined>;
/** Serve stdin to stdout, one message at a time and in order; resolves when stdin closes and every answer is out. */
export declare function serveMcp(o: McpOptions): Promise<void>;
export {};
