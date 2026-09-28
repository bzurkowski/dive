import type { Dive, Step } from '../types.ts'

// Chapter, step, and focus inside the step. c = -1 is the cover, c = -2 the end screen.
export interface Pos {
  c: number
  s: number
  f: number
}

// Number of → positions in a step: one per note or message, else one.
export function stepSize(step: Step): number {
  switch (step.kind) {
    case 'code':
      return step.notes.length
    case 'sequence':
    case 'flow':
    case 'edge':
      return step.messages.length
    case 'diagram':
      return step.notes?.length || 1
    default:
      return 1
  }
}

export const COVER: Pos = { c: -1, s: 0, f: 0 }
export const END: Pos = { c: -2, s: 0, f: 0 }

export type Flat = { c: number; s: number }[]

export const flatten = (dive: Dive): Flat => dive.chapters.flatMap((ch, c) => ch.steps.map((_, s) => ({ c, s })))

// #/end, or #/c[/s[/f]] with step and focus clamped; anything else is the cover.
export function parseHash(dive: Dive, hash: string): Pos {
  const path = hash.replace(/^#\/?|\/$/g, '')
  if (path === 'end') return END
  if (!/^\d+(\/\d+){0,2}$/.test(path)) return COVER
  const [c, s = 0, f = 0] = path.split('/').map(Number)
  const steps = dive.chapters[c]?.steps
  if (!steps) return COVER
  const si = Math.min(s, steps.length - 1)
  return { c, s: si, f: Math.min(f, stepSize(steps[si]) - 1) }
}

export const toHash = (p: Pos) => (p.c === END.c ? '#/end' : p.c < 0 ? '#/' : `#/${p.c}/${p.s}/${p.f}`)

export const flatIndex = (flat: Flat, p: Pos) => flat.findIndex((x) => x.c === p.c && x.s === p.s)

// Next or previous position: focus inside the step first, then the next step.
// Before the first step is the cover, past the last the end screen.
export function move(dive: Dive, flat: Flat, p: Pos, dir: 1 | -1): Pos {
  const step = dive.chapters[p.c]?.steps[p.s]
  const f = p.f + dir
  if (step && f >= 0 && f < stepSize(step)) return { ...p, f }
  const i = (p.c === END.c ? flat.length : flatIndex(flat, p)) + dir
  const t = flat[i]
  if (t) return { ...t, f: dir > 0 ? 0 : stepSize(dive.chapters[t.c].steps[t.s]) - 1 }
  return i < 0 ? COVER : END
}

// A flow in a chapter: its 'flow' step at s, its steps up to end (exclusive).
// edge is the index of its first 'edge' step, or end when it has none.
export interface Flow {
  s: number
  edge: number
  end: number
}

export function flows(steps: Step[]): Flow[] {
  const starts = steps.flatMap((st, s) => (st.kind === 'flow' ? [s] : []))
  return starts.map((s, k) => {
    const end = starts[k + 1] ?? steps.length
    const e = steps.slice(s, end).findIndex((st) => st.kind === 'edge')
    return { s, end, edge: e < 0 ? end : s + e }
  })
}

export const flowAt = (fl: Flow[], s: number) => fl.find((f) => s >= f.s && s < f.end)

// Target of "skip edge cases": the step after p's flow. Offered only on the
// flow's last step before its edges and on the edges themselves, else null.
export function skipEdges(dive: Dive, flat: Flat, p: Pos): Pos | null {
  const steps = dive.chapters[p.c]?.steps
  const f = steps && flowAt(flows(steps), p.s)
  if (!f || f.edge === f.end || p.s < f.edge - 1) return null
  return move(dive, flat, { c: p.c, s: f.end - 1, f: stepSize(steps[f.end - 1]) - 1 }, 1)
}

// The step keys of PROSE in dive.py: only they hold prose, not ids, enums or paths.
const PROSE = new Set(['title', 'say', 'text', 'body', 'term', 'meaning', 'question', 'why', 'label', 'note'])

function words(v: unknown): number {
  if (!v || typeof v !== 'object') return 0
  return Object.entries(v).reduce(
    (n, [k, x]) => n + (PROSE.has(k) && typeof x === 'string' ? (x.match(/\S+/g)?.length ?? 0) : words(x)),
    0,
  )
}

// Reading time: ~200 wpm plus a fixed cost to look at code, diagrams and quizzes.
// ponytail: rough constants, tune against real dives.
export function stepSeconds(step: Step): number {
  const read = (words(step) / 200) * 60
  switch (step.kind) {
    case 'code':
      return read + 10 + 10 * step.notes.length
    case 'sequence':
    case 'flow':
    case 'edge':
      return read + 5 + 4 * step.messages.length
    case 'diagram':
      return read + 8 + 4 * (step.notes?.length ?? 0)
    case 'quiz':
      return read + 15
    default:
      return read
  }
}

export const chapterSeconds = (steps: Step[]) => steps.reduce((n, s) => n + stepSeconds(s), 0)

export const minutes = (sec: number) => `${Math.max(1, Math.round(sec / 60))} min`
