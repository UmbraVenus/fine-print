import type { AdRow } from './types'

/** The small tables (Queue, My ads) load every row once and filter, sort and page in the browser. */
export const LOCAL_LIMIT = 50

export type SortKey = 'name' | 'date' | 'second' | 'check'

export interface LocalQuery {
  view: 'my-ads' | 'queue'
  q: string
  format: string[]
  product: string[]
  /** Statuses on My ads; auto check results (critical, caution, good) on the Queue. */
  status: string[]
  /** Only rows due on or before this day. */
  dueBy: string | null
  sort: { key: SortKey; order: 'asc' | 'desc' }
  page: number
  pageSize: number
}

const AUTO_CHECK: Record<string, (r: AdRow) => boolean> = {
  critical: (r) => r.critical > 0,
  caution: (r) => r.critical === 0 && r.caution > 0,
  good: (r) => r.critical === 0 && r.caution === 0,
}

/** SQLite order: NULL sorts before any value. */
function cmp(a: string | number | null, b: string | number | null): number {
  if (a === b) return 0
  if (a === null) return -1
  if (b === null) return 1
  return a < b ? -1 : 1
}

const nocase = (s: string) => s.toLowerCase()

/** The same filters and order as the server's list_ads, so both give the same rows. */
export function applyLocal(rows: AdRow[], query: LocalQuery): { rows: AdRow[]; total: number } {
  const needle = query.q.trim().toLowerCase()
  const matching = rows.filter((r) => {
    if (needle && ![r.name, r.source, r.format].some((v) => v.toLowerCase().includes(needle))) return false
    if (query.format.length && !query.format.includes(r.format)) return false
    if (query.product.length && !query.product.includes(r.product)) return false
    if (query.status.length) {
      if (query.view === 'queue') {
        if (!query.status.some((k) => AUTO_CHECK[k]?.(r))) return false
      } else if (!query.status.includes(r.status)) return false
    }
    if (query.dueBy && !(r.due_date !== null && r.due_date <= query.dueBy)) return false
    return true
  })

  const dir = query.sort.order === 'asc' ? 1 : -1
  const { key } = query.sort
  const order = (a: AdRow, b: AdRow): number => {
    if (key === 'name') return dir * cmp(nocase(a.name), nocase(b.name)) || a.id - b.id
    if (key === 'second' && query.view === 'my-ads') {
      // Due dates belong to ads in review; the rest have none and go last.
      return cmp(Number(a.status !== 'pending'), Number(b.status !== 'pending')) || dir * cmp(a.due_date, b.due_date) ||
        -cmp(a.updated_at, b.updated_at) || a.id - b.id
    }
    if (key === 'second') return dir * cmp(a.updated_at, b.updated_at) || dir * (a.id - b.id)
    if (key === 'check') {
      return dir * (a.critical - b.critical) || dir * (a.caution - b.caution) || cmp(a.due_date, b.due_date) ||
        cmp(nocase(a.name), nocase(b.name)) || a.id - b.id
    }
    if (query.view === 'queue') return dir * cmp(a.due_date, b.due_date) || cmp(nocase(a.name), nocase(b.name)) || a.id - b.id
    return dir * cmp(a.updated_at, b.updated_at) || dir * (a.id - b.id)
  }
  const sorted = [...matching].sort(order)
  const start = (Math.max(1, query.page) - 1) * query.pageSize
  return { rows: sorted.slice(start, start + query.pageSize), total: sorted.length }
}
