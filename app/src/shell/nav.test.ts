// Run: node app/src/shell/nav.test.ts
import type { Dive, Step } from '../types.ts'
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

// Hashes: an intro with a 3-message sequence, an empty chapter, a recap.
const msg = { from: 'a', to: 'b', label: 'l', note: 'n' }
const seq = { kind: 'sequence', title: 's', say: '', actors: [], messages: [msg, msg, msg] } as const
const three = {
  ...dive,
  chapters: [
    { id: 'intro', title: 'Intro', steps: [card, seq] },
    { id: 'glossary', title: 'Glossary', steps: [] },
    { id: 'recap', title: 'Recap', steps: [seq, card] },
  ],
} as Dive
for (const p of [COVER, END, { c: 0, s: 1, f: 2 }, { c: 2, s: 0, f: 1 }])
  eq(parseHash(three, toHash(p)), p, `round trip ${toHash(p)}`)
eq(parseHash(three, '#/2'), { c: 2, s: 0, f: 0 }, 'chapter only')
eq(parseHash(three, '#/0/1'), { c: 0, s: 1, f: 0 }, 'no focus')
eq(parseHash(three, '#/0/1/2/'), { c: 0, s: 1, f: 2 }, 'trailing slash')
eq(parseHash(three, '#/end/'), END, 'end with a trailing slash')
eq(parseHash(three, '#/0/9/9'), { c: 0, s: 1, f: 2 }, 'step and focus clamp')
eq(parseHash(three, `#/0/${'9'.repeat(400)}/0`), { c: 0, s: 1, f: 0 }, 'huge step clamps')
eq(parseHash(three, '#/1/0/0'), COVER, 'empty chapter')
eq(parseHash(three, '#/9/0/0'), COVER, 'missing chapter')
for (const h of [
  '',
  '#',
  '#//',
  '#/abc',
  '#/-1/0/0',
  '#/0/-1/0',
  '#/0/0.5/0',
  '#/0/1/0.5',
  '#/1e0',
  '#/end/1',
  '#/0/1/2/3',
])
  eq(parseHash(three, h), COVER, `garbage ${JSON.stringify(h)}`)

const tflat = flatten(three)
eq(move(three, tflat, { c: 0, s: 1, f: 0 }, 1), { c: 0, s: 1, f: 1 }, 'focus moves inside a step')
eq(move(three, tflat, { c: 0, s: 1, f: 1 }, -1), { c: 0, s: 1, f: 0 }, 'focus moves back inside a step')
eq(move(three, tflat, { c: 0, s: 1, f: 0 }, -1), { c: 0, s: 0, f: 0 }, 'first focus moves to the previous step')
eq(move(three, tflat, { c: 0, s: 1, f: 2 }, 1), { c: 2, s: 0, f: 0 }, 'last focus skips the empty chapter')
eq(move(three, tflat, { c: 2, s: 0, f: 0 }, -1), { c: 0, s: 1, f: 2 }, 'back lands on the last focus')
eq(move(three, tflat, { c: 0, s: 0, f: 5 }, 1), { c: 0, s: 1, f: 0 }, 'focus past the step size moves on')
eq(move(three, tflat, END, -1), { c: 2, s: 1, f: 0 }, 'end moves back across chapters')
eq(move(three, tflat, COVER, -1), COVER, 'cover stays')
// The cover's start button goes to { c: 0 } even when the dive has no steps.
const empty = { ...dive, chapters: [] } as Dive
eq(move(empty, [], { c: 0, s: 0, f: 0 }, 1), END, 'a position outside the dive moves on')
eq(move(empty, [], { c: 0, s: 0, f: 0 }, -1), COVER, 'a position outside the dive moves back')

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
eq(flows([flow] as Step[]), [{ s: 0, end: 1, edge: 1 }], 'a flow with no steps after it')
eq(flows([card, flow, edge, quiz] as Step[]), [{ s: 1, end: 4, edge: 2 }], 'edge cases run from the first edge')
eq(flows([card, quiz] as Step[]), [], 'no flow step, no flows')
const tail = { ...dive, chapters: [{ id: 'walkthrough', title: 'W', steps: [card, flow, edge] }] } as Dive
const tailFlat = flatten(tail)
eq(skipEdges(tail, tailFlat, { c: 0, s: 0, f: 0 }), null, 'no skip before the first flow')
eq(skipEdges(tail, tailFlat, { c: 0, s: 1, f: 0 }), END, 'a flow right before its edges skips to the end')
eq(skipEdges(tail, tailFlat, { c: 0, s: 2, f: 0 }), END, 'the last edge of the dive skips to the end')
