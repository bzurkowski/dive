// Run: node app/src/code/rows.test.ts
import { layout, noteSpan, parse } from './rows.ts'

function eq(actual: unknown, expected: unknown, what: string) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a !== e) throw new Error(`${what}: got ${a}, want ${e}`)
}

const diff = [' a', '-b', '+B', '+C', ' d', ...Array.from({ length: 20 }, (_, i) => ` x${i}`)].join('\n')
const p = parse({ lang: 'ts', diff: true, text: diff + '\n' })
eq(p.rows.length, 25, 'rows')
eq([p.rows[1].old, p.rows[2].new, p.rows[4].old, p.rows[4].new], [2, 2, 3, 4], 'line numbers')
eq([p.adds, p.dels], [2, 1], 'counts')
eq(p.oldText.split('\n').slice(0, 3), ['a', 'b', 'd'], 'old side')
eq(p.newText.split('\n').slice(0, 4), ['a', 'B', 'C', 'd'], 'new side')

eq(noteSpan(p.rows, { lines: [1, 3], text: '' }), [0, 3], 'new span includes inner del row')
eq(noteSpan(p.rows, { lines: [2, 2], side: 'old', text: '' }), [1, 1], 'old span')
eq(noteSpan(p.rows, { lines: [90, 91], text: '' }), null, 'missing span')

const items = layout(p.rows, [], new Set())
eq(items.at(-1), { kind: 'gap', start: 12, end: 25 }, 'collapses far context')
eq(layout(p.rows, [], new Set([12])).length, 25, 'expanded gap')

const hunked = parse({ lang: 'ts', diff: true, text: '@@ -10,2 +12,2 @@\n x\n-y\n+z' })
eq([hunked.rows[1].old, hunked.rows[1].new, hunked.rows[3].new], [10, 12, 13], 'hunk header numbers')

// A blank context line that lost its space is '', a stray line keeps its first char.
const odd = parse({ lang: 'ts', diff: true, text: ' a\r\n\r\nstray\r\n+b\r\n\\ No newline at end of file\r\n' })
eq(
  odd.rows.map((r) => [r.type, r.text, r.old, r.new]),
  [
    ['ctx', 'a', 1, 1],
    ['ctx', '', 2, 2],
    ['ctx', 'stray', 3, 3],
    ['add', 'b', null, 4],
  ],
  'odd diff lines',
)

const plain = parse({ lang: 'py', diff: false, text: 'a\nb\n' })
eq(layout(plain.rows, [], new Set()).length, 2, 'plain file without notes shows all')
console.log('rows ok')
