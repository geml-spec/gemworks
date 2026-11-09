import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PARSER_VERSION } from "@geml/geml";
import z from "@deepseek-ai/schemastery";
import { defineTool } from "@deepseek-ai/dsh-tools";
import { POWERSHELL_TOOLS, powershellFencedRefusal, powershellPersonOnlyRefusal } from "./powershell.js";
import { appendOrCreate, exists, readText, realPath } from "../../host-fs.js";
import { readDictionaryFile } from "../../dictionary-io.js";
import { commandOf } from "../../core/command-line.js";
import { DSH_TOOLS } from "../../core/host-tools.js";
import { writtenProjectPath } from "../../core/written.js";
import { decisionsContext, NOTE_TOOL, SESSIONS_PROMPT } from "../../core/session-log.js";
import { appendSession, commits, decisionsFor, hostLabel, recordAnswer, recordDecisions, recordFile, recordPrompt } from "../../session-store.js";
import { readJournal } from "../../core/journal.js";
import { actOnSession, boardReply, coachBoardReply, readQuery } from "./board.js";
import { callLoopTool, coachFlowsAt, LOOP_TOOLS, loopContext, loopPrompt, proposalsAt, workItemsAt } from "../../loop.js";
import { readPractices } from "../../practice-store.js";
import { readSessions } from "../../session-store.js";
import { hasErrors, loadStatechart } from "../../core/statechart.js";
import { metaFor, openRun, Supervisor } from "../../core/supervisor.js";
import { docReader, resolveWorkflow, workflowNameOf } from "../../workspace.js";
/** Cordis plugin name, used by loader diagnostics. */
export const name = "gemworks";
/** Services this plugin calls into. */
export const inject = ["tools", "agents", "systemPrompt"];
export const Config = z.object({
    statechart: z.string(),
    journalDir: z.string().required(),
    onMissing: z.union([z.const("skip"), z.const("fail")]).default("skip"),
});
const nowIso = () => new Date().toISOString();
const isRecord = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
/** A finished call's exit status: the one its value reports, else 1 for an error and 0 for a clean result. */
function exitCodeOf(result) {
    const v = result.isError ? undefined : result.value;
    if (isRecord(v) && typeof v["exitCode"] === "number")
        return v["exitCode"];
    return result.isError ? 1 : 0;
}
export function apply(ctx, config) {
    /** Every session under supervision, by its id: what the board's routes read. */
    const sessions = new Map();
    /** Every session in the project's record, supervised or not, by its id: its directory. */
    const recorded = new Map();
    ctx.on("agent/created", ({ agent, source }) => {
        // Synchronously, on purpose. `agent/created` is serial: the loop awaits
        // its listeners and holds the first turn's input until they settle, so an
        // attach that yielded would be waited for, not raced - but nothing in
        // `attach` needs to await (the reads, the parse and the first journal
        // append are all synchronous), so creation is not held up either. The
        // harness's 0.2 line dropped `agent/session-start`, the veto-less emit
        // this listened to before; `agent/created` carries the same payload.
        // The project's shared session record, workflow or none.
        try {
            recordSession(agent, recorded);
        }
        catch (error) {
            ctx.logger(name).warn(error);
        }
        try {
            const attached = attach(ctx, agent, source, config);
            if (attached === null)
                return;
            const id = String(agent.id);
            sessions.set(id, attached);
            // The agent's teardown takes its entry with it.
            agent.ctx.effect(() => () => { if (sessions.get(id) === attached)
                sessions.delete(id); });
        }
        catch (error) {
            ctx.logger(name).error(error);
        }
    });
    // The board for the web GUI (spec §8.10): routes under /api/gemworks, mounted
    // once a web server is there. A headless profile has none, and the callback
    // simply never runs; reading `ctx.webServer` at apply time would answer
    // nothing even in the web composition, where plugins load before it is up.
    ctx.inject(["webServer"], (scoped) => {
        scoped.effect(() => scoped.webServer.register({ kind: "prefix", path: "/api/gemworks", handler: boardApi(sessions, recorded) }));
    });
}
/**
 * One agent in the project's shared session record (session-store.ts): its
 * prompts as each turn opens, its answer as the turn closes (the text the
 * stream carried), the files its write tools wrote and the commits its
 * commands made, the decisions the model notes with `gemworks_note`; and the
 * other sessions' decisions of the last three days in its context. What fails
 * to be written is missed, never the agent's.
 */
export function recordSession(agent, recorded) {
    const cwd = resolve(agent.session.header.cwd ?? process.cwd());
    const id = String(agent.id);
    const host = "dsh";
    // The board draws a session with no workflow from the record: it needs the session's directory.
    if (recorded !== undefined) {
        recorded.set(id, cwd);
        agent.ctx.effect(() => () => { if (recorded.get(id) === cwd)
            recorded.delete(id); });
    }
    const safe = (f) => { try {
        f();
    }
    catch { /* the record misses this one */ } };
    safe(() => { appendSession(cwd, host, id, () => []); });
    let turn;
    let answer = "";
    let committed = false;
    agent.ctx.on("agent/pre-step", async (payload, next) => {
        if (payload.turn !== turn) {
            turn = payload.turn;
            answer = "";
            const said = payload.messages.filter((m) => m.source.kind === "user").flatMap((m) => m.content.flatMap((b) => (b.type === "text" ? [b.text] : []))).join("\n").trim();
            if (said !== "")
                safe(() => recordPrompt(cwd, host, id, said));
        }
        return next();
    });
    agent.ctx.on("agent/assistant-stream", (({ frame }) => {
        if (frame.type === "chunk" && frame.chunk?.type === "text-delta" && typeof frame.chunk.text === "string")
            answer += frame.chunk.text;
    }));
    agent.ctx.on("agent/turn-stopping", () => {
        const said = answer;
        const made = committed;
        answer = "";
        committed = false;
        if (said !== "" || made)
            safe(() => recordAnswer(cwd, host, id, said, made));
    });
    agent.ctx.on("tools/result", (exec, result) => {
        const input = isRecord(exec.arguments) ? exec.arguments : undefined;
        if (DSH_TOOLS.run.includes(exec.name)) {
            const command = commandOf(input);
            if (command !== undefined && commits(command))
                committed = true;
        }
        const written = DSH_TOOLS.write.includes(exec.name) && !result.isError ? writtenProjectPath(input, cwd, realPath) : undefined;
        if (written !== undefined)
            safe(() => recordFile(cwd, host, id, written));
    });
    agent.ctx.tools.register(defineTool({
        name: `gemworks_${NOTE_TOOL.name}`,
        description: NOTE_TOOL.description,
        parameters: { decisions: { type: "array", items: { type: "string" }, required: true, description: "The conclusions and decisions, one short sentence each." } },
        output: { schema: { type: "object", additionalProperties: false, properties: { text: { type: "string" } } }, render: (_args, value) => [{ type: "text", text: JSON.stringify(value) }] },
        execute: (async (args) => {
            const given = Array.isArray(args["decisions"]) ? args["decisions"].filter((d) => typeof d === "string") : [];
            const n = recordDecisions(cwd, host, id, given);
            if (n === 0)
                throw new Error("Nothing recorded: decisions is a list of short sentences.");
            return { text: `Recorded ${n} decision${n === 1 ? "" : "s"}; the project's other sessions will see ${n === 1 ? "it" : "them"}.` };
        }),
    }));
    agent.ctx.systemPrompt.section({ name: "gemworks:sessions", order: 401, text: () => SESSIONS_PROMPT.replace("gemworks `note` tool", "`gemworks_note` tool") });
    agent.ctx.systemPrompt.context({
        name: "gemworks:shared-decisions",
        order: 131,
        text: () => {
            try {
                const fresh = decisionsFor(cwd, id, null);
                return fresh.length === 0 ? "" : decisionsContext(fresh, (d) => `${hostLabel(d.host)}${d.branch !== undefined ? ` · ${d.branch}` : ""}，${new Date(d.at).toTimeString().slice(0, 5)}`);
            }
            catch {
                return "";
            }
        },
    });
    // The work loop (loop.ts): its tools as this host names them, what the model is told once, and beside each step the
    // work items on the way and the practices of the step this session's item stands at.
    for (const tool of LOOP_TOOLS) {
        agent.ctx.tools.register(defineTool({
            name: `gemworks_${tool.name}`,
            description: dshWords(tool.description),
            parameters: dshParameters(tool.inputSchema),
            output: { schema: { type: "object", additionalProperties: false, properties: { text: { type: "string" } } }, render: (_args, value) => [{ type: "text", text: JSON.stringify(value) }] },
            execute: (async (args) => {
                const r = await callLoopTool(cwd, host, id, tool.name, isRecord(args) ? args : {});
                if (r === undefined || !r.ok)
                    throw new Error(r?.text ?? "gemworks: no such tool");
                return { text: r.text };
            }),
        }));
    }
    agent.ctx.systemPrompt.section({
        name: "gemworks:loop", order: 402,
        text: () => { try {
            return dshWords(loopPrompt(coachFlowsAt(cwd)).join("\n\n"));
        }
        catch {
            return "";
        } },
    });
    agent.ctx.systemPrompt.context({
        name: "gemworks:work-items", order: 132,
        text: () => { try {
            return loopContext(cwd, id).join("\n");
        }
        catch {
            return "";
        } },
    });
}
/** The words the loop speaks in, as this host names its tools: the gemworks `work` tool is `gemworks_work` here. */
export const dshWords = (text) => text.replace(/the gemworks `(\w+)` tool/g, "the `gemworks_$1` tool").replace(/gemworks `(\w+)` tool/g, "`gemworks_$1` tool");
/**
 * A tool's JSON Schema as this host declares parameters (dsh-tools' schema DSL): each property says itself whether it
 * is required, every object whether it is open; a bound on an array's length is left to the tool, which checks it.
 */
export function dshParameters(schema) {
    const node = (s) => {
        const note = typeof s["description"] === "string" ? { description: s["description"] } : {};
        if (s["type"] === "object") {
            const required = new Set(Array.isArray(s["required"]) ? s["required"] : []);
            const props = isRecord(s["properties"]) ? s["properties"] : {};
            return { type: "object", properties: Object.fromEntries(Object.entries(props).map(([k, v]) => [k, { ...node(v), ...(required.has(k) ? { required: true } : {}) }])), additionalProperties: s["additionalProperties"] === true, ...note };
        }
        if (s["type"] === "array")
            return { type: "array", ...(isRecord(s["items"]) ? { items: node(s["items"]) } : {}), ...note };
        return { type: s["type"], ...(Array.isArray(s["enum"]) ? { enum: s["enum"] } : {}), ...note };
    };
    return (node(schema)["properties"] ?? {});
}
/** What the light flows put on a session's board, read from the project's record now. */
export function coachDataOf(cwd, id) {
    const flows = coachFlowsAt(cwd);
    let practices = [];
    try {
        practices = readPractices(cwd).practices;
    }
    catch { /* drawn without them */ }
    const own = readSessions(cwd).find((s) => s.id === id);
    const asks = (own?.asks ?? []).map((q) => ({ question: q.question, options: q.options, ...(q.recommended !== undefined ? { recommended: q.recommended } : {}), ...(q.item !== undefined ? { item: q.item } : {}) }));
    return { items: workItemsAt(cwd, flows), flows, practices, proposals: proposalsAt(cwd).filter((p) => p.status === "open"), asks, own: id };
}
/** The package's version, for the board's header; unknown when the manifest is not beside the built module. */
function gemworksVersion() {
    try {
        const v = JSON.parse(readText(fileURLToPath(new URL("../../../package.json", import.meta.url)))).version;
        return typeof v === "string" ? v : undefined;
    }
    catch {
        return undefined;
    }
}
function localeOf() {
    try {
        return Intl.DateTimeFormat().resolvedOptions().locale;
    }
    catch {
        return undefined;
    }
}
/** The request's body, whole; a body past a mebibyte is refused. */
async function bodyOf(req) {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
        const buf = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
        size += buf.length;
        if (size > 1_048_576)
            throw new Error("the request body is over 1 MiB");
        chunks.push(buf);
    }
    return Buffer.concat(chunks).toString("utf8");
}
/** A supervision as the board reads it: the journal read afresh, the dictionary as it stands. */
function supervisionOf(id, a) {
    const name = workflowNameOf(a.cwd, a.workflowFile);
    return {
        sc: a.sc, sup: a.sup, dictionary: readDictionaryFile(a.workflowFile, a.sc), item: `session:${id}`,
        // Root-relative, as the Claude Code board's workspace reports it: the rows' file links are made from the root.
        workflow: { name, path: relative(a.cwd, a.workflowFile), title: name },
        journal: exists(a.journalPath) ? readJournal(readText(a.journalPath)) : null,
        root: a.cwd,
    };
}
/**
 * The board's routes (spec §8.10). `GET /api/gemworks/board?session=<id>&tab=…&filter=…&expanded=…&lang=…`
 * answers one tab's rows with the tabs and the header; `POST /api/gemworks/act`
 * with `{ session, action }` runs a press (a board action, or a field's typed
 * value as `{ op: "input", field, value }`). A session no workflow supervises
 * is drawn from the project's record (its work items and flows) when it is one
 * the plugin records, else 404; a press the host cannot run is 400 with the
 * reason. Exported for the tests.
 */
export function boardApi(sessions, recorded = new Map()) {
    const version = gemworksVersion();
    const versions = version !== undefined ? { gemworks: version, parser: PARSER_VERSION } : undefined;
    return async (req, res) => {
        const json = (code, body) => {
            res.writeHead(code, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
            res.end(JSON.stringify(body));
        };
        try {
            const url = new URL(req.url ?? "/", "http://gemworks.invalid");
            if (req.method === "GET" && url.pathname === "/api/gemworks/board") {
                const q = readQuery(url.searchParams);
                const a = sessions.get(q.session);
                const cwd = a?.cwd ?? recorded.get(q.session);
                let coach;
                try {
                    coach = cwd !== undefined ? coachDataOf(cwd, q.session) : undefined;
                }
                catch {
                    coach = undefined;
                }
                if (a === undefined) {
                    if (coach === undefined)
                        return json(404, { ok: false, error: `no supervision for session ${q.session}` });
                    return json(200, { ok: true, ...coachBoardReply(coach, q, nowIso(), localeOf(), versions) });
                }
                return json(200, { ok: true, ...boardReply(supervisionOf(q.session, a), q, nowIso(), localeOf(), versions, coach) });
            }
            if (req.method === "POST" && url.pathname === "/api/gemworks/act") {
                let body;
                try {
                    body = JSON.parse(await bodyOf(req));
                }
                catch (e) {
                    return json(400, { ok: false, error: `the body is not JSON: ${e instanceof Error ? e.message : String(e)}` });
                }
                const b = isRecord(body) ? body : {};
                const a = sessions.get(String(b["session"] ?? ""));
                if (a === undefined)
                    return json(404, { ok: false, error: `no supervision for session ${String(b["session"] ?? "")}` });
                if (!isRecord(b["action"]) || typeof b["action"]["op"] !== "string")
                    return json(400, { ok: false, error: "action is not a board action" });
                const r = actOnSession({ sup: a.sup, sc: a.sc, workflowFile: a.workflowFile }, b["action"], nowIso());
                return json(r.ok ? 200 : 400, r);
            }
            return json(404, { ok: false, error: "no such route" });
        }
        catch (e) {
            return json(500, { ok: false, error: e instanceof Error ? e.message : String(e) });
        }
    };
}
/**
 * Put one agent under supervision. Exported so tests can drive it directly:
 * the harness testkit publishes an agent without running a turn, and this is
 * the same entry point `agent/created` uses.
 *
 * @returns the live supervision, or null when this agent is left unsupervised
 *   (no workflow, or a journal that does not verify).
 */
export function attach(ctx, agent, source, config) {
    const log = ctx.logger(name);
    const onMissing = config.onMissing ?? "skip";
    const cwd = agent.session.header.cwd ?? process.cwd();
    /** No workflow to supervise by: leave the agent alone (saying so at `level`), or fail its startup. */
    const unsupervised = (why, level = "debug") => {
        if (onMissing === "fail")
            throw new Error(`gemworks: ${why}`);
        log[level](`${why}; leaving this agent unsupervised`);
        return null;
    };
    let file;
    if (config.statechart) {
        file = resolve(cwd, config.statechart);
    }
    else {
        const workflow = resolveWorkflow(resolve(cwd));
        // No workflow at all is most projects; several with none chosen, or one named wrongly, is a setup to fix.
        if ("error" in workflow)
            return unsupervised(workflow.error, workflow.kind === "none" ? "debug" : "warn");
        file = workflow.path;
    }
    let text;
    try {
        text = readText(file);
    }
    catch {
        return unsupervised(`no workflow at ${file}`);
    }
    const workflowDir = dirname(file);
    const loaded = loadStatechart(text, file, { readDoc: docReader(workflowDir, resolve(cwd)) });
    for (const d of loaded.diagnostics) {
        const line = `${file}:${d.line}: ${d.code}: ${d.message}`;
        if (d.severity === "error")
            log.error(line);
        else if (d.severity === "warning")
            log.warn(line);
        else
            log.debug(line); // info: an authoring note for `gemworks check`, not a runtime warning
    }
    if (!loaded.statechart || hasErrors(loaded.diagnostics)) {
        if (onMissing === "fail")
            throw new Error(`gemworks: ${file} does not check out`);
        return null;
    }
    const sc = loaded.statechart;
    // --- the run, fresh or resumed -------------------------------------------
    const journalPath = resolve(config.journalDir, `${String(agent.id)}.geml`);
    const opened = openRun({
        sc,
        item: `session:${String(agent.id)}`,
        workflowFile: file,
        journalText: exists(journalPath) ? readText(journalPath) : null,
        source,
        now: nowIso(),
    });
    if (!opened.ok) {
        // A journal that contradicts itself is worse than none - resuming from it
        // would put the agent in a state nobody wrote, with the audit trail
        // asserting otherwise.
        log.error(`${journalPath}: ${opened.reason}; leaving this agent unsupervised`);
        return null;
    }
    if (opened.note)
        log.warn(`${journalPath}: ${opened.note}`);
    const head = opened.head;
    const append = (block) => appendOrCreate(journalPath, head, block);
    const sup = new Supervisor(sc, opened.run, {
        append,
        now: nowIso,
        changed: () => refresh(),
        tools: DSH_TOOLS,
        // Read afresh for every decision: a person may have answered in another session, or edited the file.
        get dictionary() {
            return readDictionaryFile(file, sc);
        },
    });
    sup.setNotice(opened.notice);
    for (const block of opened.blocks)
        append(block);
    // --- registrations, all on agent.ctx -------------------------------------
    const disposers = [];
    const toolDisposers = [];
    // `stopped` keeps TEARDOWN from re-registering: unregistering the first tool
    // fires the change, and a listener that is still live puts everything straight back.
    let stopped = false;
    let settled = Promise.resolve();
    function toolFor(spec, execute) {
        return agent.ctx.tools.register(defineTool({
            name: spec.name,
            description: spec.description,
            parameters: spec.parameters,
            output: {
                schema: spec.output.schema,
                render: (_args, value) => [{ type: "text", text: JSON.stringify(value) }],
            },
            execute: (async (args, exec) => execute(args, exec.callId)),
        }));
    }
    /** A verb: the supervisor's answer, or a thrown Error the model reads. */
    const verb = (args, callId, spec) => {
        const outcome = sup.invoke(spec.name, args, metaFor(nowIso(), callId));
        if (!outcome.ok)
            throw new Error(outcome.reason);
        return outcome.result;
    };
    /**
     * Recompute the two tools whose shape the state decides (move's targets,
     * set's variables). Called after every accepted action, which is what keeps
     * their shape honest.
     */
    function refresh() {
        if (stopped)
            return;
        for (const dispose of toolDisposers.splice(0))
            dispose();
        const specs = sup.specs();
        if (specs.move) {
            const s = specs.move;
            toolDisposers.push(toolFor(s, (args, callId) => verb(args, callId, s)));
        }
        if (specs.set) {
            const s = specs.set;
            toolDisposers.push(toolFor(s, (args, callId) => verb(args, callId, s)));
        }
    }
    disposers.push(toolFor(sup.specs().status, () => ({ text: `${sup.instruction()}\n\n${sup.context()}` })));
    // The gate before a call (spec §5.3), as dsh's pre-execute waterfall: a
    // refusal denies with its reason (the supervisor has recorded it); keys the
    // dictionary has no decision on go to dsh's approval service as `ask` —
    // the person allows the call once, or it is denied; nothing is learned
    // here. `pwsh` is the exception (./powershell.ts): its command is
    // PowerShell, which the supervisor's sh scanners cannot read, so its input
    // is withheld from the gate and the two rules that need no parse are
    // applied here, through the supervisor's own `refuse`: journaled like any
    // refusal, and remembered so the failed result it produces is not mistaken
    // for a tool that ran and failed.
    disposers.push(agent.ctx.on("tools/pre-execute", async (exec, next) => {
        const input = isRecord(exec.arguments) ? exec.arguments : undefined;
        let gate;
        if (POWERSHELL_TOOLS.has(exec.name)) {
            const command = commandOf(input);
            const reason = command === undefined ? undefined : powershellPersonOnlyRefusal(command) ?? powershellFencedRefusal((c) => sup.fencedRefusal(c), command);
            gate = reason === undefined ? sup.gate(exec.name, exec.callId) : { kind: "refuse", reason: sup.refuse(exec.name, reason, exec.callId) };
        }
        else
            gate = sup.gate(exec.name, exec.callId, input);
        if (gate.kind === "refuse")
            return { kind: "deny", reason: gate.reason };
        return next();
    }));
    // The state's own instruction, byte for byte, and the snapshot beneath it.
    disposers.push(agent.ctx.systemPrompt.section({
        name: "gemworks:state",
        order: 400,
        text: () => sup.instruction(),
    }));
    disposers.push(agent.ctx.systemPrompt.context({
        name: "gemworks:snapshot",
        order: 130,
        // The clock's evidence, once per step: a stage held long enough moves on before the model reads the context.
        text: () => { sup.elapse({ at: nowIso() }); return sup.context(); },
    }));
    // A finished call is evidence for the use its key is bound to: a command's
    // exit status, another tool's success or error. Serialised through
    // `settled` so a burst of results appends in order.
    disposers.push(agent.ctx.on("tools/result", (exec, result) => {
        const input = isRecord(exec.arguments) ? exec.arguments : undefined;
        const callId = exec.callId;
        settled = settled.then(() => {
            const meta = metaFor(nowIso(), callId);
            if (DSH_TOOLS.run.includes(exec.name)) {
                const command = commandOf(input);
                if (command !== undefined && !POWERSHELL_TOOLS.has(exec.name))
                    sup.observeCommand({ command, exitCode: exitCodeOf(result) }, meta);
            }
            else
                sup.observeCall(exec.name, input, !result.isError, meta);
            // A file a write tool wrote is what the work made.
            const written = DSH_TOOLS.write.includes(exec.name) && !result.isError ? writtenProjectPath(input, resolve(cwd), realPath) : undefined;
            if (written !== undefined)
                sup.recordWrite(exec.name, written, callId);
        });
    }));
    refresh();
    return {
        run: sup.run,
        journalPath,
        sup, sc, workflowFile: file, workflowDir, cwd: resolve(cwd),
        whenSettled: () => settled,
        dispose: () => {
            stopped = true;
            for (const dispose of disposers.splice(0))
                dispose();
            for (const dispose of toolDisposers.splice(0))
                dispose();
        },
    };
}
