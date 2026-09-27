import { stepSize, type Dive, type Step } from '../types.ts'

// Position in the dive. c = -1 is the cover, c = -2 the end screen.
export interface Pos {
  c: number
  s: number
  f: number
}

export const COVER: Pos = { c: -1, s: 0, f: 0 }
export const END: Pos = { c: -2, s: 0, f: 0 }

export type Flat = { c: number; s: number }[]

export const flatten = (dive: Dive): Flat => dive.chapters.flatMap((ch, c) => ch.steps.map((_, s) => ({ c, s })))

export function parseHash(dive: Dive, hash: string): Pos {
  const path = hash.replace(/^#\/?/, '')
  if (path === 'end') return END
  const [c, s, f] = path.split('/').map((x) => Number(x) || 0)
  const steps = dive.chapters[c]?.steps
  if (!path || !steps?.length) return COVER
  const si = Math.min(Math.max(0, s), steps.length - 1)
  return { c, s: si, f: Math.min(Math.max(0, f), stepSize(steps[si]) - 1) }
}

export const toHash = (p: Pos) => (p.c === END.c ? '#/end' : p.c < 0 ? '#/' : `#/${p.c}/${p.s}/${p.f}`)

export const flatIndex = (flat: Flat, p: Pos) => flat.findIndex((x) => x.c === p.c && x.s === p.s)

// Next or previous position: focus inside the step first, then steps, then chapters.
// Past the last step is the end screen.
export function move(dive: Dive, flat: Flat, p: Pos, dir: 1 | -1): Pos {
  if (p.c === COVER.c) return dir > 0 && flat[0] ? { ...flat[0], f: 0 } : p
  let i = flat.length
  if (p.c !== END.c) {
    const size = stepSize(dive.chapters[p.c].steps[p.s])
    if (dir > 0 && p.f + 1 < size) return { ...p, f: p.f + 1 }
    if (dir < 0 && p.f > 0) return { ...p, f: p.f - 1 }
    i = flatIndex(flat, p)
  }
  i += dir
  if (i < 0) return COVER
  const t = flat[i]
  if (!t) return END
  return { ...t, f: dir > 0 ? 0 : stepSize(dive.chapters[t.c].steps[t.s]) - 1 }
}

// Reading time: ~200 wpm plus a fixed cost to look at code and diagrams.
// ponytail: rough constants, tune against real dives.
const SKIP = new Set([
  'kind',
  'file',
  'id',
  'from',
  'to',
  'side',
  'type',
  'group',
  'focus',
  'url',
  'lines',
  'correct',
  'code',
])

function words(v: unknown): number {
  if (typeof v === 'string') return v.split(/\s+/).filter(Boolean).length
  if (Array.isArray(v)) return v.reduce((n: number, x) => n + words(x), 0)
  if (v && typeof v === 'object') return Object.entries(v).reduce((n, [k, x]) => n + (SKIP.has(k) ? 0 : words(x)), 0)
  return 0
}

export function stepSeconds(step: Step): number {
  const look =
    step.kind === 'code'
      ? 10 + 10 * step.notes.length
      : step.kind === 'sequence'
        ? 5 + 4 * step.messages.length
        : step.kind === 'diagram'
          ? 8 + 4 * (step.notes?.length ?? 0)
          : step.kind === 'quiz'
            ? 15
            : 0
  return (words(step) / 200) * 60 + look
}

export const chapterSeconds = (steps: Step[]) => steps.reduce((n, s) => n + stepSeconds(s), 0)

export const minutes = (sec: number) => `${Math.max(1, Math.round(sec / 60))} min`
