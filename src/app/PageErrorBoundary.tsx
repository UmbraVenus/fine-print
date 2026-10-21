import { Button } from 'antd'
import { Component, type ReactNode } from 'react'

const RETRY_KEY = 'fp_chunk_retry'

/** A page's code failed to load: usually a dev-server reload or a new deploy. One reload fixes it. */
function isChunkError(error: Error): boolean {
  return /dynamically imported module|Importing a module script failed|Failed to fetch|error loading dynamically/i.test(
    error.message,
  )
}

interface State {
  error: Error | null
}

/** Never leave a blank screen: retry a failed page load once, then explain and offer a reload. */
export class PageErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error) {
    if (!isChunkError(error)) return
    // Reload once; if the same page fails again within 10 seconds, show the message instead of looping.
    const now = Date.now()
    try {
      const last = JSON.parse(window.sessionStorage.getItem(RETRY_KEY) ?? 'null') as { path: string; at: number } | null
      if (last && last.path === window.location.pathname && now - last.at < 10_000) return
      window.sessionStorage.setItem(RETRY_KEY, JSON.stringify({ path: window.location.pathname, at: now }))
    } catch {
      return
    }
    window.location.reload()
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div role="alert" className="fp-card" style={{ padding: '48px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
        <h1 className="fp-page-title" style={{ fontSize: 22, lineHeight: '30px' }}>
          This page didn't load
        </h1>
        <p style={{ margin: 0, fontSize: 15, color: '#4A5468' }}>Reloading usually fixes it. Your work is saved.</p>
        <Button type="primary" onClick={() => window.location.reload()}>
          Reload the page
        </Button>
      </div>
    )
  }
}
