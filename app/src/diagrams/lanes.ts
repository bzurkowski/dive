import type { Actor } from '../types'

export interface Lane {
  label: string // the actor's label, or the name of a collapsed group
  group?: string
  actors: Actor[] // one, or every actor of a collapsed group
}

// Lifelines of a sequence. Grouped, each group collapses into one lane at its
// first actor. `of` maps actor id → lane; a duplicate id keeps its first actor.
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
