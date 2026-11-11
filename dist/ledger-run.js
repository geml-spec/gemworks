// The person's ledger of corrections on a host whose model Gemworks may borrow
// (Pi now): what the Claude Code module does with its engine's model
// (hooks/register.tsx labelPrompt, themeLedger, proposeFlows), with the model
// handed in as `complete`. A prompt the person typed is labelled following the
// guide; a correction then goes into a theme with the others, the themes are
// linked to the practices that state them; and a kind of work corrected often
// with no flow of its own gets a flow proposed, once. The ledger itself is the
// bridge's (corrections ops), shared with every session. Nothing here throws at
// a caller: a model that does not answer leaves the prompt for `gemworks
// corrections pending`.
import { checkRequest, flowRequest, labelRequest, linkKey, promptId, readChecks, readFlowDraft, readLabels, readThemes, themeRequest } from "./core/corrections.js";
import { newProposals } from "./core/growth.js";
import { langOf, wordsFor } from "./hosts/claude-code/text.js";
import { handleRequest } from "./bridge.js";
import { coachFlowsAt, proposalsAt, saveProposals } from "./loop.js";
/** At most this many theme requests a run: a long backlog is worked through over several prompts. */
const THEME_RUNS = 12;
const ask = async (complete, system, prompt, maxTokens) => {
    try {
        return await complete(system, prompt, maxTokens);
    }
    catch {
        return undefined;
    }
};
async function bridgeCorrections(root, op) {
    try {
        const res = await handleRequest({ v: 1, root, ...op });
        return res.ok ? res.corrections : undefined;
    }
    catch {
        return undefined;
    }
}
/** One typed prompt labelled into the ledger; a correction, or themes left waiting, then put into themes. Whether it was labelled. */
export async function labelPrompt(root, p, complete, locale) {
    const req = labelRequest([{ text: p.text, before: p.before }]);
    const reply = await ask(complete, req.system, req.prompt, 300);
    const label = reply !== undefined ? readLabels(reply, 1)[0] : undefined;
    if (label === undefined)
        return false;
    const row = {
        id: promptId(p.session, p.at, new Set()), at: p.at, session: p.session, text: p.text, ...label, project: root,
        ...(p.flow !== undefined && p.step !== undefined ? { flow: p.flow, step: p.step } : {}), by: "model",
    };
    const view = await bridgeCorrections(root, { op: "corrections-add", prompts: [row] });
    if (view === undefined)
        return false;
    if (label.kind === "correct" || view.unthemed > 0 || view.stale || view.unchecked > 0)
        await themeLedger(root, p.session, complete, locale);
    return true;
}
/** At most this many check requests a run. */
const CHECK_RUNS = 4;
/**
 * The corrections a 失效 card would count, each read against the practice it would count against before any card counts
 * it (hooks/register.tsx checkLedger): each pair keeps its answer; a reply that reads none is asked again later.
 */
export async function checkLedger(root, session, complete) {
    for (let run = 0; run < CHECK_RUNS; run++) {
        const view = await bridgeCorrections(root, { op: "corrections", toTheme: true, session });
        const items = view?.toCheck;
        if (items === undefined || items.length === 0)
            break;
        const req = checkRequest(items);
        const reply = await ask(complete, req.system, req.prompt, 400);
        const verdicts = reply !== undefined ? readChecks(reply, req.handles) : [];
        if (verdicts.length === 0)
            break;
        const done = await bridgeCorrections(root, { op: "corrections-check", verdicts });
        if (done === undefined || done.unchecked === 0)
            break;
    }
}
/** The ledger's corrections put into themes, a batch a request, by the session that holds the claim; then read against their rule; then flows proposed. */
export async function themeLedger(root, session, complete, locale) {
    for (let run = 0; run < THEME_RUNS; run++) {
        const view = await bridgeCorrections(root, { op: "corrections", toTheme: true, session });
        const given = view?.toTheme;
        if (view === undefined || given === undefined || (given.corrections.length === 0 && !view.stale))
            break;
        const req = themeRequest(given.corrections, given.themes, given.practices);
        const reply = await ask(complete, req.system, req.prompt, 6000);
        if (reply === undefined)
            break;
        const answer = readThemes(reply, req.handles);
        // A reply that put none in a theme is no answer: asked again another time. One that answered most: the rest have none.
        if (given.corrections.length > 0 && answer.assign.length === 0)
            break;
        const answered = new Set(answer.assign.map((a) => a.id));
        const most = answer.assign.length * 2 >= given.corrections.length;
        const whole = { ...answer, assign: [...answer.assign, ...(most ? given.corrections.filter((c) => !answered.has(c.id)).map((c) => ({ id: c.id, theme: null })) : [])] };
        const done = await bridgeCorrections(root, { op: "corrections-themes", answer: whole, linked: linkKey(given.practices) });
        if (done === undefined || (done.unthemed === 0 && !done.stale))
            break;
    }
    await checkLedger(root, session, complete);
    await proposeFlows(root, complete, locale);
}
/** A flow proposed, once, for each kind of work corrected often in the last days with none of its own: its steps drafted by the model. */
export async function proposeFlows(root, complete, locale) {
    const view = await bridgeCorrections(root, { op: "corrections" });
    if (view === undefined || view.flowless.length === 0)
        return;
    const flows = coachFlowsAt(root);
    const t = wordsFor(langOf(undefined, locale));
    for (const f of view.flowless) {
        const kept = proposalsAt(root);
        if (flows.some((x) => x.name === f.work) || kept.some((p) => p.kind === "new-flow" && p.flow === f.work))
            continue;
        const req = flowRequest(f.work, f.quotes);
        const reply = await ask(complete, req.system, req.prompt, 1500);
        const draft = reply !== undefined ? readFlowDraft(reply) : undefined;
        if (draft === undefined)
            continue;
        const at = new Date().toISOString();
        const made = newProposals([{ kind: "new-flow", name: f.work, ...draft, why: t("近 7 天纠正 {0} 次，其中判断 {1} 次，无流程可挂", f.n, f.judgment) }], flows, kept, at, (n) => `c${Date.parse(at).toString(36).slice(-6)}${n}`);
        if (made.added.length > 0)
            saveProposals(root, [...kept, ...made.added.map((p) => ({ ...p, by: "gemworks" }))]);
    }
}
