/** The dsh tools whose command line is PowerShell. */
export declare const POWERSHELL_TOOLS: ReadonlySet<string>;
/** Why a `pwsh` command is for a person — it holds gemworks and mark, unmark or advance as words — or undefined. */
export declare function powershellPersonOnlyRefusal(command: string): string | undefined;
/** Why a `pwsh` command may not run in this state because a fenced use is in it, or undefined; `fenced` is the supervisor's own search (Supervisor.fencedRefusal). */
export declare function powershellFencedRefusal(fenced: (command: string) => string | undefined, command: string): string | undefined;
