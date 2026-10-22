import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from '../lib/api'
import { readRole, writeRole } from '../lib/role'
import type { Role } from '../lib/types'

interface Nav {
  pending: number
  today: string
  now: string
}

interface Workspace {
  role: Role
  setRole: (role: Role) => void
  pending: number | null
  /** The workspace's "today" (Pacific time), from the server, so every label agrees with the stats. */
  today: string
  /** Bumped after anything changes the data, so pages refetch. */
  version: number
  refresh: () => void
}

const WorkspaceContext = createContext<Workspace | null>(null)

function localToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date())
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role>(readRole)
  const [nav, setNav] = useState<Nav | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let cancelled = false
    api
      .get<Nav>('/api/nav')
      .then((data) => !cancelled && setNav(data))
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [version])

  // Another tab may change the data, or the role: coming back to
  // this tab refetches, so a decided ad leaves the Queue and a submitted one shows Pending in My ads.
  useEffect(() => {
    const onReturn = () => {
      if (document.visibilityState === 'hidden') return
      setRoleState(readRole())
      setVersion((v) => v + 1)
    }
    window.addEventListener('focus', onReturn)
    document.addEventListener('visibilitychange', onReturn)
    return () => {
      window.removeEventListener('focus', onReturn)
      document.removeEventListener('visibilitychange', onReturn)
    }
  }, [])

  const setRole = useCallback((next: Role) => {
    writeRole(next)
    setRoleState(next)
  }, [])

  const refresh = useCallback(() => setVersion((v) => v + 1), [])

  const value = useMemo<Workspace>(
    () => ({ role, setRole, pending: nav?.pending ?? null, today: nav?.today ?? localToday(), version, refresh }),
    [role, setRole, nav, version, refresh],
  )
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

export function useWorkspace(): Workspace {
  const value = useContext(WorkspaceContext)
  if (!value) throw new Error('useWorkspace outside WorkspaceProvider')
  return value
}
