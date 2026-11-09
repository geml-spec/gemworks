// Gemworks's Claude Code shell. This module runs with no Node and no DOM: from
// the latest policy snapshot it decides whether a tool call can matter to the
// workflow, and asks the bundled CLI (dist/gemworks.mjs: one JSON request on
// stdin, one JSON answer on stdout) only when it can. It never writes a
// project file — journals, .geml/context.geml, the dictionary, the backlog and
// the exports belong to the CLI, which writes them under locks. Gemworks fails
// open: when Node is missing, the bridge fails or times out, or an answer does
// not parse, the call goes through, nothing is recorded, and the band says
// what is wrong; a start that got no answer is tried again by a later tool
// call, prompt or /gemworks, at most once a minute. Each tool call carries the
// directory it starts in, and one that may act in another checkout (a
// worktree, another repository) always goes to the bridge, which attributes
// it to that checkout's work item; the band stays on the session's. A
// main-loop call carries the stage the main loop last read, so an answer on
// another work item (a branch switch, another episode) hands that item over
// in the result. A call no row of the dictionary takes goes through: whether
// it is safe is Claude Code's permission system's call, not the workflow's.
// The one question asked here, with $.ui.ask, is about a tool that is not its
// use's preferred one; the answer goes through the bridge into the dictionary.
//
// What the person sees (spec §8): the band above the prompt — the G mark, the
// words, the one or two actions the moment needs, the pending count — and the
// board's six tabs, each drawn from the pure modules under
// src/hosts/claude-code/ and run through `act`. The settings live in the
// plugin's store; the words follow the chosen language.
import type { EngineInterface, Register, ToolCallResult } from 'claude-code'
import { atom, read, update } from 'claude-code'
import type { GemworksJson, GemworksTab } from '../types'
import { preferAnswer, preferQuestion } from '../dist/core/asking.js'
import type { Answered } from '../dist/core/asking.js'
import { CLAUDE_CODE_TOOLS } from '../dist/core/host-tools.js'
import { commitMessageFiles } from '../dist/core/commit-message.js'
import { FLOW_TOOLS } from '../dist/core/verb-specs.js'
import type { VerbName } from '../dist/core/verb-specs.js'
import type { BoardAction, BoardTab, Dialog, JournalFilter, Pressable, ShareHow, ShareWhat } from '../dist/hosts/claude-code/actions.js'
import { answered, asksAfterTurn, bandLine, heldSteps, leadOf, newsOf, NO_FACTS, NO_MEMORY, nowRows, openAfter, pendingNote, pressablesFor, pressedOf, remember, standingOf, stepPressables } from '../dist/hosts/claude-code/attention.js'
import type { Queued } from '../dist/hosts/claude-code/attention.js'
import type { AttentionFacts, AttentionMemory } from '../dist/hosts/claude-code/attention.js'
import { envParts, remoteInPlay } from '../dist/hosts/claude-code/env.js'
import { captureHint, offersCapture } from '../dist/hosts/claude-code/screenshot.js'
import { appendEvents, currentTurn, decisionsContext, decisionsSince, formatLog, isLogName, isStatusLine, legacyLogName, logName, nextTurn, NOTE_TOOL, parseLog, SAME_PROMPT_MS, SESSIONS_GITIGNORE, SESSIONS_PROMPT, summarize, withEarlierTurns } from '../dist/core/session-log.js'
import type { SessionEvent, SessionSummary } from '../dist/core/session-log.js'
import { flowRequest, labelRequest, linkKey, promptId, readFlowDraft, readLabels, readThemes, themeRequest, typedWords } from '../dist/core/corrections.js'
import type { LabelledPrompt } from '../dist/core/corrections.js'
import { ARTIFACT_TOOL, isMadeForPeople, publishedLink } from '../dist/core/artifact-tool.js'
import { ASK_PROMPT, ASK_TOOL, askedOf } from '../dist/core/ask-tool.js'
import { COACH_FLOWS, coachBand, goneOnAfterTurn, itemProgress, readCoachFlow, stripText, turnItem, turnWords, WORK_REMINDER, WORK_TOOL, workContext, workEvents, workItemsOf, workPrompt } from '../dist/hosts/claude-code/coach.js'
import type { CoachFlow, CoachFocus, Doing, GoneOn, WorkGroup, WorkItem } from '../dist/hosts/claude-code/coach.js'
import { memoryMoveContext, PRACTICE_PROMPT, PRACTICE_TOOL, practiceContext } from '../dist/hosts/claude-code/practice.js'
import { isNew, newPractices, type Practice } from '../dist/core/practices.js'
import { expireEvent, expiring, exportText as flowExport, flowText, GROWTH_PROMPT, isRulesFile, newProposals, parseProposals, parseRules, PROPOSE_TOOL, proposalsText, RULE_TOOL, ruleRefusal, rulesText, skippedSteps, type Proposal, type Rule } from '../dist/hosts/claude-code/growth.js'
import { keysOf } from '../dist/core/dictionary.js'
import { isVisualTool, visualFileName, visualPage } from '../dist/hosts/claude-code/visual.js'
import { transcriptEvents, type Transcript } from '../dist/core/transcript.js'
import type { Asked } from '../dist/core/ask-tool.js'
import type { AttachedClient, HostInfo } from '../dist/hosts/claude-code/env.js'
import { baseName, openersFor } from '../dist/hosts/claude-code/open-file.js'
import { bandView, BRAND_RED, cellWidth, MARK, MARK_SVG, SEP, toneProps, truncate, wrapCells } from '../dist/hosts/claude-code/band.js'
import type { BandView, Tone } from '../dist/hosts/claude-code/band.js'
import { BOARD_ID, ciSuggestions, DIALOG_ID, glyphSvg, heldRows, HOME_TAB, hostName, ICON_CHAR, ICON_SVG, ICON_TONE, inputAction, paneRows, projectPath, sessionLabel, TAB_IDS, tabs, toolSuggestions } from '../dist/hosts/claude-code/board.js'
import type { BoardRow, FlowEdgeRow, Glyph, Icon } from '../dist/hosts/claude-code/board.js'
import { boardFailure, boardText, COMMAND_HINT, commandText, parseCommand, traceText } from '../dist/hosts/claude-code/command.js'
import { afterNeeded, beforeDecision, checkoutProbe, isOwnTool, matchesUnit, paramsToFill } from '../dist/hosts/claude-code/fastpath.js'
import type { BeforeDecision, CallFacts } from '../dist/hosts/claude-code/fastpath.js'
import { inboxItems, othersWaiting, pendingList, shortReason } from '../dist/hosts/claude-code/inbox.js'
import type { InboxItem } from '../dist/hosts/claude-code/inbox.js'
import { BRIDGE_TIMEOUT_MS, decodeResponse, encodeRequest, SLOW_TIMEOUT_MS, unreadableText } from '../dist/hosts/claude-code/protocol.js'
import type { BoardData, BridgeOp, BridgeRequest, BridgeResponse, CorrectionsView, ShellStatus, TodoCount } from '../dist/hosts/claude-code/protocol.js'
import { bashExitCode, bridgeInput, contextOf, hasGitOperation, nodeMajor, toolArgs, touchedPath, writtenPath } from '../dist/hosts/claude-code/readers.js'
import { answerGist, logExport, promptLine, sessionExport } from '../dist/hosts/claude-code/sessions.js'
import type { PromptRecord } from '../dist/hosts/claude-code/sessions.js'
import type { TurnMoved } from '../dist/hosts/claude-code/board.js'
import { MADE_VIEW, type MadeView } from '../dist/hosts/claude-code/made.js'
import type { MadeAll } from '../dist/hosts/claude-code/protocol.js'
import type { MemoryList } from '../dist/memory-store.js'
import { fitToBudget, stepDown } from '../dist/hosts/claude-code/budget.js'
import { hhmm } from '../dist/hosts/claude-code/time.js'
import { dayKey, mergeBooks, noteUse, pruneBook, usageKeys, usesSince } from '../dist/hosts/claude-code/usage.js'
import type { UsageBook } from '../dist/hosts/claude-code/usage.js'
import { DEFAULT_SETTINGS, settingsFrom } from '../dist/hosts/claude-code/settings.js'
import type { Settings } from '../dist/hosts/claude-code/settings.js'
import { statusShareText } from '../dist/hosts/claude-code/share.js'
import { HEADER_LOCKUP, LOCKUP_SVG } from '../dist/hosts/claude-code/brand.js'
import { isNewer, releaseNotesOf } from '../dist/hosts/claude-code/release-notes.js'
import { waitingNotices } from '../dist/hosts/claude-code/notices.js'
import { asksJudgeRequest, judgementLine, judgeOptions, judgeRequest, JUDGEMENT_MS, readAsksJudgement, readJudgement } from '../dist/hosts/claude-code/judge.js'
import type { Judgement, JudgeOption } from '../dist/hosts/claude-code/judge.js'
import { langOf, wordsFor } from '../dist/hosts/claude-code/text.js'
import type { T } from '../dist/hosts/claude-code/text.js'
import { act } from './act.tsx'

const shellAtom = atom({ plugin: 'gemworks', key: 'shell' } as const, null as GemworksJson)
const problemAtom = atom({ plugin: 'gemworks', key: 'problem' } as const, null as string | null)
const nodeAtom = atom({ plugin: 'gemworks', key: 'node' } as const, null as string | null)
const rootAtom = atom({ plugin: 'gemworks', key: 'root' } as const, null as string | null)
const deliveredAtom = atom({ plugin: 'gemworks', key: 'delivered' } as const, null as string | null)
/** Whether this conversation was told about the other sessions and the ask tool through a prompt's context: once, then again after a /clear or a compaction. */
const toldAtom = atom({ plugin: 'gemworks', key: 'told' } as const, false as boolean)
/** Whether prompt.compose ran this session: then the system prompt carries those instructions itself, every turn, and no prompt need. */
const composedAtom = atom({ plugin: 'gemworks', key: 'composed' } as const, false as boolean)
/** Whether a plugin above gemworks keeps prompt.compose (probed once a session: true cut, false reaching, null not known). */
const composeCutAtom = atom({ plugin: 'gemworks', key: 'composeCut' } as const, null as boolean | null)
const lastFileAtom = atom({ plugin: 'gemworks', key: 'lastFile' } as const, null as string | null)
const boardAtom = atom({ plugin: 'gemworks', key: 'board' } as const, null as GemworksJson)
const tabAtom = atom({ plugin: 'gemworks', key: 'tab' } as const, HOME_TAB as GemworksTab)
const doneOpenAtom = atom({ plugin: 'gemworks', key: 'doneOpen' } as const, false)
/** Whether the work items tab lists the dropped work items, or only counts them. */
const droppedOpenAtom = atom({ plugin: 'gemworks', key: 'droppedOpen' } as const, false)
/** Whether 此刻 lists the branches and pull requests held back (已暂缓), or only counts them. */
const heldOpenAtom = atom({ plugin: 'gemworks', key: 'heldOpen' } as const, false)
const artifactMenuAtom = atom({ plugin: 'gemworks', key: 'artifactMenu' } as const, null as string | null)
const docsOpenAtom = atom({ plugin: 'gemworks', key: 'docsOpen' } as const, false)
/** 全部产物: every artifact the project's work made, as the bridge last read it; how the list stands. */
const madeAllAtom = atom({ plugin: 'gemworks', key: 'madeAll' } as const, null as GemworksJson)
const madeViewAtom = atom({ plugin: 'gemworks', key: 'madeView' } as const, MADE_VIEW as { kind: string; shown: number; item: string | null })
const madeElsewhereAtom = atom({ plugin: 'gemworks', key: 'madeElsewhere' } as const, [] as string[])
/** The project paths this turn wrote, made for a person: with no workflow journal to hold them, what the turn's end versions. */
const madeHereAtom = atom({ plugin: 'gemworks', key: 'madeHere' } as const, [] as string[])
/** Files handed to git commit as its message this turn: not artifacts, taken out again at the turn's end. */
const notMadeAtom = atom({ plugin: 'gemworks', key: 'notMade' } as const, [] as string[])
/** The questions the model registered this turn (the ask tool): the band's once the turn ends. */
const askedAtom = atom({ plugin: 'gemworks', key: 'asked' } as const, [] as Asked[])
/** The questions the person's last prompt left open: the next reply's band asks them again, after its own. */
const leftAsksAtom = atom({ plugin: 'gemworks', key: 'leftAsks' } as const, [] as Asked[])
/** The questions answered since the last reply: a reply that registers one again, not having seen the answer (it waited in the queue), does not ask it again. */
const answeredAtom = atom({ plugin: 'gemworks', key: 'answered' } as const, [] as string[])
const flowStateAtom = atom({ plugin: 'gemworks', key: 'flowState' } as const, null as string | null)
const flowSwitchAtom = atom({ plugin: 'gemworks', key: 'flowSwitch' } as const, false)
const toolQueryAtom = atom({ plugin: 'gemworks', key: 'toolQuery' } as const, '')
const toolMenuAtom = atom({ plugin: 'gemworks', key: 'toolMenu' } as const, null as string | null)
const toolNamingAtom = atom({ plugin: 'gemworks', key: 'toolNaming' } as const, null as string | null)
const toolsOpenAtom = atom({ plugin: 'gemworks', key: 'toolsOpen' } as const, [] as GemworksJson)
/** The usage book as last stored (null before it is read), and what this session added since. */
const usageBookAtom = atom({ plugin: 'gemworks', key: 'usageBook' } as const, null as GemworksJson)
const usagePendingAtom = atom({ plugin: 'gemworks', key: 'usagePending' } as const, {} as GemworksJson)
const dismissedAtom = atom({ plugin: 'gemworks', key: 'dismissed' } as const, null as GemworksJson)
/** The last turn's judgement (Judgement), or null. */
const judgedAtom = atom({ plugin: 'gemworks', key: 'judged' } as const, null as GemworksJson)
/** The work item's to-do count as the last refresh or board answer carried it (spec §7.2); null when that work item is no media entry. */
const todoAtom = atom({ plugin: 'gemworks', key: 'todo' } as const, null as GemworksJson)
/** Why the last board request brought no board; null when it did. */
const boardProblemAtom = atom({ plugin: 'gemworks', key: 'boardProblem' } as const, null as string | null)
/** A tool or command this session would not register: kept for the whole session, unlike the bridge's problem. */
const setupAtom = atom({ plugin: 'gemworks', key: 'setup' } as const, null as string | null)
/** When the bridge was last started (Node found, the first status asked), in $.clock.now()'s milliseconds. */
const startedAtAtom = atom({ plugin: 'gemworks', key: 'startedAt' } as const, null as number | null)
const passesAtom = atom({ plugin: 'gemworks', key: 'passes' } as const, [] as GemworksJson)
const preferPassedAtom = atom({ plugin: 'gemworks', key: 'preferPassed' } as const, [] as GemworksJson)
const promptsAtom = atom({ plugin: 'gemworks', key: 'prompts' } as const, [] as GemworksJson)
/** The sessions this one carries on, newest first: the app started it from them (a rewind, a fork). Their work items are its own. */
const sessionLineAtom = atom({ plugin: 'gemworks', key: 'sessionLine' } as const, [] as string[])
const sessionFlowAtom = atom({ plugin: 'gemworks', key: 'sessionFlow' } as const, null as string | null)
const sessionRunsAtom = atom({ plugin: 'gemworks', key: 'sessionRuns' } as const, [] as GemworksJson)
const filterAtom = atom({ plugin: 'gemworks', key: 'filter' } as const, 'all')
const expandedAtom = atom({ plugin: 'gemworks', key: 'expanded' } as const, null as string | null)
const evidenceAtom = atom({ plugin: 'gemworks', key: 'evidence' } as const, null as string | null)
const dialogAtom = atom({ plugin: 'gemworks', key: 'dialog' } as const, null as string | null)
const settingsAtom = atom({ plugin: 'gemworks', key: 'settings' } as const, null as GemworksJson)
const latestAtom = atom({ plugin: 'gemworks', key: 'latest' } as const, null as GemworksJson)
const notifiedAtom = atom({ plugin: 'gemworks', key: 'notified' } as const, {} as GemworksJson)
const seenInboxAtom = atom({ plugin: 'gemworks', key: 'seenInbox' } as const, null as GemworksJson)
/** What a turn's end told the desktop of (notices.ts keys): a question, a work item at the person's step; each once. */
const notifiedWaitingAtom = atom({ plugin: 'gemworks', key: 'notifiedWaiting' } as const, [] as string[])
const localeAtom = atom({ plugin: 'gemworks', key: 'locale' } as const, null as string | null)
const workflowsAtom = atom({ plugin: 'gemworks', key: 'workflows' } as const, null as GemworksJson)
const shareAtom = atom({ plugin: 'gemworks', key: 'share' } as const, { what: 'status', how: 'copy', strip: true } as GemworksJson)
const versionAtom = atom({ plugin: 'gemworks', key: 'version' } as const, null as string | null)
/** The band's attention (attention.ts): the last reply, when it came, the prompt it answered, and what the band remembers. */
const attentionAtom = atom({ plugin: 'gemworks', key: 'attention' } as const, null as GemworksJson)
/** The repository as the bridge last read it for the band: branches ahead of their upstream, open pull requests. */
const factsAtom = atom({ plugin: 'gemworks', key: 'facts' } as const, null as GemworksJson)
/** The facts when the last reply ended: what changed since is news for the model. */
const factsAtReplyAtom = atom({ plugin: 'gemworks', key: 'factsAtReply' } as const, null as GemworksJson)
/** A command changed the plugin's own folder since it was loaded. */
const reloadAtom = atom({ plugin: 'gemworks', key: 'reload' } as const, false)
/** The engine said `/reload-plugins` cannot run in this session (a remote connection): no button offers it. */
const reloadUnavailableAtom = atom({ plugin: 'gemworks', key: 'reloadUnavailable' } as const, false)
/** The machine and checkout the session runs on, as the bridge read them ({ name, platform, user, branch }). */
const hostAtom = atom({ plugin: 'gemworks', key: 'host' } as const, null as GemworksJson)
/** The clients attached to the session (session.attach): [{ clientId, surface }]. */
const clientsAtom = atom({ plugin: 'gemworks', key: 'clients' } as const, [] as GemworksJson)
/** Where the last prompt came from: composer (this machine), bridge (Remote Control), sdk. */
const originAtom = atom({ plugin: 'gemworks', key: 'origin' } as const, null as string | null)
/** The steps the person pressed that went into the session: queued until it is idle, then entered and being done until that turn ends. */
const queuedAtom = atom({ plugin: 'gemworks', key: 'queued' } as const, [] as GemworksJson)
/** The project's shared session logs: where they are, what they hold, the other session unfolded, the decisions already passed on, a commit in this turn. */
const sessionsDirAtom = atom({ plugin: 'gemworks', key: 'sessionsDir' } as const, null as string | null)
const projectSessionsAtom = atom({ plugin: 'gemworks', key: 'projectSessions' } as const, [] as GemworksJson)
const openSessionAtom = atom({ plugin: 'gemworks', key: 'openSession' } as const, null as string | null)
/** The initialization (the host's transcripts read into the record, once): its count while it runs, its outcome until the next prompt. */
const initAtom = atom({ plugin: 'gemworks', key: 'init' } as const, null as InitState | null)
/** Whether the sessions tab lists every other session. */
const sessionsAllAtom = atom({ plugin: 'gemworks', key: 'sessionsAll' } as const, false as boolean)
/** Whether the sessions tab lists every decision. */
const decisionsShownAtom = atom({ plugin: 'gemworks', key: 'decisionsShown' } as const, 20 as number)
/** How many of this session's turns the sessions tab draws, the newest; a press adds as many again. */
const TURNS_SHOWN = 30
const turnsShownAtom = atom({ plugin: 'gemworks', key: 'turnsShown' } as const, TURNS_SHOWN as number)
/** This session's turns checked on the sessions tab, by prompt id. */
const pickedAtom = atom({ plugin: 'gemworks', key: 'picked' } as const, [] as string[])
/** Whether the sessions tab is picking turns to split or delete (整理). */
const tidyingAtom = atom({ plugin: 'gemworks', key: 'tidying' } as const, false as boolean)
/** The project's Claude Code memory, as the bridge last read it. */
const memoryAtom = atom({ plugin: 'gemworks', key: 'memory' } as const, null as MemoryList | null)
/** The memory group unfolded, the memory whose card is open, the one being edited, and whether the group lists all. */
const memoryGroupAtom = atom({ plugin: 'gemworks', key: 'memoryGroup' } as const, null as string | null)
const memoryMenuAtom = atom({ plugin: 'gemworks', key: 'memoryMenu' } as const, null as string | null)
const memoryEditAtom = atom({ plugin: 'gemworks', key: 'memoryEdit' } as const, null as string | null)
const memoryShownAtom = atom({ plugin: 'gemworks', key: 'memoryShown' } as const, 10 as number)
const decisionsSeenAtom = atom({ plugin: 'gemworks', key: 'decisionsSeen' } as const, null as string | null)
const committedAtom = atom({ plugin: 'gemworks', key: 'committed' } as const, false)
/** The turn unfolded on the session tab (where the conversation cannot be scrolled): its prompt's id and its answer. */
const expandedTurnAtom = atom({ plugin: 'gemworks', key: 'expandedTurn' } as const, null as GemworksJson)
/** The file the last export wrote: the board links to it. */
const exportedAtom = atom({ plugin: 'gemworks', key: 'exported' } as const, null as string | null)
/** The session the last export on the sessions tab was of (`own` or its id), where its file is linked. */
const exportedForAtom = atom({ plugin: 'gemworks', key: 'exportedFor' } as const, null as string | null)
/** The coach's light flows, read once (coachFlows); the work item whose arrow was pressed. */
const coachFlowsAtom = atom({ plugin: 'gemworks', key: 'coachFlows' } as const, null as GemworksJson)
const coachFocusAtom = atom({ plugin: 'gemworks', key: 'coachFocus' } as const, null as GemworksJson)
/** The work items tab's groups listed whole (coach.ts WorkGroup). */
const workOpenAtom = atom({ plugin: 'gemworks', key: 'workOpen' } as const, [] as string[])
/** Every layer's practices (core/practices.ts) and whether the project's memory was moved in; null until read. */
const practicesAtom = atom({ plugin: 'gemworks', key: 'practices' } as const, null as GemworksJson)
/** The person's ledger of corrections as the flow tab shows it (protocol.ts CorrectionsView); null until read. */
const correctionsAtom = atom({ plugin: 'gemworks', key: 'corrections' } as const, null as GemworksJson)
/** Whether this session was asked to move the project's memory onto the steps. */
const memoryAskedAtom = atom({ plugin: 'gemworks', key: 'memoryAsked' } as const, false)
/** The flows of the flow tab whose practices are listed (`*` those for every flow); null: the first flow's. */
const manualExpandedAtom = atom({ plugin: 'gemworks', key: 'manualExpanded' } as const, null as string[] | null)
/** The work item unfolded under its row on the work items tab (its history). */
const workUnfoldedAtom = atom({ plugin: 'gemworks', key: 'workUnfolded' } as const, null as string | null)
/** The 好，做吧 the person pressed, on their way until their own turn ends (coach.ts GoneOn). */
const goneOnAtom = atom({ plugin: 'gemworks', key: 'goneOn' } as const, [] as GemworksJson)
const goneOnKept = async ($: EngineInterface): Promise<GoneOn[]> => ((await read($, goneOnAtom)) as unknown as GoneOn[] | null) ?? []
/** The work item the person's own turn took up, as it stood then (coach.ts Doing): 我在做 in place of 好，做吧 until that turn ends. */
const doingAtom = atom({ plugin: 'gemworks', key: 'doing' } as const, null as GemworksJson)
const doingKept = async ($: EngineInterface): Promise<Doing | null> => (await read($, doingAtom)) as unknown as Doing | null
/** The proposals to change the flows (growth.ts), and the rules (the project's and the team's): null until read. */
const proposalsAtom = atom({ plugin: 'gemworks', key: 'proposals' } as const, null as GemworksJson)
const rulesAtom = atom({ plugin: 'gemworks', key: 'rules' } as const, null as GemworksJson)
/** The practice whose 改成规定 was pressed: the one practice the rule tool may write a rule for. */
const pendingRuleAtom = atom({ plugin: 'gemworks', key: 'pendingRule' } as const, null as string | null)
/** The share dialog's text, shown to select where nothing can be copied (the desktop has no clipboard for a plugin). */
const sharedTextAtom = atom({ plugin: 'gemworks', key: 'sharedText' } as const, null as string | null)
const readQueued = async ($: EngineInterface): Promise<Queued[]> => ((await read($, queuedAtom)) as unknown as Queued[] | null) ?? []
async function setQueued($: EngineInterface, f: (was: Queued[]) => Queued[]): Promise<void> {
  await update($, queuedAtom, (was) => f(((was as unknown) as Queued[] | null) ?? []) as unknown as GemworksJson)
  $.ui.invalidate('ui.render')
}

/** A start that got no answer is tried again on a tool call or a prompt, at most this often. */
const START_RETRY_MS = 60_000
/** After a start that found no Node: sooner, since a first probe can fail on a cold machine. */
const NODE_RETRY_MS = 10_000
/** A probe's time: a first run of node.exe behind an antivirus, or off a cold disk, takes longer than a warm one. */
const PROBE_MS = 10_000
/** One desktop notification per refusal reason this often. */
const REFUSAL_NOTIFY_MS = 3 * 60_000
/** The prompts kept for the sessions tab. */
const PROMPTS_KEPT = 300
const STORE_SETTINGS = 'settings'
const REGISTRY = 'https://registry.npmjs.org/gemworks/latest'
/** This project's repository and license, as package.json names them (the smoke test holds them to it). */
const REPO = 'https://github.com/geml-spec/gemworks'
const LICENSE = 'AGPL-3.0-only'
/** The about and upgrade dialogs' links; the docs in the reader's language where there is a Chinese page. */
const LINKS = {
  docs: { zh: `${REPO}/blob/main/README.zh.md`, other: `${REPO}#readme` },
  repo: REPO,
  feedback: `${REPO}/issues`,
  changelog: `${REPO}/blob/main/CHANGELOG.md`,
}

/**
 * Whether a directory holds a `.git` entry, as `$.fs.stat` first answered for
 * it: the module's memory, for the session. A directory that becomes a
 * checkout later in the session (git init in a directory seen before) is not
 * looked at again.
 */
const gitEntries = new Map<string, boolean>()

/** An error's message, without the `gemworks: ` the engine puts before a refused `$` call of this plugin. */
const reasonOf = (err: unknown): string => (err instanceof Error ? err.message : String(err)).replace(/^gemworks: /, '')

async function nowIso($: EngineInterface): Promise<string> { return new Date(await $.clock.now()).toISOString() }

async function readShell($: EngineInterface): Promise<ShellStatus | null> {
  return (await read($, shellAtom)) as unknown as ShellStatus | null
}
async function readBoard($: EngineInterface): Promise<BoardData | null> { return (await read($, boardAtom)) as unknown as BoardData | null }
const readPasses = async ($: EngineInterface): Promise<string[]> => ((await read($, passesAtom)) as unknown as string[] | null) ?? []
async function readPrompts($: EngineInterface): Promise<PromptRecord[]> { return ((await read($, promptsAtom)) as unknown as PromptRecord[] | null) ?? [] }
async function readSettings($: EngineInterface): Promise<Settings> { return settingsFrom(await read($, settingsAtom)) }

/** The words in the language chosen: the setting, else the CLI's locale, else the host's LANG. */
async function words($: EngineInterface): Promise<T> {
  // Read at once: every drawing starts here, and each read is a trip to the host.
  const [s, shell, locale] = await Promise.all([readSettings($), readShell($), read($, localeAtom)])
  return wordsFor(langOf(s.language, shell?.locale ?? locale ?? undefined))
}

/**
 * Node ≥ 22: on the session's PATH; else where a shell finds it — a login
 * shell on Unix (the app's own PATH may lack what the shell's profile adds),
 * `where` through cmd.exe on Windows; the one that is not this OS's fails at
 * once — else in the places the installers put it; or why there is none.
 * The first candidate that answers with a new enough version is the one.
 */
async function findNode($: EngineInterface): Promise<{ node: string } | { problem: string }> {
  const major = async (bin: string): Promise<number | undefined> => {
    try {
      const r = await $.process.run([bin, '--version'], { timeoutMs: PROBE_MS })
      return r.exitCode === 0 ? nodeMajor(r.stdout) : undefined
    } catch {
      return undefined
    }
  }
  const candidates: string[] = ['node']
  const offer = (p: string): void => { const q = p.trim(); if (q !== '' && !candidates.includes(q)) candidates.push(q) }
  for (const argv of [['/bin/sh', '-lc', 'command -v node'], ['cmd.exe', '/d', '/c', 'where node']]) {
    try {
      const r = await $.process.run(argv, { timeoutMs: PROBE_MS })
      if (r.exitCode === 0) for (const line of r.stdout.split(/\r?\n/)) offer(line)
    } catch { /* not this OS, or no such shell */ }
  }
  // The installers' places: Windows (the installer, nvm-windows, Volta), then macOS (Homebrew, the installer) and Linux.
  // Each variable is named at its own call: the engine lists what a module reads, so the name must be a literal there.
  try { const v = await $.env.get('ProgramFiles'); if (v) offer(`${v}\\nodejs\\node.exe`) } catch { /* no env */ }
  try { const v = await $.env.get('LOCALAPPDATA'); if (v) { offer(`${v}\\Programs\\nodejs\\node.exe`); offer(`${v}\\Volta\\bin\\node.exe`) } } catch { /* no env */ }
  try { const v = await $.env.get('NVM_SYMLINK'); if (v) offer(`${v}\\node.exe`) } catch { /* no env */ }
  for (const p of ['/opt/homebrew/bin/node', '/usr/local/bin/node', '/usr/bin/node']) offer(p)
  let seen: number | undefined
  for (const bin of candidates) {
    const m = await major(bin)
    if (m === undefined) continue
    if (m >= 22) return { node: bin }
    seen = seen === undefined ? m : Math.max(seen, m)
  }
  return { problem: seen !== undefined ? `gemworks：Node ${seen} 太旧，需要 Node ≥ 22` : 'gemworks：找不到 node — 请安装 Node ≥ 22' }
}

/**
 * Since when the bridge has not answered (the first request of the run that
 * did not come back), or undefined while it answers. A busy machine is no
 * news: the band says so only once none has come back for QUIET_MS; a board
 * or an export the person asked for says so at once.
 */
let missedSince: number | undefined
/** Whether a turn of the main loop is under way: background reading waits for it to end. */
let turnBusy = false
/** This turn, on the main thread: whether a call changed something (wrote, ran, published, asked), and whether its work items were reported or asked for once already. */
let turnActed = false
let turnReported = false
const QUIET_MS = 120_000
/** How long a finished tool call waits for its evidence to be recorded before its result goes on regardless. */
const AFTER_WAIT_MS = 2_000
/** What a race with `$.clock.sleep` gives when the sleep ends first. */
const LATE = Symbol('late')

/** One request to the CLI. Undefined when the bridge is unavailable; the band then says why. */
async function bridge($: EngineInterface, op: BridgeOp, timeoutMs: number = BRIDGE_TIMEOUT_MS, onFile?: string): Promise<BridgeResponse | undefined> {
  const node = await read($, nodeAtom)
  const root = await read($, rootAtom)
  if (node === null || root === null) return undefined
  // `onFile`: this one request acts on that work item's file; the current one stays the shell's.
  const lastFile = onFile ?? (await read($, lastFileAtom))
  const gh = (await readShell($))?.status?.gh
  const request = { v: 1, root, ...(lastFile !== null ? { lastFile } : {}), ...(gh ? { gh } : {}), ...op } as BridgeRequest
  let out: { exitCode: number; stdout: string; stderr: string }
  try {
    out = await $.process.run([node, `${$.plugin.root}/dist/gemworks.mjs`, 'hook'], { cwd: root, stdin: encodeRequest(request), timeoutMs })
  } catch (err) {
    const now = await $.clock.now()
    missedSince ??= now
    if (now - missedSince >= QUIET_MS || op.op === 'board' || op.op === 'export') await update($, problemAtom, () => `gemworks：暂时没应答，不拦操作（${reasonOf(err)}）`)
    return undefined
  }
  missedSince = undefined
  const res = decodeResponse(out.stdout)
  if (res === undefined) {
    await update($, problemAtom, () => unreadableText(out.exitCode, out.stderr, $.plugin.root))
    return undefined
  }
  // An answer without a shell is a request that failed (it threw, or the CLI could not read it): it says
  // nothing about the workflow, so the last shell and its policy stay and the band shows the error.
  const failed = !res.ok && res.shell === undefined ? res.error.replace(/^gemworks: /, '') : null
  // Each written only when it changed: every tool call asks the bridge, and a write redraws whatever read the value.
  const problem = failed !== null ? `gemworks：${failed}` : null
  if ((await read($, problemAtom)) !== problem) await update($, problemAtom, () => problem)
  const shell = res.shell
  if (shell !== undefined && JSON.stringify(shell) !== JSON.stringify(await read($, shellAtom))) await update($, shellAtom, () => shell as unknown as GemworksJson)
  // Refresh and board answers carry the to-do count; every other answer leaves the last one standing.
  if (res.ok && res.todo !== undefined) {
    const todo = res.todo
    await update($, todoAtom, () => todo as unknown as GemworksJson)
  }
  // The stage moved under a tool call, a verb or a catch-up, the dictionary learned, or a call was refused: the board is read again, after this hook.
  const refused = op.op === 'before' && res.ok && res.refusal !== undefined
  if (((op.op === 'after' || op.op === 'verb' || op.op === 'refresh') && movedStage(res)) || op.op === 'learn' || refused) await reloadBoardLater($)
  if (res.ok && (res.entered?.length ?? 0) > 0) await notifyStage($, res)
  return res
}

const movedStage = (res: BridgeResponse): boolean => res.ok && (res.context !== undefined || (res.entered?.length ?? 0) > 0)

/** Read the board again once the current hook is done. */
async function reloadBoardLater($: EngineInterface): Promise<void> {
  $.clock.after(0, () => {
    void loadBoard($)
  })
}

/**
 * A result with the new stage's text after it, for the model only — after the
 * handoff line when the answer is on another work item than the one the main
 * loop last read. On the main loop it is recorded as delivered; a subagent's
 * result reaches only the subagent, so the main thread's next prompt still
 * carries the stage. The stage text of another work item the call was
 * attributed to (the checkout a subagent works in) is the subagent's alone:
 * the main loop's stays the session's.
 */
async function withStage<X extends { result?: unknown; context?: readonly string[] }>($: EngineInterface, ran: X, res: BridgeResponse | undefined, agentId: unknown): Promise<X> {
  if (res === undefined || !res.ok) return ran
  const texts: string[] = []
  if (res.context !== undefined) {
    const key = res.shell.contextKey
    if (key !== null && agentId === undefined) await update($, deliveredAtom, () => key)
    texts.push(res.handoff !== undefined ? `${res.handoff}\n${res.context}` : res.context)
  }
  if (res.routed !== undefined && agentId !== undefined) texts.push(res.routed.context)
  return texts.length === 0 ? ran : { ...ran, context: [...(ran.context ?? []), ...texts] }
}

/** The directory the loop making a call stands in, read before the call runs; undefined when the engine does not say. */
async function callCwd($: EngineInterface): Promise<string | undefined> {
  try {
    return await $.session.cwd()
  } catch {
    return undefined
  }
}

/** Whether a directory holds a `.git` entry — a worktree's file or a repository's directory — asked once per directory. */
async function hasGitEntry($: EngineInterface, dir: string): Promise<boolean> {
  const seen = gitEntries.get(dir)
  if (seen !== undefined) return seen
  let found: boolean
  try {
    await $.fs.stat(`${dir}/.git`)
    found = true
  } catch {
    found = false
  }
  gitEntries.set(dir, found)
  return found
}

/** Whether a call may act outside the session's checkout: checkoutProbe, then a `.git` entry between its directory and the root. */
async function actsElsewhere($: EngineInterface, call: CallFacts, cwd: string, root: string): Promise<boolean> {
  const probe = checkoutProbe(call, cwd, root)
  if (probe.elsewhere) return true
  for (const dir of probe.dirs) if (await hasGitEntry($, dir)) return true
  return false
}

/** What the main loop last read, `<item>@<rev>`, for a call of the main loop; null for a subagent's, which no handoff is for. */
async function deliveredFor($: EngineInterface, agentId: unknown): Promise<string | null> {
  return agentId === undefined ? read($, deliveredAtom) : null
}

/**
 * The standing instructions (the other sessions, the ask tool) for a prompt's
 * context, the first time this conversation gets them. The system prompt is
 * where they belong, but under a Team or Enterprise organization a built-in
 * plugin runs before gemworks on prompt.compose and keeps the event, so its
 * sections never reach the model; where compose did run, the prompt carries
 * nothing. A failure tells nothing: the turn goes on.
 */
async function prefaceFor($: EngineInterface): Promise<string[]> {
  try {
    const [told, composed, cut] = await Promise.all([read($, toldAtom), read($, composedAtom), read($, composeCutAtom)])
    // Told already; or compose ran, so the system prompt carries them; or the probe saw the event reach the engine.
    if (told === true || composed === true || cut === false) return []
    await update($, toldAtom, () => true)
    const flows = await coachFlows($).catch(() => [] as CoachFlow[])
    return [SESSIONS_PROMPT, ASK_PROMPT, ...(flows.length > 0 ? [workPrompt(flows), PRACTICE_PROMPT, GROWTH_PROMPT] : [])]
  } catch {
    return []
  }
}

/**
 * Whether prompt.compose reaches gemworks: composed once through the other
 * plugins' hooks, the table holds the engine's own sections (bare ids, `intro`,
 * `system`, `lean_body`…) unless a plugin above kept the event. Not known
 * when the call fails: the first prompt then carries the instructions unless
 * compose is seen running.
 */
async function probeCompose($: EngineInterface): Promise<void> {
  try {
    const { sections } = await $.prompt.compose()
    const cut = !sections.some((x) => !x.id.includes(':'))
    await update($, composeCutAtom, () => cut)
  } catch { /* not known */ }
}

/**
 * Ask the person about a tool that is not its use's preferred one (spec
 * §5.3, preferences): $.ui.ask puts the question to them whatever the
 * permission mode, and returns the option they chose. A dismissed question,
 * or one that could not be asked, lets the call through once: the module
 * fails open. Gemworks asks nothing else: whether a call no row takes is safe
 * to run is the host's permission system's call.
 */
async function askPerson($: EngineInterface, d: Extract<BeforeDecision, { kind: 'prefer' }>): Promise<Answered> {
  const q = preferQuestion(d.key, d.use, d.preferred)
  let chosen: string | undefined
  try {
    const answer: unknown = await ($.ui as unknown as { ask(question: string, options: string[]): Promise<unknown> }).ask(q.question, q.options)
    chosen = typeof answer === 'string' ? answer : undefined
  } catch {
    chosen = undefined
  }
  return preferAnswer(chosen, d.key, d.use, d.preferred)
}

/** One of the three model tools, answered by the bridge's verb op. */
async function serveVerb($: EngineInterface, name: VerbName, event: unknown): Promise<ToolCallResult> {
  const e = event as Record<string, unknown>
  await retryStart($)
  const callId = typeof e['tool_use_id'] === 'string' ? e['tool_use_id'] : undefined
  const delivered = await deliveredFor($, e['agentId'])
  const res = await bridge($, { op: 'verb', name, args: toolArgs(e), ...(callId !== undefined ? { callId } : {}), ...(delivered !== null ? { delivered } : {}) })
  if (res === undefined) return { result: `gemworks is unavailable: ${(await read($, problemAtom)) ?? 'no workflow here'}` }
  if (!res.ok) return { result: `gemworks: ${res.error}` }
  if (e['agentId'] === undefined) await notePrompt($, (p) => ({ ...p, entered: [...p.entered, ...(res.entered ?? [])] }))
  return withStage($, { result: res.text ?? '' }, res, e['agentId'])
}

/** Read the board; null when it came, else why not (kept for the pane, which shows it). The inbox is told of new items. */
/** 全部产物: every artifact the project's work made, read again; the list read before stays when it cannot be. */
async function loadMade($: EngineInterface): Promise<void> {
  const res = await bridge($, { op: 'made' }, SLOW_TIMEOUT_MS).catch(() => undefined)
  if (res !== undefined && res.ok && res.made !== undefined) { const made = res.made; await update($, madeAllAtom, () => made as unknown as GemworksJson) }
}

async function loadBoard($: EngineInterface): Promise<string | null> {
  // 全部产物 is read beside the board while the board is up on the work items tab: no workflow has no board, and still made things.
  const shown = ['items', 'made'].includes((await read($, tabAtom)) as string) && (await $.ui.panes().catch(() => [])).some((p) => p.id === BOARD_ID)
  const [res] = await Promise.all([bridge($, { op: 'board' }, SLOW_TIMEOUT_MS), shown ? loadMade($) : Promise.resolve()])
  const failure = boardFailure(res, await read($, problemAtom), await words($)) ?? null
  await update($, boardProblemAtom, () => failure)
  if (res !== undefined && res.ok && res.board !== undefined) {
    const board = res.board
    await update($, boardAtom, () => board as unknown as GemworksJson)
  }
  await notifyInbox($)
  return failure
}

// ---- what needs the person now (attention.ts) ---------------------------------------------

/** The last reply as the band keeps it. `consumed`: the person has answered it; its asks no longer lead. */
/** `picks`: the answers given so far to the reply's several asks, by their place; said together once all are given. */
/** `asks`: the questions the model registered in the turn the reply ends (the ask tool); none, and a question in the reply is only a hint. */
interface Attention { reply: string; replyAt: number; memory: AttentionMemory; consumed: boolean; picks?: (string | null)[]; asks?: Asked[] }
async function readAttention($: EngineInterface): Promise<Attention | null> { return (await read($, attentionAtom)) as unknown as Attention | null }

/** The repository's facts for the band, with the reload a command made due. */
async function factsNow($: EngineInterface): Promise<AttentionFacts> {
  const [kept, reload, shell, running] = await Promise.all([read($, factsAtom), read($, reloadAtom), readShell($), read($, versionAtom)])
  const f = (kept as unknown as AttentionFacts | null) ?? NO_FACTS
  // The version this module was loaded as, and the one the folder holds now (the CLI reads it on every request).
  const synced = shell?.versions?.gemworks
  const differ = typeof running === 'string' && running !== '' && synced !== undefined && synced !== '' && synced !== running
  return reload || differ ? { ...f, reload: true, ...(differ ? { versions: { running, synced } } : {}) } : f
}

/** What the band and the board's 此刻 show now: the lead, the standing steps, the memory, the line. Reads only. */
async function attentionNow($: EngineInterface, t: T) {
  // Everything at once: the band and the board's 此刻 wait on the slowest read, not on the sum of them.
  const [a, facts, now, clients, origin, unavailable, dismissed] = await Promise.all([readAttention($), factsNow($), $.clock.now(), read($, clientsAtom), read($, originAtom), read($, reloadUnavailableAtom), dismissedOf($)])
  const reply = a !== null && !a.consumed ? a.reply : ''
  const memory = a?.memory ?? NO_MEMORY
  // A reload is the machine's: over a remote connection, or once the engine said it cannot run here, it is named with no button.
  const remote = remoteInPlay({ clients: (clients as unknown as AttachedClient[] | null) ?? [], ...(origin !== null ? { origin } : {}) })
  // A branch or a pull request the person holds back raises no card: it waits under 已暂缓.
  const standing = standingOf(reply, facts, now, t, { reloadHere: !remote && !unavailable }).filter((s) => !dismissed.includes(s.key))
  const { branches, prs } = heldSteps(dismissed, facts)
  const held = { branches, prs }
  const lead = a === null || a.consumed ? null : leadOf({ reply, standing, memory, picks: a.picks ?? [], ...(a.asks !== undefined ? { asked: a.asks } : {}), t })
  const line = bandLine({ lead, standing, memory, reply, awayMs: a === null ? null : now - a.replyAt, t })
  return { attention: a, reply, standing, memory, lead, line, held }
}

/**
 * The person's prompt ends the band's moment: its memory moves on (what led, how long each step has waited, the asks
 * the prompt answers), and what changed in the repository since the reply is news for the model, so the person need
 * not say it. Answers the context lines to add.
 */
async function attentionOnPrompt($: EngineInterface, said: string, typed = true): Promise<string[]> {
  try {
    const t = await words($)
    const now = await attentionNow($, t)
    const a = now.attention
    if (a === null) return []
    if (!a.consumed) {
      const memory = answered(remember(a.memory, { reply: a.reply, standing: now.standing, lead: now.lead }), said)
      await update($, attentionAtom, () => ({ ...a, memory, consumed: true }) as unknown as GemworksJson)
      // What it did not answer stays for the next reply's band. When the person typed, a small model reads which of the
      // open questions the prompt settles, answered or left behind (judgeOpenAsks); a pressed step settles only what it names.
      const open = openAfter(a.asks ?? [], a.picks ?? [], said)
      await update($, leftAsksAtom, () => open)
      const settled = (a.asks ?? []).filter((q) => !open.some((x) => x.question === q.question)).map((q) => q.question)
      const before = ((await read($, answeredAtom)) as string[] | null) ?? []
      await update($, answeredAtom, () => [...new Set([...before, ...settled])])
      // Typed answers off (settings): a question is settled by its press alone.
      if (typed && open.length > 0 && (await readSettings($)).judge.enabled) $.clock.after(0, () => { void judgeOpenAsks($, open, said).catch(() => undefined) })
    }
    const news = newsOf((await read($, factsAtReplyAtom)) as unknown as AttentionFacts | null, await factsNow($), t)
    return news.length > 0 ? [`[gemworks] since your last reply: ${news.join('; ')}`] : []
  } catch {
    return []
  }
}

/**
 * Which of the open questions a typed prompt settles: the questions are state, what the person wrote since the oldest
 * of them was asked is the change (the prompt the last of it), and a small model reads both after the prompt is on its
 * way. Reading the whole stretch, not the prompt alone, settles a question answered in an earlier message that an older
 * version took for an answer to another. A settled question leaves the state; the others stay for the next reply's
 * band. With no reading (the call failed, the reply was no answer) typing settles the one the band showed, the first,
 * as it always did.
 */
async function judgeOpenAsks($: EngineInterface, open: Asked[], said: string): Promise<void> {
  const from = open.every((q) => q.at !== undefined) ? open.map((q) => q.at as string).sort()[0] : undefined
  const since = (await readPrompts($)).filter((p) => from === undefined || p.at >= from).map((p) => ({ at: p.at, text: p.text }))
  const history = since.at(-1)?.text === said ? since : [...since, { at: await nowIso($), text: said }]
  const ask = asksJudgeRequest(open, history)
  const r = await $.model.complete({ model: 'haiku', system: ask.system, prompt: ask.prompt, maxTokens: 120, effort: 'low', timeoutMs: 20_000 }).catch(() => undefined)
  const places = r !== undefined && r.isAnswered ? readAsksJudgement(r.text, open.length) : undefined
  const settled = (places ?? [0]).flatMap((i) => (open[i] !== undefined ? [open[i].question] : []))
  if (settled.length === 0) return
  await update($, leftAsksAtom, (left) => ((left as Asked[] | null) ?? []).filter((x) => !settled.includes(x.question)))
  // While the turn runs, they are answered for the turn's end (which reads this); after, a later turn may ask them afresh.
  if (turnBusy) await update($, answeredAtom, (done) => [...new Set([...(((done as string[] | null) ?? [])), ...settled])])
  // The turn may have ended first and put them back on the band: take them off there, with their places among the picks.
  const a = await readAttention($)
  if (a === null || a.consumed || a.asks === undefined || !a.asks.some((x) => settled.includes(x.question))) return
  const { asks: _asks, picks: _picks, ...rest } = a
  const stays = a.asks.map((x) => !settled.includes(x.question))
  const asks = a.asks.filter((_, i) => stays[i])
  const picks = (a.picks ?? []).filter((_, i) => stays[i])
  const kept: Attention = { ...rest, ...(asks.length > 0 ? { asks } : {}), ...(a.picks !== undefined && asks.length > 0 ? { picks } : {}) }
  await update($, attentionAtom, () => kept as unknown as GemworksJson)
}

/** Where the session runs and who drives it (env.ts): the parts of one line, and whether a person may be away from the machine. */
async function envNow($: EngineInterface, t: T, surface?: string): Promise<{ parts: string[]; host: HostInfo | null; remote: boolean }> {
  const [h, c, o, root] = await Promise.all([read($, hostAtom), read($, clientsAtom), read($, originAtom), read($, rootAtom)])
  const host = h as unknown as HostInfo | null
  const clients = (c as unknown as AttachedClient[] | null) ?? []
  const origin = o ?? undefined
  const remote = remoteInPlay({ ...(surface !== undefined ? { surface } : {}), clients, ...(origin !== undefined ? { origin } : {}) })
  return { parts: envParts({ host, root, remote, t }), host, remote }
}

// ---- the project's shared session record (session-log.ts) -------------------------------

/**
 * Whether a prompt is the person's: typed here, sent over Remote Control or by
 * an SDK host, or an option they pressed on the board (the module's own prompt
 * as theirs); not a background task's notification, a scheduled trigger or
 * another session's message.
 */
const fromPerson = (o: { kind: string; asUser?: boolean }): boolean => o.kind === 'composer' || o.kind === 'bridge' || o.kind === 'sdk' || (o.kind === 'plugin' && o.asUser === true)

/** How this host names its logs. */
const OWN_HOST = 'claude-code'
/** How far back a session's first prompt hears the other sessions' decisions. */
const DECISIONS_BACK_MS = 3 * 24 * 60 * 60 * 1000

/** This session's log as it stands: the GEML one, else an earlier .jsonl one (carried into the GEML one at the next write), else nothing. */
async function ownLogText($: EngineInterface, dir: string, id: string): Promise<string> {
  for (const name of [logName(OWN_HOST, id), legacyLogName(OWN_HOST, id)]) {
    try { return String(await $.fs.read(`${dir}/${name}`)) } catch { /* the next */ }
  }
  return ''
}

/** This session's log, the events `make` adds at its end (given the events so far, a session line first when there was none); nothing when the project has no record. */
async function appendOwn($: EngineInterface, make: (events: SessionEvent[]) => SessionEvent[]): Promise<SessionEvent[]> {
  try {
    const dir = await read($, sessionsDirAtom)
    if (dir === null) return []
    const id = await $.session.id()
    const path = `${dir}/${logName(OWN_HOST, id)}`
    const text = await ownLogText($, dir, id)
    const events = parseLog(text)
    const head: SessionEvent[] = []
    if (!events.some((x) => x.t === 'session')) {
      const host = (await read($, hostAtom)) as unknown as HostInfo | null
      const root = await read($, rootAtom)
      head.push({ t: 'session', id, host: OWN_HOST, at: await nowIso($), ...(host?.branch !== undefined ? { branch: host.branch } : {}), ...(root !== null ? { checkout: root } : {}) })
      // The directory keeps itself out of git, whichever branch the main working tree is on.
      if (!(await $.fs.exists(`${dir}/.gitignore`))) await $.fs.write(`${dir}/.gitignore`, SESSIONS_GITIGNORE)
    }
    const added = [...head, ...make([...events, ...head])]
    if (added.length > 0) await $.fs.write(path, appendEvents(text, added))
    return [...events, ...added]
  } catch { return [] }
}

/** Logs read again only when they changed: by name, the size and time they were read at. */
const logsRead = new Map<string, { size: number; mtimeMs: number; summary: SessionSummary | undefined }>()

/** Every session's log in the project's record, read into the session tab's state (answers left out: the tab shows the decisions). */
async function loadProjectSessions($: EngineInterface): Promise<SessionSummary[]> {
  const dir = await read($, sessionsDirAtom)
  if (dir === null) return []
  let entries: { name: string; kind: string; size: number; mtimeMs: number }[]
  try { entries = [...(await $.fs.list(dir))] } catch { return [] }
  const sessions: SessionSummary[] = []
  const names = entries.map((en) => en.name)
  for (const en of entries) {
    if (en.kind !== 'file' || !isLogName(en.name, names)) continue
    const known = logsRead.get(en.name)
    let summary = known !== undefined && known.size === en.size && known.mtimeMs === en.mtimeMs ? known.summary : undefined
    if (summary === undefined) {
      try { summary = summarize(parseLog(String(await $.fs.read(`${dir}/${en.name}`)))) } catch { summary = undefined }
      if (summary !== undefined) summary = { ...summary, turns: summary.turns.map(({ answer, ...turn }) => { const gist = answer !== undefined ? answerGist(answer) : undefined; return gist !== undefined ? { ...turn, gist } : turn }) }
      logsRead.set(en.name, { size: en.size, mtimeMs: en.mtimeMs, summary })
    }
    if (summary !== undefined) sessions.push(summary)
  }
  if (JSON.stringify(sessions) !== JSON.stringify(await read($, projectSessionsAtom))) await update($, projectSessionsAtom, () => sessions as unknown as GemworksJson)
  return sessions
}

/** A person's prompt: into this session's log as the next turn; the other sessions' decisions it has not heard come back as the line beside it. */
async function sessionsOnPrompt($: EngineInterface, text: string): Promise<string[]> {
  const at = await nowIso($)
  await appendOwn($, (events) => [{ t: 'prompt', turn: nextTurn(events), at, text }])
  const sessions = await loadProjectSessions($)
  if (sessions.length === 0) return []
  const seen = await read($, decisionsSeenAtom)
  const since = seen ?? new Date(Date.parse(at) - DECISIONS_BACK_MS).toISOString()
  const fresh = decisionsSince(sessions, await $.session.id(), since)
  await update($, decisionsSeenAtom, () => at)
  if (fresh.length === 0) return []
  return [decisionsContext(fresh, (d) => `${hostName(d.host)}${d.branch !== undefined ? ` · ${d.branch}` : ''}，${hhmm(d.at)}`)]
}

/** The model's note: the decisions into this session's log, under the turn under way. */
async function noteDecisions($: EngineInterface, event: unknown): Promise<ToolCallResult> {
  const args = toolArgs(event as Record<string, unknown>)
  const offered = Array.isArray(args['decisions']) ? (args['decisions'] as unknown[]).filter((x): x is string => typeof x === 'string' && x.trim() !== '').map((x) => x.trim()) : []
  if (offered.length === 0) return { result: 'Nothing recorded: decisions is a list of short sentences.' }
  // Status is no decision: git, the board and the journal hold what was pushed, synced, committed, or what a version does.
  const status = offered.filter(isStatusLine)
  const given = offered.filter((x) => !isStatusLine(x))
  const leftOut = status.length === 0 ? '' : ` ${status.length} left out as status, which git, the board and the journal hold: ${status.map((x) => `"${x.slice(0, 60)}"`).join(', ')}.`
  if (given.length === 0) return { result: `Nothing recorded:${leftOut} A decision is a choice the person made or a finding other sessions would rediscover.` }
  if ((await read($, sessionsDirAtom)) === null) return { result: 'Nothing recorded: this project has no shared session record yet (gemworks has not read the repository).' }
  const at = await nowIso($)
  const events = await appendOwn($, (so) => given.map((text): SessionEvent => ({ t: 'decision', turn: currentTurn(so), at, text })))
  if (events.length === 0) return { result: 'Nothing recorded: the session record could not be written.' }
  await loadProjectSessions($)
  return { result: `Recorded ${given.length} decision${given.length === 1 ? '' : 's'}; the project's other sessions will see ${given.length === 1 ? 'it' : 'them'}.${leftOut}` }
}

/**
 * The coach's light flows: the project's own (`.geml/coach/<name>.geml` beside its sessions), else the ones the plugin
 * ships; read once a session. A flow neither has, or one that does not read, is left out.
 */
async function coachFlows($: EngineInterface): Promise<CoachFlow[]> {
  const kept = (await read($, coachFlowsAtom)) as unknown as CoachFlow[] | null
  // Flows kept by an earlier version (a session the plugin reloaded in) say no judge on their steps: read again.
  if (kept !== null && kept.length > 0 && kept.every((f) => f.states.every((st) => typeof st.judge === 'string'))) return kept
  const dir = await read($, sessionsDirAtom)
  const own = dir !== null ? dir.replace(/[\\/]sessions[\\/]?$/, '/coach') : undefined
  const flows: CoachFlow[] = []
  const readAt = async (path: string): Promise<string | undefined> => $.fs.read(path).then(String, () => undefined)
  for (const name of COACH_FLOWS) {
    // The project's own flow takes who judges a step, what it prevents and its buttons' words from the shipped one's step of the same id.
    const shippedText = await readAt(`${$.plugin.root}/coach/${name}.geml`)
    const shipped = shippedText !== undefined ? readCoachFlow(name, shippedText) : undefined
    const ownText = own !== undefined ? await readAt(`${own}/${name}.geml`) : undefined
    const repo = await read($, rootAtom)
    const teamText = ownText === undefined && repo !== null ? await readAt(`${repo}/.gemworks/flows/${name}.geml`) : undefined
    const flow = (ownText !== undefined ? readCoachFlow(name, ownText, shipped) : teamText !== undefined ? readCoachFlow(name, teamText, shipped) : undefined) ?? shipped
    if (flow !== undefined) flows.push(flow)
  }
  if (own !== undefined) {
    let entries: { name: string; kind: string }[] = []
    try { entries = [...(await $.fs.list(own))] } catch { /* none of its own */ }
    for (const en of entries) {
      const name = en.name.replace(/\.geml$/, '')
      if (en.kind !== 'file' || !en.name.endsWith('.geml') || (COACH_FLOWS as readonly string[]).includes(name)) continue
      const text = await readAt(`${own}/${en.name}`)
      const flow = text !== undefined ? readCoachFlow(name, text) : undefined
      if (flow !== undefined) flows.push(flow)
    }
  }
  if (flows.length > 0) await update($, coachFlowsAtom, () => flows as unknown as GemworksJson)
  return flows
}

/** The flows as read so far: what a drawing uses, since a drawing writes nothing (coachFlows reads them). */
async function coachFlowsKept($: EngineInterface): Promise<CoachFlow[]> {
  return ((await read($, coachFlowsAtom)) as unknown as CoachFlow[] | null) ?? []
}

/**
 * The questions the person has not answered: the last reply's not yet picked, or, while a turn runs, the ones it left
 * open for the next reply's band.
 */
async function openAsks($: EngineInterface): Promise<Asked[]> {
  const a = await readAttention($)
  if (a !== null && !a.consumed) return (a.asks ?? []).filter((_, i) => (a.picks?.[i] ?? null) === null)
  return ((await read($, leftAsksAtom)) as Asked[] | null) ?? []
}

/** The work items the project's sessions reported, as they stand now; those of the sessions this one carries on are its own. */
async function workItems($: EngineInterface): Promise<WorkItem[]> {
  const items = workItemsOf(((await read($, projectSessionsAtom)) as unknown as SessionSummary[] | null) ?? [], await coachFlowsKept($))
  const line = ((await read($, sessionLineAtom)) as string[] | null) ?? []
  if (line.length === 0) return items
  const id = await $.session.id().catch(() => '')
  return id === '' ? items : items.map((i) => (line.includes(i.session) ? { ...i, session: id } : i))
}

/**
 * A session the app started from another (a rewind, a fork) carries that one on: its prompts up to where the transcript
 * leaves off, its work items, and its board when the board was up. The store keeps nothing under the new id while the
 * transcript already holds the person's words: the session whose kept prompts the transcript holds most is the one.
 * A reload of a session carried on reads the line again from the store.
 */
async function continueFrom($: EngineInterface): Promise<void> {
  try {
    const id = await $.session.id()
    const known = await $.store.get(`continues:${id}`)
    if (Array.isArray(known)) { await update($, sessionLineAtom, () => known as string[]); return }
    if ((await readPrompts($)).length > 0) return
    const said = (await $.session.messages()).filter((m) => m.role === 'user' && m.text.trim() !== '').map((m) => m.text)
    if (said.length === 0) return
    const held = (p: PromptRecord): boolean => { const head = p.text.slice(0, 80).trim(); return head !== '' && said.some((s) => s.includes(head)) }
    const order = await $.store.get('prompts:sessions')
    let from: string | undefined
    let kept: PromptRecord[] = []
    for (const other of (Array.isArray(order) ? (order as string[]) : []).filter((x) => x !== id).reverse()) {
      const theirs = await $.store.get(`prompts:${other}`)
      const carried = Array.isArray(theirs) ? (theirs as unknown as PromptRecord[]).filter(held) : []
      if (carried.length > kept.length) { from = other; kept = carried }
    }
    if (from === undefined) return
    const before = await $.store.get(`continues:${from}`)
    const line = [from, ...(Array.isArray(before) ? (before as string[]).filter((x) => x !== id) : [])]
    await update($, sessionLineAtom, () => line)
    await $.store.set(`continues:${id}`, line)
    await update($, promptsAtom, () => kept as unknown as GemworksJson)
    $.clock.after(0, () => { void storePrompts($) })
    trace($, `continue: from ${from}, ${kept.length} prompts`)
    if ((await $.store.get(`board:${from}`)) === true) await openBoard($)
  } catch { /* taken for a new session, as before */ }
}

/** Whether the board is up, kept per session (only when it changed): a session carried on from this one opens it again. */
async function noteBoard($: EngineInterface): Promise<void> {
  try {
    const id = await $.session.id()
    const up = (await $.ui.panes()).some((p) => p.id === BOARD_ID)
    if ((await $.store.get(`board:${id}`)) !== up) await $.store.set(`board:${id}`, up)
  } catch { /* noted at the next */ }
}

/**
 * What each of this session's prompts moved, decided and learned, as the record holds it: the turn whose prompt is
 * the same text sent nearest in time. A turn that moved one work item names it, so the sessions tab folds a run of them.
 */
async function movedOf($: EngineInterface, t: T): Promise<(p: PromptRecord) => TurnMoved> {
  const session = await $.session.id().catch(() => '')
  const own = (((await read($, projectSessionsAtom)) as unknown as SessionSummary[] | null) ?? []).find((x) => x.id === session)
  const flows = await coachFlowsKept($)
  const learned = ((await practicesKept($))?.list ?? []).filter((x) => x.session === session)
  return (p) => {
    const at = Date.parse(p.at)
    const turn = (own?.turns ?? []).filter((x) => x.prompt === p.text).sort((a, b) => Math.abs(Date.parse(a.at) - at) - Math.abs(Date.parse(b.at) - at))[0]
    if (turn === undefined) return { words: [] }
    const moved = turn.moved ?? []
    const one = moved.length === 1 ? moved[0] : undefined
    return { words: turnWords(turn, flows, learned.filter((x) => x.turn === turn.turn), t), ...(one !== undefined ? { item: { id: one.id, title: one.title } } : {}) }
  }
}

/** The project's .geml/ directory: where its sessions are kept; null until the bridge said. */
async function gemlDir($: EngineInterface): Promise<string | null> {
  const dir = await read($, sessionsDirAtom)
  return dir === null ? null : dir.replace(/[\\/]sessions[\\/]?$/, '')
}

/** The proposals and the rules as their files hold them: the project's (beside its sessions) and the team's (the repository's .gemworks/). */
async function loadGrowth($: EngineInterface): Promise<void> {
  const geml = await gemlDir($)
  if (geml === null) return
  const readAt = async (p: string): Promise<string> => $.fs.read(p).then(String, () => '')
  const proposals = parseProposals(await readAt(`${geml}/proposals.geml`))
  const root = await read($, rootAtom)
  const rules = [...parseRules(await readAt(`${geml}/rules.geml`), 'project'), ...(root !== null ? parseRules(await readAt(`${root}/.gemworks/rules.geml`), 'team') : [])]
  await update($, proposalsAtom, () => proposals as unknown as GemworksJson)
  await update($, rulesAtom, () => rules as unknown as GemworksJson)
}

async function proposalsKept($: EngineInterface): Promise<Proposal[]> { return ((await read($, proposalsAtom)) as unknown as Proposal[] | null) ?? [] }
async function rulesKept($: EngineInterface): Promise<Rule[]> { return ((await read($, rulesAtom)) as unknown as Rule[] | null) ?? [] }

/** The proposals written back, and kept. */
async function saveProposals($: EngineInterface, list: readonly Proposal[]): Promise<void> {
  const geml = await gemlDir($)
  if (geml === null) return
  await $.fs.write(`${geml}/proposals.geml`, proposalsText(list))
  await update($, proposalsAtom, () => list as unknown as GemworksJson)
}

/** The project's rules written back (the team's stay the repository's), and kept with the team's. */
async function saveRules($: EngineInterface, list: readonly Rule[]): Promise<void> {
  const geml = await gemlDir($)
  if (geml === null) return
  await $.fs.write(`${geml}/rules.geml`, rulesText(list.filter((r) => r.layer === 'project')))
  await update($, rulesAtom, () => list as unknown as GemworksJson)
}

/** A flow changed or added by the person, written as the project's own; the flows read again. */
async function writeOwnFlow($: EngineInterface, flow: CoachFlow): Promise<void> {
  const geml = await gemlDir($)
  if (geml === null) return
  await $.fs.write(`${geml}/coach/${flow.name}.geml`, flowText(flow))
  await update($, coachFlowsAtom, () => [] as unknown as GemworksJson)
  await coachFlows($)
}

/** The propose tool: the proposals given, checked against the flows and the ones kept, for the person on the flow tab. */
async function recordProposals($: EngineInterface, event: unknown): Promise<ToolCallResult> {
  if ((event as { agentId?: string }).agentId !== undefined) return { result: 'Not recorded: only the main conversation proposes.' }
  if ((await gemlDir($)) === null) return { result: 'Nothing recorded: this project has no shared record yet.' }
  const args = toolArgs(event as Record<string, unknown>)
  const given = Array.isArray(args['proposals']) ? (args['proposals'] as unknown[]) : []
  await loadGrowth($)
  const kept = await proposalsKept($)
  const at = await nowIso($)
  const stamp = Date.parse(at).toString(36).slice(-6)
  const r = newProposals(given, await coachFlows($), kept, at, (n) => `q${stamp}${n}`)
  if (r.added.length === 0) return { result: `Nothing recorded: ${r.errors.join('; ') || 'proposals is a list'}.` }
  await saveProposals($, [...kept, ...r.added])
  return { result: `Proposed ${r.added.length}; the person answers on the flow tab.${r.errors.length > 0 ? ` Left out: ${r.errors.join('; ')}.` : ''}` }
}

/** The rule tool: the rule for the practice whose 改成规定 the person pressed, and for no other. */
async function recordRule($: EngineInterface, event: unknown): Promise<ToolCallResult> {
  const args = toolArgs(event as Record<string, unknown>)
  const pending = await read($, pendingRuleAtom)
  const id = typeof args['practice'] === 'string' ? args['practice'] : ''
  if (pending === null || pending !== id) return { result: 'Not recorded: a rule is written only for the practice whose 改成规定 the person pressed.' }
  const practice = ((await practicesKept($))?.list ?? []).find((p) => p.id === id)
  const flow = (await coachFlows($)).find((f) => f.name === practice?.flow)
  const requires = typeof args['requires'] === 'string' ? args['requires'] : ''
  const key = typeof args['key'] === 'string' ? args['key'].trim() : ''
  if (practice === undefined || flow === undefined) return { result: 'Not recorded: that practice is gone.' }
  if (!flow.states.some((st) => st.id === requires && !st.final)) return { result: `Not recorded: ${flow.name} has no step "${requires}" (${flow.states.map((st) => st.id).join(', ')}).` }
  if (key === '' || !/^[A-Za-z_][\w.-]*(\(.*\))?$/s.test(key)) return { result: 'Not recorded: key is a tool key, as Bash(npm run deploy*).' }
  await loadGrowth($)
  const at = await nowIso($)
  const text = typeof args['text'] === 'string' && args['text'].trim() !== '' ? args['text'].trim() : practice.text
  const rule: Rule = { id: `r${Date.parse(at).toString(36).slice(-6)}`, flow: flow.name, requires, key, text, why: practice.why, at, layer: 'project', from: `practice:${practice.id}` }
  await saveRules($, [...(await rulesKept($)), rule])
  await update($, pendingRuleAtom, () => null)
  return { result: `Rule written: ${key} is held while «${flow.states.find((st) => st.id === requires)?.title ?? requires}» is unmet.` }
}

/**
 * What holds a tool call, if anything does: a write to a file that keeps rules (they are the person's to change), or
 * a rule whose key the call matches while the step it requires is unmet on this session's work item. A write also
 * takes back the facts of that item that expire once the work changes.
 */
async function ruleHold($: EngineInterface, tool: string, input: Record<string, unknown>): Promise<string | undefined> {
  const writes = CLAUDE_CODE_TOOLS.write.includes(tool)
  const target = typeof input['file_path'] === 'string' ? input['file_path'] : typeof input['notebook_path'] === 'string' ? input['notebook_path'] : ''
  if (writes && isRulesFile(target)) return '规定只有定它的人能改：rules.geml 请你自己改。'
  const session = await $.session.id().catch(() => '')
  const item = turnItem(await workItems($), session)
  if (item === undefined) return undefined
  const flows = await coachFlowsKept($)
  const rules = await rulesKept($)
  if (rules.length > 0) {
    const held = ruleRefusal(rules, item, flows, keysOf(tool, input, CLAUDE_CODE_TOOLS.run, CLAUDE_CODE_TOOLS.write))
    if (held !== undefined) {
      if (held.rule.layer === 'project') await saveRules($, rules.map((r) => (r.id === held.rule.id ? { ...r, held: (r.held ?? 0) + 1 } : r)))
      $.clock.after(0, () => { void notifyRefusal($, tool, held.reason).catch(() => undefined) })
      return held.reason
    }
  }
  const flow = flows.find((f) => f.name === item.flow)
  if (writes && flow !== undefined) {
    const gone = expiring(item, flow)
    if (gone.length > 0) {
      const at = await nowIso($)
      const t = await words($)
      await appendOwn($, (so) => [expireEvent(item, gone, t('改过，要重跑'), at, currentTurn(so))])
      await loadProjectSessions($)
    }
  }
  return undefined
}

/** Every layer's practices, as the bridge reads them; kept for the board and the next prompt. */
async function loadPractices($: EngineInterface): Promise<void> {
  const res = await bridge($, { op: 'practices' }).catch(() => undefined)
  if (res === undefined || !res.ok || res.practices === undefined) return
  if (JSON.stringify(res.practices) === JSON.stringify(await read($, practicesAtom))) return
  await update($, practicesAtom, () => res.practices as unknown as GemworksJson)
}

/** The practices as read so far: what a drawing uses. */
async function practicesKept($: EngineInterface): Promise<{ list: Practice[]; memoryMoved: boolean } | null> {
  return (await read($, practicesAtom)) as unknown as { list: Practice[]; memoryMoved: boolean } | null
}

// ---- the ledger of corrections (core/corrections.ts): labelled and put in themes by the session's own model ----------

/** The model that labels the person's prompts and puts their corrections in themes. */
const LEDGER_MODEL = 'sonnet'
/** The most theme requests one run makes, the newest corrections first: enough to work off two months imported, behind the person's prompt. */
const THEME_RUNS = 12
/** Whether this session is putting corrections in themes now: one run at a time. */
let theming = false

/** The ledger as the flow tab shows it, kept; what was read stays when the bridge does not answer. */
async function loadCorrections($: EngineInterface): Promise<CorrectionsView | undefined> {
  const res = await bridge($, { op: 'corrections' }).catch(() => undefined)
  if (res === undefined || !res.ok || res.corrections === undefined) return undefined
  await update($, correctionsAtom, () => res.corrections as unknown as GemworksJson)
  return res.corrections
}

async function correctionsKept($: EngineInterface): Promise<CorrectionsView | null> { return (await read($, correctionsAtom)) as unknown as CorrectionsView | null }

/** What the flow tab draws of the ledger: its cards and each practice's count; none until read. */
async function ledgerKept($: EngineInterface): Promise<{ cards: CorrectionsView['cards']; counts: CorrectionsView['counts'] } | undefined> {
  const view = await correctionsKept($)
  return view !== null ? { cards: view.cards, counts: view.counts } : undefined
}

/**
 * A prompt the person typed, labelled by the session's own model following the guide (never keyword rules), into their
 * ledger, with the step this session's work item stood at; a correction then goes into a theme. When the model or the
 * bridge does not answer, nothing is kept: `gemworks corrections pending` finds it later.
 */
async function labelPrompt($: EngineInterface, p: { text: string; before: string; at: string; session: string; project: string; flow?: string; step?: string }): Promise<void> {
  const ask = labelRequest([{ text: p.text, before: p.before }])
  const r = await $.model.complete({ model: LEDGER_MODEL, system: ask.system, prompt: ask.prompt, maxTokens: 300, effort: 'low', timeoutMs: 60_000 })
  if (!r.isAnswered) return
  const label = readLabels(r.text, 1)[0]
  if (label === undefined) return
  const row: LabelledPrompt = {
    id: promptId(p.session, p.at, new Set()), at: p.at, session: p.session, text: p.text, ...label, project: p.project,
    ...(p.flow !== undefined && p.step !== undefined ? { flow: p.flow, step: p.step } : {}), by: 'model',
  }
  const res = await bridge($, { op: 'corrections-add', prompts: [row] }).catch(() => undefined)
  if (res === undefined || !res.ok || res.corrections === undefined) return
  await update($, correctionsAtom, () => res.corrections as unknown as GemworksJson)
  // A correction goes into a theme; so do any waiting from before (imported, or a session that stopped), and the links follow changed practices.
  if (label.kind === 'correct' || res.corrections.unthemed > 0 || res.corrections.stale) await themeLedger($)
}

/**
 * The ledger's corrections put into themes, and the themes linked to the practices that state them, by the session's
 * own model, a batch a request; then a flow proposed for a kind of work corrected often with none. A correction the
 * reply left out is given no theme, so it is not asked again.
 */
async function themeLedger($: EngineInterface): Promise<void> {
  if (theming) return
  // Learning off (settings): the ledger is not themed, nor flows proposed from it.
  if (!(await readSettings($)).learn.enabled) return
  theming = true
  try {
    const session = await $.session.id().catch(() => '')
    if (session === '') return
    for (let run = 0; run < THEME_RUNS; run++) {
      const res = await bridge($, { op: 'corrections', toTheme: true, session }).catch(() => undefined)
      const view = res !== undefined && res.ok ? res.corrections : undefined
      const given = view?.toTheme
      if (view === undefined || given === undefined || (given.corrections.length === 0 && !view.stale)) break
      const ask = themeRequest(given.corrections, given.themes, given.practices)
      const r = await $.model.complete({ model: LEDGER_MODEL, system: ask.system, prompt: ask.prompt, maxTokens: 6000, effort: 'low', timeoutMs: 180_000 })
      if (!r.isAnswered) break
      const answer = readThemes(r.text, ask.handles)
      // A reply that put none in a theme is no answer (cut short, unreadable): nothing is marked, the batch is asked again
      // another time. One that answered most: the few it left out have no theme, so they are not asked again and again.
      if (given.corrections.length > 0 && answer.assign.length === 0) break
      const answered = new Set(answer.assign.map((a) => a.id))
      const most = answer.assign.length * 2 >= given.corrections.length
      const whole = { ...answer, assign: [...answer.assign, ...(most ? given.corrections.filter((c) => !answered.has(c.id)).map((c) => ({ id: c.id, theme: null })) : [])] }
      const done = await bridge($, { op: 'corrections-themes', answer: whole, linked: linkKey(given.practices) }).catch(() => undefined)
      if (done === undefined || !done.ok || done.corrections === undefined) break
      await update($, correctionsAtom, () => done.corrections as unknown as GemworksJson)
      if (done.corrections.unthemed === 0 && !done.corrections.stale) break
    }
    await proposeFlows($)
  } finally {
    theming = false
  }
}

/** A flow proposed, once, for each kind of work corrected often in the last days with no work item on a flow: its steps drafted by the model, the card the flow tab's own. */
async function proposeFlows($: EngineInterface): Promise<void> {
  const view = await correctionsKept($)
  if (view === null || view.flowless.length === 0 || (await gemlDir($)) === null) return
  const flows = await coachFlowsKept($)
  const t = await words($)
  for (const f of view.flowless) {
    const kept = await proposalsKept($)
    if (flows.some((x) => x.name === f.work) || kept.some((p) => p.kind === 'new-flow' && p.flow === f.work)) continue
    const ask = flowRequest(f.work, f.quotes)
    const r = await $.model.complete({ model: LEDGER_MODEL, system: ask.system, prompt: ask.prompt, maxTokens: 1500, effort: 'low', timeoutMs: 120_000 })
    const draft = r.isAnswered ? readFlowDraft(r.text) : undefined
    if (draft === undefined) continue
    const at = await nowIso($)
    const made = newProposals([{ kind: 'new-flow', name: f.work, ...draft, why: t('近 7 天纠正 {0} 次，其中判断 {1} 次，无流程可挂', f.n, f.judgment) }], flows, kept, at, (n) => `c${Date.parse(at).toString(36).slice(-6)}${n}`)
    if (made.added.length > 0) await saveProposals($, [...kept, ...made.added.map((p) => ({ ...p, by: 'gemworks' as const }))])
  }
}

/** The practice tool: the practices given, checked against the flows and the ones kept, into their layers. */
async function recordPractices($: EngineInterface, event: unknown): Promise<ToolCallResult> {
  if ((event as { agentId?: string }).agentId !== undefined) return { result: 'Not recorded: only the main conversation records practices.' }
  const args = toolArgs(event as Record<string, unknown>)
  const given = Array.isArray(args['practices']) ? (args['practices'] as unknown[]) : []
  const memory = args['memory'] === true
  const flows = await coachFlows($)
  await loadPractices($)
  const kept = (await practicesKept($))?.list ?? []
  const at = await nowIso($)
  const stamp = Date.parse(at).toString(36).slice(-6)
  const session = await $.session.id().catch(() => '')
  const turn = currentTurn(parseLog(await ownLogText($, (await read($, sessionsDirAtom)) ?? '', session).catch(() => '')))
  const r = newPractices(given, kept, at, memory ? 'memory' : 'model', (n) => `p${stamp}${n}`, flows.map((f) => ({ name: f.name, steps: f.states.map((s) => s.id) })), { session, turn })
  if (r.added.length === 0 && !memory) return { result: `Nothing recorded: ${r.errors.join('; ') || 'practices is a list'}.` }
  const res = await bridge($, { op: 'practice-add', practices: r.added, ...(memory ? { memory: true } : {}) }).catch(() => undefined)
  if (res === undefined || !res.ok) return { result: 'Nothing recorded: gemworks could not write the practices.' }
  if (res.practices !== undefined) await update($, practicesAtom, () => res.practices as unknown as GemworksJson)
  // A new practice may state a theme the person kept saying: the themes are linked again, behind.
  if (r.added.length > 0) $.clock.after(0, () => { void themeLedger($).catch(() => undefined) })
  return { result: `Recorded ${r.added.length} practice${r.added.length === 1 ? '' : 's'}; they remind at their steps.${r.errors.length > 0 ? ` Left out: ${r.errors.join('; ')}.` : ''}` }
}

/** The work tool: the turn's work items, checked against the flows, into this session's log; the board shows them. */
async function recordWork($: EngineInterface, event: unknown): Promise<ToolCallResult> {
  if ((event as { agentId?: string }).agentId !== undefined) return { result: 'Not recorded: only the main conversation reports work items.' }
  if ((await read($, sessionsDirAtom)) === null) return { result: 'Nothing recorded: this project has no shared session record yet (gemworks has not read the repository).' }
  const flows = await coachFlows($)
  const items = await workItems($)
  const at = await nowIso($)
  const stamp = Date.parse(at).toString(36).slice(-6)
  let errors: string[] = []
  let made: SessionEvent[] = []
  await appendOwn($, (so) => {
    const r = workEvents(toolArgs(event as Record<string, unknown>), flows, items, at, currentTurn(so), (n) => `${stamp}${n}`)
    errors = r.errors
    made = r.events
    return r.events
  })
  if (made.length === 0) return { result: `Nothing recorded: ${errors.join('; ') || 'items is a list of work items'}.` }
  turnReported = true
  // The board reads the sessions it was drawn from: their new record draws it again.
  await loadProjectSessions($)
  const said = made.map((e) => (e.t === 'item' ? `#${e.id} «${e.title}» (${e.flow}: ${e.state}${e.status !== 'open' ? `, ${e.status}` : ''})` : '')).join('; ')
  return { result: `Recorded ${said}.${errors.length > 0 ? ` Left out: ${errors.join('; ')}.` : ''}` }
}

/**
 * A visual drawn inline (the visualize tool) has no file or link of its own: a page of it in the project's `.geml/visuals/`,
 * named by its title (the same title, a new version), among the turn's artifacts at its end.
 */
async function keepVisual($: EngineInterface, input: Record<string, unknown>): Promise<void> {
  const code = typeof input['widget_code'] === 'string' ? input['widget_code'] : ''
  const dir = await read($, sessionsDirAtom)
  if (code.trim() === '' || dir === null) return
  const title = typeof input['title'] === 'string' ? input['title'] : ''
  const path = `${dir.replace(/[\\/]sessions[\\/]?$/, '')}/visuals/${visualFileName(title)}`
  await $.fs.write(path, visualPage(title, code))
  await update($, madeElsewhereAtom, (was) => [...new Set([...(was ?? []), path])])
}

/**
 * The work item an artifact goes under: the workflow's current one, which the bridge knows ({}); else the one this
 * session's turn is on (the coach's); undefined when there is neither, and the artifact is no work item's.
 */
async function artifactItem($: EngineInterface): Promise<{ item?: string } | undefined> {
  if ((await readShell($))?.status?.item.kind === 'item') return {}
  const item = turnItem(await workItems($), await $.session.id().catch(() => ''))
  return item !== undefined ? { item: item.id } : undefined
}

/** A turn's end, on a work item: the files it wrote that git does not keep get a version where their content changed. */
async function artifactsOnTurn($: EngineInterface): Promise<void> {
  const [on, made, drafts, here] = await Promise.all([artifactItem($), read($, madeElsewhereAtom), read($, notMadeAtom), read($, madeHereAtom)])
  const elsewhere = ((made as unknown) as string[] | null) ?? []
  const notMade = ((drafts as unknown) as string[] | null) ?? []
  const written = ((here as unknown) as string[] | null) ?? []
  if (elsewhere.length > 0) await update($, madeElsewhereAtom, () => [] as unknown as GemworksJson)
  if (notMade.length > 0) await update($, notMadeAtom, () => [] as string[])
  if (written.length > 0) await update($, madeHereAtom, () => [] as string[])
  // A turn on no work item made nothing that is one's.
  if (on === undefined) return
  // The workflow item's journal names what it wrote; with the coach's item, the turn's own list does.
  const own = on.item !== undefined && written.length > 0 ? { written } : {}
  await bridge($, { op: 'artifacts', ...on, ...own, ...(elsewhere.length > 0 ? { elsewhere } : {}), ...(notMade.length > 0 ? { notMade } : {}) }, SLOW_TIMEOUT_MS).catch(() => undefined)
  // What the turn recorded shows on an open board now: nothing else reads the board again while the stage stays put.
  try { if ((await $.ui.panes()).some((p) => p.id === BOARD_ID)) await reloadBoardLater($) } catch { /* read when next opened */ }
}

/** What the person gave with a prompt (images, documents): their bytes, as the conversation holds them, among the work item's artifacts. */
async function uploadsOnPrompt($: EngineInterface, named: readonly { type: string; mediaType?: string; filename?: string }[]): Promise<void> {
  const on = await artifactItem($)
  if (on === undefined) return
  const messages = await $.session.messages({ as: 'api' })
  if (!Array.isArray(messages)) return
  const last = [...messages].reverse().find((m) => m.role === 'user' && m.content.some((b) => b.type === 'image' || b.type === 'document'))
  if (last === undefined) return
  const media = last.content.filter((b) => b.type === 'image' || b.type === 'document')
  for (const [i, b] of media.entries()) {
    const source = b['source'] as { type?: string; media_type?: string; data?: string } | undefined
    if (source?.type !== 'base64' || typeof source.data !== 'string' || source.data === '') continue
    const name = named[i]?.filename
    const mediaType = source.media_type ?? named[i]?.mediaType
    await bridge($, { op: 'artifact', ...on, kind: b.type === 'image' ? 'image' : 'file', where: 'upload', data: source.data, ...(name !== undefined ? { name } : {}), ...(mediaType !== undefined ? { mediaType } : {}) }, SLOW_TIMEOUT_MS)
  }
  await reloadBoardLater($)
}

/** A question the model registered (the ask tool): kept for the band, which asks it once the turn ends. A subagent's goes nowhere. */
async function registerAsk($: EngineInterface, event: unknown): Promise<ToolCallResult> {
  if ((event as { agentId?: string }).agentId !== undefined) return { result: 'Not registered: only the main conversation asks the person.' }
  const asked = askedOf(toolArgs(event as Record<string, unknown>))
  if ('error' in asked) return { result: `Not registered: ${asked.error}.` }
  const stamped = { ...asked, at: await nowIso($) }
  await update($, askedAtom, (was) => [...(was ?? []).filter((q) => q.question !== asked.question), stamped])
  return { result: 'Registered: the status band asks it with these answers once this turn ends.' }
}

/** What the model says the work item made that gemworks did not see: a link, a picture, a file — under the current work item's artifacts. */
async function recordArtifact($: EngineInterface, event: unknown): Promise<ToolCallResult> {
  const args = toolArgs(event as Record<string, unknown>)
  const kind = args['kind']
  const where = typeof args['where'] === 'string' ? args['where'].trim() : ''
  if ((kind !== 'link' && kind !== 'image' && kind !== 'file') || where === '') return { result: 'Nothing recorded: kind is link, image or file, and where is the address or the path.' }
  const name = typeof args['name'] === 'string' ? args['name'] : undefined
  const version = typeof args['version'] === 'string' ? args['version'] : undefined
  const on = await artifactItem($)
  if (on === undefined) return { result: 'Nothing recorded: no work item is on the way in this session; report the one this is for with the work tool first.' }
  const res = await bridge($, { op: 'artifact', ...on, kind, where, ...(name !== undefined ? { name } : {}), ...(version !== undefined ? { version } : {}) })
  if (res === undefined) return { result: 'Nothing recorded: gemworks did not answer.' }
  if (!res.ok) return { result: `Nothing recorded: ${res.error.replace(/^gemworks: /, '')}` }
  await reloadBoardLater($)
  return { result: res.text ?? 'Recorded.' }
}

/** A page the Artifact tool published: its link among the current work item's artifacts, named by its title. */
async function publishedArtifact($: EngineInterface, said: string | undefined, input: Record<string, unknown>): Promise<void> {
  if ((input['action'] !== undefined && input['action'] !== 'publish') || input['asset'] === true) return
  const link = publishedLink(said ?? '')
  if (link === undefined) return
  const title = typeof input['title'] === 'string' && input['title'] !== '' ? input['title'] : undefined
  const page = typeof input['file_path'] === 'string' && input['file_path'] !== '' ? input['file_path'] : undefined
  const on = await artifactItem($)
  if (on === undefined) return
  const res = await bridge($, { op: 'artifact', ...on, kind: 'link', where: link.url, ...(link.version !== undefined ? { version: link.version } : {}), ...(title !== undefined ? { name: title } : {}), ...(page !== undefined ? { page } : {}) })
  if (res !== undefined && res.ok) await reloadBoardLater($)
}

/** A turn's end: its answer into this session's log, and the commits a command in it made. */
async function sessionsOnAnswer($: EngineInterface, answer: string): Promise<void> {
  const at = await nowIso($)
  const committed = await read($, committedAtom)
  if (committed) await update($, committedAtom, () => false)
  let commits: { sha: string; at: string; subject: string }[] = []
  const root = await read($, rootAtom)
  const events = await appendOwn($, (so) => [{ t: 'answer', turn: currentTurn(so), at, text: answer }])
  const asked = [...events].reverse().find((x): x is Extract<SessionEvent, { t: 'prompt' }> => x.t === 'prompt')
  if (committed && root !== null && asked !== undefined) {
    try {
      const r = await $.process.run(['git', '-C', root, 'log', `--since=${asked.at}`, '--format=%H%x09%cI%x09%s', 'HEAD'], { timeoutMs: BRIDGE_TIMEOUT_MS })
      if (r.exitCode === 0) commits = r.stdout.split(/\r?\n/).filter((l) => l !== '').map((l) => { const [sha = '', when = at, ...rest] = l.split('\t'); return { sha, at: when, subject: rest.join('\t') } })
    } catch { commits = [] }
  }
  if (commits.length > 0) {
    const branch = ((await read($, hostAtom)) as unknown as HostInfo | null)?.branch
    await appendOwn($, (so) => commits.filter((c) => !so.some((x) => x.t === 'commit' && x.sha === c.sha)).map((c): SessionEvent => ({ t: 'commit', turn: currentTurn(so), at: c.at, sha: c.sha, subject: c.subject, ...(branch !== undefined ? { branch } : {}) })))
  }
  await loadProjectSessions($)
}

/** The answer of the turn a prompt opened, as this session's log holds it; null when it has none. */
async function answerOf($: EngineInterface, p: PromptRecord): Promise<string | null> {
  try {
    const dir = await read($, sessionsDirAtom)
    if (dir === null) return null
    const events = parseLog(await ownLogText($, dir, await $.session.id()))
    const at = Date.parse(p.at)
    const asked = events.filter((x): x is Extract<SessionEvent, { t: 'prompt' }> => x.t === 'prompt' && x.text === p.text)
      .sort((a, b) => Math.abs(Date.parse(a.at) - at) - Math.abs(Date.parse(b.at) - at))[0]
    if (asked === undefined) return null
    const answered = events.find((x): x is Extract<SessionEvent, { t: 'answer' }> => x.t === 'answer' && x.turn === asked.turn)
    return answered?.text ?? null
  } catch { return null }
}

/** A file this session wrote: into its log once. */
async function sessionsOnFile($: EngineInterface, path: string): Promise<void> {
  const at = await nowIso($)
  const branch = ((await read($, hostAtom)) as unknown as HostInfo | null)?.branch
  await appendOwn($, (so) => (so.some((x) => x.t === 'file' && x.path === path) ? [] : [{ t: 'file', turn: currentTurn(so), at, path, ...(branch !== undefined ? { branch } : {}) }]))
}

/** Ask the bridge what the repository says (pushed or not, pull requests green or failing); the band redraws when it changed. */
async function loadFacts($: EngineInterface): Promise<void> {
  // This session's id marks it open, so the other sessions leave the steps of its branch to it.
  let session: string | undefined
  try { session = await $.session.id() } catch { /* headless */ }
  const res = await bridge($, { op: 'attention', ...(session !== undefined && session !== '' ? { session } : {}) }, SLOW_TIMEOUT_MS)
  if (res === undefined || !res.ok) return
  // The machine comes back with no workflow too, where the repository's facts do not.
  const host = res.host
  if (host !== undefined && JSON.stringify(host) !== JSON.stringify(await read($, hostAtom))) {
    await update($, hostAtom, () => host as unknown as GemworksJson)
    $.ui.invalidate('ui.render')
  }
  if (res.attention === undefined) return
  const dir = res.sessions
  if (dir !== undefined && dir !== (await read($, sessionsDirAtom))) {
    await update($, sessionsDirAtom, () => dir)
    await loadProjectSessions($)
  }
  const facts = res.attention
  // A branch no longer ahead (pushed, or gone), or a pull request no longer open, lets its hold go: the next time it comes up, it is asked about again.
  const dismissed = await dismissedOf($)
  const kept = heldSteps(dismissed, facts).dismissed
  if (kept.length !== dismissed.length) {
    await update($, dismissedAtom, () => kept as unknown as GemworksJson)
    try { await $.store.set(`dismissed:${(await read($, rootAtom)) ?? ''}`, kept as unknown as GemworksJson) } catch { /* the session keeps its own */ }
  }
  if (JSON.stringify(facts) === JSON.stringify(await read($, factsAtom))) return
  await update($, factsAtom, () => facts as unknown as GemworksJson)
  $.ui.invalidate('ui.render')
}

/** The waits between a start that got no answer and the next try by itself: soon, then slower, then every minute. */
const START_BACKOFF_MS = [5_000, 15_000, 30_000, 60_000]
let startTries = 0
/** Whether a start is waiting to try again: the band says so while the stage is not there. */
let startRetrying = false

/**
 * A start that got no shell (no Node, no answer in time — the machine busy
 * while the session restarts) tries again by itself, in 5 s, then 15 s, 30 s,
 * then every minute, until a shell comes; the band says 桥接未应答，重试中
 * meanwhile instead of 启动中… for good. A prompt or a tool call in between
 * tries at once (retryStart).
 */
function scheduleStartRetry($: EngineInterface): void {
  const wait = START_BACKOFF_MS[Math.min(startTries, START_BACKOFF_MS.length - 1)] as number
  startTries += 1
  startRetrying = true
  $.ui.invalidate('ui.render')
  $.clock.after(wait, () => {
    void (async () => { if ((await read($, rootAtom)) !== null && (await read($, shellAtom)) === null) await startBridge($) })().catch(() => undefined)
  })
}

/** Node, then the first status; a start that got no answer tries again by itself (scheduleStartRetry). */
async function startBridge($: EngineInterface): Promise<void> {
  const now = await $.clock.now()
  await update($, startedAtAtom, () => now)
  if ((await read($, nodeAtom)) === null) {
    const found = await findNode($)
    if ('problem' in found) {
      await update($, problemAtom, () => found.problem)
      return
    }
    await update($, nodeAtom, () => found.node)
  }
  // The first status of a session also moves the earlier layout (a workflow directory in the checkout) into the project's home.
  const res = await bridge($, { op: 'status', migrate: true })
  if (res === undefined) { scheduleStartRetry($); return }
  startTries = 0
  startRetrying = false
  const dir = res.ok ? res.sessions : undefined
  if (dir !== undefined && dir !== (await read($, sessionsDirAtom))) await update($, sessionsDirAtom, () => dir)
  if (res.ok && res.practices !== undefined) await update($, practicesAtom, () => res.practices as unknown as GemworksJson)
  // The coach's flows, read once the project's home is known (its own flows sit beside its sessions).
  $.clock.after(0, () => { void coachFlows($).catch(() => undefined); void loadGrowth($).catch(() => undefined) })
  // git and gh can take seconds: catch up outside the start the first prompt waits on, and read the board the inbox is built from.
  $.clock.after(0, () => {
    void bridge($, { op: 'refresh' }, SLOW_TIMEOUT_MS).then(() => loadBoard($))
  })
}

/** The top of the checkout a directory is in, by git, asked once per directory; undefined when it is in none or git cannot say. */
const checkouts = new Map<string, string | undefined>()
async function checkoutOf($: EngineInterface, dir: string): Promise<string | undefined> {
  if (checkouts.has(dir)) return checkouts.get(dir)
  let top: string | undefined
  try {
    const r = await $.process.run(['git', '-C', dir, 'rev-parse', '--show-toplevel'], { timeoutMs: BRIDGE_TIMEOUT_MS })
    const line = r.stdout.trim()
    top = r.exitCode === 0 && line !== '' ? line : undefined
  } catch {
    top = undefined
  }
  checkouts.set(dir, top)
  return top
}

/** A path as compared: forward slashes, and a Windows drive's path in one case. */
function samePath(a: string, b: string): boolean {
  const norm = (p: string) => { const s = p.split('\\').join('/').replace(/\/+$/, ''); return /^[a-z]:\//i.test(s) ? s.toLowerCase() : s }
  return norm(a) === norm(b)
}

/**
 * The session moved to another checkout (a directory added or switched to, a
 * worktree entered): the root follows it, and what was read for the old one
 * is dropped and read again there. A directory in no checkout leaves the root.
 */
async function followCwd($: EngineInterface): Promise<void> {
  const cwd = await callCwd($)
  if (cwd === undefined) return
  const to = await checkoutOf($, cwd)
  if (to === undefined) return
  const root = await read($, rootAtom)
  // The root is the checkout's top, where .geml/ is: a session started in a subdirectory moves up to it too.
  if (root !== null && samePath(root, to)) return
  // The old checkout's counts are stored under it; the new one reads its own.
  try { await storeUsage($) } catch { /* kept for the session */ }
  await update($, rootAtom, () => to)
  await update($, usageBookAtom, () => null)
  await update($, usagePendingAtom, () => ({}) as GemworksJson)
  await update($, dismissedAtom, () => null)
  await loadStored($)
  await update($, shellAtom, () => null)
  await update($, boardAtom, () => null)
  await update($, boardProblemAtom, () => null)
  await update($, problemAtom, () => null)
  await update($, todoAtom, () => null)
  await update($, deliveredAtom, () => null)
  await update($, lastFileAtom, () => null)
  await update($, passesAtom, () => [] as unknown as GemworksJson)
  await update($, workflowsAtom, () => null)
  await startBridge($)
}

/** After a start that got no shell (no Node, no answer), a tool call or a prompt starts again — at most once a minute. */
async function retryStart($: EngineInterface): Promise<void> {
  if ((await read($, rootAtom)) === null || (await read($, shellAtom)) !== null) return
  const last = await read($, startedAtAtom)
  const wait = (await read($, nodeAtom)) === null ? NODE_RETRY_MS : START_RETRY_MS
  if (last !== null && (await $.clock.now()) - last < wait) return
  await startBridge($)
}

/** Register one tool or command; a refusal is noted for the band, and the start goes on. */
async function registerOne($: EngineInterface, name: string, register: () => Promise<unknown>): Promise<void> {
  try {
    await register()
  } catch (err) {
    const reason = reasonOf(err)
    await update($, setupAtom, (was) => `${was ?? 'gemworks：没有注册上'} ${name}（${reason}）`)
  }
}

// ---- the host's transcripts into the record, once (transcript.ts) --------------------------

interface InitState { state: 'running' | 'done'; done: number; total: number; failed: number }
/** Between files: how often a turn under way is looked at, how long at most one file waits for it, and the breath between two files. */
const BUSY_POLL_MS = 500
const BUSY_WAIT_MAX_MS = 5 * 60_000
const FILE_GAP_MS = 300

/**
 * The first start after the plugin is installed: every transcript of this
 * project's checkouts, this session's too, goes into the shared session record
 * and the work items' artifacts, one at a time in the background, the band
 * counting along; the store remembers it was done. Nothing here holds anything
 * up: a transcript that cannot be read is counted and passed over.
 */
async function initBackfill($: EngineInterface): Promise<void> {
  const dir = await read($, sessionsDirAtom)
  if (dir === null || (await readShell($))?.status == null) return
  const key = `init:${dir}`
  try { if ((await $.store.get(key)) === true) return } catch { return }
  const listed = await bridge($, { op: 'backfill-list' }, SLOW_TIMEOUT_MS).catch(() => undefined)
  if (listed === undefined || !listed.ok || listed.backfill === undefined || !('sessions' in listed.backfill)) return
  const sessions = listed.backfill.sessions
  const done = async () => { try { await $.store.set(key, true) } catch { /* done again at the next start */ } }
  // No transcript: nothing to say, nothing to do again.
  if (sessions.length === 0) { await done(); return }
  let own = ''
  try { own = await $.session.id() } catch { /* headless */ }
  const state: InitState = { state: 'running', done: 0, total: sessions.length, failed: 0 }
  await update($, initAtom, () => ({ ...state }))
  $.ui.invalidate('ui.render')
  for (const s of sessions) {
    // Between the person's turns only, and a breath between files: the reading never competes with a turn under way.
    for (let waited = 0; turnBusy && waited < BUSY_WAIT_MAX_MS; waited += BUSY_POLL_MS) await $.clock.sleep(BUSY_POLL_MS)
    await $.clock.sleep(FILE_GAP_MS)
    const mine = s.id === own
    const res = await bridge($, { op: 'backfill-one', file: s.file, ...(mine ? { own: true } : {}) }, SLOW_TIMEOUT_MS).catch(() => undefined)
    if (res === undefined || !res.ok) state.failed += 1
    else if (mine && res.backfill !== undefined && 'transcript' in res.backfill && res.backfill.transcript !== undefined) {
      try { await mergeOwnBackfill($, res.backfill.transcript) } catch { state.failed += 1 }
    }
    state.done += 1
    await update($, initAtom, () => ({ ...state }))
    $.ui.invalidate('ui.render')
  }
  await done()
  await update($, initAtom, () => ({ ...state, state: 'done' }))
  try { await loadProjectSessions($) } catch { /* read at the next prompt */ }
  await reloadBoardLater($)
  $.ui.invalidate('ui.render')
}

/** How recent a prompt must be to be left alone by a reconciliation: the host may not have written its row yet. */
const RECENT_MS = 2 * 60_000
/** How long the reconciliation waits before reading the transcript a second time: two reads that agree are a fact, a file that changed between them is not. */
const RECHECK_MS = 1_000

/**
 * The sessions tab and this session's log against the host's transcript on
 * disk: a prompt whose row the transcript no longer holds was removed or split
 * away (the split-session skill rewrites the file), so its line leaves the tab
 * and its turn's events leave the log — into the new session's log when the
 * turns were split there (`moveTo`). A prompt from the last two minutes, or
 * one without a row id, is left alone; without a transcript nothing changes.
 */
async function reconcileTurns($: EngineInterface, moveTo?: string): Promise<void> {
  let session: string
  try { session = await $.session.id() } catch { return }
  const was = await readPrompts($)
  const now = Date.parse(await nowIso($))
  const settled = was.filter((p) => p.uuid !== undefined && now - Date.parse(p.at) >= RECENT_MS)
  if (settled.length === 0) return
  const res = await bridge($, { op: 'turn-ids', session }, SLOW_TIMEOUT_MS).catch(() => undefined)
  if (res === undefined || !res.ok || res.backfill === undefined || !('uuids' in res.backfill)) return
  // Read again a second later: a transcript being rewritten changes between the reads, and a changing file is no fact.
  await $.clock.sleep(RECHECK_MS)
  const again = await bridge($, { op: 'turn-ids', session }, SLOW_TIMEOUT_MS).catch(() => undefined)
  if (again === undefined || !again.ok || again.backfill === undefined || !('uuids' in again.backfill)) return
  if (JSON.stringify(again.backfill.uuids) !== JSON.stringify(res.backfill.uuids) || JSON.stringify(again.backfill.messages ?? []) !== JSON.stringify(res.backfill.messages ?? [])) return
  const held = new Set([...res.backfill.uuids, ...(res.backfill.messages ?? []).map((m) => m.uuid)])
  const gone = settled.filter((p) => !held.has(p.uuid as string))
  if (gone.length === 0) return
  const goneIds = new Set(gone.map((p) => p.id))
  await update($, promptsAtom, (w) => (((w as unknown) as PromptRecord[] | null) ?? []).filter((p) => !goneIds.has(p.id)) as unknown as GemworksJson)
  $.clock.after(0, () => { void storePrompts($) })
  // The log: the gone prompts' turns (the same words within half a minute), whole, out; into the new session's log when they were split there.
  const dir = await read($, sessionsDirAtom)
  if (dir !== null) {
    try {
      const events = parseLog(await ownLogText($, dir, session))
      const turns = new Set<number>()
      for (const e of events) if (e.t === 'prompt' && gone.some((p) => p.text === e.text && Math.abs(Date.parse(p.at) - Date.parse(e.at)) < SAME_PROMPT_MS)) turns.add(e.turn)
      if (turns.size > 0) {
        const kept = events.filter((e) => !('turn' in e) || !turns.has(e.turn))
        const moved = events.filter((e) => 'turn' in e && turns.has(e.turn))
        await $.fs.write(`${dir}/${logName(OWN_HOST, session)}`, formatLog(kept))
        if (moveTo !== undefined && moveTo !== '') {
          const head = events.find((e): e is Extract<SessionEvent, { t: 'session' }> => e.t === 'session')
          const path = `${dir}/${logName(OWN_HOST, moveTo)}`
          let there: SessionEvent[] = []
          try { there = parseLog(String(await $.fs.read(path))) } catch { there = [] }
          const from = nextTurn(there)
          const numbers = new Map([...turns].sort((a, b) => a - b).map((n, i) => [n, from + i]))
          const first = moved.find((e) => e.t === 'prompt')?.at ?? await nowIso($)
          const opening: SessionEvent[] = there.some((e) => e.t === 'session') ? [] : [{ t: 'session', id: moveTo, host: OWN_HOST, at: first, ...(head?.branch !== undefined ? { branch: head.branch } : {}), ...(head?.checkout !== undefined ? { checkout: head.checkout } : {}) }]
          await $.fs.write(path, formatLog([...there, ...opening, ...moved.map((e): SessionEvent => ('turn' in e ? { ...e, turn: numbers.get(e.turn) as number } : e))]))
        }
      }
    } catch { /* the record stays as it was */ }
  }
  try { await loadProjectSessions($) } catch { /* read at the next prompt */ }
  await reloadBoardLater($)
}

/** What the split-session script printed last, when a command ran it: whether turns were removed, and the session they were split into. */
function splitSummary(done: unknown): { removed?: boolean; created?: { cliId: string } } | undefined {
  const d = done as { result?: unknown; text?: unknown } | undefined
  const r = d?.result as { stdout?: unknown } | undefined
  const out = typeof r?.stdout === 'string' ? r.stdout : typeof d?.text === 'string' ? d.text : ''
  const at = out.lastIndexOf('\n{')
  const text = at >= 0 ? out.slice(at + 1) : out.trimStart().startsWith('{') ? out : ''
  if (text === '') return undefined
  try {
    const v = JSON.parse(text) as { removed?: unknown; created?: { cliId?: unknown } }
    const created = typeof v.created?.cliId === 'string' ? v.created.cliId : undefined
    if (v.removed !== true && created === undefined) return undefined
    return { ...(v.removed === true ? { removed: true } : {}), ...(created !== undefined ? { created: { cliId: created } } : {}) }
  } catch { return undefined }
}

/** This session's turns before gemworks loaded: into its log before the ones recorded live, and onto the sessions tab, marked. */
async function mergeOwnBackfill($: EngineInterface, tr: Transcript): Promise<void> {
  if (tr.turns.length === 0) return
  const dir = await read($, sessionsDirAtom)
  if (dir === null) return
  const earlier = transcriptEvents(tr, OWN_HOST, { head: false })
  // The log, with its session line (appendOwn writes one when there is none), then the earlier turns put before its own.
  const events = await appendOwn($, () => [])
  if (events.length > 0) await $.fs.write(`${dir}/${logName(OWN_HOST, await $.session.id())}`, formatLog(withEarlierTurns(events, earlier)))
  const was = await readPrompts($)
  const there = (t: Transcript['turns'][number]): boolean => was.some((p) => p.text === t.text && Math.abs(Date.parse(p.at) - Date.parse(t.at)) < SAME_PROMPT_MS)
  const records: PromptRecord[] = tr.turns.filter((t) => !there(t)).map((t) => {
    const did = t.answer !== undefined ? answerGist(t.answer) : undefined
    return { id: `b-${t.uuid}`, at: t.at, text: t.text, uuid: t.uuid, ...(did !== undefined ? { did } : {}), tools: 0, refusals: 0, entered: [], signals: [], backfilled: true }
  })
  if (records.length === 0) return
  await update($, promptsAtom, (w) => [...records, ...(((w as unknown) as PromptRecord[] | null) ?? [])].slice(-PROMPTS_KEPT) as unknown as GemworksJson)
  $.clock.after(0, () => { void storePrompts($) })
}

// ---- how often each tool ran ------------------------------------------------------------

/** How many days of use the store keeps, and how many the tools tab counts. */
const USAGE_DAYS_KEPT = 7
const USAGE_DAYS_SHOWN = 2

/** The usage book: the stored one, read once a session, with what this session added since. */
async function usageBook($: EngineInterface): Promise<UsageBook> {
  // Read only: a drawing may call this, and drawing writes no state. The store's book is read in when the root is set (loadStored).
  const stored = ((await read($, usageBookAtom)) as unknown as UsageBook | null) ?? {}
  return mergeBooks(stored, ((await read($, usagePendingAtom)) as unknown as UsageBook | null) ?? {})
}

/** What the store keeps for this checkout — the usage book, the suggestions put away — read in once its root is set. */
async function loadStored($: EngineInterface): Promise<void> {
  const root = (await read($, rootAtom)) ?? ''
  let book: UsageBook = {}
  let dismissed: string[] = []
  try { book = ((await $.store.get(`usage:${root}`)) as unknown as UsageBook | null) ?? {} } catch { book = {} }
  try { dismissed = ((await $.store.get(`dismissed:${root}`)) as unknown as string[] | null) ?? [] } catch { dismissed = [] }
  await update($, usageBookAtom, () => book as unknown as GemworksJson)
  await update($, dismissedAtom, () => dismissed as unknown as GemworksJson)
}

/** How many sessions' prompts the store keeps, and how much of each prompt's text. */
const PROMPT_SESSIONS_KEPT = 8
const PROMPT_TEXT_KEPT = 2000

/** This session's prompts into the store (under its id), the oldest sessions' let go; a store that refuses leaves the session's own. */
async function storePrompts($: EngineInterface): Promise<void> {
  try {
    const id = await $.session.id()
    const prompts = (await readPrompts($)).map((p) => (p.text.length > PROMPT_TEXT_KEPT ? { ...p, text: p.text.slice(0, PROMPT_TEXT_KEPT) } : p))
    await $.store.set(`prompts:${id}`, prompts)
    const was = await $.store.get('prompts:sessions')
    const order = [...(Array.isArray(was) ? (was as string[]).filter((x) => x !== id) : []), id]
    for (const old of order.slice(0, -PROMPT_SESSIONS_KEPT)) await $.store.delete(`prompts:${old}`)
    await $.store.set('prompts:sessions', order.slice(-PROMPT_SESSIONS_KEPT))
  } catch { /* the session's own state still holds them */ }
}

/** At a load with no prompts held (the app restarted under a resumed session), the ones the store kept for it. */
async function restorePrompts($: EngineInterface): Promise<void> {
  if ((await readPrompts($)).length > 0) return
  try {
    const kept = await $.store.get(`prompts:${await $.session.id()}`)
    if (Array.isArray(kept) && kept.length > 0) await update($, promptsAtom, () => kept as unknown as GemworksJson)
  } catch { /* none kept */ }
}

/** One call noted in this session's book; a failure to count never stands in the call's way. */
async function noteUsage($: EngineInterface, tool: string, input: Record<string, unknown>): Promise<void> {
  try {
    const keys = usageKeys(tool, input)
    const day = dayKey(await nowIso($))
    await update($, usagePendingAtom, (was) => noteUse((((was as unknown) as UsageBook | null) ?? {}), day, keys) as unknown as GemworksJson)
  } catch { /* the count is a nicety */ }
}

/** These two days' counts, by key. */
async function usageNow($: EngineInterface): Promise<Record<string, number>> {
  return usesSince(await usageBook($), await nowIso($), USAGE_DAYS_SHOWN)
}

/**
 * The usage a drawing shows: the stored book alone. What this session's calls add joins it when the turn ends
 * (storeUsage), so a tool call, which notes its use, redraws neither the band nor the board.
 */
async function usageDrawn($: EngineInterface): Promise<Record<string, number>> {
  const [book, now] = await Promise.all([read($, usageBookAtom), nowIso($)])
  return usesSince((book as unknown as UsageBook | null) ?? {}, now, USAGE_DAYS_SHOWN)
}

/** What this session added goes into the store, merged with what other sessions stored meanwhile. */
async function storeUsage($: EngineInterface): Promise<void> {
  const pending = ((await read($, usagePendingAtom)) as unknown as UsageBook | null) ?? {}
  if (Object.keys(pending).length === 0) return
  const key = `usage:${(await read($, rootAtom)) ?? ''}`
  try {
    const stored = ((await $.store.get(key)) as unknown as UsageBook | null) ?? {}
    const next = pruneBook(mergeBooks(stored, pending), USAGE_DAYS_KEPT)
    await $.store.set(key, next as unknown as GemworksJson)
    await update($, usageBookAtom, () => next as unknown as GemworksJson)
    await update($, usagePendingAtom, () => ({}) as GemworksJson)
  } catch { /* a read-only store: the session keeps its own */ }
}

/** The suggestions put away in this project. */
async function dismissedOf($: EngineInterface): Promise<string[]> {
  // Read only, like usageBook: loadStored put the store's list here.
  return ((await read($, dismissedAtom)) as unknown as string[] | null) ?? []
}

// ---- each turn's judgement ---------------------------------------------------------------

/** What waits on the person, as the band and the board list it. */
async function pendingNow($: EngineInterface, t: T): Promise<InboxItem[]> {
  const shell = await readShell($)
  const board = await readBoard($)
  const item = shell?.status?.item
  return pendingList(await inboxOf($, t), [...othersWaiting(board, item?.kind === 'item' ? item.id : undefined, t), ...(board !== null ? [...toolSuggestions(board, await usageDrawn($), await dismissedOf($), t), ...ciSuggestions(board, shell?.units ?? [], await dismissedOf($), t)] : [])])
}

/** Take a judged option: a way out (and how to take it back: the revision before), or a work item to come back to. Nothing is said: the person's prompt said it. */
async function takeOption($: EngineInterface, option: JudgeOption): Promise<Judgement['undo'] | undefined> {
  const a = option.action
  if (a.op === 'advance') {
    const before = a.file === undefined ? (await readShell($))?.status?.state?.rev : (await readBoard($))?.items.find((i) => i.file === a.file)?.rev
    const res = await bridge($, { op: 'advance', to: a.to }, BRIDGE_TIMEOUT_MS, a.file)
    await loadBoard($)
    if (res !== undefined && !res.ok) $.ui.toast(`gemworks：${res.error.replace(/^gemworks: /, '')}`)
    return res?.ok === true && before !== undefined ? { ...(a.file !== undefined ? { file: a.file } : {}), rev: before } : undefined
  }
  if (a.op === 'switch-file') {
    await update($, lastFileAtom, () => a.file)
    await bridge($, { op: 'status' })
    await loadBoard($)
  }
  return undefined
}

/**
 * The turn's judgement (typing is pressing a button): whether the person's
 * prompt picks one of the options waiting on them. A small model reads them,
 * the last answer's first sentence and the prompt; a sure pick is taken and
 * shown with an undo, an unsure one is asked on the band. Run after the
 * prompt is on its way: the model's turn does not wait for it.
 */
async function judgeTurn($: EngineInterface, said: string, lastAnswer: string): Promise<void> {
  const t = await words($)
  const options = judgeOptions(await pendingNow($, t))
  if (options.length === 0) { await update($, judgedAtom, () => null); return }
  const ask = judgeRequest(options, lastAnswer, said)
  const r = await $.model.complete({ model: 'haiku', system: ask.system, prompt: ask.prompt, maxTokens: 200, effort: 'low', timeoutMs: 20_000 })
  const found = r.isAnswered ? readJudgement(r.text, options) : undefined
  if (found === undefined) { await update($, judgedAtom, () => null); return }
  const undo = found.sure ? await takeOption($, found.option) : undefined
  const judged: Judgement = { at: await nowIso($), said: promptLine(said, 60), option: found.option, ...(found.alternatives.length > 0 ? { alternatives: found.alternatives } : {}), sure: found.sure, why: found.why, taken: found.sure, ...(undo !== undefined ? { undo } : {}) }
  await update($, judgedAtom, () => judged as unknown as GemworksJson)
}

// ---- the inbox, the digest and the notifications -------------------------------

/** The inbox as it stands: the shell, the board's timeline, the questions nobody answered, the bridge's problem. */
async function inboxOf($: EngineInterface, t?: T): Promise<InboxItem[]> {
  const [board, shell, problem, now, said] = await Promise.all([readBoard($), readShell($), read($, problemAtom), nowIso($), t !== undefined ? Promise.resolve(t) : words($)])
  return inboxItems({ shell, timeline: board?.timeline ?? [], problem, now, t: said })
}

/** Tell the desktop of inbox items it has not seen, when the settings say so; a bridge problem is not news. */
async function notifyInbox($: EngineInterface): Promise<void> {
  const t = await words($)
  const items = (await inboxOf($, t)).filter((i) => i.kind !== 'broken')
  const seen = (await read($, seenInboxAtom)) as unknown as string[] | null
  const keys = items.map((i) => i.key)
  await update($, seenInboxAtom, () => keys as unknown as GemworksJson)
  if (seen === null) return
  const fresh = items.filter((i) => !seen.includes(i.key))
  if (fresh.length === 0 || !(await readSettings($)).notify.inbox) return
  const first = fresh[0] as InboxItem
  const head = first.kind === 'approve' ? (first.closes === true ? t('需验收：{0}', first.title) : t('需决定：{0}', first.title)) : `${first.verb} ${first.title}`.trim()
  const text = [head, ...first.detail.slice(0, 1)].join('\n')
  try { await $.ui.notify(text, { title: 'Gemworks' }) } catch { /* no channel */ }
}

/** What waits on the person as a turn ends, when the settings say so: a question the band asks, a work item of this session at a step they judge. Each once. */
async function notifyWaiting($: EngineInterface, asks: readonly Asked[]): Promise<void> {
  const s = await readSettings($)
  if (!s.notify.inbox && !s.notify.confirm) return
  const [t, items, flows, session, seen] = await Promise.all([words($), workItems($), coachFlowsKept($), $.session.id().catch(() => ''), read($, notifiedWaitingAtom)])
  const w = waitingNotices(asks, items, flows, session, (seen as string[] | null) ?? [], t)
  await update($, notifiedWaitingAtom, () => w.keys)
  for (const text of [s.notify.inbox ? w.ask : undefined, s.notify.confirm ? w.confirm : undefined]) {
    if (text !== undefined) { try { await $.ui.notify(text, { title: 'Gemworks' }) } catch { /* no channel */ } }
  }
}

/** A refusal: one notification per reason every few minutes, when the settings say so. */
async function notifyRefusal($: EngineInterface, tool: string, reason: string): Promise<void> {
  if (!(await readSettings($)).notify.refusal) return
  const short = shortReason(reason)
  const now = await $.clock.now()
  const notified = ((await read($, notifiedAtom)) as unknown as Record<string, string> | null) ?? {}
  const last = Date.parse(notified[short] ?? '')
  if (Number.isFinite(last) && now - last < REFUSAL_NOTIFY_MS) return
  await update($, notifiedAtom, () => ({ ...notified, [short]: new Date(now).toISOString() }) as unknown as GemworksJson)
  const t = await words($)
  try { await $.ui.notify(t('拦下了 {0}：{1}', tool, short), { title: 'Gemworks' }) } catch { /* no channel */ }
}

/** A stage change, when the settings say so. */
async function notifyStage($: EngineInterface, res: Extract<BridgeResponse, { ok: true }>): Promise<void> {
  if (!(await readSettings($)).notify.stage) return
  const item = res.shell.status?.item
  const t = await words($)
  try { await $.ui.notify(t('{0} 进了 #{1}', item?.kind === 'item' ? item.id : 'Gemworks', (res.entered ?? []).join(' → ')), { title: 'Gemworks' }) } catch { /* no channel */ }
}

/** The last prompt's record changed by `fn`: what the turn after it did. */
async function notePrompt($: EngineInterface, fn: (p: PromptRecord) => PromptRecord): Promise<void> {
  await update($, promptsAtom, (was) => {
    const list = [...(((was as unknown) as PromptRecord[] | null) ?? [])]
    const last = list[list.length - 1]
    if (last === undefined) return was
    list[list.length - 1] = fn(last)
    return list as unknown as GemworksJson
  })
}

// ---- the actions -------------------------------------------------------------------

const VERB_FAILED = { result: 'gemworks failed; the line above the prompt says why' }

const PANE_TITLE = 'Gemworks'

/** The marketplace the plugin was installed from, read off its path; absent for a `--plugin-dir` plugin. */
function marketplaceOf(root: string): string | undefined {
  return root.split('\\').join('/').match(/\/plugins\/(?:cache|marketplaces)\/([^/]+)\//)?.[1]
}

async function openBoard($: EngineInterface, tab?: BoardTab, readNow = true): Promise<{ isPlaced: boolean; reason?: string }> {
  if (tab !== undefined) await update($, tabAtom, () => tab)
  const opened = await $.ui.open({ id: BOARD_ID, title: PANE_TITLE })
  // Open first, then read it behind: a board not read yet says 正在读取看板… meanwhile (a read that fails says why again);
  // one read before shows what it had until the new read lands, so nothing recorded since is missing for long.
  if ((await readBoard($)) === null) await update($, boardProblemAtom, () => null)
  if (readNow) $.clock.after(0, () => { void loadBoard($) })
  else if (['items', 'made'].includes((await read($, tabAtom)) as string)) $.clock.after(0, () => { void loadMade($) })
  return opened
}

/**
 * A reload: a pane the module before this one left up still answers to that
 * module, so its presses do nothing — and opening an id that is open only
 * retitles it. The board is closed and opened again, which draws it anew from
 * this module (its tab is kept in the state); a dialog is closed.
 */
async function adoptPanes($: EngineInterface): Promise<void> {
  try {
    const up = await $.ui.panes()
    trace($, `adopt: panes up ${JSON.stringify(up.map((p) => `${p.id}${p.isShown ? '*' : ''}`))}`)
    if (up.some((p) => p.id === BOARD_ID)) { await $.ui.close({ id: BOARD_ID }); const o = await $.ui.open({ id: BOARD_ID, title: PANE_TITLE }); trace($, `adopt: board closed and opened, placed ${String(o.isPlaced)}`) }
    if (up.some((p) => p.id === DIALOG_ID)) { await update($, dialogAtom, () => null); await $.ui.close({ id: DIALOG_ID }) }
  } catch { /* no pane to adopt */ }
}

/** The newest published version, asked once per session. */
async function checkLatest($: EngineInterface): Promise<void> {
  if ((await read($, latestAtom)) !== null) return
  try {
    const r = await $.http.fetch(REGISTRY)
    const version = r.ok ? (JSON.parse(r.text) as { version?: unknown }).version : undefined
    await update($, latestAtom, () => (typeof version === 'string' ? { version } : { error: `HTTP ${r.status}` }) as unknown as GemworksJson)
  } catch (err) {
    const error = reasonOf(err)
    await update($, latestAtom, () => ({ error }) as unknown as GemworksJson)
  }
}

/** The bundled and the installed workflows, for the settings dialog. */
async function loadWorkflows($: EngineInterface): Promise<void> {
  const res = await bridge($, { op: 'add' }, SLOW_TIMEOUT_MS)
  if (res !== undefined && res.ok) {
    const value = { bundled: res.workflows ?? [], installed: res.installed ?? [] }
    await update($, workflowsAtom, () => value as unknown as GemworksJson)
  }
}

async function openDialog($: EngineInterface, dialog: Dialog | null): Promise<void> {
  const [, , t] = await Promise.all([update($, dialogAtom, () => dialog), update($, sharedTextAtom, () => null), words($)])
  if (dialog === null) {
    await $.ui.close({ id: DIALOG_ID })
    return
  }
  const title = dialog === 'settings' ? t('设置') : dialog === 'upgrade' ? t('升级') : dialog === 'about' ? t('关于') : t('分享')
  await $.ui.open({ id: DIALOG_ID, title, focus: true, closeOnEscape: true, holdToasts: true })
  if (dialog === 'settings') void loadWorkflows($)
  if (dialog === 'upgrade' || dialog === 'about') void checkLatest($)
}

/** An export: through the bridge, which writes under .geml/exports/; the path is toasted, the text comes back. */
async function exportText($: EngineInterface, kind: 'journal' | 'workflow' | 'text', format: 'geml' | 'md' | 'json', extra: { name?: string; text?: string; strip?: boolean; to?: string } = {}): Promise<string | undefined> {
  const t = await words($)
  const res = await bridge($, { op: 'export', kind, format, ...extra }, SLOW_TIMEOUT_MS)
  if (res === undefined) return undefined
  if (!res.ok) { $.ui.toast(t('导出失败：{0}', res.error.replace(/^gemworks: /, ''))); return undefined }
  if (res.exported !== undefined) {
    const path = res.exported.path
    $.ui.toast(t('已导出 {0}', path))
    await update($, exportedAtom, () => path)
  }
  return res.exported?.text
}

async function sessionText($: EngineInterface, format: 'geml' | 'md'): Promise<{ text: string; name: string } | undefined> {
  const t = await words($)
  const prompts = await readPrompts($)
  if (prompts.length === 0) { $.ui.toast(t('没有可导出的内容')); return undefined }
  let session = 'session'
  try { session = await $.session.id() } catch { /* headless */ }
  return { text: sessionExport(prompts, format, session, t), name: `session-${session.slice(0, 8)}` }
}

/** Another session's record, from its log in the project's record, as a GEML document, and the session's name on the tab: nothing when the record has no such session. */
async function otherSessionText($: EngineInterface, id: string): Promise<{ text: string; name: string; label: string } | undefined> {
  const t = await words($)
  const dir = await read($, sessionsDirAtom)
  const known = (((await read($, projectSessionsAtom)) as unknown) as SessionSummary[] | null)?.find((s) => s.id === id)
  if (dir === null || known === undefined) { $.ui.toast(t('没有可导出的内容')); return undefined }
  let summary: SessionSummary | undefined
  for (const name of [logName(known.host, id), legacyLogName(known.host, id)]) {
    try { summary = summarize(parseLog(String(await $.fs.read(`${dir}/${name}`)))); break } catch { /* the next */ }
  }
  if (summary === undefined || summary.turns.length === 0) { $.ui.toast(t('没有可导出的内容')); return undefined }
  return { text: logExport(summary, t), name: `session-${id.slice(0, 8)}`, label: sessionLabel(known, '', t) }
}

/** The share dialog's pick for the strict workflow among the flows: no flow file is named so. */
const STRICT_FLOW = '#strict'

async function share($: EngineInterface, what: ShareWhat, how: ShareHow, strip: boolean, surface?: string, flowName?: string): Promise<void> {
  const t = await words($)
  const copy = async (text: string): Promise<void> => {
    const r = await $.ui.copy({ text, ...(surface !== undefined ? { surface: surface as never } : {}) })
    $.ui.toast(r.isCopied ? t('已复制') : `gemworks：${r.reason}`)
  }
  let text: string | undefined
  if (what === 'status') {
    text = await shareStatus($, t)
    if (how === 'file') text = await exportText($, 'text', 'md', { name: 'status', text, strip })
  } else if (what === 'session') {
    const s = await sessionText($, how === 'copy' ? 'md' : 'geml')
    if (s === undefined) return
    text = how === 'copy' ? s.text : await exportText($, 'text', 'geml', { name: s.name, text: s.text, strip })
  } else if (what === 'flow' && flowName === STRICT_FLOW) {
    text = await exportText($, 'workflow', 'geml', { strip })
  } else if (what === 'flow') {
    // A light flow, with its practices and rules: the flow tab's export, as text or into .geml/exports/.
    const flow = (await coachFlowsKept($)).find((f) => f.name === flowName)
    if (flow === undefined) { $.ui.toast(t('没有可导出的内容')); return }
    const whole = flowExport(flow, (await practicesKept($))?.list ?? [], await rulesKept($))
    text = how === 'file' ? await exportText($, 'text', 'geml', { name: `flow-${flow.name}`, text: whole, strip }) : whole
  } else text = await exportText($, what, how === 'copy' ? 'md' : 'geml', { strip })
  if (text === undefined || text === '') { if (text === '') $.ui.toast(t('没有可导出的内容')); return }
  if (how === 'copy' && surface !== undefined && surface !== 'terminal') { await update($, sharedTextAtom, () => text as string); return }
  if (how === 'copy') await copy(text)
  else if (how === 'pr') {
    const root = await read($, rootAtom)
    let answer: string
    try { answer = await $.ui.ask(t('发到当前分支的 PR 评论？评论将对仓库的其他人可见。'), [t('发出去'), t('取消')]) } catch { return }
    if (answer !== t('发出去')) return
    try {
      const r = await $.process.run(['gh', 'pr', 'comment', '--body', text], { cwd: root ?? undefined, timeoutMs: SLOW_TIMEOUT_MS })
      $.ui.toast(r.exitCode === 0 ? r.stdout.trim() || 'gh: ok' : `gh: ${r.stderr.trim() || r.stdout.trim()}`)
    } catch (err) { $.ui.toast(`gh: ${reasonOf(err)}`) }
  }
}

/** The diagnosis lines of this module, the newest kept: written to the project's .geml/trace.log, where a reader outside the session finds them. */
const traceLines: string[] = []
/**
 * A line for a diagnosis (what a press and a drawing did, on which surface):
 * into the transcript and .geml/trace.log, only while the trace setting is
 * on — it floods the conversation; never a failure of what it notes.
 */
function trace($: EngineInterface, text: string): void {
  void (async () => {
    if (!(await readSettings($)).trace.enabled) return
    traceLines.push(`${new Date().toISOString()} ${text}`)
    if (traceLines.length > 300) traceLines.splice(0, traceLines.length - 300)
    try { $.ui.log(`gemworks: ${text}`) } catch { /* no log */ }
    const root = await read($, rootAtom)
    if (root !== null) await $.fs.write(`${root}/.geml/trace.log`, `${traceLines.join('\n')}\n`)
  })().catch(() => undefined)
}

/** A press runs its action; a failure is one toast, never a crash of the drawing. */
/** The project's Claude Code memory, read through the bridge for the sessions tab; what was read stays when the bridge does not answer. */
async function loadMemory($: EngineInterface): Promise<void> {
  const res = await bridge($, { op: 'memory' }).catch(() => undefined)
  if (res === undefined || !res.ok || res.memory === undefined) return
  const memory = res.memory
  if (JSON.stringify(memory) !== JSON.stringify(await read($, memoryAtom))) await update($, memoryAtom, () => memory)
}

/** How far apart a message typed mid-turn and its queued record in the transcript may be, to be the same message. */
const QUEUED_MATCH_MS = 10 * 60_000

/** How long an opener may take to hand the file to its app. */
const OPEN_MS = 10_000

/**
 * Opens a local file or folder with the machine's own app, a press on the
 * artifacts' menu or the export (a `file:` link opens nothing on a remote
 * surface); with `reveal`, shows it selected in its folder. A missing path
 * says so and runs nothing; an opener that is not on the machine gives way to
 * the next; one still running at the timeout started. Pressed from the phone,
 * or with the last prompt over Remote Control, the toast says it opened on the
 * machine, where the person may not be.
 */
async function openFile($: EngineInterface, path: string, reveal: boolean, surface?: string): Promise<void> {
  const t = await words($)
  const name = baseName(path)
  if (!(await $.fs.exists(path).catch(() => false))) { $.ui.toast(t('找不到：{0}', name)); return }
  const [h, o] = await Promise.all([read($, hostAtom), read($, originAtom)])
  const platform = (h as unknown as HostInfo | null)?.platform
  const away = remoteInPlay({ ...(surface !== undefined ? { surface } : {}), clients: [], ...(o !== null ? { origin: o } : {}) })
  const done = reveal ? (away ? '已在本机的文件夹里显示：{0}' : '已在文件夹里显示：{0}') : (away ? '已在本机打开：{0}' : '已打开：{0}')
  for (const opener of openersFor(platform, path, reveal)) {
    try {
      const r = await $.process.run(opener.argv, { timeoutMs: OPEN_MS, ...(opener.env !== undefined ? { env: opener.env } : {}) })
      $.ui.toast(r.exitCode === 0 ? t(done, name) : t('打不开：{0}', name))
      return
    } catch (err) {
      if (/timed out|still running/i.test(reasonOf(err))) { $.ui.toast(t(done, name)); return }
    }
  }
  $.ui.toast(t('打不开：{0}', name))
}

function press($: EngineInterface, action: BoardAction): (e: { surface: string }) => void {
  return (e) => {
    trace($, `press ${action.op}${'tab' in action ? ` ${String((action as { tab?: unknown }).tab)}` : ''}${'dialog' in action ? ` ${String((action as { dialog?: unknown }).dialog)}` : ''} on ${e.surface}`)
    // A transcript row moves only while the plugin answers the person's own input: 跳转 asks for the scroll first,
    // before anything is awaited, the prompt's row at the top of the window.
    if (action.op === 'locate' && action.uuid !== undefined && e.surface === 'terminal') {
      const moving = $.ui.scroll({ to: { requestId: action.uuid }, block: 'start' })
      void moving.then(async (r) => { if (r.deny !== undefined) $.ui.toast((await words($))('对话没有滚到那一处：{0}', r.deny)) }).catch(async (err: unknown) => $.ui.toast((await words($))('对话没有滚到那一处：{0}', reasonOf(err))))
      return
    }
    void act($, action, e.surface).catch((err: unknown) => $.ui.toast(`gemworks：${reasonOf(err)}`))
  }
}

// ---- the drawings ---------------------------------------------------------------------

/** The elements, loosely typed: the pane is drawn on every surface, and only some have Input or Link. */
type Els = { Box: any; Text: any; Button: any; Link?: any; Input?: any; Select?: any; Svg?: any; Markdown?: any }

/** A link that opens `href`; its words and the address where the surface draws no links. */
function drawLink(els: Els, key: string, href: string, label: string): unknown {
  const { Link, Text } = els
  return Link !== undefined ? <Link key={key} href={href} label={label} /> : <Text key={key} dimColor>{label}: {href}</Text>
}

/** The surface's elements, with no Svg on the terminal: its table answers one, drawn as an empty box, where a character reads better. */
function elementsOf($: EngineInterface, e: Parameters<EngineInterface['ui']['resolve']>[0]): Els {
  const els = $.ui.resolve(e) as unknown as Els
  return (e as { surface?: string }).surface === 'terminal' ? { ...els, Svg: undefined } : els
}

/** A card's icon: a line drawing where the surface draws pictures, its character in the icon's colour elsewhere. */
function drawIcon(els: Els, k: Icon): unknown {
  const { Svg, Text } = els
  return Svg !== undefined ? <Svg source={ICON_SVG[k]} alt={k} width={14} height={14} /> : <Text {...toneProps(ICON_TONE[k])}>{ICON_CHAR[k]}</Text>
}

/**
 * The blank label of a button laid over an icon: two ideographic spaces, the icon's width and the room around it. A
 * desktop draws the label as HTML, where a run of plain spaces collapses to nothing: the button shrank to its padding
 * at the box's left edge, in front of the icon, and a press on the icon itself missed.
 */
const HIT = '　　'

/** A blank label as wide as `cells` columns, in ideographic spaces (two columns each), which HTML does not collapse. */
function blankOf(cells: number): string {
  return '　'.repeat(Math.max(1, Math.ceil(cells / 2)))
}

/** A glyph where the surface draws pictures; nothing elsewhere, where the words beside it say what it would. */
function drawGlyph(els: Els, g: Glyph, tone: Tone | 'active' = 'dim', size = 15): unknown {
  const { Svg } = els
  return Svg !== undefined ? <Svg source={glyphSvg(g, tone)} alt={g} width={size} height={size} /> : null
}

/**
 * An icon that is a press by itself (the dialogs): a Button holds only words, so a blank one is laid over the icon,
 * named by the label; the label shows under the pointer. Where the surface draws no pictures, the label as a button.
 */
function iconButton($: EngineInterface, els: Els, b: Pressable, g: Glyph, o: { tone?: Tone | 'active'; from?: 'left' | 'right'; size?: number; lines?: number; tip?: false; card?: unknown; pad?: { left?: number; right?: number } } = {}): unknown {
  const { Box, Button, Text, Svg } = els
  if (Svg === undefined) return <Button key={b.key} plain dimColor label={b.label} onPress={press($, b.action)} />
  const edge = o.from === 'left' ? { left: 0 } : { right: 0 }
  // The rows the icon stands in (a row of two lines stretches it): each takes the press.
  const lines = Math.max(1, o.lines ?? 1)
  return (
    <Box key={`${b.key}-icon`} flexShrink={0} alignItems="center" paddingLeft={o.pad?.left ?? 1} paddingRight={o.pad?.right ?? 1}>
      {drawGlyph(els, g, o.tone ?? 'dim', o.size ?? 18)}
      {/* Its name under the pointer, below the box, so it never lies over the press; `tip: false` shows none (the 整理 box). */}
      {o.tip !== false && (
        <Box position="absolute" top={lines} {...edge} width={cellWidth(b.label) + 2} paddingX={1} display="none" hover={{ display: 'flex' }} backgroundColor="inverseText">
          <Text wrap="truncate-end">{b.label}</Text>
        </Box>
      )}
      {/* A card of its own in place of the tip: inside this keyed box, the scope the pointer on the icon lights (a card
          beside it, under an outer keyed box, never showed: the inner key scopes the hover). */}
      {o.card ?? null}
      {/* The press over the box: one blank button centred in it, painted last — the one layout the desktop takes a press
          through (a column of buttons under overflow hidden took none: every icon of the board went dead, 0.2.43–0.2.47). */}
      <Box position="absolute" top={0} left={0} right={0} bottom={0} justifyContent="center" alignItems="center">
        <Button key={b.key} plain label={HIT} onPress={press($, b.action)} />
      </Box>
    </Box>
  )
}

/** The prototype's greys, with alpha so they read on a light and a dark ground: a rule, a heading, a band behind a row. */
const RULE = '#8a898666'
const HEADING = '#8a8986'
/** A work item's step as a cell: met, the one it stands at (bold), not reached (dim), passed unmet (a warning). */
const CELL_MARK = { met: '✓', here: '●', ahead: '○', skipped: '⚠' } as const
const CELL_TONE = { met: {}, here: { bold: true as const }, ahead: { dimColor: true as const }, skipped: toneProps('warning') } as const
const SHADE = '#8a89861a'
const SELECTED = '#2a6fdb24'
/** A rule one CSS pixel high in the grey at 22%: wider than any slot, so drawn with no width it spans the slot it is in. */
const RULE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="4000" height="1" viewBox="0 0 4000 1" preserveAspectRatio="none"><rect width="4000" height="1" fill="#8a8986" fill-opacity="0.22"/></svg>'
function hairline(els: Els, key: string): unknown {
  const { Box, Svg } = els
  return Svg !== undefined ? <Box key={key} paddingY="xs"><Svg source={RULE_SVG} alt="—" height={1} /></Box> : null
}

/**
 * The rows in the prototype's grouping: a run of work items sits in one rounded box, a rule between them; any other
 * row as it is. Only where the surface draws pictures; the terminal's rows stand alone.
 */
/** One row as drawRow draws it; a row that cannot be drawn says so in its place. */
function safeRow($: EngineInterface, els: Els, row: BoardRow, i: number, toolWidth?: number): unknown {
  try {
    return drawRow($, els, row, i, toolWidth)
  } catch (err) {
    return <els.Text key={`row-failed-${i}-${'key' in row ? String(row.key) : row.kind}`} color="error">{`gemworks：${reasonOf(err)}`}</els.Text>
  }
}

function drawRows($: EngineInterface, els: Els, rows: BoardRow[], columns: number): unknown[] {
  // One name column for every tool on the tab: the uses line up across the groups, and across a menu opened between rows.
  const tools = rows.filter((r): r is Extract<BoardRow, { kind: 'tool' }> => r.kind === 'tool')
  const toolWidth = tools.length === 0 ? 0 : Math.min(Math.max(...tools.map((x) => cellWidth(x.name))) + 2, Math.floor(columns * 0.45))
  if (els.Svg === undefined) return rows.map((r, i) => safeRow($, els, r, i, toolWidth))
  const { Box, Text } = els
  const out: unknown[] = []
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] as BoardRow
    if (r.kind === 'tool') {
      const run: Extract<BoardRow, { kind: 'tool' }>[] = []
      while (i < rows.length && (rows[i] as BoardRow).kind === 'tool') run.push(rows[i++] as Extract<BoardRow, { kind: 'tool' }>)
      i--
      out.push(<Box key={`tools-${r.key}`} flexDirection="column">{run.map((x) => drawTool($, els, x, toolWidth))}</Box>)
      continue
    }
    if (r.kind === 'turn' || r.kind === 'menu') {
      const run: Extract<BoardRow, { kind: 'turn' | 'menu' | 'prose' }>[] = []
      while (i < rows.length && ((rows[i] as BoardRow).kind === 'turn' || (rows[i] as BoardRow).kind === 'menu' || (rows[i] as BoardRow).kind === 'prose')) run.push(rows[i++] as Extract<BoardRow, { kind: 'turn' | 'menu' | 'prose' }>)
      i--
      out.push(
        <Box key={`turns-${r.key}`} flexDirection="column">
          {run.map((x, n) => safeRow($, els, x, n))}
        </Box>,
      )
      continue
    }
    if (r.kind !== 'entry') { out.push(safeRow($, els, r, i)); continue }
    const run: Extract<BoardRow, { kind: 'entry' }>[] = []
    while (i < rows.length && (rows[i] as BoardRow).kind === 'entry') run.push(rows[i++] as Extract<BoardRow, { kind: 'entry' }>)
    i--
    out.push(
      <Box key={`list-${r.key}`} flexDirection="column" borderStyle="round" borderColor={RULE} paddingX={1}>
        {run.flatMap((x, n) => n === 0 ? [safeRow($, els, x, n)] : [hairline(els, `sep-${x.key}`), safeRow($, els, x, n)])}
      </Box>,
    )
  }
  return out
}

/**
 * A tool's row where the surface draws pictures: the name as words in a column of the run's width (a press laid
 * over it when it opens a menu), so every name starts at the same edge and the uses line up after them.
 */
function drawTool($: EngineInterface, els: Els, row: Extract<BoardRow, { kind: 'tool' }>, width: number): unknown {
  const { Box, Text, Button } = els
  return (
    <Box key={row.key} gap={2} paddingX={1} hover={{ backgroundColor: SHADE }}>
      <Box width={width} flexShrink={0} overflow="hidden">
        {row.action !== undefined
          ? <Button key={`open-${row.key}`} plain onPress={press($, row.action)}><Text {...toneProps(row.tone)}>{row.name}</Text></Button>
          : <Text {...toneProps(row.tone)} wrap="truncate-end">{row.name}</Text>}
      </Box>
      <Text dimColor wrap="truncate-end">{row.use}</Text>
      {row.guess !== '' && <Text {...toneProps('warning')}>{row.guess}</Text>}
      <Box flexGrow={1} />
      <Text {...toneProps(row.tone === 'normal' ? 'dim' : row.tone)}>{row.count}</Text>
    </Box>
  )
}

function drawRow($: EngineInterface, els: Els, row: BoardRow, i: number, toolWidth?: number): unknown {
  const { Box, Text, Button, Link, Input } = els
  switch (row.kind) {
    case 'section': return (
      <Box key={row.key} gap={1} marginTop={i > 0 ? 1 : 0} {...(row.actions !== undefined ? { flexWrap: 'wrap' as const } : {})}>
        {els.Svg !== undefined ? <Text color={HEADING} bold>{row.text}</Text> : <Text dimColor bold>{row.text}</Text>}
        {row.count !== undefined && <Text dimColor>{String(row.count)}</Text>}
        {row.note !== undefined && <Text dimColor>{row.note}</Text>}
        {(row.fold !== undefined || row.actions !== undefined) && <Box flexGrow={1} />}
        {(row.actions ?? []).map((b) => <Button key={b.key} plain label={b.label} onPress={press($, b.action)} />)}
        {row.fold !== undefined && <Button key={row.fold.key} plain label={row.fold.label} onPress={press($, row.fold.action)} />}
      </Box>
    )
    case 'card': return (
      <Box key={row.key} flexDirection="column" borderStyle="round" borderDimColor paddingX={1}>
        <Box gap={1}>
          {drawIcon(els, row.icon)}
          {row.verb !== '' && <Text dimColor>{row.verb}</Text>}
          <Box flexShrink={1} minWidth={0}><Text bold wrap="wrap">{row.title}</Text></Box>
          {row.tag !== undefined && row.tag !== '' && <Text dimColor>{row.tag}</Text>}
        </Box>
        {row.detail.map((d, n) => <Text key={`d${n}`} dimColor wrap="truncate-end">{d}</Text>)}
        {row.actions.length > 0 && (
          <Box gap={1}>
            {row.actions.map((b) => <Button key={b.key} label={b.label} {...(b.primary ? { variant: 'primary' } : {})} onPress={press($, b.action)} />)}
          </Box>
        )}
      </Box>
    )
    case 'entry': return row.detail === undefined ? (
      <Box key={row.key} gap={2} paddingX={els.Svg !== undefined ? 0 : 1}>
        {row.action !== undefined
          ? <Button key={`go-${row.key}`} plain label={row.title} onPress={press($, row.action)} />
          : <Text {...toneProps(row.tone)} wrap="truncate-end">{row.title}</Text>}
        <Box flexGrow={1} />
        {row.tag !== '' && <Text dimColor>{row.tag}</Text>}
        {row.link !== undefined && drawLink(els, `open-${row.key}`, row.link.href, row.link.label)}
        {row.extra !== undefined && <Button key={row.extra.key} plain dimColor label={row.extra.label} onPress={press($, row.extra.action)} />}
        {row.open !== undefined && (els.Svg !== undefined ? <Box flexShrink={0} alignItems="center">{drawGlyph(els, row.open ? 'unfold' : 'fold', 'dim', 15)}</Box> : <Text dimColor>{row.open ? '▾' : '▸'}</Text>)}
      </Box>
    ) : (
      // Two lines: the name and its tags, then where it is and what it has; the whole row takes the press.
      <Box key={row.key} flexDirection="column" paddingX={1} {...(row.current === true && els.Svg !== undefined ? { backgroundColor: SELECTED } : row.action !== undefined ? { hover: { backgroundColor: SHADE } } : {})}>
        <Box gap={2}>
          {row.action !== undefined
            ? <Button key={`go-${row.key}`} plain onPress={press($, row.action)}><Text {...toneProps(row.tone)} {...(row.current === true ? { bold: true } : {})}>{row.title}</Text></Button>
            : <Text {...toneProps(row.tone)} {...(row.current === true ? { bold: true } : {})} wrap="truncate-end">{row.title}</Text>}
          <Box flexGrow={1} />
          {row.tag !== '' && <Text dimColor>{row.tag}</Text>}
          {row.link !== undefined && drawLink(els, `open-${row.key}`, row.link.href, row.link.label)}
        </Box>
        {row.action !== undefined
          ? <Button key={`go-2-${row.key}`} plain dimColor label={row.detail} onPress={press($, row.action)} />
          : <Text dimColor wrap="truncate-end">{row.detail}</Text>}
      </Box>
    )
    // The dialogs' parts, as the 2026-10-13 dialogs draw them (BoardRow says what each is).
    case 'label': return (
      <Box key={row.key} marginTop={i > 0 ? 1 : 0}>
        <Text dimColor size="caption" weight="semibold">{row.text}</Text>
      </Box>
    )
    case 'check':
    case 'radio': {
      const on = row.on
      if (els.Svg === undefined) {
        const mark = row.kind === 'check' ? (on ? '[x]' : '[ ]') : (on ? '(•)' : '( )')
        return (
          <Box key={`${row.key}-row`} flexDirection="column">
            <Button key={row.key} plain label={`${mark} ${row.label}`} onPress={press($, row.action)} />
            {row.note !== undefined && <Text dimColor>{`    ${row.note}`}</Text>}
          </Box>
        )
      }
      // The mark takes the press laid over it and the words are a button of the same press; the note under them wraps.
      const glyph: Glyph = row.kind === 'check' ? (on ? 'boxon' : 'box') : (on ? 'radioon' : 'radio')
      return (
        <Box key={`${row.key}-row`} gap={1} alignItems="flex-start" hover={{ backgroundColor: SHADE }}>
          {iconButton($, els, { key: `${row.key}-mark`, label: row.label, action: row.action }, glyph, { tone: on ? 'active' : 'dim', from: 'left', size: 16, tip: false })}
          <Box flexDirection="column" flexGrow={1} minWidth={0}>
            <Button key={row.key} plain label={row.label} onPress={press($, row.action)} />
            {/* The note as words that wrap: a long one in a button might be cut at the pane's edge. */}
            {row.note !== undefined && <Text dimColor size="footnote" wrap="wrap">{row.note}</Text>}
          </Box>
        </Box>
      )
    }
    case 'select': {
      const { Select } = els
      const pick = (value: string): void => { const a = row.actions[value]; if (a !== undefined) void act($, a).catch((err: unknown) => $.ui.toast(`gemworks：${reasonOf(err)}`)) }
      if (Select === undefined) return (
        <Box key={row.key} gap={1} flexWrap="wrap">
          {row.options.map((o) => <Button key={`${row.key}-${o.value}`} label={o.label} {...(o.value === row.value ? { variant: 'primary' } : {})} onPress={() => pick(o.value)} />)}
        </Box>
      )
      return <Select key={row.key} label={row.label} options={row.options} value={row.value} onSelect={(value: string) => pick(value)} />
    }
    case 'facts': return (
      <Box key={row.key} flexDirection="column">
        {row.rows.map(([name, value], n) => (
          <Box key={`${row.key}-${n}`} gap={2}>
            <Box width={Math.max(...row.rows.map(([k]) => cellWidth(k))) + 1} flexShrink={0}><Text dimColor>{name}</Text></Box>
            <Text>{value}</Text>
          </Box>
        ))}
      </Box>
    )
    case 'panel': return (
      <Box key={row.key} gap={1} borderStyle="round" {...(els.Svg !== undefined ? { borderColor: RULE, backgroundColor: SHADE } : { borderDimColor: true })} paddingX={1} alignItems="center">
        <Box flexDirection="column" flexGrow={1} minWidth={0}>
          {row.lines.map((l, n) => <Text key={`${row.key}-${n}`} {...toneProps(l.tone)} {...(l.bold === true ? { weight: 'semibold' as const } : {})} wrap="wrap">{l.text}</Text>)}
        </Box>
        {row.action !== undefined && <Button key={row.action.key} label={row.action.label} onPress={press($, row.action.action)} />}
      </Box>
    )
    case 'linkrow': return (
      <Box key={row.key} gap={3} flexWrap="wrap">
        {row.items.map((x, n) => drawLink(els, `${row.key}-${n}`, x.href, x.label))}
      </Box>
    )
    case 'rule': return hairline(els, row.key)
    case 'text': return <Text key={`r${i}`} {...toneProps(row.tone)}>{row.text}</Text>
    case 'button': return <Button key={row.key} plain label={row.label} {...(row.primary ? { variant: 'primary' } : {})} onPress={press($, row.action)} />
    case 'buttons': return (
      <Box key={`b${i}`} gap={2}>
        {row.end === true && <Box flexGrow={1} />}
        {row.items.map((b) => <Button key={b.key} label={b.label} {...(b.primary ? { variant: 'primary' } : {})} onPress={press($, b.action)} />)}
      </Box>
    )
    case 'link': return Link !== undefined ? <Link key={row.key} href={row.href} label={row.label} /> : <Text key={row.key} dimColor>{row.label}: {row.href}</Text>
    case 'links': {
      const items = row.items.map((x) => x.href !== undefined
        ? drawLink(els, x.key, x.href, x.label)
        : x.action !== undefined ? <Button key={x.key} plain label={x.label} onPress={press($, x.action)} /> : null)
      return els.Svg !== undefined
        ? <Box key={row.key} flexDirection="column" borderStyle="round" borderColor={RULE} marginLeft={2} paddingX={1}>{items}</Box>
        : <Box key={row.key} gap={2} paddingX={1}>{items}</Box>
    }
    // A search is read as typed; any other field when submitted.
    case 'input': {
      const run = (value: string): void => { const a = inputAction(row.field, value, row.target); if (a !== undefined) void act($, a).catch((err: unknown) => $.ui.toast(`gemworks：${reasonOf(err)}`)) }
      if (Input === undefined) return <Text key={row.key} dimColor>{row.placeholder}</Text>
      return row.field === 'tool-search'
        ? <Input key={row.key} placeholder={row.placeholder} {...(row.value !== undefined ? { value: row.value } : {})} onInput={(value: string) => run(value)} onSubmit={run} />
        : <Input key={row.key} placeholder={row.placeholder} {...(row.value !== undefined ? { value: row.value } : {})} onSubmit={run} />
    }
    // A tool in one line: its name as the press that opens its menu, its use, what it looks like, how often it ran.
    // The name in the tab's one name column (drawRows measures it), so the uses start at the same edge in every group.
    // A work item on the way: its flow's word, its name and the arrow to its flow; its steps as cells (one line of marks
    // where no pictures are drawn); what it needs or what comes next, and the presses that are the person's.
    case 'work': return (
      <Box key={row.key} flexDirection="column" paddingX={1}>
        <Box gap={1}>
          <Text {...toneProps(row.flow === 'bugfix' ? 'error' : row.flow === 'design' ? 'warning' : 'success')}>{els.Svg !== undefined ? row.tag : `[${row.tag}]`}</Text>
          <Box flexShrink={1} minWidth={0}>{row.open !== undefined ? <Button key={row.open.key} plain label={row.title} onPress={press($, row.open.action)} /> : <Text wrap="truncate-end">{row.title}</Text>}</Box>
          <Box flexGrow={1} />
          {row.made !== undefined && <Button key={row.made.key} plain dimColor label={row.made.label} onPress={press($, row.made.action)} />}
          {els.Svg !== undefined ? iconButton($, els, row.go, 'go', { from: 'right', size: 15 }) : <Button key={row.go.key} plain label="›" onPress={press($, row.go.action)} />}
        </Box>
        {row.cells.length > 0 && (els.Svg !== undefined
          ? <Box gap={1}>{row.cells.map((c, n) => <Text key={`c${n}`} {...CELL_TONE[c.cell]}>{`${CELL_MARK[c.cell]}${c.title}`}</Text>)}</Box>
          : <Text dimColor wrap="truncate-end">{stripText(row.cells)}</Text>)}
        {(row.detail !== '' || row.actions.length > 0) && (
          <Box gap={1}>
            <Box flexShrink={1} minWidth={0}><Text dimColor wrap="truncate-end">{row.detail}</Text></Box>
            <Box flexGrow={1} />
            {row.actions.map((b) => <Button key={b.key} label={b.label} {...(b.primary ? { variant: 'primary' } : {})} onPress={press($, b.action)} />)}
          </Box>
        )}
      </Box>
    )
    // A flow's step in the manual: its title, the requirement to leave it, who judges it; under it what it prevents.
    case 'step': return (
      <Box key={row.key} flexDirection="column" paddingX={1} {...(row.here && els.Svg !== undefined ? { backgroundColor: SELECTED } : {})}>
        <Box gap={1}>
          <Text {...(row.final ? { dimColor: true } : row.here ? { bold: true } : {})}>{row.here && els.Svg === undefined ? `▸${row.title}` : row.title}</Text>
          {row.need !== '' && <Box flexShrink={1} minWidth={0}><Text dimColor wrap="truncate-end">{`· ${row.need}`}</Text></Box>}
          <Box flexGrow={1} />
          {row.judge !== '' && <Text {...toneProps(row.judgeKind === 'fact' ? 'success' : row.judgeKind === 'you' ? 'warning' : 'dim')}>{row.judge}</Text>}
        </Box>
        {row.prevents !== '' && <Text dimColor wrap="truncate-end">{row.prevents}</Text>}
        {(row.rules ?? []).map((r, n) => <Text key={`rule${n}`} {...toneProps('warning')} wrap="truncate-end">{`🔒 ${r}`}</Text>)}
      </Box>
    )
    // A practice on a step: what to do, its tag, where it came from; its layer and × the person's presses.
    case 'practice': return (
      <Box key={row.key} gap={1} paddingX={2}>
        {row.tag !== '' && <Text {...toneProps(row.fresh ? 'warning' : 'dim')}>{row.tag}</Text>}
        <Box flexShrink={1} minWidth={0}><Text wrap="truncate-end">{row.text}</Text></Box>
        {row.why !== '' && <Box flexShrink={1} minWidth={0}><Text dimColor wrap="truncate-end">{`— ${row.why}`}</Text></Box>}
        <Box flexGrow={1} />
        {row.count !== undefined && <Box flexShrink={0}><Text {...toneProps(row.count.held ? 'success' : 'warning')}>{row.count.text}</Text></Box>}
        {row.actions.map((b) => <Button key={b.key} plain dimColor label={b.label} onPress={press($, b.action)} />)}
      </Box>
    )
    case 'tool': return (
      <Box key={row.key} gap={2} paddingX={1}>
        <Box {...(toolWidth !== undefined && toolWidth > 0 ? { width: toolWidth } : {})} flexShrink={0} overflow="hidden">
          {row.action !== undefined ? <Button key={`open-${row.key}`} plain label={row.name} onPress={press($, row.action)} /> : <Text {...toneProps(row.tone)} wrap="truncate-end">{row.name}</Text>}
        </Box>
        <Text dimColor>{row.use}</Text>
        {row.guess !== '' && <Text {...toneProps('warning')}>{row.guess}</Text>}
        <Box flexGrow={1} />
        <Text {...toneProps(row.tone === 'normal' ? 'dim' : row.tone)}>{row.count}</Text>
      </Box>
    )
    // The flow picture: the parser's drawing where the surface draws pictures, the boxes and ways out in elements elsewhere.
    case 'flow': return els.Svg !== undefined && row.svg !== '' ? <els.Svg key={row.key} source={row.svg} alt="flow" /> : drawFlow($, els, row)
    case 'image': return els.Svg !== undefined
      ? <els.Svg key={row.key} source={row.svg} alt={row.alt} {...(row.width !== undefined ? { width: row.width } : {})} />
      : <Text key={row.key} bold>{row.alt}</Text>
    // A work item's way through its flow, in one line: the passed states ticked, the current one in the accent.
    case 'steps': return (
      <Box key={row.key} gap={1} flexWrap="wrap">
        {row.steps.map((s, n) => <Text key={`s${n}`} {...(s.current ? { color: BRAND_RED, bold: true } : s.passed ? {} : { dimColor: true })}>{`${n > 0 ? '→ ' : ''}${s.title}${s.passed ? ' ✓' : ''}`}</Text>)}
      </Box>
    )
    case 'heading': return (
      <Box key={row.key} gap={1}>
        <Text bold>{row.text}</Text>
        {row.sub !== '' && <Text dimColor>{row.sub}</Text>}
        {row.action !== undefined && <Box flexGrow={1} />}
        {row.action !== undefined && <Button key={row.action.key} plain label={row.action.label} onPress={press($, row.action.action)} />}
      </Box>
    )
    // Something that happened, in one line: its time, its kind, what, why, which turn; its evidence under it when shown.
    case 'event': return (
      <Box key={row.key} flexDirection="column">
        <Box gap={1}>
          {drawGlyph(els, row.glyph, row.tone === 'normal' ? 'dim' : row.tone, 14)}
          <Text dimColor>{row.at}</Text>
          <Text {...toneProps(row.tone === 'normal' ? 'dim' : row.tone)}>{row.label}</Text>
          <Button key={`open-${row.key}`} plain label={row.text} onPress={press($, row.action)} />
          {row.why !== '' && <Text dimColor wrap="truncate-end">{row.why}</Text>}
          {row.turn !== '' && <Text dimColor wrap="truncate-end">{row.turn}</Text>}
        </Box>
        {row.open && row.detail.map((d, n) => <Text key={`d${n}`} dimColor wrap="truncate-end">{`      ${d}`}</Text>)}
      </Box>
    )
    // A prompt in one line: a triangle saying whether it is unfolded, its time, its first line, what its turn did; at its
    // right the scroll to it, where the conversation scrolls. The press on any of the first four unfolds it (the card of
    // what can be done to the turn, then the whole prompt and answer, come as rows under it). A folded row is twelve
    // nodes and two buttons: the desktop goes blank and takes no press once a tab draws thousands, so nothing else —
    // no per-row icons, no hover labels, no rule between rows — rides on it.
    case 'turn': {
      const icons = row.icons ?? []
      return els.Svg !== undefined ? (
        <Box key={row.key} gap={2} paddingX={1} {...(row.open || row.check === true ? { backgroundColor: SELECTED } : { hover: { backgroundColor: SHADE } })}>
          <Box flexGrow={1} minWidth={0} gap={2}>
            {row.check !== undefined
              ? (row.check !== null
                // The box takes the press itself: the row's words are its buttons, and a drawn box beside them would take none.
                ? iconButton($, els, { key: `pick-${row.key}`, label: row.checkLabel ?? '', action: row.action }, row.check ? 'boxon' : 'box', { tone: row.check ? 'active' : 'dim', from: 'left', size: 15, tip: false })
                : <Box flexShrink={0} alignItems="center" width={2}><Text> </Text></Box>)
              : row.fold === true && <Box flexShrink={0} alignItems="center">{drawGlyph(els, row.open ? 'unfold' : 'fold', 'dim', 15)}</Box>}
            <Box width={Math.max(5, cellWidth(row.at))} flexShrink={0}><Button key={`at-${row.key}`} plain dimColor label={row.at} onPress={press($, row.action)} /></Box>
            {/* Its time, its words and what it did take the press, each a button labelled with them: no box laid over the row, which
                costs the desktop elements it counts against its limit. */}
            <Box flexDirection="column" flexGrow={1} minWidth={0}>
              <Button key={`open-${row.key}`} plain label={row.text} onPress={press($, row.action)} />
              {row.did !== '' && <Button key={`open-2-${row.key}`} plain dimColor label={row.did} onPress={press($, row.action)} />}
            </Box>
          </Box>
          {icons.map((ic) => iconButton($, els, ic.button, ic.glyph, { size: 15 }))}
        </Box>
      ) : (
        <Box key={row.key} flexDirection="column">
          <Box gap={1}>
            {row.check !== undefined && (row.check !== null
              ? <Button key={`pick-${row.key}`} plain {...(row.check ? {} : { dimColor: true })} label={row.check ? '[x]' : '[ ]'} onPress={press($, row.action)} />
              : <Text>{'   '}</Text>)}
            <Text dimColor>{row.at}</Text>
            <Button key={`open-${row.key}`} plain label={row.text} onPress={press($, row.action)} />
            {row.fold === true && row.check === undefined && <Text dimColor>{row.open ? '▾' : '▸'}</Text>}
            {icons.length > 0 && <Box flexGrow={1} />}
            {icons.map((ic) => iconButton($, els, ic.button, ic.glyph))}
          </Box>
          {row.did !== '' && <Text dimColor wrap="truncate-end">{`      ${row.did}`}</Text>}
        </Box>
      )
    }
    // A sentence shown whole, its tag under it at the right; the whole of it takes the press.
    case 'note': {
      // Each line and the tag a button labelled with its words: no blank Button laid over them in a box, which costs the desktop
      // elements it counts against its limit (budget.ts).
      if (els.Svg !== undefined) return (
        <Box key={row.key} flexDirection="column" paddingX={1} hover={{ backgroundColor: SHADE }}>
          {row.lines.map((l, n) => <Button key={`go-${row.key}-${n}`} plain label={l} onPress={press($, row.action)} />)}
          <Box><Box flexGrow={1} /><Button key={`go-${row.key}-${row.lines.length}`} plain dimColor label={row.tag} onPress={press($, row.action)} /></Box>
        </Box>
      )
      return (
        <Box key={row.key} flexDirection="column" paddingX={1}>
          <Button key={`go-${row.key}`} plain label={row.lines[0] ?? ''} onPress={press($, row.action)} />
          {row.lines.slice(1).map((l, n) => <Text key={`l${n}`}>{l}</Text>)}
          <Text dimColor>{`  ${row.tag}`}</Text>
        </Box>
      )
    }
    case 'prose': return (
      <Box key={row.key} paddingX={1} marginLeft={els.Svg !== undefined ? 8 : 2} backgroundColor={els.Svg !== undefined ? SHADE : undefined}>
        {row.markdown === true && els.Markdown !== undefined ? <els.Markdown key={`md-${row.key}`} text={row.text} /> : <Text wrap="wrap">{row.text}</Text>}
      </Box>
    )
    // A row's menu: a small card under the row, the entry that destroys in the error colour, the one that closes dim.
    case 'menu': return els.Svg !== undefined ? (
      <Box key={row.key} flexDirection="column" borderStyle="round" borderColor={RULE} marginLeft={8} width={20} paddingX={1}>
        {row.items.map((b) => <Button key={b.key} plain onPress={press($, b.action)}><Text {...(b.tone === 'danger' ? { color: 'error' } : b.tone === 'quiet' ? { dimColor: true } : {})}>{b.label}</Text></Button>)}
      </Box>
    ) : (
      <Box key={row.key} gap={2}>
        {row.items.map((b) => <Button key={b.key} label={b.label} onPress={press($, b.action)} />)}
      </Box>
    )
  }
}

/**
 * The flow picture (spec §8.2) in the pane's own elements, on every surface:
 * each rank a row of state boxes (the current one in the accent, a final one
 * double-framed, the start marked, a badge for the items standing there),
 * and under it the ways out of its states, one line each — a way out a
 * person may take now is a numbered button, its number the hotkey; the
 * transition last taken is in the success colour; one that needs approval in
 * the warning colour; the rest dim, a machine-judged condition marked ✓ or ✗.
 */
function drawFlow($: EngineInterface, els: Els, row: Extract<BoardRow, { kind: 'flow' }>): unknown {
  const { Box, Text, Button } = els
  const arrow = (e: FlowEdgeRow): string => (e.kind === 'self' ? '↻' : e.kind === 'forward' ? '↓' : e.back ? '↩' : '↷')
  return (
    <Box key={row.key} flexDirection="column">
      {row.ranks.map((rank, r) => {
        const many = rank.length > 1
        return (
          <Box key={`rank${r}`} flexDirection="column">
            <Box gap={1} flexWrap="wrap">
              {rank.map((s) => (
                <Box key={s.id} borderStyle={s.final ? 'double' : 'round'} {...(s.current ? { borderColor: BRAND_RED } : { borderDimColor: true })} paddingX={1}>
                  <Text {...(s.current ? { color: BRAND_RED, bold: true } : {})}>{`${s.initial ? '● ' : ''}${s.current ? '▶ ' : ''}${s.title}`}</Text>
                  {s.count > 0 && <Text dimColor>{` ${s.count}`}</Text>}
                </Box>
              ))}
            </Box>
            {rank.flatMap((s) => row.edges.filter((e) => e.from === s.id)).map((e) => {
              const mark = e.holds === true ? ' ✓' : e.holds === false ? ' ✗' : ''
              const label = `${arrow(e)} ${many ? `#${e.from} ` : ''}→ #${e.to}  ${e.text}${mark}`
              if (e.press !== undefined) return <Button key={`advance-${e.name}`} plain {...(e.press.n <= 9 ? { hotkey: String(e.press.n) } : {})} label={label} onPress={press($, e.press.action)} />
              return <Text key={`edge-${e.name}`} {...toneProps(e.taken ? 'success' : e.approval && e.holds !== false ? 'warning' : 'dim')}>{`    ${label}`}</Text>
            })}
          </Box>
        )
      })}
    </Box>
  )
}

/** The board's header: the mark, the name, the version and a newer one when told; the dialogs; the work item, its stage and flow, and its hold. */
interface Header {
  version: string;
  /** The version the plugin's folder holds, when it is not the one running: loaded at the next reload. */
  synced?: string;
  newer?: string;
  dialogs: Pressable[];
  name?: string;
  stage?: string;
  flow?: string;
  /** Why there is no work item, when there is none. */
  reason?: string;
}

async function headerRows($: EngineInterface, t: T): Promise<Header> {
  const [shell, stored, known, settings] = await Promise.all([readShell($), read($, versionAtom), read($, latestAtom), readSettings($)])
  const s = shell?.status ?? null
  // The version this module was loaded as; the folder's, from the CLI, only when it was not read.
  const version = stored ?? shell?.versions?.gemworks ?? ''
  const synced = shell?.versions?.gemworks
  const latest = known as unknown as { version?: string } | null
  const newer = settings.notify.update && latest?.version !== undefined && version !== '' && isNewer(latest.version, version) ? latest.version : undefined
  const dialogs: Pressable[] = (['share', 'settings', 'upgrade', 'about'] as const).map((d) => ({ key: `dialog-${d}`, label: d === 'share' ? t('分享') : d === 'settings' ? t('设置') : d === 'upgrade' ? t('升级') : t('关于'), action: { op: 'dialog', dialog: d } }))
  const head: Header = { version, dialogs, ...(newer !== undefined ? { newer } : {}), ...(synced !== undefined && synced !== '' && version !== '' && synced !== version ? { synced } : {}) }
  if (s !== null && s.item.kind === 'item') {
    return { ...head, name: s.title ?? s.item.id, ...(s.state !== undefined ? { stage: s.paused ? `${s.state.title} · ${t('已暂停')}` : s.state.title } : {}), flow: s.workflow.title }
  }
  if (s !== null && s.item.kind === 'inactive') return { ...head, reason: s.item.reason }
  return head
}

/** The settings, upgrade, about and share dialogs as rows. */
async function dialogRows($: EngineInterface, t: T, dialog: Dialog, columns: number, surface: string): Promise<BoardRow[]> {
  // Drawn as the 2026-10-13 dialogs (docs/design/ui): a small grey label over each group, switches and one-of-several
  // whose whole row takes the press, a Select for a pick from a list, a shaded panel, facts in two columns, links on
  // one line. The terminal has a clipboard and desktop notifications; the desktop app gives a plugin neither.
  const terminal = surface === 'terminal'
  const text = (s: string, tone: Tone = 'normal'): BoardRow => ({ kind: 'text', text: truncate(s, columns), tone })
  const label = (key: string, s: string): BoardRow => ({ kind: 'label', key, text: s })
  const check = (key: string, on: boolean, words: string, note?: string): BoardRow => ({ kind: 'check', key: `set-${key}`, label: words, ...(note !== undefined ? { note } : {}), on, action: { op: 'setting', key, value: !on } })
  const rows: BoardRow[] = []
  const [shell, stored, s, locale, known, picked, shown, status] = await Promise.all([
    readShell($), read($, versionAtom), readSettings($), read($, localeAtom), read($, latestAtom), read($, shareAtom), read($, sharedTextAtom),
    dialog === 'share' ? shareStatus($, t) : Promise.resolve(''),
  ])
  const version = stored ?? shell?.versions?.gemworks ?? '?'
  if (dialog === 'settings') {
    // Only what works on the light flows; a strict workflow's own (its stage changes) shows where one is open. The
    // diagnosis is /gemworks trace: it is for chasing a board problem, not for the person.
    const system = langOf('system', shell?.locale ?? locale ?? undefined)
    const names: Record<string, string> = { zh: '中文', en: 'English', ja: '日本語' }
    const languages: [string, string][] = [['system', t('跟随系统（{0}）', names[system] ?? system)], ['zh', '中文'], ['en', 'English'], ['ja', '日本語']]
    rows.push(label('language', t('语言')), {
      kind: 'select', key: 'lang', label: t('偏好语言'), value: s.language,
      options: languages.map(([value, l]) => ({ value, label: l })),
      actions: Object.fromEntries(languages.map(([value]) => [value, { op: 'setting', key: 'language', value } as BoardAction])),
    }, text(t('状态带、看板、提醒的文字跟着换；流程自己的标题和说明保持作者写的语言。'), 'dim'))
    rows.push(label('judge', t('状态带')), check('judge.enabled', s.judge.enabled, t('打字就能回答状态带上的问题'), t('用小模型把你打的字对上等你定的问题；有把握直接选，否则先问。')))
    rows.push(label('learn', t('学习')), check('learn.enabled', s.learn.enabled, t('从你的纠正里提议做法和流程步骤'), t('每条提示词交给小模型归类，攒成纠正账本、提议流程步骤；关掉后不再读你的提示词。')))
    if (terminal) {
      rows.push(label('notify', t('桌面提醒')),
        check('notify.inbox', s.notify.inbox, t('有问题等你定')),
        check('notify.confirm', s.notify.confirm, t('工作项到了要你确认的一步')),
        check('notify.refusal', s.notify.refusal, t('被规定拦下'), t('同一原因 3 分钟内只提一次')))
      if (shell?.status !== null && shell?.status !== undefined) rows.push(label('strict', t('严格流程')), check('notify.stage', s.notify.stage, t('阶段变更时提醒')))
    }
  } else if (dialog === 'upgrade') {
    const latest = known as unknown as { version?: string; error?: string } | null
    const newer = latest?.version !== undefined && isNewer(latest.version, version) ? latest.version : undefined
    // npm answers 404 for a package not published yet: that is what to say, not the status code.
    const where = latest === null ? { text: '…', tone: 'dim' as Tone }
      : latest.version !== undefined ? (newer !== undefined ? { text: t('● 可更新 {0}', newer), tone: 'warning' as Tone } : latest.version === version ? { text: t('已是最新'), tone: 'success' as Tone } : { text: t('已发布 {0}', latest.version), tone: 'dim' as Tone })
      : { text: latest.error === 'HTTP 404' ? t('尚未发布到 npm，无法检查更新') : t('无法检查更新：{0}', latest.error ?? '?'), tone: 'dim' as Tone }
    rows.push({ kind: 'panel', key: 'version', lines: [{ text: t('当前 {0}', version), tone: 'normal', bold: true }, where], action: { key: 'check-update', label: t('检查更新'), action: { op: 'check-update' } } })
    const market = marketplaceOf($.plugin.root)
    const command = `claude plugin update gemworks${market !== undefined ? `@${market}` : ''}`
    if (newer !== undefined) {
      if (terminal) rows.push({ kind: 'buttons', items: [{ key: 'copy-update', label: `${t('更新')}: ${command}`, primary: true, action: { op: 'copy', text: command } }] })
      else rows.push(text(t('更新命令（在终端里运行）'), 'dim'), { kind: 'prose', key: 'update-command', text: command })
    }
    // What this version brings: its section of the CHANGELOG the plugin ships, as written; nothing when it has none.
    let notes: string[] = []
    try { notes = releaseNotesOf(String(await $.fs.read(`${$.plugin.root}/CHANGELOG.md`)), version) } catch { /* no CHANGELOG beside the plugin */ }
    if (notes.length > 0) {
      rows.push(label('notes', t('这一版有什么')))
      for (const line of notes) rows.push(text(`· ${line}`))
    }
    rows.push({ kind: 'linkrow', key: 'link-changelog', items: [{ href: LINKS.changelog, label: t('完整 CHANGELOG') }] }, { kind: 'rule', key: 'rule-upgrade' })
    if (market !== undefined) rows.push(text(t('装在 marketplace {0}', market), 'dim'))
    rows.push(text(t('更新后下一个会话生效；本会话不受影响'), 'dim'), check('notify.update', s.notify.update, t('有新版本时在看板上提示')))
  } else if (dialog === 'about') {
    rows.push({ kind: 'image', key: 'lockup', svg: LOCKUP_SVG, alt: 'Gemworks', width: 180 })
    rows.push(text(t('把写下一条提示词前要看的信息放在一处：工作进度、待决定事项、产物。流程用 GEML 编写，可替换、调整、导入。')))
    rows.push({ kind: 'facts', key: 'facts', rows: [[t('插件'), `gemworks ${version}`], [t('许可'), LICENSE]] }, { kind: 'rule', key: 'rule-about' })
    const zh = langOf(s.language, shell?.locale ?? locale ?? undefined) === 'zh'
    rows.push({ kind: 'linkrow', key: 'links', items: [
      { href: zh ? LINKS.docs.zh : LINKS.docs.other, label: t('说明文档') },
      { href: LINKS.repo, label: t('仓库') },
      { href: LINKS.feedback, label: t('反馈') },
    ] })
  } else {
    const here = shell?.status
    if (here?.item.kind === 'item') rows.push({ kind: 'heading', key: 'share-title', text: t('分享 {0}', here.title ?? here.item.id), sub: '' })
    // A flow is a light one with its practices and rules, or the strict workflow where one is open; a work item's
    // journal is a strict workflow's only: on the light flows alone there is none, and exporting it would only fail.
    const strict = here !== null && here !== undefined
    const [flows, practices, own] = await Promise.all([coachFlowsKept($), practicesKept($), $.session.id().then(async (id) => turnItem(await workItems($), id)?.flow).catch(() => undefined)])
    const flowChoices = [...flows.map((f) => ({ name: f.name, title: f.title })), ...(strict ? [{ name: STRICT_FLOW, title: t('{0}（严格流程）', here.workflow.title) }] : [])]
    const kept = (picked as unknown as { what: ShareWhat; how: ShareHow; strip: boolean; flow?: string } | null) ?? { what: 'status', how: 'copy', strip: true }
    const flowName = flowChoices.some((f) => f.name === kept.flow) ? kept.flow : (flowChoices.find((f) => f.name === own) ?? flowChoices[0])?.name
    const flowTitle = flowChoices.find((f) => f.name === flowName)?.title ?? ''
    const flowPractices = (practices?.list ?? []).filter((p) => p.flow === flowName && p.deleted !== true && p.layer !== 'personal').length
    const whats: [ShareWhat, string, string][] = [
      ['status', t('现在在哪'), t('进度、待办、最近产物')],
      ...(flowName !== undefined ? [['flow', t('一条流程'), flowName === STRICT_FLOW ? t('{0} · 状态机和它用的工具，给别的项目用', flowTitle) : t('{0} · 含 {1} 条做法，给别的项目或同事用', flowTitle, flowPractices)] as [ShareWhat, string, string]] : []),
      ['session', t('本会话'), t('提示词和那一轮做了什么；工具调用的输出不带')],
      ...(strict ? [['journal', t('这个工作项的记录'), t('每次阶段变更、凭据、产物、被拦，带哈希链，对方能校验')] as [ShareWhat, string, string]] : []),
    ]
    const choice = whats.some(([w]) => w === kept.what) ? kept : { ...kept, what: 'status' as ShareWhat }
    rows.push(label('what', t('分享什么')))
    for (const [what, words, note] of whats) {
      rows.push({ kind: 'radio', key: `what-${what}`, label: words, note, on: choice.what === what, action: { op: 'share-pick', what } })
      if (what === 'flow' && choice.what === 'flow' && flowChoices.length > 1) rows.push({ kind: 'buttons', items: flowChoices.map((f): Pressable => ({ key: `flow-${f.name}`, label: f.title, ...(f.name === flowName ? { primary: true } : {}), action: { op: 'share-pick', flow: f.name } })) })
    }
    rows.push(label('how', t('怎么给')), { kind: 'buttons', items: ([['copy', terminal ? t('复制文字') : t('显示文字')], ['file', t('存成文件')], ['pr', t('PR 评论')]] as const).map(([how, words]): Pressable => ({ key: `how-${how}`, label: words, ...(choice.how === how ? { primary: true } : {}), action: { op: 'share-pick', how } })) })
    if (choice.what === 'status') rows.push({ kind: 'panel', key: 'preview', lines: status.split('\n').filter((line) => line !== '').map((line) => ({ text: line, tone: 'normal' as Tone })) })
    rows.push({ kind: 'check', key: 'strip', label: t('去掉命令行里的绝对路径'), on: choice.strip, action: { op: 'share-pick', strip: !choice.strip } })
    rows.push({ kind: 'buttons', end: true, items: [
      { key: 'share-cancel', label: t('取消'), action: { op: 'dialog', dialog: null } },
      { key: 'share-go', label: choice.how === 'copy' ? (terminal ? t('复制') : t('显示')) : choice.how === 'file' ? t('存成文件') : t('发 PR 评论'), primary: true, action: { op: 'share', what: choice.what, how: choice.how, strip: choice.strip, ...(choice.what === 'flow' && flowName !== undefined ? { flow: flowName } : {}) } },
    ] })
    if (shown !== null && shown !== '') rows.push(text(t('选中后复制'), 'dim'), { kind: 'prose', key: 'shared-text', text: shown })
  }
  return rows
}

/** Where the work stands, as the share dialog says it: the same pending list as the band's, and what the work made. */
async function shareStatus($: EngineInterface, t: T): Promise<string> {
  const [shell, board, inbox, usage, dismissed] = await Promise.all([readShell($), readBoard($), inboxOf($, t), usageNow($), dismissedOf($)])
  const item = shell?.status?.item
  const pending = pendingList(inbox, [...othersWaiting(board, item?.kind === 'item' ? item.id : undefined, t), ...(board !== null ? toolSuggestions(board, usage, dismissed, t) : [])])
  return statusShareText(shell, pending, board?.artifacts, t)
}

/** A question takes the rows it needs on the band: shown whole (past the engine's rows, the band scrolls). */
const QUESTION_ROWS = Number.POSITIVE_INFINITY
/** The fewest cells the band's one thing keeps on its row before what grew (新学到, 提议) gives way. */
const ROOM_MIN = 16

/** How long a part of the board may take to read before it says so: a read that never answers costs a part, never the pane. */
const BOARD_READ_MS = 4_000

/**
 * `work`, or undefined once `ms` passed. The wait is cancelled when the work
 * answers first; where the engine gives no timer here, the work alone.
 */
async function within<V>($: EngineInterface, ms: number, work: Promise<V>): Promise<V | undefined> {
  const Ctl = (globalThis as { AbortController?: typeof AbortController }).AbortController
  if (Ctl === undefined) return work
  const ctl = new Ctl()
  let timer: Promise<typeof LATE>
  try {
    timer = $.clock.sleep(ms, { signal: ctl.signal }).then(() => LATE, () => new Promise<typeof LATE>(() => undefined))
  } catch {
    return work
  }
  try {
    const r = await Promise.race([work, timer])
    return r === LATE ? undefined : (r as V)
  } finally {
    ctl.abort()
  }
}

/** The rows of one tab of the board, read for that tab alone; the work items open on 此刻. */
async function tabRows($: EngineInterface, e: { surface: string; props: { bodyColumns: number; scroll: { bodyRows: number } } }, t: T, tab: BoardTab): Promise<BoardRow[]> {
  const columns = e.props.bodyColumns
  // Each read is a trip to the host: the ones a tab needs, at once; the ones written on every tool call only where the tab shows them.
  const shows = (visible: boolean) => <V,>(get: () => Promise<V>, otherwise: V): Promise<V> => (visible ? get() : Promise.resolve(otherwise))
  const attention = shows(tab === 'items')(() => Promise.all([attentionNow($, t), readQueued($), read($, heldOpenAtom)]).catch(() => null), null)
  const [inbox, board, problem, shell, now, root, filter, expanded, evidence, prompts, project, unfolded, doneOpen, sessionFlow, sessionRuns, flowState, switching, workflows, usage, dismissed, toolQuery, toolMenu, toolNaming, toolsOpen, exported, exportedFor, droppedOpen, artifactMenu, docsOpen] = await Promise.all([
    inboxOf($, t), readBoard($), read($, boardProblemAtom), readShell($), nowIso($), read($, rootAtom),
    read($, filterAtom), read($, expandedAtom), read($, evidenceAtom),
    shows(tab === 'sessions' || tab === 'journal')(() => readPrompts($), [] as PromptRecord[]),
    shows(tab === 'sessions' || tab === 'journal')(async () => {
      const [sessions, own, open, all, decisionsShown] = await Promise.all([read($, projectSessionsAtom), $.session.id().catch(() => ''), read($, openSessionAtom), read($, sessionsAllAtom), read($, decisionsShownAtom)])
      return { sessions: (sessions as unknown as SessionSummary[] | null) ?? [], own, open, all: all === true, decisionsShown: typeof decisionsShown === 'number' ? decisionsShown : 20 }
    }, null),
    shows(tab === 'sessions')(() => read($, expandedTurnAtom), null as GemworksJson),
    read($, doneOpenAtom), read($, sessionFlowAtom), read($, sessionRunsAtom),
    read($, flowStateAtom), read($, flowSwitchAtom), read($, workflowsAtom),
    usageDrawn($), dismissedOf($), read($, toolQueryAtom), read($, toolMenuAtom), read($, toolNamingAtom), read($, toolsOpenAtom),
    // The last export's line, while its file is there: one moved or deleted since draws none. A look that fails keeps it.
    shows(tab === 'sessions' || tab === 'journal')(async () => {
      const [path, at] = await Promise.all([read($, exportedAtom), read($, rootAtom)])
      if (path === null || path === '' || at === null) return path
      return (await $.fs.exists(projectPath(at, path)).catch(() => true)) ? path : null
    }, null),
    shows(tab === 'sessions')(() => read($, exportedForAtom), null),
    shows(tab === 'items')(() => read($, droppedOpenAtom), false),
    shows(tab === 'items')(() => read($, artifactMenuAtom), null),
    shows(tab === 'items')(() => read($, docsOpenAtom), false),
  ])
  // Where this session runs, after 本会话 on the sessions tab.
  const env = tab === 'sessions' ? await envNow($, t, e.surface).then((x) => x.parts, () => [] as string[]) : []
  const memory = tab === 'sessions'
    ? { list: (await read($, memoryAtom)) as MemoryList | null, group: await read($, memoryGroupAtom), menu: await read($, memoryMenuAtom), edit: await read($, memoryEditAtom), shown: ((await read($, memoryShownAtom)) as number | null) ?? 10 }
    : undefined
  // What the work made: the 产物 tab's list, and each work item's 产物 n.
  const made = tab === 'items' || tab === 'made'
    ? { madeAll: (await read($, madeAllAtom)) as unknown as MadeAll | null, madeView: (await read($, madeViewAtom)) as unknown as MadeView }
    : {}
  const rows = paneRows({
    board, problem, shell, tab, columns, maxRows: Math.max(4, e.props.scroll.bodyRows - 4), t, now, root: root ?? '', env, inbox, ...made,
    filter: filter as JournalFilter, expanded, evidence, prompts,
    ...(project !== null ? { project, scrolls: e.surface === 'terminal', unfolded: unfolded as unknown as { id: string; answer: string | null } | null } : {}),
    ...(tab === 'items' || tab === 'flow' || tab === 'made' ? { coach: {
      items: await workItems($), flows: await coachFlowsKept($), focus: (await read($, coachFocusAtom)) as unknown as CoachFocus | null, asks: tab === 'items' ? await openAsks($) : [],
      own: await $.session.id().catch(() => ''), open: ((await read($, workOpenAtom)) ?? []) as WorkGroup[],
      practices: (await practicesKept($))?.list ?? [], expanded: (await read($, manualExpandedAtom)) as string[] | null,
      unfolded: (await read($, workUnfoldedAtom)) as string | null, sessions: ((await read($, projectSessionsAtom)) as unknown as SessionSummary[] | null) ?? [],
      proposals: await proposalsKept($), rules: await rulesKept($), skipped: skippedSteps(await workItems($), await coachFlowsKept($), await proposalsKept($)),
      gone: await goneOnKept($), doing: await doingKept($),
      ...(tab === 'flow' ? { ledger: await ledgerKept($) } : {}),
    } } : {}),
    exportedFor, doneOpen, droppedOpen, sessionItem: sessionFlow as string | null, ...(tab === 'sessions' ? { moved: await movedOf($, t) } : {}), sessionLimit: await read($, turnsShownAtom), picked: ((await read($, pickedAtom)) as string[] | null) ?? [], tidying: (await read($, tidyingAtom)) === true, sessionRuns: (sessionRuns as unknown as string[] | null) ?? [],
    flowState, switching, workflows: workflows as unknown as { bundled: string[]; installed: string[] } | null,
    usage, dismissed, toolQuery, toolMenu, toolNaming, toolsOpen: (toolsOpen as unknown as string[] | null) ?? [],
    exported, artifactMenu, docsOpen, ...(memory !== undefined ? { memory } : {}),
  })
  const here = await attention
  const asked = here !== null && here[0].attention !== null && !here[0].attention.consumed ? here[0].attention.asks : undefined
  return here === null ? rows : [...nowRows({ reply: here[0].reply, standing: here[0].standing, memory: here[0].memory, queued: here[1], picks: here[0].attention?.picks ?? [], ...(asked !== undefined ? { asked } : {}), t }), ...heldRows(here[0].held, here[2], t, now), ...rows]
}

/** The board's header: the mark, the version, the dialogs; the work item, its stage and flow; where the session runs. */
function drawHeader($: EngineInterface, els: Els, head: Header | undefined, t: T, columns: number): unknown {
  const { Box, Text, Button } = els
  return (
    <Box key="header" flexDirection="column">
      {head !== undefined && (
        <Box gap={1} alignItems="center">
          {els.Svg !== undefined ? <els.Svg source={LOCKUP_SVG} alt="Gemworks" width={HEADER_LOCKUP.width} height={HEADER_LOCKUP.height} /> : <Text {...toneProps(MARK.tone)}>{MARK.text}</Text>}
          {els.Svg === undefined && <Text bold>Gemworks</Text>}
          {head.version !== '' && (els.Svg !== undefined
            ? <Box key="version" borderStyle="round" borderColor={RULE} paddingX={1}><Text dimColor>{head.version}</Text></Box>
            : <Text dimColor>{head.version}</Text>)}
          {head.synced !== undefined && <Text key="synced" color="warning">{t('已同步 {0}', head.synced)}</Text>}
          {head.newer !== undefined && <Button key="newer" plain label={t('● 可更新 {0}', head.newer)} onPress={press($, { op: 'dialog', dialog: 'upgrade' })} />}
          <Box flexGrow={1} />
          <Box key="dialogs" gap={els.Svg !== undefined ? 2 : 1} alignItems="center">
            {head.dialogs.map((d) => iconButton($, els, d, d.key.replace(/^dialog-/, '') as Glyph))}
          </Box>
        </Box>
      )}
      {head !== undefined && hairline(els, 'rule-top')}
      {head?.name !== undefined && (els.Svg !== undefined
        ? (
          <Box key="item-row" gap={1} alignItems="center" backgroundColor={SHADE} paddingX={1}>
            <Text bold>{head.name}</Text>
            {head.stage !== undefined && <Text bold color="inverseText" backgroundColor="text">{` ${head.stage} `}</Text>}
            {head.flow !== undefined && <Text dimColor>{head.flow}</Text>}
            <Box flexGrow={1} />
          </Box>
        )
        : (
          <Box gap={1}>
            <Text bold>{head.name}</Text>
            {head.stage !== undefined && <Text {...toneProps('brand')} bold>{head.stage}</Text>}
            {head.flow !== undefined && <Text dimColor>{head.flow}</Text>}
            <Box flexGrow={1} />
          </Box>
        ))}
      {head?.reason !== undefined && <Text dimColor>{head.reason}</Text>}
    </Box>
  )
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    // The root is the checkout's top, where .geml/ is: a session started (or reloaded) in a subdirectory moves up to it.
    const top = await checkoutOf($, e.cwd).catch(() => undefined)
    await update($, rootAtom, () => top ?? e.cwd)
    await update($, setupAtom, () => null)
    await loadStored($)
    await restorePrompts($)
    await continueFrom($)
    for (const t of FLOW_TOOLS) {
      await registerOne($, t.name, () => $.tool.register({ name: t.name, description: t.description, inputSchema: t.inputSchema, isDeferred: false }))
    }
    await registerOne($, NOTE_TOOL.name, () => $.tool.register({ name: NOTE_TOOL.name, description: NOTE_TOOL.description, inputSchema: NOTE_TOOL.inputSchema as unknown as Record<string, unknown>, isDeferred: false }))
    await registerOne($, ARTIFACT_TOOL.name, () => $.tool.register({ name: ARTIFACT_TOOL.name, description: ARTIFACT_TOOL.description, inputSchema: ARTIFACT_TOOL.inputSchema as unknown as Record<string, unknown>, isDeferred: false }))
    await registerOne($, ASK_TOOL.name, () => $.tool.register({ name: ASK_TOOL.name, description: ASK_TOOL.description, inputSchema: ASK_TOOL.inputSchema as unknown as Record<string, unknown>, isDeferred: false }))
    await registerOne($, WORK_TOOL.name, () => $.tool.register({ name: WORK_TOOL.name, description: WORK_TOOL.description, inputSchema: WORK_TOOL.inputSchema as unknown as Record<string, unknown>, isDeferred: false }))
    await registerOne($, PRACTICE_TOOL.name, () => $.tool.register({ name: PRACTICE_TOOL.name, description: PRACTICE_TOOL.description, inputSchema: PRACTICE_TOOL.inputSchema as unknown as Record<string, unknown>, isDeferred: false }))
    await registerOne($, PROPOSE_TOOL.name, () => $.tool.register({ name: PROPOSE_TOOL.name, description: PROPOSE_TOOL.description, inputSchema: PROPOSE_TOOL.inputSchema as unknown as Record<string, unknown>, isDeferred: false }))
    await registerOne($, RULE_TOOL.name, () => $.tool.register({ name: RULE_TOOL.name, description: RULE_TOOL.description, inputSchema: RULE_TOOL.inputSchema as unknown as Record<string, unknown>, isDeferred: false }))
    await registerOne($, '/gemworks', () => $.command.register({ name: 'gemworks', description: 'Gemworks：当前阶段、看板、暂停与继续、切换或添加流程', argumentHint: COMMAND_HINT }))
    // The settings, from the store; the host's language; the plugin's version.
    try {
      const stored = await $.store.get(STORE_SETTINGS)
      await update($, settingsAtom, () => settingsFrom(stored) as unknown as GemworksJson)
    } catch { await update($, settingsAtom, () => DEFAULT_SETTINGS as unknown as GemworksJson) }
    try { const lang = await $.env.get('LANG'); if (lang !== undefined) await update($, localeAtom, () => lang) } catch { /* no env */ }
    try {
      const manifest = JSON.parse(String(await $.fs.read(`${$.plugin.root}/.claude-plugin/plugin.json`))) as { version?: unknown }
      if (typeof manifest.version === 'string') { const v = manifest.version; await update($, versionAtom, () => v); trace($, `loaded ${v} in ${e.cwd}`) }
    } catch { /* no manifest */ }
    $.clock.after(0, () => { void probeCompose($) })
    await adoptPanes($)
    await startBridge($)
    $.clock.after(0, () => { void initBackfill($).then(() => reconcileTurns($)).catch(() => undefined) })
    // A load is a reload: nothing is due. The repository's facts now and every two minutes; the band every minute, so a
    // person away from the keyboard comes back to the steps still waiting on them without having to type first.
    await update($, reloadAtom, () => false)
    await update($, queuedAtom, () => [])
    await update($, goneOnAtom, () => [])
    await update($, doingAtom, () => null)
    $.clock.after(0, () => { void loadFacts($) })
    $.clock.every(120_000, () => { void loadFacts($) })
    $.clock.every(60_000, () => {
      $.ui.invalidate('ui.render')
      void loadProjectSessions($)
      // The flow tab's ledger, while it is the tab shown: other sessions label into it too.
      void read($, tabAtom).then((tab) => (tab === 'flow' ? loadCorrections($) : undefined)).catch(() => undefined)
    })
    return next(e)
  }).catch(($, e, next) => next(e))

  // The clients driving the session (the desktop app, a phone over Remote Control): kept for the environment line.
  on('session.attach', async ($, e, next) => {
    const done = await next(e)
    try {
      await update($, clientsAtom, (was) => [...(((was as unknown) as AttachedClient[] | null) ?? []).filter((c) => c.clientId !== e.clientId), { clientId: e.clientId, surface: e.surface }] as unknown as GemworksJson)
      $.ui.invalidate('ui.render')
    } catch { /* the roster stays */ }
    return done
  }).catch(($, e, next) => next(e))
  on('session.detach', async ($, e, next) => {
    const done = await next(e)
    try {
      await update($, clientsAtom, (was) => (((was as unknown) as AttachedClient[] | null) ?? []).filter((c) => c.clientId !== e.clientId) as unknown as GemworksJson)
      $.ui.invalidate('ui.render')
    } catch { /* the roster stays */ }
    return done
  }).catch(($, e, next) => next(e))

  // A /clear ends the conversation the model read the stage and the standing instructions in: the next prompt delivers them again. What ran is stored.
  on('session.end', async ($, e, next) => {
    await update($, deliveredAtom, () => null)
    try { await update($, toldAtom, () => false) } catch { /* said again at the next */ }
    try { await storeUsage($) } catch { /* kept for the session */ }
    await noteBoard($)
    return next(e)
  }).catch(($, e, next) => next(e))

  // A compaction may fold the first prompt's standing instructions away: the main loop's next prompt carries them again, where the system prompt
  // does not. A summary computed ahead of time (`precompute`) replaces nothing yet.
  on('session.compact', async ($, e, next) => {
    const done = await next(e)
    if (e.agentId === undefined && e.trigger !== 'precompute' && !('skip' in done)) { try { await update($, toldAtom, () => false) } catch { /* said again after the next /clear */ } }
    return done
  }).catch(($, e, next) => next(e))

  // Every tool call. A broken gemworks never blocks one: where next already ran, next(e) replays its result.
  on('tool.call', async ($, e, next) => {
    const tool = String(e.tool)
    // What the turn did, for its end: a call that writes, runs, publishes or asks the person something.
    if (e.agentId === undefined && (CLAUDE_CODE_TOOLS.write.includes(tool) || CLAUDE_CODE_TOOLS.run.includes(tool) || tool === 'Artifact' || tool === `mcp__gemworks__${ASK_TOOL.name}`)) turnActed = true
    // How often each tool is used: every call is noted under its day as it starts, by the key the dictionary would give it, gemworks's own too.
    await noteUsage($, tool, toolArgs(e as unknown as Record<string, unknown>))
    if (isOwnTool(tool) || tool === `mcp__gemworks__${NOTE_TOOL.name}` || tool === `mcp__gemworks__${ARTIFACT_TOOL.name}` || tool === `mcp__gemworks__${ASK_TOOL.name}` || tool === `mcp__gemworks__${WORK_TOOL.name}` || tool === `mcp__gemworks__${PRACTICE_TOOL.name}` || tool === `mcp__gemworks__${PROPOSE_TOOL.name}` || tool === `mcp__gemworks__${RULE_TOOL.name}`) return next(e)
    // A rule the person made holds a call while the step it requires is unmet; a check that fails lets the call through.
    try {
      const held = await ruleHold($, tool, toolArgs(e as unknown as Record<string, unknown>))
      if (held !== undefined) return { deny: `gemworks: ${held}` }
    } catch { /* never in the way on its own failure */ }
    await retryStart($)
    if (e.agentId === undefined) await notePrompt($, (p) => ({ ...p, tools: p.tools + 1 }))
    const input = toolArgs(e as unknown as Record<string, unknown>)
    const call = { tool, input }
    const policy = (await readShell($))?.policy ?? null
    const root = await read($, rootAtom)
    // Where the call starts, read before it runs: a `cd` in its own command line has not moved the loop yet.
    const cwd = policy !== null ? await callCwd($) : undefined
    const elsewhere = cwd !== undefined && root !== null && (await actsElsewhere($, call, cwd, root))
    // An engine that cannot say where the call starts: at the root, as the session did.
    const from = cwd ?? root ?? ''
    const passes = await readPasses($)
    let consulted = false
    let decision = beforeDecision(policy, call, elsewhere, passes)
    // A question about the preferred tool is asked here, once a session for a row; the answer goes through the bridge into the dictionary, and the CLI then judges and records.
    const passed = ((await read($, preferPassedAtom)) as unknown as string[] | null) ?? []
    if (decision.kind === 'prefer' && passed.includes(decision.key)) decision = { kind: 'pass' }
    if (decision.kind === 'prefer') {
      const asked = decision
      const answered = await askPerson($, asked)
      if (answered.kind === 'pass') await update($, preferPassedAtom, (was) => [...new Set([...((((was as unknown) as string[] | null) ?? [])), asked.key])] as unknown as GemworksJson)
      if (answered.kind === 'deny') return { deny: `gemworks: ${answered.reason}` }
      if (answered.kind === 'learn') {
        await bridge($, { op: 'learn', lessons: answered.lessons, tool, input: bridgeInput(input), cwd: from })
        decision = { kind: 'consult' }
      } else decision = { kind: 'pass' }
    }
    if (decision.kind === 'consult') {
      const waived = decision.waived
      const before = { op: 'before' as const, tool, callId: e.tool_use_id, input: bridgeInput(input), cwd: from, ...(waived !== undefined ? { waived } : {}) }
      const res = await bridge($, before)
      if (res !== undefined && res.ok && res.refusal !== undefined) {
        if (e.agentId === undefined) await notePrompt($, (p) => ({ ...p, refusals: p.refusals + 1 }))
        await notifyRefusal($, tool, res.refusal)
        return { deny: `gemworks: ${res.refusal}` }
      }
      // The waiver was spent on this call.
      if (waived !== undefined && res !== undefined && res.ok) await update($, passesAtom, (was) => ((((was as unknown) as string[] | null) ?? []).filter((k) => !waived.includes(k))) as unknown as GemworksJson)
      consulted = res !== undefined && res.ok && res.recorded === true
    }
    // A tool with default parameters in the dictionary: the ones the model left out are filled in.
    const fill = paramsToFill(policy, call)
    const ran = await next(fill === undefined ? e : { ...e, ...fill })
    if (ran.deny !== undefined) return ran
    // A page the Artifact tool published is one of the work item's artifacts: recorded once the call is answered.
    // A visual drawn inline is kept as a page: it has no file or link of its own.
    if (isVisualTool(tool) && ran.isError !== true) $.clock.after(0, () => { void keepVisual($, input).catch(() => undefined) })
    if (tool === 'Artifact' && ran.isError !== true) { const said = ran.text ?? (typeof ran.result === 'string' ? ran.result : undefined); $.clock.after(0, () => { void publishedArtifact($, said, input).catch(() => undefined) }) }
    const wrotePath = touchedPath(tool, input, root ?? '')
    // A file written in another checkout is that checkout's work item, never the session's current one.
    if (!elsewhere && wrotePath !== undefined && matchesUnit(policy, wrotePath, (await readShell($))?.units ?? [])) await update($, lastFileAtom, () => wrotePath)
    if (wrotePath !== undefined && ran.isError !== true) { const path = wrotePath; $.clock.after(0, () => { void sessionsOnFile($, path) }) }
    // A file made for a person in the project: versioned at the turn's end, when no workflow journal names it.
    if (!elsewhere && wrotePath !== undefined && ran.isError !== true && isMadeForPeople(wrotePath)) { const path = wrotePath; $.clock.after(0, () => { void update($, madeHereAtom, (was) => [...new Set([...(was ?? []), path])]).catch(() => undefined) }) }
    // A page, a picture, a draft made for the person outside the project (a scratchpad): one of the work item's artifacts at the turn's end.
    const outside = wrotePath === undefined && ran.isError !== true && CLAUDE_CODE_TOOLS.write.includes(tool) ? writtenPath(tool, input) : undefined
    if (outside !== undefined && isMadeForPeople(outside)) $.clock.after(0, () => { void update($, madeElsewhereAtom, (was) => [...new Set([...(was ?? []), outside])]).catch(() => undefined) })
    // A file handed to git commit as its message was a draft for the commit, not for the person: no artifact, and out again if recorded before.
    const command = CLAUDE_CODE_TOOLS.run.includes(tool) && typeof input['command'] === 'string' ? input['command'] as string : undefined
    const drafts = command !== undefined && /\bcommit\b/.test(command) ? commitMessageFiles(command) : []
    if (drafts.length > 0) {
      const cwd = await $.session.cwd().catch(() => root ?? '')
      // On Windows a Git Bash path names its drive as a folder (/c/Users/…): the file the write tools named C:\Users\….
      const windows = /^[A-Za-z]:[\\/]/.test(cwd)
      const drive = (f: string): string => (windows ? f.replace(/^\/([A-Za-z])(?=\/)/, (_, d: string) => `${d.toUpperCase()}:`) : f)
      const named = drafts.map(drive).map((f) => (/^(\/|[A-Za-z]:[\\/])/.test(f) ? f : `${cwd}/${f}`))
      const same = (a: string, b: string): boolean => a.split('\\').join('/').toLowerCase() === b.split('\\').join('/').toLowerCase()
      $.clock.after(0, () => {
        void (async () => {
          await update($, madeElsewhereAtom, (was) => (was ?? []).filter((p) => !named.some((n) => same(n, p))))
          await update($, notMadeAtom, (was) => [...new Set([...(was ?? []), ...named])])
        })().catch(() => undefined)
      })
    }
    const exitCode = CLAUDE_CODE_TOOLS.run.includes(tool) ? bashExitCode(ran) : undefined
    const outcome = {
      isError: ran.isError === true,
      gitOperation: hasGitOperation(ran),
      ...(exitCode !== undefined ? { exitCode } : {}),
      ...(wrotePath !== undefined ? { wrotePath } : {}),
    }
    if (!afterNeeded(policy, call, { ...outcome, consulted }, elsewhere)) return ran
    const delivered = await deliveredFor($, e.agentId)
    const before = (await readShell($))?.status?.vars ?? {}
    const agentId = e.agentId
    const settled = async (res: BridgeResponse | undefined): Promise<void> => {
      if (res === undefined || !res.ok || agentId !== undefined) return
      const after = res.shell.status?.vars ?? {}
      const signals = Object.keys(after).filter((k) => after[k] === true && before[k] !== true)
      const entered = res.entered ?? []
      if (signals.length > 0 || entered.length > 0) await notePrompt($, (p) => ({ ...p, signals: [...p.signals, ...signals], entered: [...p.entered, ...entered] }))
    }
    // The call's result does not wait on gemworks: AFTER_WAIT_MS at most. The evidence is recorded meanwhile; a stage it
    // moved reaches the model with the next prompt, as a stage moved between prompts does.
    const pending = bridge($, { op: 'after', tool, callId: e.tool_use_id, input: bridgeInput(input), ...outcome, cwd: from, ...(delivered !== null ? { delivered } : {}) })
    const res = await Promise.race([pending, $.clock.sleep(AFTER_WAIT_MS).then((): typeof LATE => LATE)])
    if (res === LATE) {
      void pending.then(settled).catch(() => undefined)
      return ran
    }
    await settled(res)
    return withStage($, ran, res, e.agentId)
  }).catch(($, e, next) => next(e))

  // The three tools. Each hook is a function literal: the engine reads hooks statically and refuses one that is a call's result.
  on('tool.call', { tool: 'mcp__gemworks__status' }, ($, e) => serveVerb($, 'status', e)).catch(() => VERB_FAILED)
  on('tool.call', { tool: 'mcp__gemworks__move' }, ($, e) => serveVerb($, 'move', e)).catch(() => VERB_FAILED)
  on('tool.call', { tool: 'mcp__gemworks__set' }, ($, e) => serveVerb($, 'set', e)).catch(() => VERB_FAILED)
  on('tool.call', { tool: 'mcp__gemworks__note' }, ($, e) => noteDecisions($, e)).catch(() => ({ result: 'gemworks could not record that' }))
  on('tool.call', { tool: 'mcp__gemworks__artifact' }, ($, e) => recordArtifact($, e)).catch(() => ({ result: 'gemworks could not record that' }))
  on('tool.call', { tool: 'mcp__gemworks__ask' }, ($, e) => registerAsk($, e)).catch(() => ({ result: 'gemworks could not register that' }))
  on('tool.call', { tool: 'mcp__gemworks__work' }, ($, e) => recordWork($, e)).catch(() => ({ result: 'gemworks could not record that' }))
  on('tool.call', { tool: 'mcp__gemworks__practice' }, ($, e) => recordPractices($, e)).catch(() => ({ result: 'gemworks could not record that' }))
  on('tool.call', { tool: 'mcp__gemworks__propose' }, ($, e) => recordProposals($, e)).catch(() => ({ result: 'gemworks could not record that' }))
  on('tool.call', { tool: 'mcp__gemworks__rule' }, ($, e) => recordRule($, e)).catch(() => ({ result: 'gemworks could not record that' }))

  // The model is told about the project's other sessions and the ask tool in the system prompt, where this event reaches gemworks (see prefaceFor).
  on('prompt.compose', async ($, e, next) => {
    const done = await next(e)
    try { await update($, composedAtom, () => true) } catch { /* the next prompt may say it once more */ }
    const flows = await coachFlows($).catch(() => [] as CoachFlow[])
    return { ...done, sections: [...done.sections, { id: 'gemworks:sessions', text: SESSIONS_PROMPT, scope: 'session' as const }, { id: 'gemworks:ask', text: ASK_PROMPT, scope: 'session' as const }, ...(flows.length > 0 ? [{ id: 'gemworks:work', text: workPrompt(flows), scope: 'session' as const }, { id: 'gemworks:practice', text: PRACTICE_PROMPT, scope: 'session' as const }, { id: 'gemworks:growth', text: GROWTH_PROMPT, scope: 'session' as const }] : [])] }
  }).catch(($, e, next) => next(e))

  // A turn that changed things and reported no work item goes back once to report it; the next stop ends it whatever it did.
  // Nothing to record into (no project read yet, no flows) asks nothing.
  on('classic.Stop', async ($, e, next) => {
    if (turnActed && !turnReported && e.stop_hook_active !== true && (await read($, sessionsDirAtom)) !== null && (await coachFlowsKept($)).length > 0) {
      turnReported = true
      return { block: WORK_REMINDER }
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  // A main-loop turn's end: the first sentence of its answer goes on its prompt's row, as what the turn did.
  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (e.agentId === undefined) {
      turnBusy = false
      try { await setQueued($, (q) => q.filter((x) => !x.entered)) } catch { /* shown till the next */ }
      try { if ((await goneOnKept($)).length > 0) await update($, goneOnAtom, (was) => goneOnAfterTurn(((was as unknown) as GoneOn[] | null) ?? []) as unknown as GemworksJson) } catch { /* shown till the next */ }
      try { if ((await doingKept($)) !== null) await update($, doingAtom, () => null) } catch { /* shown till the next */ }
      $.clock.after(0, () => { void storePrompts($) })
      $.clock.after(0, () => { void noteBoard($) })
      if (!e.isAborted) { const answer = e.answer; $.clock.after(0, () => { void sessionsOnAnswer($, answer) }) }
      $.clock.after(0, () => { void artifactsOnTurn($).catch(() => undefined) })
      $.clock.after(0, () => { void loadMemory($) })
      try { await storeUsage($) } catch { /* kept for the next turn */ }
      try {
        const did = answerGist(e.answer)
        if (did !== undefined) await notePrompt($, (p) => (p.did === undefined ? { ...p, did } : p))
      } catch { /* the row stays without it */ }
      if (!e.isAborted) {
        try {
          const [was, at, registered, left] = await Promise.all([readAttention($), $.clock.now(), read($, askedAtom), read($, leftAsksAtom)])
          // The state the turn leaves: this reply's own questions first, then those still open from before (attention.ts).
          // A question the person answered while this turn ran is not asked again: the answer waits in the queue, unseen by it.
          const done = ((await read($, answeredAtom)) as string[] | null) ?? []
          const item = turnItem(await workItems($), await $.session.id().catch(() => ''))?.id
          const asks = asksAfterTurn(((registered as unknown) as Asked[] | null) ?? [], ((left as unknown) as Asked[] | null) ?? [], done, item)
          await update($, askedAtom, () => [] as unknown as GemworksJson)
          await update($, leftAsksAtom, () => [] as Asked[])
          await update($, answeredAtom, () => [] as string[])
          const kept: Attention = { reply: e.answer, replyAt: at, memory: was?.memory ?? NO_MEMORY, consumed: false, ...(asks.length > 0 ? { asks } : {}) }
          await update($, attentionAtom, () => kept as unknown as GemworksJson)
          $.clock.after(0, () => { void notifyWaiting($, asks).catch(() => undefined) })
          const facts = await read($, factsAtom)
          await update($, factsAtReplyAtom, () => facts)
          $.clock.after(0, () => { void loadFacts($) })
        } catch { /* the band keeps the last reply */ }
      }
    }
    return done
  })

  // The person's prompt is recorded for the sessions tab; the stage changed between prompts (a person moved it, session start caught up git): the model hears of it now.
  on('prompt.submit', async ($, e, next) => {
    // Where it came from: this machine's prompt box, or Remote Control (a plugin's own prompt keeps the last).
    const person = fromPerson(e.origin as { kind: string; asUser?: boolean })
    turnBusy = true
    turnActed = false
    turnReported = false
    try { if (((await read($, initAtom)) as unknown as InitState | null)?.state === 'done') await update($, initAtom, () => null) } catch { /* stays */ }
    if (person && e.origin.kind !== 'plugin') { try { await update($, originAtom, () => e.origin.kind) } catch { /* unknown */ } }
    // The person's own turn takes up this session's work item: 我在做 in place of its 好，做吧 until the turn ends.
    if (person) {
      try {
        const i = turnItem(await workItems($), await $.session.id().catch(() => ''))
        await update($, doingAtom, () => (i !== undefined ? { id: i.id, next: i.next, at: i.at } : null))
      } catch { /* the button stays */ }
    }
    // The first prompt of a conversation carries the standing instructions, where the system prompt did not.
    const news = [...(await prefaceFor($)), ...(person ? [...(await attentionOnPrompt($, e.text)), ...(await sessionsOnPrompt($, e.text).catch(() => [] as string[]))] : [])]
    // The work items on the way, by id, so the turn's report updates them rather than reporting them anew.
    try { news.push(...workContext(await workItems($), await coachFlows($))) } catch { /* the model reports them anew */ }
    // The practices of the step this session's work item stands at; on a project's first start, the ask to move its memory onto the steps.
    try {
      const kept = await practicesKept($)
      if (kept !== null) news.push(...practiceContext(await workItems($), await coachFlows($), kept.list, await $.session.id().catch(() => '')))
      if (person && kept !== null && !kept.memoryMoved && (await read($, memoryAskedAtom)) !== true) {
        const res = await bridge($, { op: 'memory' }).catch(() => undefined)
        const memory = res !== undefined && res.ok ? res.memory : undefined
        if (memory !== undefined && memory.entries.length > 0) {
          news.push(...memoryMoveContext(memory.dir, memory.entries))
          await update($, memoryAskedAtom, () => true)
        }
      }
    } catch { /* a reminder missed, not a prompt stopped */ }
    // What the person gave with it (images, documents) is one of the work item's artifacts: copied once the prompt entered, behind it.
    const given = person ? e.attachments ?? [] : []
    const go = (ev: typeof e) => next(news.length > 0 ? { ...ev, context: [...(ev.context ?? []), ...news] } : ev).then((done) => {
      if (given.length > 0) $.clock.after(0, () => { void uploadsOnPrompt($, given).catch(() => undefined) })
      return done
    })
    // Between turns, where the person may have moved the session: the root follows. Within a turn it stays, so a call in another checkout stays elsewhere.
    await followCwd($)
    const root = await read($, rootAtom)
    if (root === null) return go(e)
    await retryStart($)
    if (person) {
      const s = (await readShell($))?.status
      const record: PromptRecord = {
        id: `p${(await readPrompts($)).length + 1}-${Date.now().toString(36)}`, at: await nowIso($), text: e.text,
        ...(s?.item.kind === 'item' ? { item: s.item.id, itemTitle: s.title ?? s.item.id } : {}), ...(s?.state !== undefined ? { state: s.state.id } : {}),
        ...(s?.workflow !== undefined ? { flow: s.workflow.title } : {}),
        tools: 0, refusals: 0, entered: [], signals: [],
      }
      const before = await readPrompts($)
      await update($, promptsAtom, (was) => [...((((was as unknown) as PromptRecord[] | null) ?? [])), record].slice(-PROMPTS_KEPT) as unknown as GemworksJson)
      $.clock.after(0, () => { void storePrompts($) })
      // A typed prompt goes into the person's ledger of corrections, labelled behind it: its words without the host's
      // reminders, the reply it answers, the step its session's work item stood at. Another session's report arrives as
      // a prompt that is one reminder: nothing typed, nothing labelled.
      const words = typedWords(e.text)
      if (e.origin.kind !== 'plugin' && words !== undefined) {
        try {
          const session = await $.session.id().catch(() => '')
          const item = turnItem(await workItems($), session)
          const flow = item !== undefined ? (await coachFlowsKept($)).find((f) => f.name === item.flow) : undefined
          const step = item !== undefined && flow !== undefined ? itemProgress(item, flow).here ?? undefined : undefined
          const said = { text: words, before: (await readAttention($))?.reply ?? '', at: record.at, session, project: root, ...(flow !== undefined && step !== undefined ? { flow: flow.name, step } : {}) }
          // Learning off (settings): the prompt is not read by the small model.
          if (session !== '' && (await readSettings($)).learn.enabled) $.clock.after(0, () => { void labelPrompt($, said).catch(() => undefined) })
        } catch { /* this prompt stays unlabelled; gemworks corrections pending finds it */ }
      }
      // A typed prompt is judged (an option pressed said what it chose already), after it is on its way.
      if (e.origin.kind !== 'plugin' && (await readSettings($)).judge.enabled) {
        const lastAnswer = before[before.length - 1]?.did ?? ''
        const text = e.text
        $.clock.after(0, () => { void judgeTurn($, text, lastAnswer).catch(() => update($, judgedAtom, () => null)) })
      } else await update($, judgedAtom, () => null)
    }
    let doc: string
    try {
      doc = String(await $.fs.read(`${root}/.geml/context.geml`))
    } catch {
      return go(e)
    }
    const seen = contextOf(doc)
    if (seen === undefined || seen.key === (await read($, deliveredAtom))) return go(e)
    const item = (await readShell($))?.status?.item
    if (item === undefined || item.kind !== 'item' || item.id !== seen.item) return go(e)
    await update($, deliveredAtom, () => seen.key)
    return go({ ...e, context: [...(e.context ?? []), seen.text] })
  }).catch(($, e, next) => next(e))

  // A command that writes into the plugin's own folder (a developer copying a new build in): a reload is due.
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const done = await next(e)
    try {
      const command = String(e.command ?? '').replace(/\\/g, '/')
      const root = $.plugin.root.replace(/\\/g, '/')
      if (command.includes(root) || /local-marketplaces/.test(command)) await update($, reloadAtom, () => true)
      if (/\bgit\b[^\n|;&]*\bcommit\b/.test(command) && !(await read($, committedAtom))) await update($, committedAtom, () => true)
      // The split-session skill rewrote the transcript (turns removed, or split into a new session): the tab and the record follow.
      if (/split-session\.mjs\b[^\n|;&]*\b(remove|split)\b/.test(command) && !/--dry-run/.test(command)) {
        const said = splitSummary(done)
        if (said !== undefined) { const to = said.created?.cliId; $.clock.after(0, () => { void reconcileTurns($, to).catch(() => undefined) }) }
      }
    } catch { /* nothing due */ }
    return done
  }).catch(($, e, next) => next(e))

  // The host stores the person's prompt as a row with an id, the same the transcript file holds: the sessions tab's newest record without one learns it, so a press can scroll to the row.
  on('session.append', { door: 'prompt' }, async ($, e, next) => {
    if (e.agentId === undefined && e.message.role === 'user' && e.message.isMeta !== true && e.origin.kind !== 'plugin' && fromPerson(e.origin as { kind: string; asUser?: boolean })) {
      const uuid = e.uuid
      await update($, promptsAtom, (was) => {
        const list = [...(((was as unknown) as PromptRecord[] | null) ?? [])]
        for (let i = list.length - 1; i >= 0; i -= 1) {
          const p = list[i] as PromptRecord
          if (p.uuid === undefined) { list[i] = { ...p, uuid }; return list as unknown as GemworksJson }
        }
        return was
      })
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  // The band (spec §8.1): Gemworks's mark, the one thing that is the person's now with its options, how many more wait, the board.
  // Hovering the thing's name, or `还有 N 件`, shows it whole in the line's place: a card drawn over the line, never beyond it.
  // A render that throws (a shell this module cannot read) draws one line saying so, never the engine's blank.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const els = elementsOf($, e)
    const { Box, Text, Button, Svg } = els
    const t = await words($)
    let view: BandView
    // The board is a press away whenever there is a workflow, not only when something waits in it.
    let workflow = false
    let waitingOnPerson = 0
    let notice: { text: string; tone: 'dim' | 'normal' } | null = null
    try {
      const shell = await readShell($)
      const board = await readBoard($)
      const item = shell?.status?.item
      // What waits on the person, the same list the board's 待处理 shows: the current work item's things, then the others'.
      const inbox = pendingList(await inboxOf($, t), [...othersWaiting(board, item?.kind === 'item' ? item.id : undefined, t), ...(board !== null ? [...toolSuggestions(board, await usageDrawn($), await dismissedOf($), t), ...ciSuggestions(board, shell?.units ?? [], await dismissedOf($), t)] : [])])
      workflow = shell?.status != null || (await coachFlowsKept($)).length > 0
      waitingOnPerson = inbox.length
      // The initialization's count while it runs; its outcome, once, until the next prompt.
      const init = (await read($, initAtom)) as unknown as InitState | null
      notice = init === null ? null : init.state === 'running'
        ? { text: t('初始化任务整理中…（{0}/{1}）', init.done, init.total), tone: 'dim' as const }
        : { text: `${t('初始化完毕。欢迎使用。')}${init.failed > 0 ? t('（{0} 个会话读不了）', init.failed) : ''}`, tone: 'normal' as const }
      view = bandView({
        shell, problem: await read($, problemAtom), setup: await read($, setupAtom), notice, todo: (await read($, todoAtom)) as unknown as TodoCount | null,
        inbox, timeline: board?.timeline ?? [], now: await nowIso($), t,
      })
      // Nothing waits on the person: the band names the work item this session was on last (coach.ts), not the stage the workflow holds.
      if (view.verb === t('我在做')) {
        const session = await $.session.id().catch(() => '')
        const own = (((await read($, projectSessionsAtom)) as unknown as SessionSummary[] | null) ?? []).find((x) => x.id === session)
        const line = coachBand(await workItems($), await coachFlowsKept($), session, t, own?.turns.at(-1)?.at, await goneOnKept($), await doingKept($))
        if (line !== undefined) view = { ...view, verb: line.verb, title: line.title, note: line.note, detail: line.detail, actions: line.actions, ...(line.more.count > 0 ? { more: line.more } : {}) }
        else if (view.title === '') view = { ...view, verb: '', title: t('空闲') }
      }
      // No shell yet and a start that got no answer: the band says it is trying again, not 启动中… for good.
      if (shell === null && startRetrying && view.tone !== 'error') view = { ...view, note: t('桥接未应答，重试中') }
    } catch (err) {
      view = { verb: '', title: `gemworks：状态带画不出来（${reasonOf(err)}）`, tone: 'error', note: '', detail: '', actions: [], more: { count: 0, detail: '' } }
    }
    // A fresh judgement of the last prompt stands in for the one thing: what it took (with an undo), or what it asks.
    const judged = (await read($, judgedAtom)) as unknown as Judgement | null
    if (judged !== null && Date.parse(await nowIso($)) - Date.parse(judged.at) < JUDGEMENT_MS) {
      const line = judgementLine(judged, t)
      view = { ...view, verb: t('判定'), title: line.title, tone: 'normal', note: line.note, detail: `${judged.said}${SEP}${line.title}${line.note !== '' ? `${SEP}${line.note}` : ''}`, actions: line.actions }
    }
    // What needs the person now (attention.ts): the reply's asks and the steps only they can take lead, after a broken
    // bridge and a fresh judgement; the workflow's own waiting items and a pause come next; a line of steps still owed
    // stands in for "我在做" only when nothing else does.
    let attentionPresses: Pressable[] | null = null
    let question: string | undefined
    const judgedFresh = judged !== null && Date.parse(await nowIso($)) - Date.parse(judged.at) < JUDGEMENT_MS
    if (view.tone !== 'error' && !judgedFresh) {
      try {
        const at = await attentionNow($, t)
        const workflowWaits = waitingOnPerson > 0 || view.verb === t('已暂停')
        if (at.line !== null && (at.line.lead !== null || !workflowWaits)) {
          view = { verb: '', title: at.line.text, tone: at.line.lead === 'broken' ? 'error' : at.line.lead === 'maybe' ? 'dim' : 'normal', note: '', detail: at.line.text, actions: [], more: { count: 0, detail: '' } }
          attentionPresses = [...pressablesFor(at.lead, at.line.options, t), ...stepPressables(at.line.steps, t)]
          question = at.line.full
          const pressed = pressedOf(attentionPresses, await readQueued($))
          if (pressed !== undefined) { view = { ...view, note: pendingNote(pressed, t) }; attentionPresses = [] }
        }
      } catch { /* the workflow's line stands */ }
    }
    // Something else leads: the initialization's count stays as the dim words after it.
    if (notice !== null && attentionPresses !== null && view.note === '') view = { ...view, note: notice.text }
    // What grew, in a few words at the right: the practices learned today, a press that lists them on the flow tab
    // (their flows unfolded), and the proposals waiting.
    let proposed: Pressable | undefined
    let learned: Pressable | undefined
    try {
      const nowAt = await nowIso($)
      const openProposals = (await proposalsKept($)).filter((p) => p.status === 'open')
      const skipped = skippedSteps(await workItems($), await coachFlowsKept($), await proposalsKept($))
      const fresh = ((await practicesKept($))?.list ?? []).filter((p) => p.deleted !== true && isNew(p, nowAt, 1))
      if (fresh.length > 0) learned = { key: 'band-learned', label: t('新学到 {0} 条', fresh.length), action: { op: 'open-board', tab: 'flow', expand: [...new Set(fresh.map((p) => p.flow))] } }
      // A press opens the flow tab: a new kind of work is the card on top; a step to add, remove or skip is under its flow, unfolded.
      if (openProposals.length + skipped.length > 0) proposed = { key: 'band-proposals', label: t('{0} 条提议', openProposals.length + skipped.length), action: { op: 'open-board', tab: 'flow', expand: [...new Set([...openProposals.filter((p) => p.kind !== 'new-flow').map((p) => p.flow), ...skipped.map((x) => x.flow)])] } }
    } catch { /* nothing said of it */ }
    const options: Pressable[] = attentionPresses ?? view.actions
    const tail: Pressable[] = [
      ...(view.more.count > 0 ? [{ key: 'more', label: t('还有 {0} 件', view.more.count), action: { op: 'open-board', tab: 'items' } as BoardAction }] : []),
      ...(workflow ? [{ key: 'board', label: t('看板'), action: { op: 'open-board', tab: 'items' } as BoardAction }] : []),
    ]
    if (view.title === '' && options.length === 0 && tail.length === 0) return next(e)
    // The engine draws one band: what a plugin below drew (gemsbang's line) goes under this one, or it would not show.
    // A chain with nothing beneath that draws ends in no tree.
    const below = await next(e).catch(() => null)
    const stack = (own: JSX.Element): JSX.Element => (below === null ? own : <Box flexDirection="column" flexGrow={1}>{own}{below}</Box>)
    const columns: number = e.props.bodyColumns
    const env = await envNow($, t, e.surface).catch(() => ({ parts: [] as string[], host: null as HostInfo | null, remote: false }))
    const at = env.remote && env.host !== null ? `@${env.host.name}` : ''
    // The screenshot button, left of the board's icon: on the desktop app, Remote Control on or not.
    const platform = env.host?.platform
    const capture: Pressable | undefined = Svg !== undefined && tail.some((b) => b.key === 'board') && offersCapture({ surface: e.surface, platform })
      ? { key: 'capture', label: t('截图'), action: { op: 'capture', platform: platform ?? '' } }
      : undefined
    const reserve = [...options, ...tail].reduce((w, b) => w + (b.key === 'board' && Svg !== undefined ? 4 : cellWidth(b.label) + 5), 0) + (at !== '' ? cellWidth(at) + 1 : 0) + (capture !== undefined ? 4 : 0)
    const lead = 2 + (view.verb !== '' ? cellWidth(view.verb) + 1 : 0)
    // What grew (新学到, 提议) counts in the line's width too.
    const sides = (learned !== undefined ? cellWidth(learned.label) + 1 : 0) + (proposed !== undefined ? cellWidth(proposed.label) + 1 : 0)
    const roomAll = columns - reserve - lead - sides
    // Words that do not fit beside their options go on rows of their own, the options on a row under them: a question
    // always did, and so does a line with options (等你 and its 好了 / 没好), never squeezed to a character a row.
    const lineWords = question ?? `${view.title}${view.note !== '' ? `${SEP}${view.note}` : ''}`
    const rows = question !== undefined ? cellWidth(question) > roomAll : options.length > 0 && cellWidth(lineWords) > roomAll
    // What grew goes where it does not fit (the flow tab lists both): on the options' row, or beside the one thing
    // where that would leave it fewer than ROOM_MIN cells.
    if (rows ? reserve + sides > columns - 2 : roomAll < ROOM_MIN) { learned = undefined; proposed = undefined }
    const room = Math.max(8, columns - reserve - lead - (learned !== undefined || proposed !== undefined ? sides : 0))
    // Whole where the room holds it; otherwise the note gets at most a third of it.
    const whole = view.note !== '' ? `${SEP}${view.note}` : ''
    const fits = cellWidth(view.title) + cellWidth(whole) <= room
    const noteRoom = fits ? cellWidth(whole) : view.note !== '' ? Math.min(cellWidth(view.note) + 3, Math.floor(room / 3)) : 0
    const title = fits ? view.title : truncate(view.title, Math.max(6, room - noteRoom))
    const note = fits ? whole : view.note !== '' ? truncate(whole, noteRoom) : ''
    /** The whole of something, drawn over the line while the pointer is on what it belongs to. */
    // `whole`: wrapped rather than cut (the desktop draws a card as a bubble narrower than the line).
    const card = (text: string, anchor: { left: number } | { right: number }, width: number, whole = false) => text === '' ? null : (
      <Box position="absolute" top={0} {...anchor} width={Math.max(10, width)} display="none" hover={{ display: 'flex' }} backgroundColor="inverseText">
        <Text wrap={whole ? 'wrap' : 'truncate-end'}>{text}</Text>
      </Box>
    )
    // Where the surface draws pictures, a native button as the design has it (a hotkey there draws a number badge);
    // the terminal's rows read "1: label", a survey's way.
    const pressable = (b: Pressable, i: number) => Svg !== undefined
      ? (b.key === 'board'
        ? iconButton($, els, b, 'board', { from: 'right', size: 15 })
        : <Button key={b.key} label={b.label} {...(b.primary ? { variant: 'primary' } : {})} onPress={press($, b.action)} />)
      : <Button key={b.key} plain hotkey={String(i + 1)} label={b.label} {...(b.primary ? { variant: 'primary' } : {})} onPress={press($, b.action)} />
    const board = tail.find((b) => b.key === 'board')
    // Under the pointer the line says how it goes, the paste key for this system with it; the icon's own tip is off.
    const shot = capture !== undefined && iconButton($, els, capture, 'capture', { from: 'right', size: 15, tip: false, card: card(captureHint(platform, t), { right: 0 }, columns - 4, true), pad: { right: 0 } })
    // The screenshot and the board side by side, a cell between them (each icon's own padding kept only on the outside).
    const boardPress = board === undefined ? null
      : Svg !== undefined ? iconButton($, els, board, 'board', { from: 'right', size: 15, ...(shot !== false ? { pad: { left: 0 } } : {}) })
      : pressable(board, options.length + tail.indexOf(board))
    const icons = shot !== false && Svg !== undefined
      ? <Box key="band-icons" flexShrink={0} gap={1} alignItems="center">{shot}{boardPress}</Box>
      : boardPress
    const grew = (learned !== undefined || proposed !== undefined) && (
      <Box key="band-grew" flexShrink={0} gap={1} alignItems="center">
        {learned !== undefined && <Button key={learned.key} plain label={learned.label} onPress={press($, learned.action)}><Text {...toneProps('warning')}>{learned.label}</Text></Button>}
        {proposed !== undefined && <Button key={proposed.key} plain label={proposed.label} onPress={press($, proposed.action)}><Text {...toneProps('warning')}>{proposed.label}</Text></Button>}
      </Box>
    )
    if (rows) {
      const lines = wrapCells(question ?? `${view.verb !== '' ? `${view.verb} ` : ''}${lineWords}`, Math.max(20, columns - 4), QUESTION_ROWS)
      // The mark a column of its own; beside it, one column for the words' lines and the row of options, so every line
      // and the options start at one edge, whatever width each surface gives the mark. A step of space between the words
      // and the options, whose buttons stand taller than a line on the desktop (the terminal draws `sm` down as none).
      return stack(
        <Box gap={1} alignItems="flex-start" flexGrow={1}>
          {Svg !== undefined
            ? (
              <Box key="band-mark" flexShrink={0} alignItems="center" paddingX={1}>
                <Svg source={MARK_SVG} alt="Gemworks" width={13} height={13} />
                <Box position="absolute" top={0} left={0} right={0} bottom={0} justifyContent="center" alignItems="center">
                  <Button key="band-mark-open" plain label={HIT} onPress={press($, { op: 'open-board', tab: 'items' })} />
                </Box>
              </Box>
            )
            : <Button key="band-mark-open" plain label={t('看板')} onPress={press($, { op: 'open-board', tab: 'items' })}><Text {...toneProps(MARK.tone)}>{MARK.text}</Text></Button>}
          <Box key="band-q-body" flexDirection="column" flexGrow={1} minWidth={0} rowGap="sm">
            <Box key="band-q-words" flexDirection="column">
              {lines.map((l, n) => <Text key={`band-q-${n}`} {...(Svg !== undefined ? { color: 'suggestion' } : {})} wrap="truncate-end">{l}</Text>)}
            </Box>
            {/* What grew and the icons at the right. */}
            <Box key="band-q-actions" gap={1} alignItems="center">
              {options.map(pressable)}
              {at !== '' && <Text dimColor>{at}</Text>}
              <Box flexGrow={1} />
              {grew}
              {icons}
            </Box>
          </Box>
        </Box>
      )
    }
    return stack(
      <Box gap={1} alignItems="center" flexGrow={1}>
        {/* The mark opens the board: a blank button laid over the picture (a Button holds only words), the mark itself as the button on the terminal. */}
        {Svg !== undefined
          ? (
            <Box key="band-mark" flexShrink={0} alignItems="center" paddingX={1}>
              <Svg source={MARK_SVG} alt="Gemworks" width={13} height={13} />
              <Box position="absolute" top={0} left={0} right={0} bottom={0} justifyContent="center" alignItems="center">
                <Button key="band-mark-open" plain label={HIT} onPress={press($, { op: 'open-board', tab: 'items' })} />
              </Box>
            </Box>
          )
          : <Button key="band-mark-open" plain label={t('看板')} onPress={press($, { op: 'open-board', tab: 'items' })}><Text {...toneProps(MARK.tone)}>{MARK.text}</Text></Button>}
        {/* Only the one thing gives way: everything else keeps its width, and the one thing is cut to the room left. */}
        {view.verb !== '' && <Box key="band-verb" flexShrink={0}><Text dimColor>{view.verb}</Text></Box>}
        {Svg !== undefined
          ? (
            <Box key="band-title" flexShrink={1} minWidth={0}>
              <Box flexShrink={1} minWidth={0} overflow="hidden">
                <Text wrap="truncate-end"><Text {...(view.tone === 'normal' ? { color: 'suggestion' } : toneProps(view.tone))} underline={workflow && view.tone === 'normal'}>{title}</Text>{note !== '' && <Text dimColor>{note}</Text>}</Text>
                {workflow && (
                  <Box position="absolute" top={0} left={0} right={0} bottom={0}>
                    <Button key="title" plain label={blankOf(cellWidth(title))} onPress={press($, { op: 'open-board', tab: 'items' })} />
                  </Box>
                )}
              </Box>
              {card([view.detail !== '' ? `${view.verb !== '' ? `${view.verb} ` : ''}${view.title}${SEP}${view.detail}` : view.title, env.parts.join(SEP)].filter((x) => x !== '').join(`${SEP}`), { left: 0 }, columns - lead)}
            </Box>
          )
          : (
            <Box key="band-title">
              {workflow
                ? <Button key="title" plain label={view.title} onPress={press($, { op: 'open-board', tab: 'items' })}><Text {...toneProps(view.tone)} underline={view.tone === 'normal'}>{title}</Text></Button>
                : <Text {...toneProps(view.tone)}>{title}</Text>}
              {card([view.detail !== '' ? `${view.verb !== '' ? `${view.verb} ` : ''}${view.title}${SEP}${view.detail}` : '', env.parts.join(SEP)].filter((x) => x !== '').join(`${SEP}`), { left: 0 }, columns - lead)}
            </Box>
          )}
        {Svg === undefined && note !== '' && <Text dimColor>{note}</Text>}
        {(options.length > 0 || at !== '') && (
          <Box key="band-options" gap={1} flexShrink={0} alignItems="center">
            {options.map(pressable)}
            {at !== '' && <Text dimColor>{at}</Text>}
          </Box>
        )}
        {tail.map((b, i) => b.key === 'more'
          ? <Box key="band-more" flexShrink={0}>{pressable(b, options.length + i)}{card(view.more.detail, { right: 0 }, columns - 4)}</Box>
          : null)}
        {board !== undefined && <Box key="band-push" flexGrow={1} />}
        {grew}
        {icons}
      </Box>
    )
  })

  // The board (spec §8.2): the header, five tabs as a row of buttons over the tab atom, and rows from board.ts.
  // The matcher spells BOARD_ID's value: the engine reads matchers statically (an imported constant shows as requestId=?).
  on('ui.render', { component: 'Pane', requestId: 'gemworks-board' }, async ($, e) => {
    trace($, `draw board on ${e.surface}, tab ${String(await read($, tabAtom))}`)
    const els = elementsOf($, e)
    const { Box, Text, Button } = els
    const columns = e.props.bodyColumns
    // The tab bar needs the chosen tab and the words alone: it is drawn whatever else fails, so a press always switches.
    const [t, kept] = await Promise.all([words($).catch(() => wordsFor('zh')), read($, tabAtom).catch(() => null)])
    // A tab this version no longer has (one kept from before an update) opens the work items.
    const tab: BoardTab = (TAB_IDS as readonly string[]).includes(kept as string) ? kept as BoardTab : HOME_TAB
    const label = tabs(t).find((x) => x.id === tab)?.label ?? tab
    const failed = (part: string, why: string): BoardRow => ({ kind: 'text', text: truncate(t('gemworks：{0}画不出来（{1}）', part, why), columns), tone: 'error' })
    // The header and the tab's rows: each on its own, read at once, each within BOARD_READ_MS.
    const [head, rows] = await Promise.all([
      within($, BOARD_READ_MS, headerRows($, t)).catch(() => undefined),
      within($, BOARD_READ_MS, tabRows($, e, t, tab)).then(
        (r) => r ?? [failed(label, t('读取超时'))],
        (err: unknown) => [failed(label, reasonOf(err))],
      ),
    ])
    let header: unknown
    try {
      header = drawHeader($, els, head, t, columns)
    } catch (err) {
      header = <Text key="header-failed" color="error">{t('gemworks：{0}画不出来（{1}）', t('页头'), reasonOf(err))}</Text>
    }
    let body: unknown[]
    try {
      body = drawRows($, els, rows, columns)
    } catch (err) {
      body = [<Text key="rows-failed" color="error">{t('gemworks：{0}画不出来（{1}）', label, reasonOf(err))}</Text>]
    }
    // The desktop draws and presses a pane of some 1,500 elements and none past it (诊断's test pages: 1,476 fine, 1,676 not):
    // the body stops at BODY_NODES, and says what it left out, whatever a tab or an unfolded list would draw.
    let drawn = 0
    if (els.Svg !== undefined) {
      // One text size down from the header and the tab bar, so more of a tab fits; counted after, as drawn.
      body = body.map((x) => stepDown(x))
      const fit = fitToBudget(body)
      drawn = fit.drawn
      if (fit.left > 0) body = [...fit.kept, <Text key="rows-cut" dimColor>{t('内容太多，后面 {0} 项没画出来：收起一些，或换个页签。', fit.left)}</Text>]
    }
    trace($, `drew board on ${e.surface}: tab ${tab}, ${rows.length} rows, ${drawn} elements`)
    return (
      <Box flexDirection="column">
        {header}
        {/* Under the header's own rule nothing else is drawn when no work item's row or reason is: a second rule there doubles it. */}
        {(head === undefined || head.name !== undefined || head.reason !== undefined) && hairline(els, 'rule-head')}
        <Box gap={els.Svg !== undefined ? 3 : 2} flexWrap="wrap" alignItems="center">
          {tabs(t).map((x) => els.Svg !== undefined
            ? iconButton($, els, { key: `tab-${x.id}`, label: x.label, action: { op: 'tab', tab: x.id } }, x.id, { tone: x.id === tab ? 'active' : 'dim', from: 'left' })
            : x.id === tab
              ? <Button key={`tab-${x.id}`} plain onPress={press($, { op: 'tab', tab: x.id })}><Text bold underline>{x.label}</Text></Button>
              : <Button key={`tab-${x.id}`} plain dimColor label={x.label} onPress={press($, { op: 'tab', tab: x.id })} />)}
        </Box>
        {hairline(els, 'rule-tabs')}
        {body}
      </Box>
    )
  })

  // The dialogs (settings, upgrade, about, share): one pane, its content by the dialog atom.
  on('ui.render', { component: 'Pane', requestId: 'gemworks-dialog' }, async ($, e) => {
    const els = elementsOf($, e)
    const { Box, Text, Button } = els
    const t = await words($)
    const dialog = (await read($, dialogAtom)) as Dialog | null
    let rows: BoardRow[]
    try {
      rows = dialog === null ? [] : await dialogRows($, t, dialog, e.props.bodyColumns, e.surface)
    } catch (err) {
      rows = [{ kind: 'text', text: `gemworks：${reasonOf(err)}`, tone: 'error' }]
    }
    return (
      <Box flexDirection="column">
        {rows.map((r, i) => drawRow($, els, r, i))}
        <Box>
          <Button key="close" role="dismiss" plain dimColor label={t('关闭')} onPress={press($, { op: 'dialog', dialog: null })} />
        </Box>
        {dialog === null && <Text dimColor> </Text>}
      </Box>
    )
  })

  // /gemworks (spec §8.3). The board opens only when asked, so it is placed at any width.
  on('command.run', { command: 'gemworks' }, async ($, e) => {
    await retryStart($)
    const t = await words($)
    const intent = parseCommand(e.args)
    if (intent.kind === 'board') {
      const failure = await loadBoard($)
      if (failure !== null) return { text: boardText(undefined, failure, t) }
      const opened = await openBoard($, intent.tab, false)
      return { text: boardText(opened.isPlaced ? undefined : opened.reason, undefined, t) }
    }
    // The diagnosis: a setting the dialog no longer shows, switched by name.
    if (intent.kind === 'trace') {
      await act($, { op: 'setting', key: 'trace.enabled', value: intent.on })
      return { text: traceText(intent.on, t) }
    }
    const op: BridgeOp | undefined = intent.kind === 'status' ? { op: 'status' }
      : intent.kind === 'pause' ? { op: 'pause' }
      : intent.kind === 'resume' ? { op: 'resume' }
      : intent.kind === 'use' ? { op: 'use', workflow: intent.workflow }
      : intent.kind === 'add' ? { op: 'add', ...(intent.workflow !== undefined ? { workflow: intent.workflow } : {}) }
      : undefined
    const res = op === undefined ? undefined : await bridge($, op, intent.kind === 'status' ? BRIDGE_TIMEOUT_MS : SLOW_TIMEOUT_MS)
    // Another workflow (use, or add's first one), or a hold: another board.
    if (res !== undefined && res.ok && (intent.kind === 'use' || intent.kind === 'pause' || intent.kind === 'resume' || (intent.kind === 'add' && res.added?.activated === true))) await reloadBoardLater($)
    return { text: commandText(intent, res, await read($, problemAtom), t) }
  }).catch(() => ({ text: 'gemworks：命令没有完成，原因见输入框上方的状态带' }))
}

// What act.tsx, split from this module, uses of it.
export {
  QUEUED_MATCH_MS, STORE_SETTINGS, TURNS_SHOWN, answerOf, appendOwn, attentionOnPrompt, bridge, checkLatest,
  coachFlows, coachFlowsKept, correctionsKept, dismissedOf, exportText, gemlDir, loadBoard, loadCorrections,
  loadGrowth, loadMade, loadMemory, loadPractices, loadProjectSessions, loadWorkflows, nowIso, openBoard,
  openDialog, openFile, otherSessionText, practicesKept, proposalsKept, readAttention, readBoard, readPrompts,
  readSettings, reasonOf, rulesKept, saveProposals, saveRules, sessionText, setQueued, share, startBridge,
  storePrompts, takeOption, themeLedger, trace, turnBusy, words, workItems, writeOwnFlow,
}
