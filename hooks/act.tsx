// A press on the band or the board, and what it does. Split from register.tsx, the plugin module, which keeps the
// state, the readers and the drawing this uses and exports them for it: each file the plugin ships stays under the
// 256 KiB Anthropic's plugin directory reads whole. Only register.tsx calls act, after both modules have loaded.
import type { EngineInterface } from 'claude-code'
import { atom, read, update } from 'claude-code'
import type { GemworksJson, GemworksTab } from '../types'
import type { BoardAction } from '../dist/hosts/claude-code/actions.js'
import { answered, picksText } from '../dist/hosts/claude-code/attention.js'
import { currentTurn, isDeferral } from '../dist/core/session-log.js'
import type { SessionEvent } from '../dist/core/session-log.js'
import { linkKey } from '../dist/core/corrections.js'
import { closeEvent, holdEvent, pressEvent, readCoachFlow } from '../dist/hosts/claude-code/coach.js'
import type { GoneOn } from '../dist/hosts/claude-code/coach.js'
import { newPractices } from '../dist/core/practices.js'
import { applyToFlow, exportText as flowExport, flowText, referenceName, referenceProposals, newFlow, parseRules, ruleAsk, rulesText, type Proposal } from '../dist/hosts/claude-code/growth.js'
import { boardText } from '../dist/hosts/claude-code/command.js'
import { BRIDGE_TIMEOUT_MS, SLOW_TIMEOUT_MS } from '../dist/hosts/claude-code/protocol.js'
import type { BridgeOp, BridgeResponse } from '../dist/hosts/claude-code/protocol.js'
import { promptLine } from '../dist/hosts/claude-code/sessions.js'
import type { PromptRecord } from '../dist/hosts/claude-code/sessions.js'
import { MADE_PAGE, MADE_VIEW } from '../dist/hosts/claude-code/made.js'
import type { MemoryList } from '../dist/memory-store.js'
import { hhmm } from '../dist/hosts/claude-code/time.js'
import { captureFailed, capturesFor, captureStarted } from '../dist/hosts/claude-code/screenshot.js'
import { withSetting } from '../dist/hosts/claude-code/settings.js'
import type { Judgement } from '../dist/hosts/claude-code/judge.js'
import { HOME_TAB } from '../dist/hosts/claude-code/board.js'
import {
  QUEUED_MATCH_MS, STORE_SETTINGS, TURNS_SHOWN, answerOf, appendOwn, attentionOnPrompt, bridge, checkLatest,
  coachFlows, coachFlowsKept, correctionsKept, dismissedOf, exportText, gemlDir, loadBoard, loadCorrections,
  loadGrowth, loadMade, loadMemory, loadPractices, loadProjectSessions, loadWorkflows, nowIso, openBoard,
  openDialog, openFile, otherSessionText, practicesKept, proposalsKept, readAttention, readBoard, readPrompts,
  readSettings, reasonOf, rulesKept, saveProposals, saveRules, sessionText, setQueued, share, startBridge,
  storePrompts, takeOption, themeLedger, trace, turnBusy, words, workItems, writeOwnFlow,
} from './register.tsx'
// The atoms act reads and updates, declared here as register.tsx declares them: the same plugin and key is the same
// value, and the validator reads a state source only from an atom made in the file that reads it.
// test/hooks-split.test.mjs holds each line to its twin in register.tsx.
const artifactMenuAtom = atom({ plugin: 'gemworks', key: 'artifactMenu' } as const, null as string | null)
const attentionAtom = atom({ plugin: 'gemworks', key: 'attention' } as const, null as GemworksJson)
const coachFocusAtom = atom({ plugin: 'gemworks', key: 'coachFocus' } as const, null as GemworksJson)
const correctionsAtom = atom({ plugin: 'gemworks', key: 'corrections' } as const, null as GemworksJson)
const decisionsShownAtom = atom({ plugin: 'gemworks', key: 'decisionsShown' } as const, 20 as number)
const dismissedAtom = atom({ plugin: 'gemworks', key: 'dismissed' } as const, null as GemworksJson)
const docsOpenAtom = atom({ plugin: 'gemworks', key: 'docsOpen' } as const, false)
const doneOpenAtom = atom({ plugin: 'gemworks', key: 'doneOpen' } as const, false)
const droppedOpenAtom = atom({ plugin: 'gemworks', key: 'droppedOpen' } as const, false)
const evidenceAtom = atom({ plugin: 'gemworks', key: 'evidence' } as const, null as string | null)
const expandedAtom = atom({ plugin: 'gemworks', key: 'expanded' } as const, null as string | null)
const expandedTurnAtom = atom({ plugin: 'gemworks', key: 'expandedTurn' } as const, null as GemworksJson)
const exportedAtom = atom({ plugin: 'gemworks', key: 'exported' } as const, null as string | null)
const exportedForAtom = atom({ plugin: 'gemworks', key: 'exportedFor' } as const, null as string | null)
const filterAtom = atom({ plugin: 'gemworks', key: 'filter' } as const, 'all')
const flowStateAtom = atom({ plugin: 'gemworks', key: 'flowState' } as const, null as string | null)
const flowSwitchAtom = atom({ plugin: 'gemworks', key: 'flowSwitch' } as const, false)
const goneOnAtom = atom({ plugin: 'gemworks', key: 'goneOn' } as const, [] as GemworksJson)
const heldOpenAtom = atom({ plugin: 'gemworks', key: 'heldOpen' } as const, false)
const judgedAtom = atom({ plugin: 'gemworks', key: 'judged' } as const, null as GemworksJson)
const lastFileAtom = atom({ plugin: 'gemworks', key: 'lastFile' } as const, null as string | null)
const latestAtom = atom({ plugin: 'gemworks', key: 'latest' } as const, null as GemworksJson)
const madeViewAtom = atom({ plugin: 'gemworks', key: 'madeView' } as const, MADE_VIEW as { kind: string; shown: number; item: string | null })
const manualExpandedAtom = atom({ plugin: 'gemworks', key: 'manualExpanded' } as const, null as string[] | null)
const memoryAtom = atom({ plugin: 'gemworks', key: 'memory' } as const, null as MemoryList | null)
const memoryEditAtom = atom({ plugin: 'gemworks', key: 'memoryEdit' } as const, null as string | null)
const memoryGroupAtom = atom({ plugin: 'gemworks', key: 'memoryGroup' } as const, null as string | null)
const memoryMenuAtom = atom({ plugin: 'gemworks', key: 'memoryMenu' } as const, null as string | null)
const memoryShownAtom = atom({ plugin: 'gemworks', key: 'memoryShown' } as const, 10 as number)
const openSessionAtom = atom({ plugin: 'gemworks', key: 'openSession' } as const, null as string | null)
const passesAtom = atom({ plugin: 'gemworks', key: 'passes' } as const, [] as GemworksJson)
const pendingRuleAtom = atom({ plugin: 'gemworks', key: 'pendingRule' } as const, null as string | null)
const pickedAtom = atom({ plugin: 'gemworks', key: 'picked' } as const, [] as string[])
const practicesAtom = atom({ plugin: 'gemworks', key: 'practices' } as const, null as GemworksJson)
const promptsAtom = atom({ plugin: 'gemworks', key: 'prompts' } as const, [] as GemworksJson)
const reloadUnavailableAtom = atom({ plugin: 'gemworks', key: 'reloadUnavailable' } as const, false)
const rootAtom = atom({ plugin: 'gemworks', key: 'root' } as const, null as string | null)
const sessionFlowAtom = atom({ plugin: 'gemworks', key: 'sessionFlow' } as const, null as string | null)
const sessionRunsAtom = atom({ plugin: 'gemworks', key: 'sessionRuns' } as const, [] as GemworksJson)
const sessionsAllAtom = atom({ plugin: 'gemworks', key: 'sessionsAll' } as const, false as boolean)
const settingsAtom = atom({ plugin: 'gemworks', key: 'settings' } as const, null as GemworksJson)
const shareAtom = atom({ plugin: 'gemworks', key: 'share' } as const, { what: 'status', how: 'copy', strip: true } as GemworksJson)
const tabAtom = atom({ plugin: 'gemworks', key: 'tab' } as const, HOME_TAB as GemworksTab)
const tidyingAtom = atom({ plugin: 'gemworks', key: 'tidying' } as const, false as boolean)
const toolMenuAtom = atom({ plugin: 'gemworks', key: 'toolMenu' } as const, null as string | null)
const toolNamingAtom = atom({ plugin: 'gemworks', key: 'toolNaming' } as const, null as string | null)
const toolQueryAtom = atom({ plugin: 'gemworks', key: 'toolQuery' } as const, '')
const toolsOpenAtom = atom({ plugin: 'gemworks', key: 'toolsOpen' } as const, [] as GemworksJson)
const turnsShownAtom = atom({ plugin: 'gemworks', key: 'turnsShown' } as const, TURNS_SHOWN as number)
const workOpenAtom = atom({ plugin: 'gemworks', key: 'workOpen' } as const, [] as string[])
const workUnfoldedAtom = atom({ plugin: 'gemworks', key: 'workUnfolded' } as const, null as string | null)
const workflowsAtom = atom({ plugin: 'gemworks', key: 'workflows' } as const, null as GemworksJson)

/** How long a region capture may stay open: the longest a command may run (the engine's ten minutes). */
const CAPTURE_MS = 10 * 60 * 1000

/**
 * The band's screenshot button: the toast saying which key pastes goes first, then the system's region capture. Each
 * way is tried until one starts; one that starts is the person's (how it ends, a cancel included, says nothing); when
 * none starts, the toast says why.
 */
async function capture($: EngineInterface, platform: string): Promise<void> {
  const t = await words($)
  $.ui.toast(captureStarted(platform, t))
  let why = ''
  for (const c of capturesFor(platform)) {
    try {
      await $.process.run(c.argv, { timeoutMs: CAPTURE_MS })
      return
    } catch (err) {
      why = reasonOf(err)
      if (/still running|timed out/i.test(why)) return
    }
  }
  $.ui.toast(captureFailed(platform, why, t))
}

/** A press on the band or the board: what it does. */
export async function act($: EngineInterface, action: BoardAction, surface?: string): Promise<void> {
  // A view change first, before anything is read: a tab, a filter, a fold or a menu shows at once.
  switch (action.op) {
    case 'coach-go': {
      await update($, coachFocusAtom, () => ({ flow: action.flow, id: action.id }))
      await update($, tabAtom, () => 'flow')
      return
    }
    // A step the person judges, pressed on its row: into this session's record at once; said too when the item is this session's, so the turn hears it.
    case 'work-meet':
    case 'work-hold':
    case 'work-take':
    case 'work-close': {
      const item = (await workItems($)).find((i) => i.id === action.id)
      const flow = (await coachFlowsKept($)).find((f) => f.name === item?.flow)
      if (item === undefined || (flow === undefined && action.op === 'work-meet')) return
      const at = await nowIso($)
      await appendOwn($, (so) => [
        action.op === 'work-meet' && flow !== undefined ? pressEvent(item, flow, action.step, action.yes, at, currentTurn(so))
          : action.op === 'work-take' ? closeEvent(item, 'open', at, currentTurn(so))
          : action.op === 'work-close' ? closeEvent(item, action.status, at, currentTurn(so))
          : holdEvent(item, action.op === 'work-hold' ? action.held : false, at, currentTurn(so)),
      ])
      await loadProjectSessions($)
      if (action.op === 'work-meet' && item.session === (await $.session.id().catch(() => ''))) {
        const step = flow?.states.find((s) => s.id === action.step)?.title ?? action.step
        await act($, { op: 'say', text: `${item.title} · ${step}：${action.label}` }, surface)
      }
      return
    }
    // 好，做吧: the button gives way first, so a second press finds 排队中/进行中 instead of sending the step again.
    case 'work-go-on': {
      const wait = turnBusy ? 1 : 0
      await update($, goneOnAtom, (was) => [...(((was as unknown) as GoneOn[] | null) ?? []).filter((g) => g.id !== action.id), { id: action.id, next: action.next, at: action.at, wait, ends: 0 }] as unknown as GemworksJson)
      try {
        await act($, { op: 'say', text: action.next }, surface)
      } catch (err) {
        await update($, goneOnAtom, (was) => (((was as unknown) as GoneOn[] | null) ?? []).filter((g) => g.id !== action.id) as unknown as GemworksJson)
        throw err
      }
      return
    }
    case 'manual-open': {
      const now = (await read($, manualExpandedAtom)) as string[] | null
      const first = (await workItems($)).filter((i) => i.status === 'open').sort((a, b) => (a.at < b.at ? 1 : -1))[0]?.flow
      const was = now ?? (first !== undefined ? [first] : [])
      await update($, manualExpandedAtom, () => [...was.filter((f) => f !== action.flow), ...(action.open ? [action.flow] : [])])
      return
    }
    case 'practice-delete':
    case 'practice-layer':
    case 'practice-everywhere': {
      const change = action.op === 'practice-delete' ? { deleted: true } : action.op === 'practice-everywhere' ? { everywhere: true } : { layer: action.layer }
      const res = await bridge($, { op: 'practice-set', id: action.id, ...change }).catch(() => undefined)
      if (res !== undefined && res.ok && res.practices !== undefined) await update($, practicesAtom, () => res.practices as unknown as GemworksJson)
      // The ledger's cards and counts are read against the practices.
      await loadCorrections($)
      return
    }
    // A theme of corrections written as a practice, and linked to it at once: its card gives way to the practice's count.
    case 'practice-from-theme': {
      const flows = await coachFlows($)
      await loadPractices($)
      const kept = (await practicesKept($))?.list ?? []
      const at = await nowIso($)
      const r = newPractices([{ flow: action.flow, step: action.step, text: action.rule, why: action.why, layer: 'personal' }], kept, at, 'person', (n) => `p${Date.parse(at).toString(36).slice(-6)}${n}`, flows.map((f) => ({ name: f.name, steps: f.states.map((s) => s.id) })))
      const added = r.added[0]
      if (added === undefined) { $.ui.toast(`gemworks：${r.errors.join('；') || '没有记下'}`); return }
      const res = await bridge($, { op: 'practice-add', practices: [added] }).catch(() => undefined)
      if (res === undefined || !res.ok) { $.ui.toast('gemworks：做法没有写进去'); return }
      if (res.practices !== undefined) await update($, practicesAtom, () => res.practices as unknown as GemworksJson)
      // The links were current but for this practice: they are again. Else the next theme run links every practice.
      const current = (await correctionsKept($))?.stale === false
      const linked = current ? linkKey((res.practices?.list ?? []).filter((p) => p.deleted !== true)) : ''
      const done = await bridge($, { op: 'corrections-themes', answer: { assign: [], links: [{ theme: action.theme, practices: [added.id] }] }, linked }).catch(() => undefined)
      if (done !== undefined && done.ok && done.corrections !== undefined) await update($, correctionsAtom, () => done.corrections as unknown as GemworksJson)
      if (!current) $.clock.after(0, () => { void themeLedger($).catch(() => undefined) })
      return
    }
    case 'ledger-dismiss': {
      const res = await bridge($, { op: 'corrections-dismiss', key: action.key, n: action.n }).catch(() => undefined)
      if (res !== undefined && res.ok && res.corrections !== undefined) await update($, correctionsAtom, () => res.corrections as unknown as GemworksJson)
      return
    }
    case 'work-unfold': await update($, workUnfoldedAtom, () => action.id); return
    // A work item's prompts: the sessions tab, showing only the turns that moved it.
    case 'session-item':
      await update($, sessionFlowAtom, () => action.id)
      if (action.id !== null) await update($, tabAtom, () => 'sessions')
      return
    // A proposal answered: accepted, the flow changes (the project's own); declined, it is not proposed again.
    case 'proposal-answer': {
      const list = await proposalsKept($)
      const p = list.find((x) => x.id === action.id)
      if (p === undefined) return
      if (action.yes) {
        if (p.kind === 'new-flow') await writeOwnFlow($, newFlow(p))
        else {
          const flow = (await coachFlowsKept($)).find((f) => f.name === p.flow)
          if (flow !== undefined) await writeOwnFlow($, applyToFlow(flow, p))
        }
      }
      await saveProposals($, list.map((x) => (x.id === p.id ? { ...x, status: action.yes ? 'accepted' as const : 'declined' as const } : x)))
      return
    }
    case 'proposal-skip': {
      const flow = (await coachFlowsKept($)).find((f) => f.name === action.flow)
      if (flow === undefined) return
      if (action.yes) await writeOwnFlow($, applyToFlow(flow, { kind: 'remove-step', remove: action.step }))
      const at = await nowIso($)
      const answered: Proposal = { id: `k${Date.parse(at).toString(36).slice(-6)}`, kind: 'remove-step', flow: action.flow, remove: action.step, why: '', at, by: 'gemworks', status: action.yes ? 'accepted' : 'declined' }
      await saveProposals($, [...(await proposalsKept($)), answered])
      return
    }
    // 改成规定: the model is asked, as the person's words, to write the rule; the rule tool takes it for this practice only.
    case 'practice-rule': {
      const practice = ((await practicesKept($))?.list ?? []).find((x) => x.id === action.id)
      const flow = (await coachFlowsKept($)).find((f) => f.name === practice?.flow)
      if (practice === undefined || flow === undefined) return
      await update($, pendingRuleAtom, () => practice.id)
      await act($, { op: 'say', text: ruleAsk(practice, flow.title, flow.states.find((st) => st.id === practice.step)?.title ?? practice.step) }, surface)
      return
    }
    // A flow shared with the team: its route (when the project changed it), its rules and its practices, into the repository's .gemworks/; the person commits.
    case 'flow-share': {
      const repo = await read($, rootAtom)
      const geml = await gemlDir($)
      const flow = (await coachFlowsKept($)).find((f) => f.name === action.flow)
      if (repo === null || geml === null || flow === undefined) return
      const t = await words($)
      if (flow.diff !== undefined) await $.fs.write(`${repo}/.gemworks/flows/${flow.name}.geml`, flowText(flow))
      const rules = await rulesKept($)
      const mine = rules.filter((r) => r.flow === flow.name && r.layer === 'project')
      if (mine.length > 0) {
        const teamText = await $.fs.read(`${repo}/.gemworks/rules.geml`).then(String, () => '')
        await $.fs.write(`${repo}/.gemworks/rules.geml`, rulesText([...parseRules(teamText, 'team'), ...mine.map((r) => ({ ...r, layer: 'team' as const }))]))
        await saveRules($, rules.map((r) => (mine.includes(r) ? { ...r, layer: 'team' as const } : r)))
      }
      const ids = ((await practicesKept($))?.list ?? []).filter((p) => p.flow === flow.name && p.layer === 'project' && p.deleted !== true).map((p) => p.id)
      if (ids.length > 0) {
        const res = await bridge($, { op: 'practice-share', ids }).catch(() => undefined)
        if (res !== undefined && res.ok && res.practices !== undefined) await update($, practicesAtom, () => res.practices as unknown as GemworksJson)
      }
      await loadGrowth($)
      $.ui.toast(t('已写进 .gemworks/，提交由你'))
      return
    }
    case 'flow-export': {
      const geml = await gemlDir($)
      const flow = (await coachFlowsKept($)).find((f) => f.name === action.flow)
      if (geml === null || flow === undefined) return
      const file = `${geml}/exports/flow-${flow.name}.geml`
      await $.fs.write(file, flowExport(flow, (await practicesKept($))?.list ?? [], await rulesKept($)))
      $.ui.toast((await words($))('已导出 {0}', file))
      return
    }
    case 'practice-share': {
      const res = await bridge($, { op: 'practice-share', ids: [action.id] }).catch(() => undefined)
      if (res !== undefined && res.ok && res.practices !== undefined) await update($, practicesAtom, () => res.practices as unknown as GemworksJson)
      $.ui.toast((await words($))('已写进 .gemworks/，提交由你'))
      return
    }
    case 'practice-claude-md': {
      const practice = ((await practicesKept($))?.list ?? []).find((x) => x.id === action.id)
      if (practice === undefined) return
      await act($, { op: 'say', text: (await words($))('把做法「{0}」写进 CLAUDE.md：它每轮都要用。先把改动给我看，我批了再写；写好后用 practice 工具记一条 ref 指向那一段。', practice.text) }, surface)
      return
    }
    // A reference imported: the file exported from a flow, or every flow in another project's .gemworks/flows; what it has that the project lacks, offered back.
    case 'reference-import': {
      const geml = await gemlDir($)
      if (geml === null) return
      const t = await words($)
      const given = action.path.replace(/[\\/]+$/, '')
      let files: string[] = [given]
      try {
        const listed = [...(await $.fs.list(`${given}/flows`))].filter((en) => en.kind === 'file' && en.name.endsWith('.geml')).map((en) => `${given}/flows/${en.name}`)
        if (listed.length > 0) files = listed
      } catch { /* a file, not a directory */ }
      const flows = await coachFlows($)
      const at = await nowIso($)
      const stamp = Date.parse(at).toString(36).slice(-6)
      let kept = await proposalsKept($)
      let read = 0
      for (const file of files) {
        const text = await $.fs.read(file).then(String, () => undefined)
        const name = referenceName(file, 'ref')
        const ref = text !== undefined ? readCoachFlow(name, text) : undefined
        if (ref === undefined || text === undefined) continue
        read++
        await $.fs.write(`${geml}/references/${name}.geml`, text)
        kept = [...kept, ...referenceProposals(ref, name, flows, kept, at, (n) => `f${stamp}${read}${n}`)]
      }
      if (read === 0) { $.ui.toast(t('读不出参考：{0}', action.path)); return }
      await saveProposals($, kept)
      $.ui.toast(t('已导入 {0} 份参考，它有的步骤在流程页上提议', read))
      return
    }
    case 'work-fold':
      await update($, workOpenAtom, (was) => [...((was ?? []) as string[]).filter((g) => g !== action.group), ...(action.open ? [action.group] : [])])
      return
    case 'tab': {
      await update($, tabAtom, () => action.tab)
      trace($, `tab is now ${action.tab}`)
      const filter = action.filter
      if (filter !== undefined) await update($, filterAtom, () => filter)
      if (action.tab === 'sessions') {
        // Chosen anew, the sessions tab's memory and decisions start on their first page: a page kept from before is a tree the desktop may not take.
        await update($, decisionsShownAtom, () => 20)
        await update($, memoryShownAtom, () => 10)
        $.clock.after(0, () => { void loadMemory($) })
      }
      // The flow tab shows the ledger as it is now: other sessions write into it too.
      if (action.tab === 'flow') $.clock.after(0, () => { void loadCorrections($).catch(() => undefined) })
      // What the work made, read anew behind the tab (a project with no workflow has no board read to bring it):
      // the 产物 tab chosen from the tab bar starts on every work item's, newest first; the work items tab counts each one's.
      if (action.tab === 'made') await update($, madeViewAtom, () => MADE_VIEW)
      if (action.tab === 'made' || action.tab === 'items') $.clock.after(0, () => { void loadMade($) })
      return
    }
    // A work item's 产物 n: the 产物 tab with its own alone; × there shows every one's again.
    case 'made-item': {
      await update($, madeViewAtom, () => ({ ...MADE_VIEW, item: action.id }))
      if (action.id !== null) {
        await update($, tabAtom, () => 'made' as GemworksTab)
        $.clock.after(0, () => { void loadMade($) })
      }
      return
    }
    case 'made-kind': await update($, madeViewAtom, (was) => ({ ...(was ?? MADE_VIEW), kind: action.kind, shown: 0 })); return
    case 'made-more': await update($, madeViewAtom, (was) => ({ ...(was ?? MADE_VIEW), shown: Math.max(MADE_PAGE, was?.shown ?? 0) + MADE_PAGE })); return
    case 'memory-group': {
      await update($, memoryGroupAtom, () => action.group)
      await update($, memoryMenuAtom, () => null)
      await update($, memoryEditAtom, () => null)
      await update($, memoryShownAtom, () => 10)
      return
    }
    case 'memory-menu': await update($, memoryMenuAtom, () => action.file); await update($, memoryEditAtom, () => null); return
    case 'memory-edit': await update($, memoryEditAtom, () => action.file); return
    case 'memory-more': await update($, memoryShownAtom, () => action.shown); return
    case 'artifact-menu': await update($, artifactMenuAtom, () => action.key); return
    case 'open-file': await openFile($, action.path, action.reveal === true, surface); return
    case 'capture': await capture($, action.platform); return
    case 'filter': await update($, filterAtom, () => action.filter); return
    case 'expand': await update($, expandedAtom, () => action.entry); return
    case 'evidence': await update($, evidenceAtom, () => action.entry); return
    case 'fold':
      if (action.what === 'dropped') await update($, droppedOpenAtom, () => action.open)
      else if (action.what === 'held') await update($, heldOpenAtom, () => action.open)
      else if (action.what === 'docs') await update($, docsOpenAtom, () => action.open)
      else await update($, doneOpenAtom, () => action.open)
      return
    case 'tool-menu': await update($, toolMenuAtom, () => action.key); await update($, toolNamingAtom, () => null); return
    case 'tool-name': await update($, toolNamingAtom, () => action.key); return
    case 'tool-search': await update($, toolQueryAtom, () => action.query); return
    case 'tool-fold': await update($, toolsOpenAtom, (was) => {
      const list = new Set((((was as unknown) as string[] | null) ?? []))
      if (action.open) list.add(action.group); else list.delete(action.group)
      return [...list] as unknown as GemworksJson
    }); return
    case 'flow-state': await update($, flowStateAtom, () => action.id); return
    case 'session-open': await update($, openSessionAtom, () => action.id); return
    case 'sessions-more': await update($, sessionsAllAtom, () => action.all); return
    case 'pick-turn': {
      const was = ((await read($, pickedAtom)) as string[] | null) ?? []
      await update($, pickedAtom, () => (action.on ? (was.includes(action.id) ? was : [...was, action.id]) : was.filter((x) => x !== action.id)))
      return
    }
    case 'pick-clear': await update($, pickedAtom, () => [] as string[]); return
    case 'tidy': {
      await update($, tidyingAtom, () => action.on)
      if (!action.on) await update($, pickedAtom, () => [] as string[])
      return
    }
    case 'pick-after': {
      // Every turn after the newest one checked, but the one still running and those not yet known in the transcript.
      const [prompts, was] = await Promise.all([readPrompts($), read($, pickedAtom)])
      const checked = (was as string[] | null) ?? []
      const from = Math.max(...prompts.map((p, i) => (checked.includes(p.id) ? i : -1)))
      if (from < 0) return
      const live = (p: PromptRecord, i: number): boolean => i === prompts.length - 1 && p.did === undefined && p.backfilled !== true
      const after = prompts.filter((p, i) => i > from && !live(p, i)).map((p) => p.id)
      await update($, pickedAtom, () => [...checked, ...after.filter((id) => !checked.includes(id))])
      return
    }
    case 'decisions-more': await update($, decisionsShownAtom, () => action.shown); return
    case 'turns-more': await update($, turnsShownAtom, (n) => (typeof n === 'number' ? n : TURNS_SHOWN) + TURNS_SHOWN); return
    case 'session-flow': await update($, sessionFlowAtom, () => action.flow); return
    case 'session-run': await update($, sessionRunsAtom, (was) => {
      const list = new Set((((was as unknown) as string[] | null) ?? []))
      if (action.open) list.add(action.id); else list.delete(action.id)
      return [...list] as unknown as GemworksJson
    }); return
    // A turn unfolds the moment it is pressed (its answer reads in after), and the one unfolded before folds.
    case 'expand-turn': {
      await update($, expandedTurnAtom, () => (action.id === null ? null : { id: action.id, answer: null }) as unknown as GemworksJson)
      if (action.id === null) return
      const p = (await readPrompts($)).find((x) => x.id === action.id)
      const answer = p === undefined ? '' : (await answerOf($, p)) ?? ''
      await update($, expandedTurnAtom, (was) => (((was as unknown) as { id?: string } | null)?.id === action.id ? { id: action.id, answer } : was) as unknown as GemworksJson)
      return
    }
    default: break
  }
  const t = await words($)
  // A press that cannot be taken back asks first, with its own words.
  const confirm = 'confirm' in action ? action.confirm : undefined
  if (confirm !== undefined) {
    let answer: string
    try { answer = await $.ui.ask(confirm.question, [confirm.yes, t('取消')]) } catch { return }
    if (answer !== confirm.yes) return
  }
  const root = await read($, rootAtom)
  const through = async (op: BridgeOp, timeout = BRIDGE_TIMEOUT_MS): Promise<BridgeResponse | undefined> => {
    const res = await bridge($, op, timeout)
    if (res !== undefined && !res.ok) $.ui.toast(`gemworks：${res.error.replace(/^gemworks: /, '')}`)
    return res
  }
  switch (action.op) {
    // A person's option: taken on its own work item, then said into the conversation in their words, so the model hears what they chose.
    case 'advance': {
      const res = await bridge($, { op: 'advance', to: action.to }, BRIDGE_TIMEOUT_MS, action.file)
      if (res !== undefined && !res.ok) $.ui.toast(`gemworks：${res.error.replace(/^gemworks: /, '')}`)
      await loadBoard($)
      if (res?.ok === true && action.say !== undefined) await $.prompt.submit({ text: action.say, asUser: true })
      return
    }
    case 'mark': await through({ op: 'mark', variable: action.variable, checked: action.checked }); await loadBoard($); return
    case 'bind': await through({ op: 'bind', id: action.id }); await loadBoard($); return
    case 'pause': await through({ op: 'pause' }); await loadBoard($); return
    case 'resume': await through({ op: 'resume' }); await loadBoard($); return
    case 'refresh': await loadBoard($); return
    case 'learn':
      await through({ op: 'learn', lessons: action.lessons, tool: '', input: {}, cwd: root ?? '' })
      await update($, toolMenuAtom, () => null)
      await update($, toolNamingAtom, () => null)
      await loadBoard($)
      return
    case 'pass-once':
      await update($, passesAtom, (was) => [...new Set([...((((was as unknown) as string[] | null) ?? [])), ...action.keys])] as unknown as GemworksJson)
      $.ui.toast(t('放行一次'))
      return
    case 'retry': await startBridge($); await loadBoard($); return
    // Going back is the person's, asked once more: the recorded state changes, nothing that was done is undone.
    case 'rollback': {
      const state = (await readBoard($))?.timeline.find((e) => e.kind === 'snapshot' && e.rev === action.rev)
      const where = state !== undefined && state.kind === 'snapshot' ? state.state : '?'
      let answer: string
      try { answer = await $.ui.ask(t('回到第 {0} 条修订（{1}）？只改记下的阶段和变量，已经做了的事不会撤销。', action.rev, where), [t('回到这里'), t('取消')]) } catch { return }
      if (answer !== t('回到这里')) return
      await update($, expandedAtom, () => null)
      await through({ op: 'rollback', rev: action.rev })
      await loadBoard($)
      return
    }
    case 'check-update': await update($, latestAtom, () => null); await checkLatest($); return
    case 'new-item': {
      const res = await through({ op: 'new-item', path: action.path, title: action.title, text: action.text })
      if (res?.ok === true) {
        $.ui.toast(t('已记成事项'))
        if (action.dismiss !== undefined) await act($, { op: 'dismiss', key: action.dismiss }, surface)
      }
      await loadBoard($)
      return
    }
    case 'judge-yes': {
      const j = (await read($, judgedAtom)) as unknown as Judgement | null
      if (j === null || j.taken) return
      const undo = await takeOption($, j.option)
      await update($, judgedAtom, () => ({ ...j, taken: true, ...(undo !== undefined ? { undo } : {}) }) as unknown as GemworksJson)
      return
    }
    case 'judge-pick': {
      const j = (await read($, judgedAtom)) as unknown as Judgement | null
      const pick = j?.alternatives?.[action.n - 1]
      if (j === null || j.taken || pick === undefined) return
      const undo = await takeOption($, pick)
      await update($, judgedAtom, () => ({ ...j, option: pick, alternatives: [], taken: true, ...(undo !== undefined ? { undo } : {}) }) as unknown as GemworksJson)
      return
    }
    case 'judge-no': await update($, judgedAtom, () => null); return
    case 'judge-undo': {
      const j = (await read($, judgedAtom)) as unknown as Judgement | null
      await update($, judgedAtom, () => null)
      if (j?.undo === undefined) return
      const res = await bridge($, { op: 'rollback', rev: j.undo.rev }, BRIDGE_TIMEOUT_MS, j.undo.file)
      await loadBoard($)
      $.ui.toast(res?.ok === true ? t('已撤销') : `gemworks：${res !== undefined && !res.ok ? res.error.replace(/^gemworks: /, '') : t('撤销')}`)
      return
    }
    case 'dismiss':
    case 'undismiss': {
      const was = await dismissedOf($)
      const next = action.op === 'dismiss' ? [...new Set([...was, action.key])] : was.filter((k) => k !== action.key)
      await update($, dismissedAtom, () => next as unknown as GemworksJson)
      try { await $.store.set(`dismissed:${root ?? ''}`, next as unknown as GemworksJson) } catch { /* the session keeps its own */ }
      return
    }
    case 'flow-switch': {
      await update($, flowSwitchAtom, () => action.open)
      if (action.open && (await read($, workflowsAtom)) === null) await loadWorkflows($)
      return
    }
    case 'export': {
      // A session's record as GEML, where the person says: asked in the engine's own dialog, a folder or a file typed under
      // Other as a path. Nothing to export says so before asking; a dismissed dialog does nothing. The file is linked under the session.
      const t = await words($)
      const which = action.session
      // A press takes the last export's line away: what stands under a session after it is what this press wrote, if anything.
      await update($, exportedAtom, () => null)
      const other = which === 'own' ? undefined : await otherSessionText($, which)
      const s = which === 'own' ? await sessionText($, 'geml') : other
      if (s === undefined) return
      // The places offered: the home's Downloads and desktop where it has them, the project's exports, else the home itself.
      const home = (await $.env.get('HOME').catch(() => undefined)) ?? (await $.env.get('USERPROFILE').catch(() => undefined))
      const has = async (dir: string): Promise<boolean> => home !== undefined && (await $.fs.exists(`${home}/${dir}`).catch(() => false))
      const [downloads, desktop] = await Promise.all([has('Downloads'), has('Desktop')])
      const places: (readonly [string, string | undefined])[] = [
        ...(downloads ? [[t('下载 ~/Downloads'), '~/Downloads'] as const] : []),
        ...(desktop ? [[t('桌面 ~/Desktop'), '~/Desktop'] as const] : []),
        [t('本项目 .geml/exports/'), undefined],
      ]
      // The dialog takes two options at least.
      if (places.length < 2) places.push([t('主目录 ~'), '~'])
      const question = other !== undefined ? t('把会话「{0}」导出到哪？', other.label) : t('把本会话导出到哪？')
      let answer: string
      try { answer = (await $.ui.ask(question, { options: places.map(([label]) => label), header: t('导出') })).trim() } catch { return }
      const place = places.find(([label]) => label === answer)
      // The desktop dialog answers a skip, a dismissal or a message sent instead with sentences of its own ("[No preference]"),
      // not a rejection. So typed text is a place only when shaped like a path — absolute, from the home, or from here —
      // never by matching those sentences, which belong to the host and to whatever language and version it is.
      if (place === undefined && !/^(?:~(?:$|[\\/])|\.{1,2}[\\/]|[\\/]|[A-Za-z]:[\\/])/.test(answer)) return
      const to = place !== undefined ? place[1] : answer
      await update($, exportedForAtom, () => which)
      await exportText($, 'text', 'geml', { name: s.name, text: s.text, ...(to !== undefined ? { to } : {}) })
      return
    }
    case 'dialog': await openDialog($, action.dialog); return
    case 'open-board': {
      $.clock.after(0, () => { void loadMemory($) })
      const expand = action.expand
      if (expand !== undefined) await update($, manualExpandedAtom, () => [...expand])
      const opened = await openBoard($, action.tab)
      if (!opened.isPlaced) $.ui.toast(boardText(opened.reason))
      return
    }
    case 'use': await through({ op: 'use', workflow: action.workflow }, SLOW_TIMEOUT_MS); await loadWorkflows($); await loadBoard($); return
    case 'add': {
      const res = await through({ op: 'add', workflow: action.workflow }, SLOW_TIMEOUT_MS)
      if (res?.ok && res.added !== undefined) $.ui.toast(t('已添加 {0}', res.added.name))
      await loadWorkflows($); await loadBoard($)
      return
    }
    case 'import': {
      const res = await through({ op: 'import', path: action.path }, SLOW_TIMEOUT_MS)
      if (res?.ok && res.added !== undefined) $.ui.toast(t('已导入 {0}', res.added.name))
      await loadWorkflows($); await loadBoard($)
      return
    }
    case 'setting': {
      const next = withSetting(await readSettings($), action.key, action.value)
      await update($, settingsAtom, () => next as unknown as GemworksJson)
      try { await $.store.set(STORE_SETTINGS, next) } catch { /* read-only store */ }
      return
    }
    // The plugin's own prompt does not pass its own prompt.submit hook: the band's moment ends here.
    case 'say': {
      // A card put away goes first, so it leaves at once rather than showing the press under way.
      if (action.dismiss !== undefined) await act($, { op: 'dismiss', key: action.dismiss }, surface)
      if (action.toast !== undefined) $.ui.toast(action.toast)
      await setQueued($, (q) => [...q.filter((x) => x.text !== action.text), { text: action.text, entered: false }])
      await attentionOnPrompt($, action.text, false)
      try {
        await $.prompt.submit({ text: action.text, asUser: true })
      } catch (err) {
        await setQueued($, (q) => q.filter((x) => x.text !== action.text))
        throw err
      }
      // A press whose card was put away leaves nothing to show under way: brought back, the card offers its buttons again.
      await setQueued($, (q) => (action.dismiss !== undefined ? q.filter((x) => x.text !== action.text) : q.map((x) => (x.text === action.text ? { ...x, entered: true } : x))))
      // What the press decided goes into the record as the person's own, under the turn its prompt opened.
      if (action.decisions !== undefined && action.decisions.length > 0) {
        const decided = action.decisions
        const at = await nowIso($)
        const events = await appendOwn($, (so) => decided.map((text): SessionEvent => ({ t: 'decision', turn: currentTurn(so), at, text })))
        if (events.length > 0) await loadProjectSessions($)
      }
      return
    }
    // One of several asks answered: kept, the band moves to the next; the last answer says them all as the person's prompt.
    case 'pick': {
      const a = await readAttention($)
      if (a === null || a.consumed) return
      const asks = (a.asks ?? []).map((q) => q.question)
      if (asks.length === 0) return
      const picks = asks.map((_, i) => (i === action.index ? action.answer : a.picks?.[i] ?? null))
      if (picks.some((p) => p === null)) { await update($, attentionAtom, () => ({ ...a, picks }) as unknown as GemworksJson); return }
      await update($, attentionAtom, () => ({ ...a, picks }) as unknown as GemworksJson)
      const decided = asks.flatMap((q, i) => { const p = picks[i]; return typeof p === 'string' && !isDeferral(p) ? [`${q}：${p}`] : [] })
      await act($, { op: 'say', text: picksText(asks, picks), ...(decided.length > 0 ? { decisions: decided } : {}) }, surface)
      return
    }
    // A slash command, run as typed once the session is idle; where the engine will not run it, it waits in the prompt box for Enter.
    case 'command': {
      const typed = `/${action.command}`
      await setQueued($, (q) => [...q.filter((x) => x.text !== typed), { text: typed, entered: false }])
      try {
        const ran = await $.command.run({ command: action.command })
        // The engine runs it, and may say it cannot here (a remote connection): not offered again this session.
        if (action.command === 'reload-plugins' && /not available|isn't available|unavailable/i.test((ran as { text?: string } | undefined)?.text ?? '')) {
          await update($, reloadUnavailableAtom, () => true)
          $.ui.toast(t('要在本机重载插件'))
        }
      } catch {
        const filled = await $.prompt.fill({ text: typed }).catch(() => undefined)
        $.ui.toast(filled?.isFilled === true ? t('回车执行 {0}', typed) : `gemworks：${typed}`)
      }
      await setQueued($, (q) => q.filter((x) => x.text !== typed))
      return
    }
    case 'copy': {
      const r = await $.ui.copy({ text: action.text, ...(surface !== undefined ? { surface: surface as never } : {}) })
      $.ui.toast(r.isCopied ? t('已复制') : `gemworks：${r.reason}`)
      return
    }
    case 'switch-file': {
      await update($, lastFileAtom, () => action.file)
      const res = await through({ op: 'status' })
      await loadBoard($)
      // Coming back to a work item is the person's word too: the model hears which one.
      if (res?.ok === true && action.say !== undefined) await $.prompt.submit({ text: action.say, asUser: true })
      return
    }
    case 'use-decision': {
      const filled = await $.prompt.fill({ text: `${t('参照 {0}：{1}', action.from, action.text)}\n`, mode: 'insert' }).catch(() => undefined)
      if (filled?.isFilled !== true) $.ui.toast(t('放不进输入框'))
      return
    }
    // The conversation scrolls to the prompt's row, by the id the host gave it (session.append); a press is the person's own input, which is when a transcript row may move.
    case 'locate': {
      const p = (await readPrompts($)).find((x) => x.id === action.id)
      // The desktop app draws the conversation itself and no plugin scrolls it: the turn unfolds on the session tab instead.
      if (surface !== undefined && surface !== 'terminal') {
        if (p === undefined) return
        const answer = (await answerOf($, p)) ?? ''
        await update($, expandedTurnAtom, () => ({ id: p.id, answer }) as unknown as GemworksJson)
        await update($, tabAtom, () => 'sessions')
        return
      }
      if (p?.uuid === undefined) { $.ui.toast(t('这条 prompt 在对话里的位置还不知道')); return }
      let deny: string | undefined
      try { deny = (await $.ui.scroll({ to: { requestId: p.uuid }, block: 'start' })).deny } catch (err) { deny = reasonOf(err) }
      if (deny !== undefined) $.ui.toast(t('对话没有滚到那一处：{0}', deny))
      return
    }
    // One memory's hook rewritten, or the memory taken out after a yes: the bridge answers the memory as it now stands.
    case 'memory-set':
    case 'memory-delete': {
      const list = (await read($, memoryAtom)) as MemoryList | null
      const title = list?.entries.find((x) => x.file === action.file)?.title ?? action.file
      if (action.op === 'memory-delete') {
        let answer: string
        try { answer = await $.ui.ask(t('删除「{0}」？会先放进回收站；下一个会话起不再读它。', title), [t('删除'), t('取消')]) } catch { return }
        if (answer !== t('删除')) return
      }
      const res = await bridge($, action.op === 'memory-set' ? { op: 'memory-set', file: action.file, hook: action.hook } : { op: 'memory-delete', file: action.file }, SLOW_TIMEOUT_MS)
      if (res === undefined || !res.ok || res.memory === undefined) { $.ui.toast(t('没改成：{0}', res !== undefined && !res.ok ? res.error : title)); return }
      const memory = res.memory
      await update($, memoryAtom, () => memory)
      await update($, memoryEditAtom, () => null)
      if (action.op === 'memory-delete') await update($, memoryMenuAtom, () => null)
      $.ui.toast(action.op === 'memory-set' ? t('已改：{0}。下一个会话起生效', title) : t('已删除：{0}。下一个会话起生效', title))
      return
    }
    // The checked turns, named to the script by their record ids so the model matches nothing by hand: one new session, or gone.
    case 'split-picked': {
      const [known, was] = await Promise.all([readPrompts($), read($, pickedAtom)])
      const checked = (was as string[] | null) ?? []
      // A message typed mid-turn has no row id of its own until the transcript is read: learned from its queued record (same words, near in time).
      let prompts = known
      const unknown = known.filter((p) => checked.includes(p.id) && p.uuid === undefined)
      if (unknown.length > 0) {
        const session = await $.session.id().catch(() => '')
        const res = session !== '' ? await bridge($, { op: 'turn-ids', session }, SLOW_TIMEOUT_MS).catch(() => undefined) : undefined
        const messages = res !== undefined && res.ok && res.backfill !== undefined && 'uuids' in res.backfill ? res.backfill.messages ?? [] : []
        const used = new Set(known.flatMap((p) => (p.uuid !== undefined ? [p.uuid] : [])))
        const learned = new Map<string, string>()
        for (const p of unknown) {
          const near = messages.filter((m) => !used.has(m.uuid) && m.text.trim() === p.text.trim() && Math.abs(Date.parse(m.at) - Date.parse(p.at)) < QUEUED_MATCH_MS)
            .sort((a, b) => Math.abs(Date.parse(a.at) - Date.parse(p.at)) - Math.abs(Date.parse(b.at) - Date.parse(p.at)))[0]
          if (near !== undefined) { learned.set(p.id, near.uuid); used.add(near.uuid) }
        }
        if (learned.size < unknown.length) { $.ui.toast(t('有 {0} 条在对话记录里找不到，没有交给模型', unknown.length - learned.size)); return }
        const withIds = (list: PromptRecord[]): PromptRecord[] => list.map((p) => (learned.has(p.id) ? { ...p, uuid: learned.get(p.id) as string } : p))
        await update($, promptsAtom, (w) => withIds(((w as unknown) as PromptRecord[] | null) ?? []) as unknown as GemworksJson)
        $.clock.after(0, () => { void storePrompts($) })
        prompts = withIds(known)
      }
      const picked = prompts.filter((p) => checked.includes(p.id) && p.uuid !== undefined)
      if (picked.length === 0) return
      const n = picked.length
      const question = action.remove ? t('删除选中的 {0} 轮？会先备份，可恢复；重启应用后才看不到。', n) : t('把选中的 {0} 轮拆到一个新会话？会先备份；重启应用后生效。', n)
      const yes = action.remove ? t('删除') : t('拆分')
      let answer: string
      try { answer = await $.ui.ask(question, [yes, t('取消')]) } catch { return }
      if (answer !== yes) return
      const script = `${$.plugin.root}/skills/split-session/split-session.mjs`
      const uuids = picked.map((p) => p.uuid as string).join(',')
      const lines = picked.map((p) => `${hhmm(p.at)}「${promptLine(p.text, 40)}」`).join('、')
      const text = action.remove
        ? t('用 gemworks:split-session skill（脚本 {0}）：用 remove --uuids {1} 删掉这 {2} 轮：{3}（不建新会话）。先加 --dry-run 核对是这几轮，再删；删完再 list 核对，然后汇报。', script, uuids, n, lines)
        : t('用 gemworks:split-session skill（脚本 {0}）：用 split --uuids {1} 把这 {2} 轮拆到一个新会话：{3}。标题概括这些轮的内容。先加 --dry-run 核对是这几轮，再拆；拆完再 list 核对，然后汇报。', script, uuids, n, lines)
      await update($, pickedAtom, () => [] as string[])
      await $.prompt.submit({ text })
      $.ui.toast(t('已交给模型，结果看对话'))
      return
    }
    // Moving turns out of the session is the split-session skill's work, done by the model in a turn of its own: the person says yes here, the prompt names the turn by its time and first line and the skill's script by its path.
    case 'split':
    case 'remove': {
      const p = (await readPrompts($)).find((x) => x.id === action.id)
      if (p === undefined) return
      const question = action.op === 'split' ? t('把这一轮及之后的轮次拆到新会话？最后一轮留下，会先备份；重启应用后生效。') : t('删除这一轮？会先备份，可恢复；重启应用后才看不到。')
      const yes = action.op === 'split' ? t('拆分') : t('删除')
      let answer: string
      try { answer = await $.ui.ask(question, [yes, t('取消')]) } catch { return }
      if (answer !== yes) return
      const script = `${$.plugin.root}/skills/split-session/split-session.mjs`
      const line = promptLine(p.text, 60)
      const text = action.op === 'split'
        ? t('用 gemworks:split-session skill（脚本 {0}）：先 list，找到 {1} 发的「{2}」那一轮，把它和之后的轮次（最后一轮除外）拆到新会话，标题概括这些轮的内容；拆完再 list 核对，然后汇报。', script, hhmm(p.at), line)
        : t('用 gemworks:split-session skill（脚本 {0}）：先 list，找到 {1} 发的「{2}」那一轮，用 remove 只删掉这一轮（不建新会话）；删完再 list 核对，然后汇报。', script, hhmm(p.at), line)
      await $.prompt.submit({ text })
      $.ui.toast(t('已交给模型，结果看对话'))
      return
    }
    case 'close-item': {
      const where = action.worktree !== undefined ? t('worktree {0} 和分支 {1}', action.worktree, action.id) : t('分支 {0}', action.id)
      let answer: string
      try { answer = await $.ui.ask(t('删掉 {0}？提交都在 main 里才删，远端分支不动。', where), [t('收尾'), t('取消')]) } catch { return }
      if (answer !== t('收尾')) return
      const steps = action.worktree !== undefined
        ? t('收尾工作项 {0}：先用 git branch --merged 确认它的提交都在 main 里；再 git worktree remove {1}（不加 --force，有没提交的改动就停下告诉我）；然后 git branch -d {0}（用 -d，不用 -D）；远端分支不动。做完汇报。', action.id, action.worktree)
        : t('收尾工作项 {0}：先用 git branch --merged 确认它的提交都在 main 里；然后 git branch -d {0}（用 -d，不用 -D）；远端分支不动。做完汇报。', action.id)
      await $.prompt.submit({ text: steps })
      $.ui.toast(t('已交给模型，结果看对话'))
      return
    }
    case 'share': await share($, action.what, action.how, action.strip, surface, action.flow); return
    // A pick in the share dialog changes the dialog, nothing else.
    case 'share-pick': {
      const { op: _op, ...pick } = action
      await update($, shareAtom, (was) => ({ ...(((was as unknown) as Record<string, unknown> | null) ?? { what: 'status', how: 'copy', strip: true }), ...pick }) as unknown as GemworksJson)
      return
    }
    default: return
  }
}
