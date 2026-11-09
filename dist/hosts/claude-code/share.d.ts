import type { InboxItem } from "./inbox.js";
import type { Artifacts, ShellStatus } from "./protocol.js";
import type { T } from "./text.js";
/**
 * Where the work stands, in a few lines: the work item, its flow and stage;
 * the first thing to decide and the first to accept, with how many more
 * wait; its latest commits. Empty with no work item.
 */
export declare function statusShareText(shell: ShellStatus | null, pending: readonly InboxItem[], artifacts: Artifacts | undefined, t: T): string;
