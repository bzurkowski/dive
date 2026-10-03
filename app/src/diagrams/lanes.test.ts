import { deepStrictEqual as eq } from 'node:assert/strict'
import { bands, cut, lanes } from './lanes.ts'

const actors = [
  { id: 'worker', label: 'runWorker', group: 'app' },
  { id: 'store', label: 'RefundStore', group: 'app' },
  { id: 'pg', label: 'Postgres', group: 'db' },
  { id: 'retry', label: 'retryRefund', group: 'app' },
  { id: 'user', label: 'User' },
]

const all = lanes(actors, false)
eq(
  all.lanes.map((l) => l.label),
  ['runWorker', 'RefundStore', 'Postgres', 'retryRefund', 'User'],
  'expanded labels',
)
eq(
  bands(all.lanes),
  [
    { group: 'app', start: 0, n: 2 },
    { group: 'db', start: 2, n: 1 },
    { group: 'app', start: 3, n: 1 },
  ],
  'bands per run',
)

const grouped = lanes(actors, true)
eq(
  grouped.lanes.map((l) => l.label),
  ['app', 'db', 'User'],
  'grouped labels',
)
eq(
  grouped.lanes.map((l) => l.actors.length),
  [3, 1, 1],
  'grouped actors',
)
eq([...grouped.of.values()], [0, 0, 1, 0, 2], 'actor → lane')

const plain = [
  { id: 'a', label: 'A' },
  { id: 'b', label: 'B' },
]
eq(bands(lanes(plain, false).lanes), [], 'no groups, no bands')
eq(lanes(plain, true).lanes.length, 2, 'no groups, nothing to collapse')

// A duplicate id keeps the first actor, like the actor lookups in App.
const dup = lanes([...plain, { id: 'a', label: 'A again' }], false)
eq(dup.of.get('a'), 0, 'duplicate id maps to the first actor')

const odd = [
  { id: 'x', label: 'app' },
  { id: 'y', label: 'Y', group: '' },
  { id: 'z', label: 'Z', group: 'app' },
]
eq(
  lanes(odd, true).lanes.map((l) => `${l.label}/${l.group}`),
  ['app/undefined', 'Y/undefined', 'app/app'],
  'empty group is no group, and a group named like an actor keeps its own lane',
)

// 9 lanes of 100px in a 356px view: lanes 0-2 fit at the start, 6 hide on the right.
eq(cut(9, 100, 0, 356), [0, 6], 'start: lanes cut on the right')
eq(cut(9, 100, 150, 356), [2, 4], 'middle: a half-shown lane counts as cut')
eq(cut(9, 100, 9999, 356), [6, 0], 'scrolled past the end clamps to the end')
eq(cut(3, 356 / 3, 0, 356), [0, 0], 'lanes that fit cut nothing')
