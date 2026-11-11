// `gemworks mcp`: the three model verbs (spec §8.5) and the work loop's tools
// (loop.ts: work, practice, propose, answer, ask, artifact) over stdio MCP, for
// hosts with no Gemworks shell of their own (Codex, Antigravity, Grok, …). JSON-RPC
// 2.0, one message per line: initialize, ping, tools/list, tools/call. Each
// call opens the workspace fresh, so the server shares a project with the CLI
// and any other host. A verb that changes the stage appends the new #current
// text to its result: these hosts have no other channel for it. Nothing on
// such a host shows Gemworks its tool calls, so `status` reads git and the
// file variables afresh before it answers; `tool` evidence is never observed
// here, the dictionary never asked, and no call refused: every stage text this
// server returns ends with a line saying so. What a host with hooks hears
// beside each prompt (the work items on the way, the step's practices, the
// other sessions' decisions) an MCP-only host reads here: `status` carries the
// work items and practices, and any result the decisions it has not read yet.
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { createInterface } from "node:readline";
import { HOST_TOOLS, NO_TOOLS } from "./core/host-tools.js";
import { FLOW_TOOLS } from "./core/verb-specs.js";
import { decisionsContext, NOTE_TOOL, SESSIONS_PROMPT } from "./core/session-log.js";
import { callLoopTool, coachFlowsAt, isLoopTool, LOOP_TOOLS, loopContext, loopPrompt } from "./loop.js";
import { boardHasWork, openBoardOnce } from "./board-file.js";
import { decisionsFor, hostLabel, latestSessionOf, recordDecisions } from "./session-store.js";
import { activeOf, ANTIGRAVITY_HOST } from "./antigravity.js";
import { activeOf as cursorActiveOf, CURSOR_HOST } from "./cursor.js";
import { QWEN_HOST } from "./qwen.js";
import { ghOncePerBranch } from "./host-git.js";
import { runVerb } from "./verbs.js";
import { openWorkspace } from "./workspace.js";
/** The package's version, read when a client asks: the bundle starts without a package.json beside it (the bundle test copies it alone). */
function packageVersion() {
    try {
        return JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
    }
    catch {
        return "unknown";
    }
}
const PROTOCOLS = ["2024-11-05", "2025-03-26", "2025-06-18", "2025-11-25"];
/** The hosts whose hooks say beside each prompt what an MCP-only host reads in this server's results. */
const HOOKED = new Set(["codex", ANTIGRAVITY_HOST, CURSOR_HOST, QWEN_HOST]);
const result = (id, value) => ({ jsonrpc: "2.0", id, result: value });
const failure = (id, code, message) => ({ jsonrpc: "2.0", id, error: { code, message } });
const text = (id, body, isError) => result(id, { content: [{ type: "text", text: body }], ...(isError ? { isError: true } : {}) });
/** Closes every stage text this server returns: this host shows Gemworks no tool calls, so the tools a stage lists are advice, and `tool` evidence is never written here. */
const NO_ENFORCEMENT_NOTE = "(this host shows Gemworks no tool calls: nothing is refused here, and a variable whose source is a tool is never written — tell the person what you ran, so they can tick a variable the guard accepts)";
const withNote = (stage) => `${stage}\n\n${NO_ENFORCEMENT_NOTE}`;
/**
 * What Codex says of a call in `_meta["x-codex-turn-metadata"]`: its session,
 * and its project — the one workspace it names, of several the first holding
 * a `.geml/`, else the first. Codex starts a plugin's server in the plugin's
 * directory and fills in no `${PLUGIN_ROOT}` in its arguments, so the call is
 * the only place that names the project.
 */
function codexTurnOf(params) {
    const meta = params?.["_meta"];
    const turn = meta?.["x-codex-turn-metadata"];
    if (turn === null || typeof turn !== "object" || Array.isArray(turn))
        return {};
    const t = turn;
    const spaces = t["workspaces"] !== null && typeof t["workspaces"] === "object" && !Array.isArray(t["workspaces"]) ? Object.keys(t["workspaces"]).filter(isAbsolute) : [];
    const root = spaces.find((p) => existsSync(join(p, ".geml"))) ?? spaces[0];
    const session = typeof t["session_id"] === "string" && t["session_id"] !== "" ? t["session_id"] : undefined;
    return { ...(root !== undefined ? { root } : {}), ...(session !== undefined ? { session } : {}) };
}
/** One parsed message in; the reply, or undefined for a notification. */
export async function answer(msg, o) {
    const m = msg;
    const id = m?.id ?? null;
    const method = m?.method;
    if (typeof method !== "string")
        return failure(id, -32600, "invalid request: `method` is required");
    if (method.startsWith("notifications/"))
        return undefined;
    if (method === "initialize") {
        const asked = m?.params?.["protocolVersion"];
        const version = typeof asked === "string" && PROTOCOLS.includes(asked) ? asked : PROTOCOLS[PROTOCOLS.length - 1];
        // What the model is told once: the shared record, and the loop's tools with the flows' steps.
        let instructions = SESSIONS_PROMPT;
        try {
            instructions = [SESSIONS_PROMPT, ...loopPrompt(coachFlowsAt(o.root))].join("\n\n");
        }
        catch { /* the tools' own descriptions say it */ }
        // A host with no hooks starts its server with its session: the GEML board opens then, when it has work on it.
        if (!HOOKED.has(o.host) && boardHasWork(o.root))
            openBoardOnce(o.root, latestSessionOf(o.root, o.host) ?? `mcp-${process.pid}`);
        return result(id, { protocolVersion: version, capabilities: { tools: {} }, serverInfo: { name: "gemworks", version: packageVersion() }, instructions });
    }
    if (method === "ping")
        return result(id, {});
    if (method === "tools/list")
        return result(id, { tools: [...FLOW_TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })), { name: NOTE_TOOL.name, description: NOTE_TOOL.description, inputSchema: NOTE_TOOL.inputSchema }, ...LOOP_TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema }))] });
    if (method !== "tools/call")
        return failure(id, -32601, `method not found: ${method}`);
    const name = m?.params?.["name"];
    // The note: the session the call names (Codex), else this host's session that asked last (a host with hooks names it in the record), else one of the server's own.
    // Antigravity, Cursor and Codex start the server outside the project: Antigravity's and Cursor's is the one their hooks last saw, Codex's the one the call names.
    const active = o.host === ANTIGRAVITY_HOST ? activeOf() : o.host === CURSOR_HOST ? cursorActiveOf() : undefined;
    const codex = codexTurnOf(m?.params);
    const root = active?.root ?? codex.root ?? o.root;
    const sessionOf = () => active?.conversationId ?? codex.session ?? latestSessionOf(root, o.host) ?? `mcp-${process.pid}`;
    const state = o.state ?? { decisionsSeen: null };
    /** A result with the other sessions' decisions this host has not read yet after it, on a host with no hooks to say them. */
    const withNews = (body, isError) => {
        if (HOOKED.has(o.host))
            return text(id, body, isError);
        let news = "";
        try {
            const now = new Date().toISOString();
            const fresh = decisionsFor(root, sessionOf(), state.decisionsSeen, now);
            state.decisionsSeen = now;
            if (fresh.length > 0)
                news = decisionsContext(fresh, (d) => `${hostLabel(d.host)}${d.branch !== undefined ? ` · ${d.branch}` : ""}，${new Date(d.at).toTimeString().slice(0, 5)}`);
        }
        catch { /* read at the next call */ }
        return text(id, news !== "" ? `${body}\n\n${news}` : body, isError);
    };
    /** The work items on the way and this session's step's practices: what `status` carries on every host. */
    const loopLines = () => { try {
        return loopContext(root, sessionOf()).join("\n");
    }
    catch {
        return "";
    } };
    if (name === NOTE_TOOL.name) {
        const given = m?.params?.["arguments"]?.decisions;
        const decisions = Array.isArray(given) ? given.filter((d) => typeof d === "string") : [];
        try {
            const n = recordDecisions(root, o.host, sessionOf(), decisions);
            // The GEML board says it now: opened the first time this session records something.
            if (n > 0)
                openBoardOnce(root, sessionOf());
            return withNews(n === 0 ? "Nothing recorded: decisions is a list of short sentences." : `Recorded ${n} decision${n === 1 ? "" : "s"}; the project's other sessions will see ${n === 1 ? "it" : "them"}.`, n === 0);
        }
        catch (e) {
            return text(id, `gemworks: ${e instanceof Error ? e.message : String(e)}`, true);
        }
    }
    if (typeof name === "string" && isLoopTool(name)) {
        const given = m?.params?.["arguments"];
        const args = given !== null && typeof given === "object" && !Array.isArray(given) ? given : {};
        const r = await callLoopTool(root, o.host, sessionOf(), name, args);
        if (r?.ok === true)
            openBoardOnce(root, sessionOf());
        return r === undefined ? failure(id, -32602, `unknown tool: ${name}`) : withNews(r.text, !r.ok);
    }
    const spec = FLOW_TOOLS.find((t) => t.name === name);
    if (spec === undefined)
        return failure(id, -32602, `unknown tool: ${String(name)}`);
    const raw = m?.params?.["arguments"];
    const args = raw !== null && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    try {
        // A host name is looked up as a key of its own, never as a property every object has (`constructor`).
        const opened = openWorkspace({ root, tools: Object.hasOwn(HOST_TOOLS, o.host) ? HOST_TOOLS[o.host] : NO_TOOLS, gh: ghOncePerBranch() });
        if (!opened.ok) {
            // No workflow: `status` still reads the work loop, which needs none.
            const loop = spec.name === "status" ? loopLines() : "";
            return loop !== "" ? withNews(`gemworks: ${opened.reason}\n\n${loop}`, false) : text(id, `gemworks: ${opened.reason}`, true);
        }
        // The one moment an MCP-only host lets Gemworks look: a merged PR or a file written since the last call may move the stage now; `status` then reports the stage it moved to.
        if (spec.name === "status")
            opened.ws.refresh({ reread: false });
        const a = runVerb(opened.ws, spec.name, args);
        if (spec.name === "status") {
            const loop = loopLines();
            return withNews(withNote(loop !== "" ? `${a.text}\n\n${loop}` : a.text), !a.ok);
        }
        return withNews(a.context !== undefined ? `${a.text}\n\n${withNote(a.context)}` : a.text, !a.ok);
    }
    catch (e) {
        // A journal that cannot be read, a lock held past its timeout, a verb that kept conflicting: one line, never a crash.
        const message = e instanceof Error ? e.message : String(e);
        return text(id, message.startsWith("gemworks:") ? message : `gemworks: ${message}`, true);
    }
}
/** Serve stdin to stdout, one message at a time and in order; resolves when stdin closes and every answer is out. */
export function serveMcp(o) {
    const rl = createInterface({ input: process.stdin });
    const served = { ...o, state: o.state ?? { decisionsSeen: null } };
    let chain = Promise.resolve();
    rl.on("line", (line) => {
        chain = chain.then(async () => {
            const t = line.trim();
            if (t === "")
                return;
            let msg;
            try {
                msg = JSON.parse(t);
            }
            catch {
                process.stdout.write(`${JSON.stringify(failure(null, -32700, "parse error"))}\n`);
                return;
            }
            const reply = await answer(msg, served);
            if (reply !== undefined)
                process.stdout.write(`${JSON.stringify(reply)}\n`);
        });
    });
    return new Promise((resolveDone) => {
        rl.on("close", () => {
            void chain.then(() => resolveDone());
        });
    });
}
