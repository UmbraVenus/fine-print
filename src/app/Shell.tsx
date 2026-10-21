import { useState, type ReactNode } from 'react'
import { Sidebar } from './Sidebar'

const COLLAPSED_KEY = 'fp_sidebar_collapsed'

// Narrow windows start with the sidebar collapsed, unless the viewer chose otherwise.
function readCollapsed(): boolean {
  try {
    const stored = window.localStorage.getItem(COLLAPSED_KEY)
    if (stored !== null) return stored === '1'
  } catch {
    // No saved choice.
  }
  return window.innerWidth < 1100
}

export function Shell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const toggle = () => {
    setCollapsed((c) => {
      try {
        window.localStorage.setItem(COLLAPSED_KEY, c ? '0' : '1')
      } catch {
        // Not remembering the choice is fine.
      }
      return !c
    })
  }
  return (
    <div className="fp-shell">
      <div className="fp-sidebar-wrap">
        <Sidebar collapsed={collapsed} onToggle={toggle} />
      </div>
      <main className="fp-main">{children}</main>
    </div>
  )
}
