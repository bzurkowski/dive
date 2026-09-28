import type { CodeNote, FileData } from '../types'

export interface Row {
  type: 'ctx' | 'add' | 'del' | 'hunk'
  old?: number // line number, old side
  new?: number // line number, new side
  text: string
  o?: number // index into oldText lines (for tokens)
  n?: number // index into newText lines (for tokens)
}

export interface Parsed {
  rows: Row[]
  oldText: string // old side, rebuilt from the diff
  newText: string // new side, or the whole file
  adds: number
  dels: number
}

// Diff text is a full-context body; `@@` headers are tolerated.
export function parse(file: FileData): Parsed {
  const lines = file.text.split(/\r?\n/)
  if (lines.at(-1) === '') lines.pop()
  if (!file.diff) {
    const rows = lines.map((text, i): Row => ({ type: 'ctx', old: i + 1, new: i + 1, text, n: i }))
    return { rows, oldText: '', newText: lines.join('\n'), adds: 0, dels: 0 }
  }
  const rows: Row[] = []
  const oldL: string[] = []
  const newL: string[] = []
  let o = 1
  let n = 1
  let adds = 0
  let dels = 0
  for (const line of lines) {
    const hunk = /^@@ -(\d+)(?:,\d+)? \+(\d+)/.exec(line)
    if (hunk) {
      o = +hunk[1]
      n = +hunk[2]
      rows.push({ type: 'hunk', text: line })
      continue
    }
    const mark = line[0]
    if (mark === '\\') continue // "\ No newline at end of file"
    const text = /^[-+ ]/.test(line) ? line.slice(1) : line // unprefixed lines are context
    if (mark === '+') {
      rows.push({ type: 'add', new: n++, text, n: newL.length })
      newL.push(text)
      adds++
    } else if (mark === '-') {
      rows.push({ type: 'del', old: o++, text, o: oldL.length })
      oldL.push(text)
      dels++
    } else {
      rows.push({ type: 'ctx', old: o++, new: n++, text, o: oldL.length, n: newL.length })
      oldL.push(text)
      newL.push(text)
    }
  }
  return { rows, oldText: oldL.join('\n'), newText: newL.join('\n'), adds, dels }
}

// Row index range [first, last] a note covers, or null if its lines are not in the file.
export function noteSpan(rows: Row[], note: Omit<CodeNote, 'file'>): [number, number] | null {
  const [a, b] = note.lines
  const side = note.side === 'old' ? 'old' : 'new'
  const covered = (r: Row) => {
    const v = r[side]
    return v !== undefined && v >= a && v <= b
  }
  const first = rows.findIndex(covered)
  return first < 0 ? null : [first, rows.findLastIndex(covered)]
}

type Item = { kind: 'row'; i: number } | { kind: 'gap'; start: number; end: number } // end exclusive

const CONTEXT = 8 // unchanged rows kept around a change or a note
const MIN_GAP = 4 // shorter runs stay visible: folding them saves little room

// Rows to show, with far unchanged runs folded into gaps. `open` holds the starts of gaps the user expanded.
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
