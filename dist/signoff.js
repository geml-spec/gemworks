// Sign-off sheets on disk (core/signoff-page.ts): `.geml/signoffs/<id>.geml` in
// the project's main working tree, written again whenever one of the item's
// steps is met, and kept among the item's artifacts once it is done — one
// version each time it finishes with something new to say. Out of git, as all
// of `.geml/` is. Nothing here throws at a caller: a sheet that cannot be
// written is one the person does not see this time, never a stopped turn.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { readArtifactRows, recordBytes } from "./artifacts-store.js";
import { boardLang } from "./board-file.js";
import { signoffPage } from "./core/signoff-page.js";
import { journalBaseOf } from "./host-git.js";
import { flowsIn } from "./hosts/claude-code/coach.js";
import { wordsFor } from "./hosts/claude-code/text.js";
import { coachFlowsAt, gemlHome, workItemsAt } from "./loop.js";
import { readSessionLogs } from "./session-store.js";
export const SIGNOFF_DIR = "signoffs";
/** Where a work item's sign-off sheet is. */
export const signoffPath = (root, id) => join(gemlHome(root), SIGNOFF_DIR, `${id.replace(/[^A-Za-z0-9._-]+/g, "-")}.geml`);
const pad = (n) => String(n).padStart(2, "0");
const local = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? undefined : d; };
const clock = (iso) => { const d = local(iso); return d === undefined ? "" : `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const day = (iso) => { const d = local(iso); return d === undefined ? "" : `${d.getFullYear()}-${clock(iso)}`; };
/** The item's events across every session, and the commits each session made in the turns it worked on the item. */
function trailOf(logs, id) {
    let opened;
    const commits = [];
    for (const events of logs) {
        const turns = events.flatMap((e) => (e.t === "item" && e.id === id ? [e.turn] : []));
        for (const e of events)
            if (e.t === "item" && e.id === id && (opened === undefined || e.at < opened))
                opened = e.at;
        if (turns.length === 0)
            continue;
        const from = Math.min(...turns), to = Math.max(...turns);
        for (const e of events) {
            if (e.t === "commit" && e.turn >= from && e.turn <= to && !commits.some((c) => c.sha === e.sha))
                commits.push({ sha: e.sha, subject: e.subject, at: e.at });
        }
    }
    return { opened, commits };
}
/**
 * The sheets of the items named, written again from the record as it stands; a finished one's sheet also goes among
 * its artifacts when it says something new. Answers the paths written.
 */
export function writeSignoffs(root, ids, lang = boardLang()) {
    const written = [];
    if (ids.length === 0)
        return written;
    let flows, items, logs, rows;
    try {
        flows = coachFlowsAt(root);
        items = workItemsAt(root, flows);
        logs = readSessionLogs(root);
        rows = readArtifactRows(journalBaseOf(root));
    }
    catch {
        return written;
    }
    const t = wordsFor(lang);
    const shown = flowsIn(flows, t);
    const self = `${t("验收单")}.geml`;
    for (const id of new Set(ids)) {
        try {
            const item = items.find((x) => x.id === id);
            const flow = item !== undefined ? shown.find((f) => f.name === item.flow) : undefined;
            if (item === undefined || flow === undefined)
                continue;
            const trail = trailOf(logs, id);
            const text = signoffPage({ item, flow, opened: trail.opened ?? item.at, commits: trail.commits, artifacts: rows, clock, day, t, self });
            const path = signoffPath(root, id);
            let was = "";
            try {
                was = readFileSync(path, "utf8");
            }
            catch { /* the first */ }
            if (was !== text) {
                mkdirSync(dirname(path), { recursive: true });
                writeFileSync(path, text, "utf8");
            }
            written.push(path);
            if (item.status === "done")
                recordBytes(journalBaseOf(root), id, { name: self, bytes: Buffer.from(text, "utf8"), kind: "file", at: new Date().toISOString() });
        }
        catch { /* the next one */ }
    }
    return written;
}
