import { CodeView } from './code/CodeView'
import { DiagramView } from './diagrams/DiagramView'
import { SequenceView } from './diagrams/SequenceView'
import type { Dive } from './types'

// Owner: app shell. Stub until implemented.
// Keep support for #/<chapter>/<step>/<focus> (0-based): deep links and screenshots.
export default function App({ dive }: { dive: Dive }) {
  const [c = 0, s = 0, f = 0] = location.hash.slice(2).split('/').map(Number)
  const step = dive.chapters[c]?.steps[s]
  const noop = () => {}
  return (
    <main className="h-full">
      {step?.kind === 'code' && <CodeView step={step} file={dive.files?.[step.file]} focus={f} onFocus={noop} />}
      {step?.kind === 'sequence' && <SequenceView step={step} focus={f} onFocus={noop} />}
      {step?.kind === 'diagram' && <DiagramView step={step} focus={f} onFocus={noop} />}
      {!step && <h1 className="p-8 text-2xl font-semibold">{dive.title}</h1>}
    </main>
  )
}
