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
    return this.state.error ? (
      <Notice>This step could not be shown: {this.state.error.message}</Notice>
    ) : (
      this.props.children
    )
  }
}
