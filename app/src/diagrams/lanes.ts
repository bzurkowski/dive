import type { Actor } from '../types'

export interface Lane {
  label: string // the actor's label, or the group name of a collapsed group
  group?: string
  actors: Actor[] // one, or every actor of a collapsed group
}

// Lifelines of a sequence. Grouped, each group collapses into one lane at its
// first actor; actors without a group keep their own lane. `of` maps actor id → lane.
export function lanes(actors: Actor[], grouped: boolean) {
  const list: Lane[] = []
  const of = new Map<string, number>()
  const byGroup = new Map<string, number>()
  for (const a of actors) {
    const merge = grouped && a.group ? a.group : undefined
    let i = merge ? byGroup.get(merge) : undefined
    if (i === undefined) {
      i = list.push({ label: merge ?? a.label, group: a.group || undefined, actors: [] }) - 1
      if (merge) byGroup.set(merge, i)
    }
    list[i].actors.push(a)
    if (!of.has(a.id)) of.set(a.id, i)
  }
  return { lanes: list, of }
}

// Runs of neighbouring lanes that share a group: the bands above the actor heads.
export function bands(list: Lane[]) {
  const out: { group: string; start: number; n: number }[] = []
  list.forEach((l, i) => {
    const last = out.at(-1)
    if (!l.group) return
    if (last && last.group === l.group && last.start + last.n === i) last.n++
    else out.push({ group: l.group, start: i, n: 1 })
  })
  return out
}
