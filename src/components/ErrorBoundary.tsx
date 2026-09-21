import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Global fallback so an unexpected render error shows something actionable
 * instead of a blank page.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Kept deliberately narrow - no request bodies, no tokens.
    console.error('Unhandled UI error:', error.message, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="fatal">
        <div className="fatal__card">
          <h1 className="fatal__title">Something went wrong</h1>
          <p className="fatal__text">
            The page hit an unexpected error. Reloading usually clears it.
          </p>
          <pre className="fatal__detail">{error.message}</pre>
          <button
            type="button"
            className="button button--primary"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        </div>
      </div>
    )
  }
}
