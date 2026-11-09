export interface HostTools {
    run: readonly string[];
    write: readonly string[];
}
export declare const CLAUDE_CODE_TOOLS: HostTools;
export declare const PI_TOOLS: HostTools;
export declare const DSH_TOOLS: HostTools;
/** Codex, through its hooks (src/codex.ts): the shell tool is `Bash`; `apply_patch` writes files and carries the patch, not a command line, in `command` — the adapter hands the gate the paths instead. */
export declare const CODEX_TOOLS: HostTools;
/** For callers that never see tool calls (the CLI). */
export declare const NO_TOOLS: HostTools;
/** Each host's tools by the name workflows and journals spell it with. */
export declare const HOST_TOOLS: Readonly<Record<string, HostTools>>;
