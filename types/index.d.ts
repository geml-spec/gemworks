// The values Gemworks's hooks module keeps in $.state. What the bridge answers
// is kept as JSON; the module reads it as the protocol's types
// (src/hosts/claude-code/protocol.ts) and the board's (actions.ts, inbox.ts,
// sessions.ts, settings.ts).
export type GemworksJson = null | boolean | number | string | readonly GemworksJson[] | { readonly [key: string]: GemworksJson }
export type GemworksTab = 'sessions' | 'flow' | 'items' | 'made' | 'journal' | 'tools'

declare module 'claude-code' {
  interface PluginState {
    gemworks: {
      shell: GemworksJson
      board: GemworksJson
      problem: string | null
      node: string | null
      root: string | null
      delivered: string | null
      /** Whether this conversation was told about the other sessions and the ask tool through a prompt's context (again after a /clear or a compaction). */
      told: boolean
      /** Whether prompt.compose ran this session: the system prompt carries those instructions itself. */
      composed: boolean
      /** Whether a plugin above gemworks keeps prompt.compose from it (probed once a session; null until known). */
      composeCut: boolean | null
      /** The initialization (the host's transcripts read into the shared record): its count while it runs, its outcome until the next prompt. */
      init: { state: "running" | "done"; done: number; total: number; failed: number } | null
      /** Whether the sessions tab lists every other session, or folds the rest after the first few. */
      sessionsAll: boolean
      /** Whether the sessions tab lists every decision, or folds the rest after the first twenty. */
      decisionsShown: number
      /** This session's turns checked on the sessions tab, by prompt id. */
      picked: string[]
      /** Whether the sessions tab is picking turns to split or delete (整理). */
      tidying: boolean
      /** The project's Claude Code memory, as the bridge last read it; null until read. */
      memory: { dir: string; entries: { file: string; title: string; hook: string; type: string; at: string }[] } | null
      /** The memory group unfolded on the sessions tab, by type ('' is 其他). */
      memoryGroup: string | null
      /** The memory whose card is open, by its file. */
      memoryMenu: string | null
      /** The memory whose hook is being edited, by its file. */
      memoryEdit: string | null
      /** Whether the unfolded group lists every memory, or the newest ten. */
      memoryShown: number
      /** How many of this session's turns the sessions tab draws, the newest first; a press adds thirty more. */
      turnsShown: number
      lastFile: string | null
      tab: GemworksTab
      /** Whether the work items tab lists the finished work items. */
      doneOpen: boolean
      /** Whether the work items tab lists the dropped work items, or only counts them. */
      droppedOpen: boolean
      /** Whether 此刻 lists the branches and pull requests held back (已暂缓), or only counts them. */
      heldOpen: boolean
      /** The artifact whose menu is open on the work items tab (`<kind>:<name>`). */
      artifactMenu: string | null
      /** Whether the work items tab lists every document the work item changed, or the newest two. */
      docsOpen: boolean
      /** Every artifact the project's work made (the bridge's made answer): the 产物 tab, and each work item's 产物 n. */
      madeAll: GemworksJson
      /** The 产物 tab: the kind it is narrowed to, how many it lists, and the one work item it shows alone (null: every one). */
      madeView: { kind: string; shown: number; item: string | null }
      /** Files made for a person written outside the project this turn (absolute paths): artifacts at the turn's end. */
      madeElsewhere: string[]
      /** Project paths made for a person written this turn: versioned at the turn's end when no workflow journal names them. */
      madeHere: string[]
      /** The questions the model registered with the ask tool this turn: the band's at the turn's end. */
      asked: { question: string; options: string[]; recommended?: string; item?: string; at?: string }[]
      /** The questions the person's last prompt left open: the next reply's band asks them again, after its own. */
      leftAsks: { question: string; options: string[]; recommended?: string; item?: string; at?: string }[]
      /** The questions answered since the last reply: a reply that registers one again, not having seen the answer, does not ask it again. */
      answered: string[]
      /** Files handed to git commit as its message this turn: not artifacts, taken out again at the turn's end. */
      notMade: string[]
      /** The state the flow tab shows below its picture (its id). */
      flowState: string | null
      /** Whether the flow tab lists the workflows to switch to. */
      flowSwitch: boolean
      /** The tools tab's search, open menu, new-use field and listed groups (string[]). */
      toolQuery: string
      toolMenu: string | null
      toolNaming: string | null
      toolsOpen: GemworksJson
      /** How often each tool ran, by day (UsageBook): the stored book, and what this session added since it was stored. */
      usageBook: GemworksJson
      usagePending: GemworksJson
      /** The suggestions put away (string[]). */
      dismissed: GemworksJson
      /** The last turn's judgement (Judgement), or null. */
      judged: GemworksJson
      todo: GemworksJson
      boardProblem: string | null
      setup: string | null
      startedAt: number | null
      /** Rows a person let through for this session when asked about their use's preferred tool (string[]). */
      preferPassed: GemworksJson
      /** Keys a person let through once (string[]). */
      passes: GemworksJson
      /** The prompts the person sent this session (PromptRecord[]). */
      prompts: GemworksJson
      /** The sessions this one carries on, newest first: the app started it from them (a rewind, a fork). Their work items are its own. */
      sessionLine: string[]
      /** The flow the sessions tab shows (its title), and the runs of another flow's turns unfolded (string[]). */
      sessionFlow: string | null
      sessionRuns: GemworksJson
      filter: string
      expanded: string | null
      /** The journal entry whose evidence shows (its row key). */
      evidence: string | null
      dialog: string | null
      /** The settings as stored (Settings). */
      settings: GemworksJson
      /** The newest published version ({ version } or { error }), once asked. */
      latest: GemworksJson
      /** Reasons notified recently (reason → ISO). */
      notified: GemworksJson
      /** The inbox keys already notified (string[]). */
      seenInbox: GemworksJson
      locale: string | null
      /** The bundled and installed workflows ({ bundled, installed }), once asked. */
      workflows: GemworksJson
      /** The share dialog's choice ({ what, how, strip }). */
      share: GemworksJson
      version: string | null
      /** The band's attention (attention.ts): the last reply ({ reply, replyAt, asked, memory, consumed }). */
      attention: GemworksJson
      /** The repository's facts for the band ({ ahead, prs }), as the bridge last read them. */
      facts: GemworksJson
      /** The facts as they stood when the last reply ended: what changed since is news for the model. */
      factsAtReply: GemworksJson
      /** A command changed the plugin's own folder since it was loaded: a reload shows it. */
      reload: boolean
      /** The engine said a reload cannot run here (a remote connection): the band names it with no button. */
      reloadUnavailable: boolean
      /** The machine and checkout the session runs on ({ name, platform, user, branch }), as the bridge read them. */
      host: GemworksJson
      /** The clients attached to the session (session.attach): [{ clientId, surface }]. */
      clients: GemworksJson
      /** Where the last prompt came from: composer (the session's own prompt box), bridge (Remote Control), sdk. */
      origin: string | null
      /** The steps the person pressed that went into the session, queued or being done ([{ text, entered }]). */
      queued: GemworksJson
      /** The directory of the project's shared session logs (the main working tree's .geml/sessions/), as the bridge said. */
      sessionsDir: string | null
      /** The project's sessions as their logs hold them (SessionSummary[], answers left out). */
      projectSessions: GemworksJson
      /** The other session unfolded on the session tab (its id). */
      openSession: string | null
      /** The time of the newest other session's decision already put beside a prompt. */
      decisionsSeen: string | null
      /** A command in this turn made a commit: the turn's end records the commits. */
      committed: boolean
      /** The turn unfolded on the session tab: { id, answer } — answer null while the record is read, "" when it holds none. */
      expandedTurn: GemworksJson
      /** The file the last export wrote. */
      exported: string | null
      /** On the sessions tab: the session the last export was of (`own` or its id), where its file is linked. */
      exportedFor: string | null
      /** The share dialog's text, shown where it cannot be copied (the desktop). */
      sharedText: string | null
      /** The coach's light flows (coach.ts CoachFlow[]), read once: the project's own, else the bundled ones. */
      coachFlows: GemworksJson
      /** The work item whose arrow was pressed: { flow, id }, its flow first on the flow tab. */
      coachFocus: GemworksJson
      /** The work items tab's groups listed whole (coach.ts WorkGroup). */
      workOpen: string[]
      /** Every layer's practices (core/practices.ts) and whether the project's memory was moved in; null until read. */
      practices: GemworksJson
      /** The person's ledger of corrections as the flow tab shows it (protocol.ts CorrectionsView); null until read. */
      corrections: GemworksJson
      /** Whether this session was asked to move the project's memory onto the steps. */
      memoryAsked: boolean
      /** The flows of the flow tab whose practices are listed (`*` those for every flow); null: the first flow's. */
      manualExpanded: string[] | null
      /** The work item unfolded under its row on the work items tab (its history). */
      workUnfolded: string | null
      /** The 好，做吧 the person pressed, on their way until their own turn ends. */
      goneOn: GemworksJson
      /** The work item the person's own turn took up (coach.ts Doing), as it stood then; null when no such turn runs. */
      doing: GemworksJson
      /** The proposals to change the flows (growth.ts), and the rules: null until read. */
      proposals: GemworksJson
      rules: GemworksJson
      /** The practice whose 改成规定 was pressed: the one practice the rule tool may write a rule for. */
      pendingRule: string | null
    }
  }
}
