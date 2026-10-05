import type { Actor, Category, Message } from '../types.ts'

export const actorLabel = (actors: Actor[], id: string) => actors.find((a) => a.id === id)?.label ?? id

export const hop = (actors: Actor[], m: Message) =>
  `${actorLabel(actors, m.from)} → ${actorLabel(actors, m.to)}: ${m.label}`

interface Lane {
  label: string // the label of the actor, or the name of a collapsed group
  group?: string
  category: Category // the category that all its actors share, else 'service'
  actors: Actor[]
}

// Grouped, a group collapses into one lane where its first actor stands.
// `of` maps an actor id to its lane. A duplicate id keeps its first actor, like actorLabel.
export function lanes(actors: Actor[], grouped: boolean) {
  const list: Lane[] = []
  const of = new Map<string, number>()
  for (const a of actors) {
    const group = a.group || undefined
    const merge = grouped ? group : undefined
    let i = merge ? list.findIndex((l) => l.group === merge) : -1
    if (i < 0) i = list.push({ label: merge ?? a.label, group, category: a.category, actors: [] }) - 1
    else if (list[i].category !== a.category) list[i].category = 'service'
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
