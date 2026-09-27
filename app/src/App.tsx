import type { Dive } from './types'

// Owner: app shell. Stub until implemented.
export default function App({ dive }: { dive: Dive }) {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold">{dive.title}</h1>
      <p className="text-muted">{dive.summary}</p>
    </main>
  )
}
