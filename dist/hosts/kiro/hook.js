import { exitCodeIn } from "../codex/hook.js";
const fold = (tool) => tool.toLowerCase().replace(/[_-]/g, "");
const SHELLS = new Set(["shell", "executebash", "executecmd", "executepwsh", "bash"]);
/** Kiro's tools that write a file, folded, and the Claude Code tool each is taken as. */
const WRITERS = { write: "Write", fswrite: "Write", fsappend: "Edit", strreplace: "Edit", edit: "Edit" };
const READERS = {
    read: "Read", fsread: "Read", readfile: "Read", readmultiplefiles: "Read", grep: "Grep", grepsearch: "Grep", glob: "Glob", filesearch: "Glob",
    listdirectory: "LS", webfetch: "WebFetch", websearch: "WebSearch", subagent: "Task", usesubagent: "Task", todo: "TodoWrite",
};
/** Whether a tool is Kiro's shell, by any of its names. */
export const isShell = (tool) => SHELLS.has(fold(tool));
/** An MCP tool's own name: Kiro's hook events name it `mcp_<server>_<tool>`, gemworks' own `mcp_gemworks_<tool>`. */
export function bareTool(tool) {
    if (tool.startsWith("mcp_gemworks_"))
        return tool.slice("mcp_gemworks_".length);
    const m = tool.match(/^mcp_[^_]+_(.+)$/);
    return m !== null ? m[1] : tool;
}
/** Where a Kiro file tool names its file. */
export function pathOf(input) {
    for (const k of ["path", "file_path", "filePath", "targetFile", "target_file", "absolute_path"])
        if (typeof input[k] === "string" && input[k] !== "")
            return input[k];
    return undefined;
}
/** The files a call writes, as it names them. */
export function writes(tool, input) {
    if (!Object.hasOwn(WRITERS, fold(tool)))
        return [];
    const p = pathOf(input);
    return p === undefined ? [] : [p];
}
/** The call as the gate and the dictionary read it: Claude Code's tool names, a written file's path in `file_path`. */
export function callOf(tool, input) {
    if (isShell(tool))
        return { tool: "Bash", input: { ...input } };
    const f = fold(tool);
    if (Object.hasOwn(WRITERS, f)) {
        const p = pathOf(input);
        return { tool: WRITERS[f], input: { ...input, ...(p !== undefined ? { file_path: p } : {}) } };
    }
    return { tool: READERS[f] ?? bareTool(tool), input: { ...input } };
}
const isObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
/**
 * A shell call's exit status from its result: the `[gemworks exit N]` a wrapped command printed, else a number the
 * result names (`exit_status`, `exitStatus`, `exit_code`, `exitCode`), else an `Exit Code: N` or `exit status: N` line;
 * null when there is none.
 */
export function exitCodeOf(response) {
    const marked = exitCodeIn(response);
    if (marked !== null)
        return marked;
    let found = null;
    const visit = (v) => {
        if (found !== null)
            return;
        if (typeof v === "string") {
            const m = v.match(/^(?:Exit Code|exit status|exit_status):\s*(\d+)\s*$/im);
            if (m !== null)
                found = Number(m[1]);
        }
        else if (Array.isArray(v))
            v.forEach(visit);
        else if (isObject(v)) {
            for (const k of ["exit_status", "exitStatus", "exit_code", "exitCode"]) {
                const n = v[k];
                if (typeof n === "number") {
                    found = n;
                    return;
                }
                if (typeof n === "string" && /^\d+$/.test(n)) {
                    found = Number(n);
                    return;
                }
            }
            Object.values(v).forEach(visit);
        }
    };
    visit(response);
    return found;
}
