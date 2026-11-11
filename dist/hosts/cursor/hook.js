import { exitCodeIn } from "../codex/hook.js";
const isObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
/** `tool_input` as an object: Cursor gives MCP calls theirs as a JSON string. */
function inputOf(v) {
    if (isObject(v))
        return v;
    if (typeof v !== "string")
        return undefined;
    try {
        const p = JSON.parse(v);
        return isObject(p) ? p : undefined;
    }
    catch {
        return undefined;
    }
}
/** The event Cursor wrote to stdin; undefined when it is not one. */
export function readEvent(text) {
    let v;
    try {
        v = JSON.parse(text);
    }
    catch {
        return undefined;
    }
    if (!isObject(v) || typeof v["hook_event_name"] !== "string")
        return undefined;
    const str = (k) => (typeof v[k] === "string" ? v[k] : undefined);
    const roots = Array.isArray(v["workspace_roots"]) ? v["workspace_roots"].filter((r) => typeof r === "string") : undefined;
    const input = inputOf(v["tool_input"]);
    const out = { hook_event_name: v["hook_event_name"] };
    for (const k of ["conversation_id", "session_id", "tool_name", "tool_use_id", "error_message", "prompt", "file_path", "text", "status", "cwd"]) {
        const s = str(k);
        if (s !== undefined)
            out[k] = s;
    }
    if (roots !== undefined)
        out.workspace_roots = roots;
    if (input !== undefined)
        out.tool_input = input;
    if ("tool_output" in v)
        out.tool_output = v["tool_output"];
    if (typeof v["loop_count"] === "number")
        out.loop_count = v["loop_count"];
    return out;
}
/** Cursor's shell tool. */
export const SHELL = "Shell";
/** Cursor's tools that write or remove a file; `Write` keeps its name, the rest are taken as Claude Code's `Edit`. */
const WRITERS = new Set(["Write", "Edit", "StrReplace", "MultiEdit", "Delete", "ApplyPatch"]);
export const writesFiles = (tool) => WRITERS.has(tool);
/** An MCP tool's own name, without Cursor's `MCP:` prefix. */
export const bareTool = (tool) => (tool.startsWith("MCP:") ? tool.slice(4) : tool);
/** Where a Cursor tool names its file. */
export function pathOf(input) {
    for (const k of ["file_path", "path", "target_file", "filePath", "target_notebook"])
        if (typeof input[k] === "string" && input[k] !== "")
            return input[k];
    return undefined;
}
/**
 * The call as the gate and the dictionary read it: Claude Code's tool names, a
 * shell call's command line in `command`, a written file's path in `file_path`.
 */
export function callOf(tool, input) {
    if (tool === SHELL)
        return { tool: "Bash", input: { ...input } };
    if (writesFiles(tool)) {
        const path = pathOf(input);
        return { tool: tool === "Write" ? "Write" : "Edit", input: { ...input, ...(path !== undefined ? { file_path: path } : {}) } };
    }
    return { tool: bareTool(tool), input: { ...input } };
}
/**
 * A shell call's exit status from its result: a number Cursor's JSON names
 * (`exitCode`, `exit_code`, `returnCode`), else the `[gemworks exit N]` a
 * wrapped command printed last; null when there is neither.
 */
export function exitCodeOf(output) {
    let v = output;
    if (typeof v === "string") {
        try {
            v = JSON.parse(v);
        }
        catch { /* plain text */ }
    }
    if (isObject(v))
        for (const k of ["exitCode", "exit_code", "returnCode"])
            if (typeof v[k] === "number")
                return v[k];
    return exitCodeIn(v);
}
/** preToolUse's answers: a refusal the person and the model both read; a rewritten call; nothing — `{}`, since Cursor blocks a permission hook whose output is no JSON. */
export const denyCall = (reason) => ({ permission: "deny", user_message: `gemworks: ${reason}`, agent_message: `gemworks: ${reason}` });
export const rewriteCall = (updated) => (updated === undefined ? {} : { updated_input: updated });
