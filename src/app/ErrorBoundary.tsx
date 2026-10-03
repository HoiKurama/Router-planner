import { Component, type ErrorInfo, type ReactNode } from 'react'

interface State { error: Error | null }

/** Shows a visible message instead of an empty page when rendering fails. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('PromptRouter render error:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return <div role="alert" className="app-crash">
      <h1>Etwas ist schiefgelaufen.</h1>
      <p>Die Oberfläche konnte nicht angezeigt werden. Deine Eingaben wurden nirgendwohin übertragen.</p>
      <pre>{this.state.error.message}</pre>
      <button className="primary-button" onClick={() => location.reload()}>Seite neu laden</button>
    </div>
  }
}
