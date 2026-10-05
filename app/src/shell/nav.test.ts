import { deepStrictEqual as eq } from 'node:assert/strict'
import type { Dive, Step } from '../types.ts'
import {
  COVER,
  END,
  flows,
  focusLabel,
  minutes,
  move,
  origin,
  parseHash,
  quizTally,
  skipFlow,
  stepSeconds,
  toHash,
} from './nav.ts'

const card = { kind: 'card', title: 't', body: 'b' } as const
const dive = {
  title: 't',
  summary: 's',
  source: { kind: 'pr', ref: '1' },
  chapters: [{ id: 'intro', title: 'Intro', steps: [card, card] }],
} as Dive

eq(move(dive, { c: 0, s: 1, f: 0 }, 1), END, 'last step moves to the end')
eq(move(dive, END, 1), END, 'end stays')
eq(move(dive, END, -1), { c: 0, s: 1, f: 0 }, 'end moves back to the last step')
eq(move(dive, COVER, 1), { c: 0, s: 0, f: 0 }, 'cover moves to the first step')
eq(move(dive, { c: 0, s: 0, f: 0 }, -1), COVER, 'first step moves back to the cover')

const msg = { from: 'a', to: 'b', label: 'l', note: 'n' }
const seq = { kind: 'sequence', title: 's', say: '', actors: [], messages: [msg, msg, msg] } as const
const three = {
  ...dive,
  chapters: [
    { id: 'intro', title: 'Intro', steps: [card, seq] },
    { id: 'review-focus', title: 'Review focus', steps: [seq, card] },
  ],
} as Dive
for (const p of [COVER, END, { c: 0, s: 1, f: 2 }, { c: 1, s: 0, f: 1 }])
  eq(parseHash(three, toHash(p)), p, `round trip ${toHash(p)}`)
eq(parseHash(three, '#/1'), { c: 1, s: 0, f: 0 }, 'chapter only')
eq(parseHash(three, '#/0/1'), { c: 0, s: 1, f: 0 }, 'no focus')
eq(parseHash(three, '#/0/1/2/'), { c: 0, s: 1, f: 2 }, 'trailing slash')
eq(parseHash(three, '#/end/'), END, 'end with a trailing slash')
eq(parseHash(three, '#/0/9/9'), { c: 0, s: 1, f: 2 }, 'step and focus clamp')
eq(parseHash(three, `#/0/${'9'.repeat(400)}/0`), { c: 0, s: 1, f: 0 }, 'huge step clamps')
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

eq(move(three, { c: 0, s: 1, f: 0 }, 1), { c: 0, s: 1, f: 1 }, 'focus moves inside a step')
eq(move(three, { c: 0, s: 1, f: 1 }, -1), { c: 0, s: 1, f: 0 }, 'focus moves back inside a step')
eq(move(three, { c: 0, s: 1, f: 0 }, -1), { c: 0, s: 0, f: 0 }, 'first focus moves to the previous step')
eq(move(three, { c: 0, s: 1, f: 2 }, 1), { c: 1, s: 0, f: 0 }, 'last focus moves to the next chapter')
eq(move(three, { c: 1, s: 0, f: 0 }, -1), { c: 0, s: 1, f: 2 }, 'back lands on the last focus')
eq(move(three, { c: 0, s: 0, f: 5 }, 1), { c: 0, s: 1, f: 0 }, 'focus past the step size moves on')
eq(move(three, COVER, -1), COVER, 'cover stays')

const step = (kind: string) => ({
  kind,
  id: kind,
  title: kind,
  say: '',
  actors: [],
  messages: [msg],
  question: '',
  options: [],
})
const [flow, quiz, edge] = ['flow', 'quiz', 'edge'].map(step)
const walk = {
  ...dive,
  chapters: [
    { id: 'walkthrough', title: 'Walkthrough', steps: [flow, quiz, edge, edge, flow, quiz, flow, quiz, edge] },
    { id: 'review-focus', title: 'Review focus', steps: [card] },
  ],
} as Dive
eq(
  flows(walk.chapters[0].steps),
  [
    { s: 0, end: 4, edge: 2 },
    { s: 4, end: 6, edge: 6 },
    { s: 6, end: 9, edge: 8 },
  ],
  'flows split at flow steps',
)
eq(skipFlow(walk, { c: 0, s: 0, f: 0 }), { c: 0, s: 4, f: 0 }, 'flow step skips to the next flow')
eq(skipFlow(walk, { c: 0, s: 1, f: 0 }), { c: 0, s: 4, f: 0 }, 'quiz skips to the next flow')
eq(skipFlow(walk, { c: 0, s: 2, f: 0 }), { c: 0, s: 4, f: 0 }, 'edge skips to the next flow')
eq(skipFlow(walk, { c: 0, s: 3, f: 0 }), null, 'no skip on the last step, next goes there')
eq(skipFlow(walk, { c: 0, s: 4, f: 0 }), { c: 0, s: 6, f: 0 }, 'a flow without edges skips too')
eq(skipFlow(walk, { c: 0, s: 7, f: 0 }), { c: 1, s: 0, f: 0 }, 'last flow skips to the next chapter')
eq(skipFlow(walk, { c: 1, s: 0, f: 0 }), null, 'no skip outside a flow')
eq(skipFlow(walk, COVER), null, 'no skip on the cover')
eq(flows([card, quiz] as Step[]), [], 'no flow step, no flows')
const tail = {
  ...dive,
  chapters: [{ id: 'walkthrough', title: 'W', steps: [flow, { ...edge, messages: [msg, msg] }] }],
} as Dive
eq(skipFlow(tail, { c: 0, s: 0, f: 0 }), END, 'the last flow of the dive skips to the end')
eq(skipFlow(tail, { c: 0, s: 1, f: 0 }), END, 'skip from a focus before the last')
eq(skipFlow(tail, { c: 0, s: 1, f: 1 }), null, 'no skip on the last focus')

// Prose is empty below, so a counted id, enum or path shows up as extra seconds.
const note = { file: 'a b.ts', lines: [1, 2], side: 'old', focus: ['a b'], text: '' }
const actor = { id: 'a', label: '', group: 'g h', change: 'added' }
const message = { from: 'a', to: 'a', label: '', note: '', type: 'return', step: 'x', change: 'removed' }
for (const [st, sec] of [
  [{ kind: 'card', title: '', body: Array(200).fill('w').join(' '), links: [{ title: '', url: 'a b' }] }, 60],
  [{ kind: 'terms', title: '', terms: [{ term: '', meaning: '', code: 'Refund Job' }] }, 0],
  [{ kind: 'code', id: 'c', title: '', say: '', notes: [note] }, 20],
  [{ kind: 'flow', id: 'f', title: '', say: '', actors: [actor], messages: [message] }, 9],
  [
    { kind: 'diagram', title: '', say: '', nodes: [{ id: 'a', label: '', group: 'g h' }], edges: [], notes: [note] },
    12,
  ],
  [{ kind: 'quiz', title: '', question: '', options: [{ text: '', correct: true, why: '' }] }, 15],
] as [Step, number][])
  eq(stepSeconds(st), sec, `${st.kind} seconds`)

const ask = {
  kind: 'quiz',
  title: 'q',
  question: 'q',
  options: [
    { text: 'a', why: 'w', correct: true },
    { text: 'b', why: 'w' },
  ],
}
const quizzes = { ...dive, chapters: [{ id: 'review-focus', title: 'R', steps: [ask, card, ask, ask] }] } as Dive
eq(quizTally(dive, {}), '', 'no quiz, no tally')
eq(quizTally(quizzes, {}), 'No quiz answered', 'none answered')
eq(quizTally(quizzes, { '0/0': 0, '0/2': 1 }), '1 of 3 quiz answers right, 1 skipped', 'a skip counts in the total')
eq(quizTally(quizzes, { '0/0': 0, '0/2': 0, '0/3': 1 }), '2 of 3 quiz answers right', 'all answered')

eq(focusLabel(three.chapters[0].steps[1], 1), 'message 2 of 3', 'message counter')
eq(focusLabel(card, 0), '', 'one position, no counter')
eq(
  origin({ kind: 'pr', ref: '842', repo: 'o/r2', url: 'https://github.com/o/r2/pull/842' }),
  'o/r2 #842',
  'last number',
)
eq(origin({ kind: 'pr', ref: '842' }), 'Pull request #842', 'no repo')
eq(origin({ kind: 'module', ref: 'src/pay' }), 'src/pay', 'module path')

const bare = { kind: 'diagram', title: '', say: '', nodes: [], edges: [] } as Step
eq(stepSeconds(bare), 8, 'diagram without notes')
const boxes = { ...dive, chapters: [{ id: 'intro', title: 'I', steps: [bare, card] }] } as Dive
eq(move(boxes, { c: 0, s: 0, f: 0 }, 1), { c: 0, s: 1, f: 0 }, 'a diagram without notes is one position')
eq(minutes([card]), '1 min', 'a short chapter still reads 1 min')
