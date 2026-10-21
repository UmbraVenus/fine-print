import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Shell } from './app/Shell'
import { WorkspaceProvider, useWorkspace } from './app/workspace'
import { ROLE_LABEL } from './lib/labels'
import type { Role } from './lib/types'
import { HistoryPage } from './pages/HistoryPage'
import { MyAdsPage } from './pages/MyAdsPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { PreCheckPage } from './pages/PreCheckPage'
import { QueuePage } from './pages/QueuePage'
import { ReviewPage } from './pages/ReviewPage'
import { RulesPage } from './pages/RulesPage'

const TITLES: Array<[RegExp, string]> = [
  [/^\/my-ads/, 'My ads'],
  [/^\/queue/, 'Queue'],
  [/^\/history/, 'History'],
  [/^\/rules/, 'Rules'],
  [/^\/review\//, 'Review'],
  [/^\/ads\/.+\/pre-check/, 'Pre-check'],
]

function DocumentTitle() {
  const { pathname } = useLocation()
  useEffect(() => {
    const page = TITLES.find(([pattern]) => pattern.test(pathname))?.[1]
    document.title = page ? `${page} · Fine Print` : 'Fine Print'
  }, [pathname])
  return null
}

function Home() {
  const { role } = useWorkspace()
  return <Navigate to={ROLE_LABEL[role].home} replace />
}

/** Pages belong to one role; the other role lands on its own home. */
function ForRole({ role, children }: { role: Role; children: React.ReactNode }) {
  const workspace = useWorkspace()
  if (workspace.role !== role) return <Navigate to={ROLE_LABEL[workspace.role].home} replace />
  return <>{children}</>
}

function AppRoutes() {
  return (
    <Shell>
      <DocumentTitle />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/my-ads" element={<ForRole role="marketer"><MyAdsPage /></ForRole>} />
        <Route path="/ads/:id/pre-check" element={<ForRole role="marketer"><PreCheckPage /></ForRole>} />
        <Route path="/queue" element={<ForRole role="reviewer"><QueuePage /></ForRole>} />
        <Route path="/review/:id" element={<ForRole role="reviewer"><ReviewPage /></ForRole>} />
        <Route path="/history" element={<ForRole role="reviewer"><HistoryPage /></ForRole>} />
        <Route path="/rules" element={<RulesPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Shell>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <WorkspaceProvider>
        <AppRoutes />
      </WorkspaceProvider>
    </BrowserRouter>
  )
}
