import type { Actor } from '../types.ts'

// An actor's label by id; an unknown id stands for itself.
export const actorLabel = (actors: Actor[], id: string) => actors.find((a) => a.id === id)?.label ?? id

export interface Lane {
  label: string // the label of the actor, or the name of a collapsed group
  group?: string
  actors: Actor[] // one, or every actor of a collapsed group
}

// Lifelines of a sequence. Grouped, each group collapses into one lane at its
// first actor. `of` maps actor id → lane. A duplicate id keeps its first actor.
export function lanes(actors: Actor[], grouped: boolean) {
  const list: Lane[] = []
  const of = new Map<string, number>()
  for (const a of actors) {
    const group = a.group || undefined
    const merge = grouped ? group : undefined
    let i = merge ? list.findIndex((l) => l.group === merge) : -1
    if (i < 0) i = list.push({ label: merge ?? a.label, group, actors: [] }) - 1
    list[i].actors.push(a)
    if (!of.has(a.id)) of.set(a.id, i)
  }
  return { lanes: list, of }
}

// Lanes cut off at the [left, right] edges of a `view` px wide canvas scrolled to `x`.
export function cut(n: number, cw: number, x: number, view: number): [number, number] {
  const max = n * cw - view
  if (max <= 1) return [0, 0]
  x = Math.min(Math.max(x, 0), max)
  // 0.01 of a lane absorbs sub-pixel scroll positions.
  return [Math.max(0, Math.ceil(x / cw - 0.01)), n - Math.floor((x + view) / cw + 0.01)]
}

// Runs of neighbouring lanes that share a group: the bands above the actor heads.
export function bands(list: Lane[]) {
  const out: { group: string; start: number; n: number }[] = []
  list.forEach((l, i) => {
    if (!l.group) return
    const last = out.at(-1)
    if (last?.group === l.group && last.start + last.n === i) last.n++
    else out.push({ group: l.group, start: i, n: 1 })
  })
  return out
}
