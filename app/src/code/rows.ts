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

// FileData → rows. Diff text is a full-context body; `@@` headers are tolerated.
export function parse(file: FileData): Parsed {
  const lines = file.text.split(/\r?\n/)
  if (lines.at(-1) === '') lines.pop()
  const rows: Row[] = []
  const oldL: string[] = []
  const newL: string[] = []
  let o = 1
  let n = 1
  let adds = 0
  let dels = 0
  for (const line of lines) {
    if (!file.diff) {
      rows.push({ type: 'ctx', old: n, new: n, text: line, n: newL.length })
      newL.push(line)
      n++
      continue
    }
    const hunk = /^@@ -(\d+)(?:,\d+)? \+(\d+)/.exec(line)
    if (hunk) {
      o = +hunk[1]
      n = +hunk[2]
      rows.push({ type: 'hunk', text: line })
      continue
    }
    const mark = line[0]
    const text = line.slice(1)
    if (mark === '\\') continue // "\ No newline at end of file"
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
  let first = -1
  let last = -1
  rows.forEach((r, i) => {
    const v = r[side]
    if (v !== undefined && v >= a && v <= b) {
      if (first < 0) first = i
      last = i
    }
  })
  return first < 0 ? null : [first, last]
}

export type Item = { kind: 'row'; i: number } | { kind: 'gap'; start: number; end: number } // end exclusive

// Hide unchanged rows more than `context` rows away from a change or a note.
// Runs shorter than 4 rows stay visible; `open` holds gap starts the user expanded.
export function layout(rows: Row[], spans: ([number, number] | null)[], open: Set<number>, context = 8): Item[] {
  const hot = rows.map((r) => r.type !== 'ctx')
  for (const s of spans) if (s) hot.fill(true, s[0], s[1] + 1)
  if (!hot.includes(true)) return rows.map((_, i) => ({ kind: 'row', i }))

  const dist = rows.map(() => Infinity)
  let last = -Infinity
  for (let i = 0; i < rows.length; i++) {
    if (hot[i]) last = i
    dist[i] = i - last
  }
  last = Infinity
  for (let i = rows.length - 1; i >= 0; i--) {
    if (hot[i]) last = i
    dist[i] = Math.min(dist[i], last - i)
  }

  const items: Item[] = []
  let i = 0
  while (i < rows.length) {
    if (dist[i] <= context) {
      items.push({ kind: 'row', i: i++ })
      continue
    }
    const start = i
    while (i < rows.length && dist[i] > context) i++
    if (i - start < 4 || open.has(start)) for (let k = start; k < i; k++) items.push({ kind: 'row', i: k })
    else items.push({ kind: 'gap', start, end: i })
  }
  return items
}
