// What a turn made, among its work item's artifacts: the files it wrote that git does not keep, the online documents it
// wrote (a Lark doc, a Google sheet — core/online-docs.ts), the pages the Artifact tool published, what the person gave
// with a prompt, and what the model records with the artifact tool. Split from register.tsx, the plugin module, which
// calls these from its hooks: each file the plugin ships stays under the 256 KiB Anthropic's plugin directory reads whole.
import type { EngineInterface, ToolCallResult } from 'claude-code'
import { atom, read, update } from 'claude-code'
import type { GemworksJson } from './state'
import { publishedLink } from '../dist/core/artifact-tool.js'
import { mayWriteOnlineDoc, onlineDocWrites } from '../dist/core/online-docs.js'
import { BOARD_ID } from '../dist/shell/board.js'
import { SLOW_TIMEOUT_MS } from '../dist/shell/protocol.js'
import { toolArgs } from '../dist/shell/readers.js'
import { artifactItem, bridge, reloadBoardLater } from './register.tsx'

// The same atoms register.tsx declares: one plugin and key, one value.
const madeElsewhereAtom = atom({ plugin: 'gemworks', key: 'madeElsewhere' } as const, [] as string[])
const madeOnlineAtom = atom({ plugin: 'gemworks', key: 'madeOnline' } as const, [] as { url: string; name?: string }[])
const madeHereAtom = atom({ plugin: 'gemworks', key: 'madeHere' } as const, [] as string[])
const notMadeAtom = atom({ plugin: 'gemworks', key: 'notMade' } as const, [] as string[])

/** A turn's end, on a work item: the files it wrote that git does not keep get a version where their content changed, and each online document it wrote its next one. */
export async function artifactsOnTurn($: EngineInterface): Promise<void> {
  const [on, made, drafts, here, docs] = await Promise.all([artifactItem($), read($, madeElsewhereAtom), read($, notMadeAtom), read($, madeHereAtom), read($, madeOnlineAtom)])
  const elsewhere = ((made as unknown) as string[] | null) ?? []
  const notMade = ((drafts as unknown) as string[] | null) ?? []
  const written = ((here as unknown) as string[] | null) ?? []
  const online = docs ?? []
  if (elsewhere.length > 0) await update($, madeElsewhereAtom, () => [] as unknown as GemworksJson)
  if (notMade.length > 0) await update($, notMadeAtom, () => [] as string[])
  if (written.length > 0) await update($, madeHereAtom, () => [] as string[])
  if (online.length > 0) await update($, madeOnlineAtom, () => [])
  // A turn on no work item made nothing that is one's.
  if (on === undefined) return
  // The workflow item's journal names what it wrote; with the coach's item, the turn's own list does.
  const own = on.item !== undefined && written.length > 0 ? { written } : {}
  await bridge($, { op: 'artifacts', ...on, ...own, ...(elsewhere.length > 0 ? { elsewhere } : {}), ...(notMade.length > 0 ? { notMade } : {}) }, SLOW_TIMEOUT_MS).catch(() => undefined)
  for (const d of online) await bridge($, { op: 'artifact', ...on, kind: 'link', where: d.url, online: true, ...(d.name !== undefined ? { name: d.name } : {}) }).catch(() => undefined)
  // What the turn recorded shows on an open board now: nothing else reads the board again while the stage stays put.
  try { if ((await $.ui.panes()).some((p) => p.id === BOARD_ID)) await reloadBoardLater($) } catch { /* read when next opened */ }
}

/** A call that may have written an online document: the ones it wrote, kept for the turn's end — once each, by address, named as last named. */
export function noteOnlineDocs($: EngineInterface, tool: string, input: Record<string, unknown>, result: string): void {
  if (!mayWriteOnlineDoc(tool, input)) return
  const docs = onlineDocWrites(tool, input, result)
  if (docs.length === 0) return
  $.clock.after(0, () => {
    void update($, madeOnlineAtom, (was) => {
      const out = (was ?? []).map((d) => ({ ...d }))
      for (const d of docs) {
        const same = out.find((x) => x.url === d.url)
        if (same === undefined) out.push(d.name !== undefined ? { url: d.url, name: d.name } : { url: d.url })
        else if (d.name !== undefined) same.name = d.name
      }
      return out
    }).catch(() => undefined)
  })
}

/** What the person gave with a prompt (images, documents): their bytes, as the conversation holds them, among the work item's artifacts. */
export async function uploadsOnPrompt($: EngineInterface, named: readonly { type: string; mediaType?: string; filename?: string }[]): Promise<void> {
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

/** What the model says the work item made that gemworks did not see: a link, a picture, a file — under the current work item's artifacts. */
export async function recordArtifact($: EngineInterface, event: unknown): Promise<ToolCallResult> {
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
export async function publishedArtifact($: EngineInterface, said: string | undefined, input: Record<string, unknown>): Promise<void> {
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
