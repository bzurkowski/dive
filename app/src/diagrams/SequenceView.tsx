import type { SequenceStep, StepViewProps } from '../types'

// Owner: diagrams. Stub until implemented.
export function SequenceView({ step }: StepViewProps<SequenceStep>) {
  return <pre className="p-4 text-sm">{step.messages.map((m) => `${m.from} -> ${m.to}: ${m.label}`).join('\n')}</pre>
}
