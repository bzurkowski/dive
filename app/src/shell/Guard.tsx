import { Component, type ReactNode } from 'react'

type Props = { at: number; children: ReactNode }
type State = { error?: Error }

export class Guard extends Component<Props, State> {
  state: State = {}
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  // Retry when the focus moves, so one bad note does not blank its step.
  // Not in the update that caught the error: that would throw again.
  componentDidUpdate(prev: Props, prevState: State) {
    // oxlint-disable-next-line react/no-did-update-set-state
    if (prevState.error && prev.at !== this.props.at) this.setState({ error: undefined })
  }
  render() {
    return this.state.error ? (
      <div role="status" className="m-4 rounded-md border border-line bg-surface px-4 py-3 text-sm">
        This step could not be shown. Its data may not match what this version of Dive expects.
        <details className="mt-2 text-xs text-muted">
          <summary className="cursor-pointer">Technical details</summary>
          <p className="mt-1">{String(this.state.error)}</p>
        </details>
      </div>
    ) : (
      this.props.children
    )
  }
}
