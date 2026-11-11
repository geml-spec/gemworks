// The flow tab's manual drawn as its design has it (.geml/design/gemworks-flow-grows/2-流程页.png): who judges a step
// as a chip, each step a block with a bar down its left edge (the one an item stands at shaded, in the accent), its
// practices inside it with 改成规定, × and ⋯ beside their words, a flow's heading as a heading. Split from register.tsx,
// the plugin module, which draws every other row and calls these: each file the plugin ships stays under the 256 KiB
// Anthropic's plugin directory reads whole.
import type { EngineInterface } from 'claude-code'
import type { BoardRow } from '../dist/hosts/claude-code/board.js'
import type { Judge } from '../dist/core/progress.js'
import { toneProps } from '../dist/hosts/claude-code/band.js'
import type { Tone } from '../dist/hosts/claude-code/band.js'
import { press } from './register.tsx'

type Els = { Box: any; Text: any; Button: any; Svg?: any }
type Row<K extends BoardRow['kind']> = Extract<BoardRow, { kind: K }>

const SELECTED = '#2a6fdb24'
const SHADE = '#8a89861a'
/** A step's bar: three pixels wide and taller than any block, cut to its block by the box it stands in. */
const bar = (color: string, opacity: number, dash = ''): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="3" height="2000" viewBox="0 0 3 2000" preserveAspectRatio="none"><line x1="1.5" y1="0" x2="1.5" y2="2000" stroke="${color}" stroke-opacity="${opacity}" stroke-width="3"${dash !== '' ? ` stroke-dasharray="${dash}"` : ''}/></svg>`
const BAR = bar('#8a8986', 0.35)
const BAR_HERE = bar('#2a6fdb', 1)
const BAR_END = bar('#8a8986', 0.35, '6 5')
const CHIP: Record<Judge, { color: string; backgroundColor: string }> = {
  fact: { color: 'success', backgroundColor: '#3a9a4a24' },
  you: { color: '#2a6fdb', backgroundColor: SELECTED },
  model: { color: '#8a8986', backgroundColor: SHADE },
}
const TERMINAL: Record<Judge, Tone> = { fact: 'success', you: 'warning', model: 'dim' }

/** Who judges a step: a tinted chip where the surface draws pictures, the word in its colour on the terminal. */
function judgeChip(els: Els, kind: Judge, word: string, key: string): unknown {
  const { Text, Svg } = els
  return Svg !== undefined ? <Text key={key} {...CHIP[kind]}>{` ${word} `}</Text> : <Text key={key} {...toneProps(TERMINAL[kind])}>{word}</Text>
}

/** 谁判： then each judge's chip and what it means. */
export function drawJudges(els: Els, row: Row<'judges'>, i: number): unknown {
  const { Box, Text } = els
  return (
    <Box key={`judges-${i}`} gap={1} flexWrap="wrap">
      <Text dimColor>{row.lead}</Text>
      {row.items.flatMap((x) => [judgeChip(els, x.judge, x.word, `judge-${x.judge}`), <Text key={`means-${x.judge}`} dimColor>{x.means}</Text>])}
    </Box>
  )
}

/** Words, then the presses after them on one line: 没有在走的：优化 ▸. */
export function drawPresses($: EngineInterface, els: Els, row: Row<'presses'>): unknown {
  const { Box, Text, Button } = els
  return (
    <Box key={row.key} gap={1} flexWrap="wrap">
      <Text dimColor>{row.lead}</Text>
      {row.items.map((b) => <Button key={b.key} plain dimColor label={b.label} onPress={press($, b.action)} />)}
    </Box>
  )
}

/** A flow's heading: its name and how it stands in one run of words, wrapped; its presses (⋯) at the end of the line. */
export function drawHeading($: EngineInterface, els: Els, row: Row<'section'>, i: number): unknown {
  const { Box, Text, Button } = els
  return (
    <Box key={row.key} gap={1} marginTop={i > 0 ? 1 : 0} alignItems="center">
      <Box flexGrow={1} flexShrink={1} minWidth={0}>
        <Text wrap="wrap"><Text weight="semibold" size="body">{row.text}</Text>{row.note !== undefined && row.note !== '' && <Text dimColor>{`  ${row.note}`}</Text>}</Text>
      </Box>
      {(row.actions ?? []).map((b) => <Button key={b.key} label={b.label} onPress={press($, b.action)} />)}
    </Box>
  )
}

/** A practice: its tag, what to do and (dim) where it came from in one run of words, wrapped; its presses right after them. */
export function drawPractice($: EngineInterface, els: Els, row: Row<'practice'>, pad: number): unknown {
  const { Box, Text, Button } = els
  return (
    <Box key={row.key} gap={1} paddingX={pad} alignItems="center">
      <Box flexShrink={1} minWidth={0}>
        <Text wrap="wrap">
          <Text {...toneProps(row.fresh ? 'warning' : 'dim')}>{`${row.tag}：`}</Text>
          {row.text}
          {row.why !== '' && <Text dimColor>{` — ${row.why}`}</Text>}
        </Text>
      </Box>
      {row.count !== undefined && <Box flexShrink={0}><Text {...toneProps(row.count.held ? 'success' : 'warning')}>{row.count.text}</Text></Box>}
      {row.actions.map((b) => <Button key={b.key} label={b.label} onPress={press($, b.action)} />)}
    </Box>
  )
}

/**
 * Practices that stand under no step (所有时候的做法) as a block of their own, drawn as a step's practices are: a bar
 * down its left edge where the surface draws pictures, the same inset, each practice and its menu inside.
 */
export function drawPracticeBlock($: EngineInterface, els: Els, key: string, inner: readonly BoardRow[], draw: (r: BoardRow, n: number) => unknown): unknown {
  const { Box, Svg } = els
  const pictures = Svg !== undefined
  return (
    <Box key={`${key}-block`} flexDirection="column" paddingLeft={pictures ? 2 : 1} paddingRight={1} {...(pictures ? { marginTop: 'xs', paddingY: 'xs' } : {})}>
      {pictures && (
        <Box key={`${key}-bar`} position="absolute" top={0} bottom={0} left={0} overflow="hidden">
          <Svg source={BAR} alt="│" width={3} height={2000} />
        </Box>
      )}
      {inner.map((x, n) => (x.kind === 'practice' ? drawPractice($, els, x, 0) : draw(x, n)))}
    </Box>
  )
}

/**
 * A step as a block: its title, the requirement to leave it and who judges it, what it prevents, the rules on it, then
 * its own rows (its practices, a practice's menu) and the press that lists its practices on a flow folded. Where the
 * surface draws pictures, a bar down its left edge (dashed on the last step) in a box laid over the block's height,
 * which cuts the bar to it; the step an item stands at is shaded, its bar in the accent.
 */
export function drawStep($: EngineInterface, els: Els, row: Row<'step'>, inner: readonly BoardRow[], draw: (r: BoardRow, n: number) => unknown): unknown {
  const { Box, Text, Button, Svg } = els
  const pictures = Svg !== undefined
  return (
    <Box key={row.key} flexDirection="column" paddingLeft={pictures ? 2 : 1} paddingRight={1} {...(pictures ? { marginTop: 'xs', paddingY: 'xs' } : {})} {...(row.here && pictures ? { backgroundColor: SELECTED } : {})}>
      {pictures && (
        <Box key={`${row.key}-bar`} position="absolute" top={0} bottom={0} left={0} overflow="hidden">
          <Svg source={row.here ? BAR_HERE : row.final ? BAR_END : BAR} alt="│" width={3} height={2000} />
        </Box>
      )}
      <Box gap={1}>
        <Text {...(row.final ? { dimColor: true } : row.here ? { bold: true } : {})}>{row.here && !pictures ? `▸${row.title}` : row.title}</Text>
        {row.need !== '' && <Box flexShrink={1} minWidth={0}><Text dimColor wrap="truncate-end">{`· ${row.need}`}</Text></Box>}
        <Box flexGrow={1} />
        {row.judge !== '' && judgeChip(els, row.judgeKind, row.judge, `${row.key}-judge`)}
      </Box>
      {row.prevents !== '' && <Text dimColor wrap="wrap">{row.prevents}</Text>}
      {(row.rules ?? []).map((r, n) => <Text key={`rule${n}`} {...toneProps('warning')} wrap="truncate-end">{`🔒 ${r}`}</Text>)}
      {inner.map((x, n) => (x.kind === 'practice' ? drawPractice($, els, x, 0) : draw(x, n)))}
      {row.more !== undefined && <Box><Button key={row.more.key} plain dimColor label={row.more.label} onPress={press($, row.more.action)} /></Box>}
    </Box>
  )
}
