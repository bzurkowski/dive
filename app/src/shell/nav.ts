import type { Dive, Source, Step } from '../types.ts'

// c = -1 is the cover, c = -2 the end screen.
export interface Pos {
  c: number
  s: number
  f: number
}

export const COVER: Pos = { c: -1, s: 0, f: 0 }
export const END: Pos = { c: -2, s: 0, f: 0 }

export interface StepViewProps<S extends Step> {
  step: S
  focus: number
  onFocus: (f: number) => void
  onJump?: (id: string) => void
}

// "c/s" of a quiz step to the index of the picked option in step.options.
export type Picks = Record<string, number>

export const KIND = { pr: 'Pull request', module: 'Module', question: 'Question' }

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

export function focusLabel(step: Step, f: number): string {
  const n = stepSize(step)
  return n > 1 ? `${'messages' in step ? 'message' : 'note'} ${f + 1} of ${n}` : ''
}

export const origin = (s: Source) =>
  s.kind === 'pr'
    ? `${s.repo ?? KIND.pr} #${(s.url ?? s.ref).match(/\d+/g)?.at(-1) ?? ''}`
    : s.kind === 'module'
      ? s.ref
      : KIND.question

export const flatten = (dive: Dive) => dive.chapters.flatMap((ch, c) => ch.steps.map((step, s) => ({ c, s, step })))

export const flatIndex = (flat: ReturnType<typeof flatten>, p: Pos) => flat.findIndex((x) => x.c === p.c && x.s === p.s)

export function quizTally(dive: Dive, picks: Picks): string {
  let n = 0
  let right = 0
  let skipped = 0
  for (const { c, s, step } of flatten(dive)) {
    if (step.kind !== 'quiz') continue
    const p = picks[`${c}/${s}`]
    n++
    if (p === undefined) skipped++
    else if (step.options[p].correct) right++
  }
  if (!n) return ''
  if (skipped === n) return 'No quiz answered'
  return `${right} of ${n} quiz answers right${skipped ? `, ${skipped} skipped` : ''}`
}

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

export function move(dive: Dive, p: Pos, dir: 1 | -1): Pos {
  const step = dive.chapters[p.c]?.steps[p.s]
  const f = p.f + dir
  if (step && f >= 0 && f < stepSize(step)) return { ...p, f }
  const flat = flatten(dive)
  const i = (p.c === END.c ? flat.length : flatIndex(flat, p)) + dir
  const t = flat[i]
  if (t) return { c: t.c, s: t.s, f: dir > 0 ? 0 : stepSize(t.step) - 1 }
  return i < 0 ? COVER : END
}

// Step indices in the chapter: s of the 'flow' step, edge of the first 'edge' step (end when it has none), end exclusive.
interface Flow {
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

// Null outside a flow and on its last position, where → lands anyway.
export function skipFlow(dive: Dive, p: Pos): Pos | null {
  const steps = dive.chapters[p.c]?.steps
  const f = steps && flowAt(flows(steps), p.s)
  if (!f) return null
  const end = { c: p.c, s: f.end - 1, f: stepSize(steps[f.end - 1]) - 1 }
  return p.s === end.s && p.f === end.f ? null : move(dive, end, 1)
}

// PROSE, words and stepSeconds mirror dive.py, which prints the same reading time.
const PROSE = new Set(['title', 'say', 'text', 'body', 'term', 'meaning', 'question', 'why', 'label', 'note'])

function words(v: unknown): number {
  if (!v || typeof v !== 'object') return 0
  return Object.entries(v).reduce(
    (n, [k, x]) => n + (PROSE.has(k) && typeof x === 'string' ? (x.match(/\S+/g)?.length ?? 0) : words(x)),
    0,
  )
}

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

export const minutes = (steps: Step[]) =>
  `${Math.max(1, Math.round(steps.reduce((n, s) => n + stepSeconds(s), 0) / 60))} min`
