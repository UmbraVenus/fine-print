import { Skeleton } from 'antd'
import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { PageErrorBoundary } from './app/PageErrorBoundary'
import { Shell } from './app/Shell'
import { WorkspaceProvider, useWorkspace } from './app/workspace'
import { ROLE_LABEL } from './lib/labels'
import type { Role } from './lib/types'

// Each page loads when it's first opened, so the first screen arrives sooner.
const InsightsPage = lazy(() => import('./pages/InsightsPage').then((m) => ({ default: m.InsightsPage })))
const HistoryPage = lazy(() => import('./pages/HistoryPage').then((m) => ({ default: m.HistoryPage })))
const MyAdsPage = lazy(() => import('./pages/MyAdsPage').then((m) => ({ default: m.MyAdsPage })))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })))
const PreCheckPage = lazy(() => import('./pages/PreCheckPage').then((m) => ({ default: m.PreCheckPage })))
const QueuePage = lazy(() => import('./pages/QueuePage').then((m) => ({ default: m.QueuePage })))
const ReviewPage = lazy(() => import('./pages/ReviewPage').then((m) => ({ default: m.ReviewPage })))
const RulesPage = lazy(() => import('./pages/RulesPage').then((m) => ({ default: m.RulesPage })))

const TITLES: Array<[RegExp, string]> = [
  [/^\/my-ads/, 'My ads'],
  [/^\/queue/, 'Queue'],
  [/^\/history/, 'History'],
  [/^\/insights/, 'Insights'],
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
  const { pathname } = useLocation()
  return (
    <Shell>
      <DocumentTitle />
      <PageErrorBoundary key={pathname}>
      <Suspense fallback={<Skeleton active paragraph={{ rows: 8 }} />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/my-ads" element={<ForRole role="marketer"><MyAdsPage /></ForRole>} />
        <Route path="/ads/:id/pre-check" element={<ForRole role="marketer"><PreCheckPage /></ForRole>} />
        <Route path="/queue" element={<ForRole role="reviewer"><QueuePage /></ForRole>} />
        <Route path="/review/:id" element={<ForRole role="reviewer"><ReviewPage /></ForRole>} />
        <Route path="/history" element={<ForRole role="reviewer"><HistoryPage /></ForRole>} />
        <Route path="/insights" element={<ForRole role="reviewer"><InsightsPage /></ForRole>} />
        <Route path="/rules" element={<RulesPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      </Suspense>
      </PageErrorBoundary>
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
