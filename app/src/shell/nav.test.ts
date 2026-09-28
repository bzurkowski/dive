// Run: node app/src/shell/nav.test.ts
import type { Dive } from '../types.ts'
import { COVER, END, flatten, move, parseHash, toHash } from './nav.ts'

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
