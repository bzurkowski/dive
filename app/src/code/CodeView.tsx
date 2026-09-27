import type { CodeStep, FileData, StepViewProps } from '../types'

// Owner: code inspector. Stub until implemented.
export function CodeView({ step, file }: StepViewProps<CodeStep> & { file?: FileData; href?: string }) {
  return <pre className="p-4 font-mono text-sm">{step.file}{'\n'}{file?.text}</pre>
}
