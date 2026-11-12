import { exitCodeIn, patchPaths } from "../codex/hook.js";
import { bareTool } from "../qwen/hook.js";
export { bareTool };
/** Devin's shell tool. */
export const SHELL = "exec";
/** Devin's tools that write a file, and the Claude Code tool each is taken as. */
const WRITERS = { write: "Write", edit: "Edit", apply_patch: "Edit", notebook_edit: "NotebookEdit" };
/** The other built-in tools a dictionary may name by Claude Code's name. */
const READERS = { read: "Read", notebook_read: "Read", grep: "Grep", glob: "Glob", webfetch: "WebFetch", todo_write: "TodoWrite", run_subagent: "Task" };
const isObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
/** Where a Devin file tool names its file: Devin's docs do not say, so every key a host uses for it. */
export function pathOf(input) {
    for (const k of ["file_path", "path", "absolute_path", "notebook_path", "target_file"])
        if (typeof input[k] === "string" && input[k] !== "")
            return input[k];
    return undefined;
}
/** The files a call writes, as it names them: a file tool's path, every file of a patch in any of its text fields. */
export function writes(tool, input) {
    if (!Object.hasOwn(WRITERS, tool))
        return [];
    if (tool === "apply_patch") {
        const paths = Object.values(input).flatMap((v) => (typeof v === "string" ? patchPaths(v) : []));
        if (paths.length > 0)
            return paths;
    }
    const p = pathOf(input);
    return p === undefined ? [] : [p];
}
/** The call as the gate and the dictionary read it: Claude Code's tool names, a written file's path in `file_path`. */
export function callOf(tool, input) {
    if (tool === SHELL)
        return { tool: "Bash", input: { ...input } };
    if (Object.hasOwn(WRITERS, tool)) {
        const file = writes(tool, input)[0];
        return { tool: WRITERS[tool], input: { ...input, ...(file !== undefined ? { file_path: file } : {}) } };
    }
    return { tool: READERS[tool] ?? bareTool(tool), input: { ...input } };
}
/** A shell call's exit status: the `[gemworks exit N]` a wrapped command printed last; null otherwise (Devin reports none). */
export const exitCodeOf = (response) => exitCodeIn(response);
/** Whether a call's result says it failed: `success: false`. */
export const failedIn = (response) => isObject(response) && response["success"] === false;
