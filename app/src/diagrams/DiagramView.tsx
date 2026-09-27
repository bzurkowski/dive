import type { DiagramStep, StepViewProps } from '../types'

// Owner: diagrams. Stub until implemented.
export function DiagramView({ step }: StepViewProps<DiagramStep>) {
  return <pre className="p-4 text-sm">{step.edges.map((e) => `${e.from} -> ${e.to}`).join('\n')}</pre>
}
