import { Button, Checkbox, Input, Select, Table, Tooltip, type TableColumnsType, type TableProps } from 'antd'
import type { FilterDropdownProps, SorterResult } from 'antd/es/table/interface'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AdThumbnail } from '../ads/AdView'
import { useWorkspace } from '../app/workspace'
import { query } from '../lib/api'
import { useApi } from '../lib/useApi'
import { dayLabel, dayPhrase, daysBetween, shortDate, workspaceDate } from '../lib/dates'
import { PRODUCT_LABEL, STATUS_LABEL, plural, sourceLabel } from '../lib/labels'
import type { AdList, AdRow, AdStatus, Stat } from '../lib/types'
import { Icon } from './Icon'
import { StatCards, type StatAction } from './StatCards'
import { AutoCheckTag, StatusTag } from './StatusTag'

export type TableView = 'my-ads' | 'queue' | 'history'

interface ViewConfig {
  statusTitle: string
  statusKey: 'status' | 'auto_check'
  dateTitle: string
  defaultOrder: 'asc' | 'desc'
  empty: string
}

const VIEWS: Record<TableView, ViewConfig> = {
  'my-ads': { statusTitle: 'Status', statusKey: 'status', dateTitle: 'Updated', defaultOrder: 'desc', empty: 'No ads yet.' },
  queue: { statusTitle: 'Auto check', statusKey: 'auto_check', dateTitle: 'Due', defaultOrder: 'asc', empty: 'Queue cleared. Go get a snack.' },
  history: { statusTitle: 'Decision', statusKey: 'status', dateTitle: 'Closed', defaultOrder: 'desc', empty: 'No approved ads yet.' },
}

const AUTO_CHECK_OPTIONS = [
  { value: 'critical', label: 'Critical' },
  { value: 'caution', label: 'Caution' },
  { value: 'good', label: 'Good standing' },
]

const FORMAT_ORDER = ['Email', 'Facebook ad', 'Instagram ad', 'Instagram post', 'Display banner', 'Blog post', 'Landing page']

const STATUS_ORDER: AdStatus[] = ['draft', 'pending', 'changes_required', 'approved_with_changes', 'approved', 'rejected']

export interface Filters {
  format: string[]
  product: string[]
  status: string[]
  /** ['today'] for the Queue's "due today" card. */
  due: string[]
}

export const NO_FILTERS: Filters = { format: [], product: [], status: [], due: [] }

function myAdsSubLine(row: AdRow, today: string): string {
  switch (row.status) {
    case 'draft': {
      const parts = [row.critical && `${row.critical} Critical`, row.caution && `${row.caution} Caution`].filter(Boolean)
      return parts.length ? `Pre-check: ${parts.join(', ')}` : 'Pre-check: good standing'
    }
    case 'changes_required':
      return `${plural(row.sent, 'comment')} from your reviewer`
    case 'pending':
      return row.due_date ? `Due ${dayPhrase(row.due_date, today)}` : 'In review'
    case 'approved_with_changes':
      return `${plural(row.sent, 'small edit')}, no second review`
    case 'approved':
      return row.live_since ? `Live since ${shortDate(workspaceDate(row.live_since), today)}` : 'Ready to go live'
    case 'rejected':
      return row.decision_message ?? 'Rejected'
  }
}

function DateCell({ view, row, today }: { view: TableView; row: AdRow; today: string }) {
  if (view === 'queue' && row.due_date) {
    if (daysBetween(today, row.due_date) < 0) {
      return <span style={{ color: '#B42318', fontWeight: 600 }}>Overdue · {shortDate(row.due_date, today)}</span>
    }
    return <>{dayLabel(row.due_date, today)}</>
  }
  const value = view === 'history' ? row.closed_at : row.updated_at
  return <>{value ? dayLabel(value, today) : '–'}</>
}

/** The checkbox list in a column header, with Reset and Apply. */
function FilterList({
  options,
  props,
}: {
  options: Array<{ value: string; label: string }>
  props: FilterDropdownProps
}) {
  const { selectedKeys, setSelectedKeys, confirm, clearFilters } = props
  return (
    <div className="fp-filter" role="group" aria-label="Filter options">
      {options.map((option) => (
        <Checkbox
          key={option.value}
          checked={selectedKeys.includes(option.value)}
          onChange={(e) =>
            setSelectedKeys(
              e.target.checked ? [...selectedKeys, option.value] : selectedKeys.filter((k) => k !== option.value),
            )
          }
        >
          {option.label}
        </Checkbox>
      ))}
      <div className="fp-filter-footer">
        <Button
          type="text"
          size="small"
          onClick={() => {
            clearFilters?.()
            confirm()
          }}
        >
          Reset
        </Button>
        <Button type="primary" size="small" onClick={() => confirm()}>
          Apply
        </Button>
      </div>
    </div>
  )
}

function SortIcon({ sortOrder }: { sortOrder: 'ascend' | 'descend' | null | undefined }) {
  if (sortOrder === 'ascend') return <Icon name="arrowUp" size={13} strokeWidth={2.4} />
  if (sortOrder === 'descend') return <Icon name="arrowDown" size={13} strokeWidth={2.4} />
  return <Icon name="sort" size={13} strokeWidth={2.2} />
}

function pageItems(page: number, pages: number): Array<number | 'gap'> {
  if (pages <= 5) return Array.from({ length: pages }, (_, i) => i + 1)
  const items: Array<number | 'gap'> = []
  const window = [page - 1, page, page + 1].filter((p) => p > 1 && p < pages)
  if (page <= 3) window.splice(0, window.length, 2, 3, ...(page === 3 ? [4] : []))
  if (page >= pages - 2) window.splice(0, window.length, ...(page === pages - 2 ? [pages - 3] : []), pages - 2, pages - 1)
  items.push(1)
  if (window[0] > 2) items.push('gap')
  items.push(...window)
  if (window[window.length - 1] < pages - 1) items.push('gap')
  items.push(pages)
  return items
}

function Footer({
  page,
  pageSize,
  total,
  onPage,
  onPageSize,
}: {
  page: number
  pageSize: number
  total: number
  onPage: (page: number) => void
  onPageSize: (size: number) => void
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1
  const last = Math.min(total, page * pageSize)
  // Kept as typed text and checked on Enter, so "300" never silently becomes the last valid prefix.
  const [goTo, setGoTo] = useState('')
  const [goToError, setGoToError] = useState(false)
  const jump = () => {
    const target = Number(goTo.trim())
    if (!Number.isInteger(target) || target < 1 || target > pages) {
      setGoToError(true)
      return
    }
    setGoToError(false)
    setGoTo('')
    onPage(target)
  }
  return (
    <div className="fp-table-footer">
      <span aria-live="polite">
        Showing {first.toLocaleString('en-US')}–{last.toLocaleString('en-US')} of {total.toLocaleString('en-US')}
      </span>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16 }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          Rows per page
          <Select
            aria-label="Rows per page"
            value={pageSize}
            onChange={onPageSize}
            options={[10, 20].map((n) => ({ value: n, label: String(n) }))}
            style={{ width: 72 }}
          />
        </label>
        <nav aria-label="Pages" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button type="button" className="fp-page" aria-label="Previous page" disabled={page <= 1} onClick={() => onPage(page - 1)}>
            <Icon name="chevronLeft" size={16} />
          </button>
          {pageItems(page, pages).map((item, i) =>
            item === 'gap' ? (
              <span key={`gap-${i}`} aria-hidden="true" style={{ color: '#4A5468', padding: '0 2px' }}>
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                className="fp-page"
                aria-label={`Page ${item}`}
                aria-current={item === page ? 'page' : undefined}
                onClick={() => onPage(item)}
              >
                {item}
              </button>
            ),
          )}
          <button type="button" className="fp-page" aria-label="Next page" disabled={page >= pages} onClick={() => onPage(page + 1)}>
            <Icon name="chevronRight" size={16} />
          </button>
        </nav>
        {pages > 5 && (
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            Go to
            <Tooltip open={goToError} title={`Pick a page from 1 to ${pages.toLocaleString('en-US')}`} placement="top">
              <Input
                aria-label="Go to page"
                aria-invalid={goToError}
                aria-describedby={goToError ? 'go-to-error' : undefined}
                placeholder="Page"
                inputMode="numeric"
                status={goToError ? 'error' : undefined}
                value={goTo}
                onChange={(e) => {
                  setGoTo(e.target.value.replace(/[^0-9]/g, ''))
                  setGoToError(false)
                }}
                onPressEnter={jump}
                onBlur={() => setGoToError(false)}
                style={{ width: 72 }}
              />
            </Tooltip>
            {goToError && (
              <span id="go-to-error" className="fp-visually-hidden" role="alert">
                Pick a page from 1 to {pages}
              </span>
            )}
          </label>
        )}
      </div>
    </div>
  )
}

export function AdTable({
  view,
  onStats,
  filters,
  onFilters,
  page,
  onPage,
}: {
  view: TableView
  onStats?: (stats: Stat[]) => void
  /** Kept by the page, so its stat cards can set them too. */
  filters: Filters
  onFilters: (filters: Filters) => void
  page: number
  onPage: (page: number) => void
}) {
  const config = VIEWS[view]
  const { today, version } = useWorkspace()
  const [, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<{ key: 'name' | 'date' | 'check'; order: 'asc' | 'desc' }>({ key: 'date', order: config.defaultOrder })
  const [pageSize, setPageSize] = useState(10)
  const params = query({
    view,
    q,
    format: filters.format,
    product: filters.product,
    [config.statusKey]: filters.status,
    due: filters.due,
    sort: sort.key,
    order: sort.order,
    page,
    page_size: pageSize,
  })
  const { latest: data, error, loading } = useApi<AdList>(`/api/ads${params}`, version)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQ(search)
      onPage(1)
    }, 250)
    return () => window.clearTimeout(timer)
  }, [search]) // eslint-disable-line react-hooks/exhaustive-deps -- onPage is stable enough; only typing should restart this

  useEffect(() => {
    if (data) onStats?.(data.stats)
  }, [data, onStats])

  // antd draws the header filter buttons itself; give each one a name a screen reader can say.
  const cardRef = useRef<HTMLElement>(null)
  useEffect(() => {
    cardRef.current?.querySelectorAll<HTMLElement>('th').forEach((th) => {
      const trigger = th.querySelector<HTMLElement>('.ant-table-filter-trigger')
      const title = th.querySelector('.ant-table-column-title')?.textContent?.trim()
      if (trigger && title) trigger.setAttribute('aria-label', `Filter by ${title}`)
    })
  })

  const openDrawer = (id: number) =>
    setSearchParams((params) => {
      params.set('view', String(id))
      return params
    })

  const statusOptions = useMemo(() => {
    if (view === 'queue') return AUTO_CHECK_OPTIONS
    const statuses = data?.filters.statuses ?? []
    return STATUS_ORDER.filter((s) => statuses.includes(s)).map((s) => ({ value: s, label: STATUS_LABEL[s] }))
  }, [view, data?.filters.statuses])

  const filterColumn = (key: keyof Filters, title: string, options: Array<{ value: string; label: string }>) => ({
    title,
    key,
    filteredValue: filters[key].length ? filters[key] : null,
    filterIcon: () => <Icon name="filter" size={13} strokeWidth={2.2} />,
    filterDropdown: (props: FilterDropdownProps) => <FilterList options={options} props={props} />,
    onHeaderCell: () => ({ className: filters[key].length ? 'fp-th-active' : undefined }),
  })

  const columns: TableColumnsType<AdRow> = [
    {
      title: 'Ad',
      key: 'name',
      sorter: true,
      sortOrder: sort.key === 'name' ? (sort.order === 'asc' ? 'ascend' : 'descend') : null,
      sortDirections: ['ascend', 'descend', 'ascend'],
      sortIcon: ({ sortOrder }) => <SortIcon sortOrder={sortOrder} />,
      showSorterTooltip: false,
      onHeaderCell: () => ({ className: sort.key === 'name' ? 'fp-th-sorted fp-th-ad' : 'fp-th-ad' }),
      render: (_, row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <AdThumbnail content={row} />
          <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
              <button type="button" className="fp-ad-link" onClick={() => openDrawer(row.id)}>
                {row.name}
              </button>
              {row.current_version > 1 && <span className="fp-version-chip">v{row.current_version}</span>}
            </span>
            <span style={{ fontSize: 13, lineHeight: '18px', color: '#4A5468' }}>
              {view === 'my-ads' ? myAdsSubLine(row, today) : sourceLabel(row.source)}
            </span>
          </span>
        </div>
      ),
    },
    {
      ...filterColumn(
        'format',
        'Format',
        FORMAT_ORDER.filter((f) => data?.filters.formats.includes(f)).map((f) => ({ value: f, label: f })),
      ),
      width: 124,
      render: (_, row) => row.format,
    },
    {
      ...filterColumn(
        'product',
        'Product',
        (data?.filters.products ?? []).map((p) => ({ value: p, label: PRODUCT_LABEL[p] })),
      ),
      width: 124,
      render: (_, row) => PRODUCT_LABEL[row.product],
    },
    {
      ...filterColumn('status', config.statusTitle, statusOptions),
      // The Queue can also sort by the auto check: most serious first.
      ...(view === 'queue'
        ? {
            sorter: true,
            sortOrder: sort.key === 'check' ? (sort.order === 'asc' ? 'ascend' : 'descend') : null,
            sortDirections: ['descend', 'ascend', 'descend'] as Array<'ascend' | 'descend'>,
            sortIcon: ({ sortOrder }: { sortOrder: 'ascend' | 'descend' | null | undefined }) => <SortIcon sortOrder={sortOrder} />,
            showSorterTooltip: false,
            onHeaderCell: () => ({
              className: [filters.status.length ? 'fp-th-active' : '', sort.key === 'check' ? 'fp-th-sorted' : ''].join(' ').trim() || undefined,
            }),
          }
        : {}),
      width: 192,
      render: (_, row) =>
        view === 'queue' ? <AutoCheckTag critical={row.critical} caution={row.caution} /> : <StatusTag status={row.status} />,
    },
    {
      title: config.dateTitle,
      key: 'date',
      width: view === 'history' ? 120 : 96,
      sorter: true,
      sortOrder: sort.key === 'date' ? (sort.order === 'asc' ? 'ascend' : 'descend') : null,
      sortDirections: ['ascend', 'descend', 'ascend'],
      sortIcon: ({ sortOrder }) => <SortIcon sortOrder={sortOrder} />,
      showSorterTooltip: false,
      onHeaderCell: () => ({ className: sort.key === 'date' ? 'fp-th-sorted' : undefined }),
      render: (_, row) => <DateCell view={view} row={row} today={today} />,
    },
  ]

  if (view !== 'history') {
    columns.push({
      title: <span className="fp-visually-hidden">Action</span>,
      key: 'action',
      width: 144,
      align: 'right',
      render: (_, row) => {
        if (view === 'queue') {
          return (
            <a className="fp-work-button" href={`/review/${row.id}`} target="_blank" rel="noopener" aria-label={`Review ${row.name} (opens in a new tab)`}>
              Review
            </a>
          )
        }
        if (row.status === 'draft' || row.status === 'changes_required') {
          return (
            <a className="fp-work-button" href={`/ads/${row.id}/pre-check`} target="_blank" rel="noopener" aria-label={`Pre-check ${row.name} (opens in a new tab)`}>
              Pre-check
            </a>
          )
        }
        return null
      },
    })
  }

  const onChange: TableProps<AdRow>['onChange'] = (_pagination, tableFilters, sorter) => {
    const next: Filters = {
      format: (tableFilters.format as string[] | null) ?? [],
      product: (tableFilters.product as string[] | null) ?? [],
      status: (tableFilters.status as string[] | null) ?? [],
      due: filters.due,
    }
    if (JSON.stringify(next) !== JSON.stringify(filters)) onFilters(next)
    const s = sorter as SorterResult<AdRow>
    if (s.columnKey === 'name' || s.columnKey === 'date' || s.columnKey === 'status') {
      const key = s.columnKey === 'status' ? 'check' : s.columnKey
      const order = s.order === 'ascend' ? 'asc' : s.order === 'descend' ? 'desc' : null
      if (order && (key !== sort.key || order !== sort.order)) {
        setSort({ key, order })
        onPage(1)
      }
    }
  }

  const filtered = Boolean(q.trim()) || Object.values(filters).some((values) => values.length > 0)
  let empty: ReactNode = config.empty
  if (error && !data) empty = "Couldn't load ads. Refresh the page to try again."
  else if (filtered) empty = 'No ads match your search.'

  return (
    <section ref={cardRef} className="fp-table-card" aria-label={`${config.statusTitle === 'Decision' ? 'Approved ads' : 'Ads'}`}>
      <div className="fp-table-search">
        <Input
          aria-label="Search ads"
          placeholder="Search ads"
          allowClear
          prefix={<Icon name="search" size={16} color="#4A5468" />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: '0 1 300px', minWidth: 200 }}
        />
      </div>
      <Table<AdRow>
        rowKey="id"
        columns={columns}
        dataSource={data?.rows ?? []}
        loading={loading && !data}
        pagination={false}
        onChange={onChange}
        locale={{ emptyText: loading && !data ? ' ' : <div className="fp-table-empty">{empty}</div> }}
        tableLayout="fixed"
        // Below ~1100px the columns keep their widths and the table scrolls inside its card.
        scroll={{ x: 880 }}
      />
      {data && data.total > 0 && (
        <Footer
          page={page}
          pageSize={pageSize}
          total={data.total}
          onPage={onPage}
          onPageSize={(size) => {
            setPageSize(size)
            onPage(1)
          }}
        />
      )}
    </section>
  )
}

/** Stat cards that filter the table below to exactly the rows they count. The rest are plain numbers. */
const STAT_ACTIONS: Record<TableView, Record<string, Partial<Filters>>> = {
  'my-ads': {
    attention: { status: ['draft', 'changes_required'] },
    in_review: { status: ['pending'] },
    approved: { status: ['approved', 'approved_with_changes'] },
  },
  queue: {
    due_today: { due: ['today'] },
  },
  history: {},
}

export function TablePage({ title, view, action }: { title: string; view: TableView; action?: ReactNode }) {
  const [stats, setStats] = useState<Stat[] | null>(null)
  const [filters, setFilters] = useState<Filters>(NO_FILTERS)
  const [page, setPage] = useState(1)
  const applyFilters = (next: Filters) => {
    setFilters(next)
    setPage(1)
  }

  const actions: Record<string, StatAction> = {}
  for (const [key, action] of Object.entries(STAT_ACTIONS[view])) {
    const preset = { ...NO_FILTERS, ...action }
    // A card is on while the table shows exactly its rows.
    const active = JSON.stringify(preset) === JSON.stringify(filters)
    actions[key] = { active, onClick: () => applyFilters(active ? NO_FILTERS : preset) }
  }

  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <h1 className="fp-page-title">{title}</h1>
        {action}
      </div>
      {stats ? <StatCards stats={stats} actions={actions} /> : <div style={{ height: 84 }} aria-hidden="true" />}
      <AdTable view={view} onStats={setStats} filters={filters} onFilters={applyFilters} page={page} onPage={setPage} />
    </>
  )
}
