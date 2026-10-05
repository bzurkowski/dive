import type { CodeNote, FileData } from '../types.ts'

export interface Row {
  type: 'ctx' | 'add' | 'del'
  old?: number
  new?: number
  text: string
}

export function parse(file: FileData): Row[] {
  const lines = file.text.split('\n')
  if (lines.at(-1) === '') lines.pop()
  if (!file.diff) return lines.map((text, i) => ({ type: 'ctx', new: i + 1, text }))
  let o = 1
  let n = 1
  return lines.map((line): Row => {
    const text = line.slice(1)
    if (line[0] === '+') return { type: 'add', new: n++, text }
    if (line[0] === '-') return { type: 'del', old: o++, text }
    return { type: 'ctx', old: o++, new: n++, text }
  })
}

export const sideText = (rows: Row[], side: 'old' | 'new') =>
  rows
    .filter((r) => r[side] !== undefined)
    .map((r) => r.text)
    .join('\n')

export function noteSpan(rows: Row[], note: Pick<CodeNote, 'lines' | 'side'>): [number, number] | null {
  const [a, b] = note.lines
  const side = note.side ?? 'new'
  const covered = (r: Row) => {
    const v = r[side]
    return v !== undefined && v >= a && v <= b
  }
  const first = rows.findIndex(covered)
  return first < 0 ? null : [first, rows.findLastIndex(covered)]
}

type Item = { kind: 'row'; i: number } | { kind: 'gap'; start: number; end: number } // end exclusive

const CONTEXT = 8
const MIN_GAP = 4

// `open` holds the start rows of the gaps the reader expanded.
export function layout(rows: Row[], spans: ([number, number] | null)[], open: Set<number>): Item[] {
  const near = rows.map(() => false)
  const keep = (a: number, b: number) => near.fill(true, Math.max(0, a - CONTEXT), b + CONTEXT + 1)
  rows.forEach((r, i) => r.type !== 'ctx' && keep(i, i))
  for (const s of spans) if (s) keep(s[0], s[1])
  if (!near.includes(true)) return rows.map((_, i) => ({ kind: 'row', i }))

  const items: Item[] = []
  let i = 0
  while (i < rows.length) {
    const start = i
    while (i < rows.length && !near[i]) i++
    if (i - start >= MIN_GAP && !open.has(start)) items.push({ kind: 'gap', start, end: i })
    else for (let k = start; k < i; k++) items.push({ kind: 'row', i: k })
    if (i < rows.length) items.push({ kind: 'row', i: i++ })
  }
  return items
}
