import { Component, type ReactNode } from 'react'
import { Notice } from './Steps'

type Props = { children: ReactNode }
type State = { error?: Error }

// Bad step data shows a notice instead of blanking the whole dive.
export class Guard extends Component<Props, State> {
  state: State = {}
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  // Retry when App moves on (new children), so one bad note does not blank the rest of its step.
  // Not in the update that caught the error: that would just throw again.
  componentDidUpdate(prev: Props, prevState: State) {
    // oxlint-disable-next-line react/no-did-update-set-state
    if (prevState.error && prev.children !== this.props.children) this.setState({ error: undefined })
  }
  render() {
    // The plain sentence is for the reader; the error itself is for the dive's author.
    return this.state.error ? (
      <Notice>
        This step could not be shown. Its data may not match what this version of Dive expects.
        <details className="mt-2 text-xs text-muted">
          <summary className="cursor-pointer">Technical details</summary>
          <p className="mt-1">{String(this.state.error)}</p>
        </details>
      </Notice>
    ) : (
      this.props.children
    )
  }
}
