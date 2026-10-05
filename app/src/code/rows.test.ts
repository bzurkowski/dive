import { deepStrictEqual as eq } from 'node:assert/strict'
import { layout, noteSpan, parse, sideText } from './rows.ts'

const diff = [' a', '-b', '+B', '+C', ' d', ...Array.from({ length: 20 }, (_, i) => ` x${i}`)].join('\n')
const p = parse({ lang: 'ts', diff: true, text: diff + '\n' })
eq(p.length, 25, 'rows')
eq([p[1].old, p[2].new, p[4].old, p[4].new], [2, 2, 3, 4], 'line numbers')
eq(sideText(p, 'old').split('\n').slice(0, 3), ['a', 'b', 'd'], 'old side')
eq(sideText(p, 'new').split('\n').slice(0, 4), ['a', 'B', 'C', 'd'], 'new side')

eq(noteSpan(p, { lines: [1, 3] }), [0, 3], 'new span includes inner del row')
eq(noteSpan(p, { lines: [2, 2], side: 'old' }), [1, 1], 'old span')
eq(noteSpan(p, { lines: [2, 3], side: 'old' }), [1, 4], 'old span includes inner add rows')
eq(noteSpan(p, { lines: [90, 91] }), null, 'missing span')

const items = layout(p, [], new Set())
eq(items.at(-1), { kind: 'gap', start: 12, end: 25 }, 'collapses far context')
eq(layout(p, [], new Set([12])).length, 25, 'expanded gap')

const plain = parse({ lang: 'py', diff: false, text: 'a\nb\n' })
eq(layout(plain, [], new Set()).length, 2, 'plain file without notes shows all')
eq(layout(parse({ lang: 'py', diff: false, text: '' }), [], new Set()), [], 'empty file')

const long = parse({ lang: 'py', diff: false, text: Array.from({ length: 30 }, (_, i) => `l${i}`).join('\n') })
const spanned = layout(long, [null, [10, 10]], new Set())
eq(
  [spanned.length, spanned[0], spanned.at(-1)],
  [20, { kind: 'row', i: 0 }, { kind: 'gap', start: 19, end: 30 }],
  'note span keeps its context, a run of 2 far rows stays visible',
)
