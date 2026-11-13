// Outward actions — a push, a pull request or a release, a package published, a deployment, a message sent — asked
// about before they run, unless the project's dictionary lets them through (core/outward.ts). Split from register.tsx,
// the plugin module, which calls outwardHold on every tool call: each file the plugin ships stays under the 256 KiB
// Anthropic's plugin directory reads whole.
import type { EngineInterface } from 'claude-code'
import { atom, read, update } from 'claude-code'
import { allowedOutward, outwardAnswer, outwardOf, outwardQuestion } from '../dist/core/outward.js'
import { bridge, within, words } from './register.tsx'

/** The project dictionary's keys that let a call through in every state, as last read; null until read. */
const outwardAtom = atom({ plugin: 'gemworks', key: 'outward' } as const, null as string[] | null)

/** The tools whose `command` is a command line. */
const SHELLS: readonly string[] = ['Bash', 'PowerShell', 'Monitor']

/** How long a first read of the keys may take before the call goes through unasked. */
const READ_MS = 2000

/**
 * The keys let through, read through the CLI (the dictionary is GEML, which only the CLI reads), after `change` is
 * written in; kept for the next call and the tools tab. Null when the CLI did not answer.
 */
export async function loadOutward($: EngineInterface, change: { allow?: string[]; forget?: string[] } = {}): Promise<string[] | null> {
  const res = await bridge($, { op: 'outward', ...change })
  if (res === undefined || !res.ok || res.outward === undefined) return null
  const list = res.outward
  await update($, outwardAtom, () => list)
  return list
}

/** The keys let through, as last read: none until they are. */
export async function outwardKept($: EngineInterface): Promise<string[]> {
  return (await read($, outwardAtom)) ?? []
}

/**
 * Whether the session draws anywhere a question can be put: `surfaces()` is empty in a `-p` run; an engine from before
 * it says the same with `surface()`, null where nothing draws; one with neither is taken to have someone there. Not
 * session.start's isInteractive, which is false for the desktop app's sessions too.
 */
async function someoneToAsk($: EngineInterface): Promise<boolean> {
  try { return (await $.session.surfaces()).length > 0 } catch { /* an engine from before surfaces() */ }
  try { return (await $.session.surface()) !== null } catch { return true }
}

/**
 * Why a call with outward actions is held, or undefined to let it run. One the dictionary lets through runs unasked;
 * the rest are put to the person in the engine's own question, once for the call. No one to ask (a `-p` run: the
 * session draws on no surface), keys that cannot be read in time, or anything else gemworks cannot settle lets the
 * call through; a question put away, or words typed instead of an answer, hold it.
 */
export async function outwardHold($: EngineInterface, tool: string, input: Record<string, unknown>): Promise<string | undefined> {
  let found
  try {
    found = outwardOf(tool, input, SHELLS)
    if (found.length === 0) return undefined
    const allowed = (await read($, outwardAtom)) ?? (await within($, READ_MS, loadOutward($)))
    if (allowed === null || allowed === undefined) return undefined
    found = found.filter((o) => !allowedOutward(allowed, o))
    if (found.length === 0 || !(await someoneToAsk($))) return undefined
  } catch {
    return undefined
  }
  const t = await words($)
  const shown = typeof input['command'] === 'string' ? input['command'] : tool.split('__').slice(1).join(' · ')
  const q = outwardQuestion(found, shown, t)
  let answer: string | undefined
  try {
    answer = await $.ui.ask(q.question, { options: q.options, header: q.header })
  } catch {
    answer = undefined
  }
  const a = outwardAnswer(answer, found, t)
  if (a.kind === 'pass') return undefined
  if (a.kind === 'allow') {
    try { await loadOutward($, { allow: a.keys }) } catch { /* asked again the next time */ }
    return undefined
  }
  return a.reason
}
