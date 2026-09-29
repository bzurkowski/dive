import type { Term } from '../types.ts'

// Letters of s skipped to find q's letters in order, or -1 when they are not all there.
// Tries every start, so "ab" in "aab" skips none.
export function gaps(s: string, q: string): number {
  let best = -1
  for (let i = s.indexOf(q[0]); i !== -1; i = s.indexOf(q[0], i + 1)) {
    let j = i
    for (let k = 1; k < q.length && j !== -1; k++) j = s.indexOf(q[k], j + 1)
    if (j === -1) break // a later start cannot fit either
    const skipped = j - i + 1 - q.length
    if (best === -1 || skipped < best) best = skipped
  }
  return best
}

// Fuzzy on term, then code; plain substring on meaning. Ties keep glossary order.
export function searchTerms(terms: Term[], query: string): Term[] {
  const q = query.trim().toLowerCase()
  if (!q) return terms
  const score = (t: Term): [number, number] | undefined => {
    const term = gaps(t.term.toLowerCase(), q)
    if (term !== -1) return [0, term]
    const code = t.code ? gaps(t.code.toLowerCase(), q) : -1
    if (code !== -1) return [1, code]
    if (t.meaning.toLowerCase().includes(q)) return [2, 0]
  }
  return terms
    .map((t) => ({ t, s: score(t) }))
    .filter((x): x is { t: Term; s: [number, number] } => !!x.s)
    .sort((a, b) => a.s[0] - b.s[0] || a.s[1] - b.s[1])
    .map((x) => x.t)
}
