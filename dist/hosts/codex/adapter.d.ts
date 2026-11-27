export interface CodexRun {
    stdout: string;
    code: number;
}
export declare function runCodex(text: string, env: NodeJS.ProcessEnv, platform?: string): Promise<CodexRun>;
