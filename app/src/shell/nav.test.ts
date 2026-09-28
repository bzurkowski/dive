// Run: node app/src/shell/nav.test.ts
import type { Dive } from '../types.ts'
import { COVER, END, flatten, flows, move, parseHash, skipEdges, toHash } from './nav.ts'

function eq(actual: unknown, expected: unknown, what: string) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a !== e) throw new Error(`${what}: got ${a}, want ${e}`)
}

const card = { kind: 'card', title: 't', body: 'b' } as const
const dive = {
  title: 't',
  summary: 's',
  source: { kind: 'pr', ref: '1' },
  chapters: [{ id: 'intro', title: 'Intro', steps: [card, card] }],
} as Dive
const flat = flatten(dive)

eq(move(dive, flat, { c: 0, s: 1, f: 0 }, 1), END, 'last step moves to the end')
eq(move(dive, flat, END, 1), END, 'end stays')
eq(move(dive, flat, END, -1), { c: 0, s: 1, f: 0 }, 'end moves back to the last step')
eq(move(dive, flat, COVER, 1), { c: 0, s: 0, f: 0 }, 'cover moves to the first step')
eq(move(dive, flat, { c: 0, s: 0, f: 0 }, -1), COVER, 'first step moves back to the cover')
eq(parseHash(dive, toHash(END)), END, 'end hash round trip')
eq(parseHash(dive, '#/'), COVER, 'cover hash')

// Flows and skipping edge cases.
const step = (kind: string) => ({
  kind,
  id: kind,
  title: kind,
  say: '',
  actors: [],
  messages: [],
  question: '',
  options: [],
})
const [flow, quiz, edge] = ['flow', 'quiz', 'edge'].map(step)
const walk = {
  ...dive,
  chapters: [
    { id: 'walkthrough', title: 'Walkthrough', steps: [flow, quiz, edge, edge, flow, quiz, flow, quiz, edge] },
    { id: 'recap', title: 'Recap', steps: [card] },
  ],
} as Dive
const wflat = flatten(walk)
eq(
  flows(walk.chapters[0].steps),
  [
    { s: 0, end: 4, edge: 2 },
    { s: 4, end: 6, edge: 6 },
    { s: 6, end: 9, edge: 8 },
  ],
  'flows split at flow steps',
)
eq(skipEdges(walk, wflat, { c: 0, s: 1, f: 0 }), { c: 0, s: 4, f: 0 }, 'quiz skips to the next flow')
eq(skipEdges(walk, wflat, { c: 0, s: 3, f: 0 }), { c: 0, s: 4, f: 0 }, 'edge skips to the next flow')
eq(skipEdges(walk, wflat, { c: 0, s: 0, f: 0 }), null, 'no skip before the last step ahead of edges')
eq(skipEdges(walk, wflat, { c: 0, s: 5, f: 0 }), null, 'no skip in a flow without edges')
eq(skipEdges(walk, wflat, { c: 0, s: 7, f: 0 }), { c: 1, s: 0, f: 0 }, 'last flow skips to the next chapter')
eq(skipEdges(walk, wflat, { c: 0, s: 8, f: 0 }), { c: 1, s: 0, f: 0 }, 'last edge skips to the next chapter')
eq(skipEdges(walk, wflat, COVER), null, 'no skip on the cover')
