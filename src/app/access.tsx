/**
 * The secret link: the first visit with ?key=… trades the key for a cookie and drops it from the
 * address bar, so the page can be bookmarked. Without a valid cookie the API refuses, and so does this.
 */
export async function unlock(): Promise<boolean> {
  const url = new URL(window.location.href)
  const key = url.searchParams.get('key')
  try {
    if (key) {
      await fetch('/api/access', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key }) })
      url.searchParams.delete('key')
      window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
    }
    const res = await fetch('/api/access')
    return res.status !== 401
  } catch {
    // The API is unreachable: let the app show its own errors.
    return true
  }
}

export function NoAccess() {
  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#F6F7F9' }}>
      <div className="fp-card" style={{ maxWidth: 420, padding: '40px 32px', display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'center' }}>
        <h1 className="fp-page-title" style={{ fontSize: 22, lineHeight: '30px' }}>
          This link isn't valid
        </h1>
        <p style={{ margin: 0, fontSize: 15, lineHeight: '22px', color: '#4A5468' }}>Ask whoever sent it for the full link.</p>
      </div>
    </main>
  )
}
