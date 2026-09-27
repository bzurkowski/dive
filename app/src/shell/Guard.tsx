import { Component, type ReactNode } from 'react'
import { Notice } from './Steps'

// Bad step data shows a notice instead of blanking the whole dive.
export class Guard extends Component<{ children: ReactNode }, { error?: Error }> {
  state: { error?: Error } = {}
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    return this.state.error ? (
      <Notice>This step could not be shown: {this.state.error.message}</Notice>
    ) : (
      this.props.children
    )
  }
}
