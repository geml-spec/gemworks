// `gemworks antigravity <Event>`: Gemworks's adapter for the Antigravity editor's
// agent (its hooks: `~/.gemini/config/hooks.json`). Antigravity runs one
// command per event — the event's name is the argument, its JSON on stdin:
// `conversationId`, `workspacePaths`, `transcriptPath`, and per event
// `invocationNum` (PreInvocation), `toolCall` { name, args } (PostToolUse),
// `fullyIdle` (Stop). The hooks run in Antigravity's config directory, so the
// project is the first workspace path. The prompt and the answer are not in
// the event: they are read from the conversation's transcript (one JSON step a
// line: a `USER_INPUT` step holding `<USER_REQUEST>…</USER_REQUEST>`, the
// model's `PLANNER_RESPONSE` steps).
//
// What it does is the project's shared session record (session-store.ts):
// the session opens a log and the model is told about the note tool; each
// prompt is a turn, the other sessions' decisions not yet read beside it as a
// transient message; the files a write tool wrote and a commit a command made
// go in; the turn's answer goes in at its end. The MCP server, which
// Antigravity starts outside the project, learns the conversation and its
// project from a pointer the hooks keep. Nothing here ends a turn: whatever
// fails, nothing is printed and the hook exits 0.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { decisionsContext, SESSIONS_PROMPT } from "./core/session-log.js";
import { normalised } from "./hosts/claude-code/readers.js";
import { appendSession, commits, decisionsFor, hostLabel, recordAnswer, recordFile, recordPrompt } from "./session-store.js";
export const ANTIGRAVITY_HOST = "antigravity";
/** Where the adapter keeps a conversation's state and the pointer to the active one. */
export function stateDir(home = homedir()) {
    return join(home, ".gemworks", "antigravity");
}
function readJson(file, fallback) {
    try {
        return { ...fallback, ...JSON.parse(readFileSync(file, "utf8")) };
    }
    catch {
        return fallback;
    }
}
function writeJson(file, value) {
    mkdirSync(resolve(file, ".."), { recursive: true });
    writeFileSync(file, JSON.stringify(value), "utf8");
}
export function activeOf(home = homedir()) {
    const a = readJson(join(stateDir(home), "active.json"), {});
    return typeof a.conversationId === "string" && typeof a.root === "string" ? { conversationId: a.conversationId, root: a.root, at: a.at ?? "" } : undefined;
}
function stepsOf(path) {
    if (path === undefined)
        return [];
    let text;
    try {
        text = readFileSync(path, "utf8");
    }
    catch {
        return [];
    }
    const out = [];
    for (const line of text.split(/\r?\n/)) {
        if (line.trim() === "")
            continue;
        try {
            out.push(JSON.parse(line));
        }
        catch { /* a line being written */ }
    }
    return out;
}
/** What the person asked in a `USER_INPUT` step: the text of its `<USER_REQUEST>`, else the whole content. */
export function requestOf(content) {
    const m = /<USER_REQUEST>\s*([\s\S]*?)\s*<\/USER_REQUEST>/.exec(content);
    return (m?.[1] ?? content).trim();
}
/** The person's prompts after a step, in order, with their step's index. */
export function promptsAfter(steps, after) {
    return steps.filter((s) => s.type === "USER_INPUT" && (s.source === undefined || s.source === "USER_EXPLICIT") && typeof s.step_index === "number" && s.step_index > after && typeof s.content === "string")
        .map((s) => ({ step: s.step_index, text: requestOf(s.content) }))
        .filter((p) => p.text !== "");
}
/** The turn's answer: the last model response with words since the last prompt. */
export function answerOf(steps) {
    let lastInput = -1;
    steps.forEach((s, i) => { if (s.type === "USER_INPUT")
        lastInput = i; });
    for (let i = steps.length - 1; i > lastInput; i--) {
        const s = steps[i];
        if (s.type === "PLANNER_RESPONSE" && typeof s.content === "string" && s.content.trim() !== "")
            return s.content;
    }
    return "";
}
/** The tools that write a file, and the argument naming it. */
const WRITES = { write_to_file: "TargetFile", replace_file_content: "TargetFile", multi_replace_file_content: "TargetFile" };
/** A path as the record keeps it: project-relative, `/`-separated; undefined outside the project. */
function projectPath(root, path) {
    const p = normalised(path);
    const base = normalised(root)?.replace(/\/+$/, "");
    if (p === undefined || base === undefined)
        return undefined;
    const lower = (s) => (process.platform === "win32" ? s.toLowerCase() : s);
    return lower(p).startsWith(`${lower(base)}/`) ? p.slice(base.length + 1) : undefined;
}
const isRecord = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
export function runAntigravity(event, text, home = homedir(), now = new Date().toISOString()) {
    let ev;
    try {
        const v = JSON.parse(text);
        if (!isRecord(v))
            return { stdout: "" };
        ev = v;
    }
    catch {
        return { stdout: "" };
    }
    const cid = typeof ev["conversationId"] === "string" ? ev["conversationId"] : undefined;
    const paths = Array.isArray(ev["workspacePaths"]) ? ev["workspacePaths"].filter((p) => typeof p === "string") : [];
    if (cid === undefined || paths[0] === undefined)
        return { stdout: "" };
    const root = resolve(paths[0]);
    const transcript = typeof ev["transcriptPath"] === "string" ? ev["transcriptPath"] : undefined;
    const file = join(stateDir(home), `${cid.replace(/[^A-Za-z0-9._-]/g, "_")}.json`);
    const state = readJson(file, { lastPromptStep: -1, decisionsSeen: null, committed: false });
    const save = () => writeJson(file, state);
    const out = (o) => ({ stdout: `${JSON.stringify(o)}\n` });
    writeJson(join(stateDir(home), "active.json"), { conversationId: cid, root, at: now });
    switch (event) {
        case "SessionStart": {
            appendSession(root, ANTIGRAVITY_HOST, cid, () => [], now);
            return out({ injectSteps: [{ systemMessage: { systemMessage: SESSIONS_PROMPT.replace("gemworks `note` tool", "`note` tool of the gemworks MCP server") } }] });
        }
        case "PreInvocation": {
            // A new prompt in the transcript: a turn, and beside it the other sessions' decisions not yet read.
            const asked = promptsAfter(stepsOf(transcript), state.lastPromptStep);
            if (asked.length === 0)
                return { stdout: "" };
            for (const p of asked)
                recordPrompt(root, ANTIGRAVITY_HOST, cid, p.text, now);
            state.lastPromptStep = asked[asked.length - 1].step;
            const fresh = decisionsFor(root, cid, state.decisionsSeen, now);
            state.decisionsSeen = now;
            save();
            if (fresh.length === 0)
                return { stdout: "" };
            return out({ injectSteps: [{ ephemeralMessage: decisionsContext(fresh, (d) => `${hostLabel(d.host)}${d.branch !== undefined ? ` · ${d.branch}` : ""}，${new Date(d.at).toTimeString().slice(0, 5)}`) }] });
        }
        case "PostToolUse": {
            const call = isRecord(ev["toolCall"]) ? ev["toolCall"] : {};
            const name = typeof call["name"] === "string" ? call["name"] : "";
            const args = isRecord(call["args"]) ? call["args"] : {};
            const failed = typeof ev["error"] === "string" && ev["error"] !== "";
            const target = WRITES[name] !== undefined && typeof args[WRITES[name]] === "string" ? projectPath(root, args[WRITES[name]]) : undefined;
            if (target !== undefined && !failed)
                recordFile(root, ANTIGRAVITY_HOST, cid, target, now);
            if (name === "run_command" && typeof args["CommandLine"] === "string" && commits(args["CommandLine"]) && !state.committed) {
                state.committed = true;
                save();
            }
            return out({});
        }
        case "Stop": {
            if (ev["fullyIdle"] === false)
                return { stdout: "" };
            recordAnswer(root, ANTIGRAVITY_HOST, cid, answerOf(stepsOf(transcript)), state.committed, now);
            if (state.committed) {
                state.committed = false;
                save();
            }
            return { stdout: "" };
        }
        default:
            return { stdout: "" };
    }
}
/** The hooks file entries for this adapter: `command` runs the bundle, the event its argument. */
export function hooksFor(command) {
    const run = (event) => ({ type: "command", command: `${command} antigravity ${event}`, timeout: 20 });
    return {
        SessionStart: [run("SessionStart")],
        PreInvocation: [run("PreInvocation")],
        PostToolUse: [{ matcher: ".*", hooks: [run("PostToolUse")] }],
        Stop: [run("Stop")],
    };
}
/**
 * `gemworks antigravity install`: the adapter's hooks into Antigravity's global
 * hooks file (under its own name, every other hook kept, the earlier probe
 * taken out) and the MCP server into its MCP config, both running `bundle`.
 * Returns the two files written.
 */
export function installAntigravity(bundle, home = homedir()) {
    const dir = join(home, ".gemini", "config");
    const hooksFile = join(dir, "hooks.json");
    const mcpFile = join(dir, "mcp_config.json");
    const hooks = readJson(hooksFile, {});
    delete hooks["gemworks-probe"];
    // Antigravity runs a hook command without a shell, its words split at spaces and quotes passed on as they are: the
    // path is written with forward slashes and quoted only when a space leaves no other way.
    const path = bundle.split("\\").join("/");
    hooks["gemworks"] = hooksFor(`node ${/\s/.test(path) ? `"${path}"` : path}`);
    mkdirSync(dir, { recursive: true });
    writeFileSync(hooksFile, `${JSON.stringify(hooks, null, 2)}\n`, "utf8");
    const mcp = readJson(mcpFile, {});
    mcp.mcpServers = { ...(mcp.mcpServers ?? {}), gemworks: { command: "node", args: [bundle, "mcp", "--host", ANTIGRAVITY_HOST] } };
    writeFileSync(mcpFile, `${JSON.stringify(mcp, null, 2)}\n`, "utf8");
    return [hooksFile, mcpFile];
}
