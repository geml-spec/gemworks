/**
 * The item file's text with its meta's `key` set to `state` — only that
 * value changes when the key is there; it is appended to the meta otherwise,
 * and a file with no meta gets one first. Undefined when the meta cannot take
 * the value.
 */
export declare function withItemState(source: string, key: string, state: string): string | undefined;
/** The state the item file's meta names under `key`, or undefined. */
export declare function itemState(source: string, key: string): string | undefined;
/**
 * The text without its meta's `key` line: what the work item holds, apart
 * from where it stands — so writing the state back is no change of the item
 * that would expire its evidence.
 */
export declare function withoutItemState(source: string, key: string): string;
