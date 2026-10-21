import { App as AntApp, Skeleton } from 'antd'
import { useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AdView, isImageTemplate } from '../ads/AdView'
import { useWorkspace } from '../app/workspace'
import { Icon } from '../components/Icon'
import { StatusTag, Tag } from '../components/StatusTag'
import { CountTags, GoodList, Group, markersFor, numberFindings, revealCard, revealPin } from '../findings/parts'
import { api, ApiError } from '../lib/api'
import { dayPhrase } from '../lib/dates'
import { sentText, type AdDetail } from '../lib/detail'
import { PRODUCT_LABEL, sourceLabel } from '../lib/labels'
import { useApi } from '../lib/useApi'
import { DecisionBar, type Decision } from '../review/DecisionBar'
import { DismissedCard, ReviewSuggestionCard, type SuggestionActions } from '../review/SuggestionCards'
import { CompareVersions, WhatChanged, compareMarkers, openItems } from '../review/WhatChanged'
import { compareVersions } from '../review/whatChanged'
import { YourFindings } from '../review/YourFindings'

const DONE_LABEL: Record<Decision, string> = {
  approved: 'Approved',
  approved_with_changes: 'Approved with changes',
  changes_required: 'Changes requested',
  rejected: 'Rejected',
}

interface DecisionResult {
  undo: string
  next: number | null
  status: Decision
}

export function ReviewPage() {
  const params = useParams()
  const adId = Number(params.id)
  const { version } = useWorkspace()
  const [reload, setReload] = useState(0)
  const [cleared, setCleared] = useState<number | null>(null)
  const { latest, error } = useApi<AdDetail>(`/api/ads/${adId}`, version * 1000 + reload)
  const detail = latest && latest.ad.id === adId ? latest : null

  if (cleared === adId) return <QueueCleared />
  if (error instanceof ApiError && error.status === 404) {
    return (
      <>
        <BackLink />
        <h1 className="fp-page-title">Ad not found</h1>
        <p style={{ margin: 0 }}>This ad doesn't exist anymore. The sample data may have been reset.</p>
      </>
    )
  }
  if (!detail) {
    return (
      <>
        <BackLink />
        <Skeleton active paragraph={{ rows: 10 }} />
      </>
    )
  }
  return <ReviewScreen key={adId} detail={detail} reload={() => setReload((r) => r + 1)} onCleared={() => setCleared(adId)} />
}

function BackLink() {
  return (
    <Link to="/queue" className="fp-back-link">
      <Icon name="chevronLeft" size={16} strokeWidth={2.2} />
      Queue
    </Link>
  )
}

function QueueCleared() {
  return (
    <>
      <BackLink />
      <div className="fp-card" style={{ padding: '64px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
        <span aria-hidden="true" style={{ width: 56, height: 56, borderRadius: 16, background: '#ECFDF3', color: '#067647', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="checkCircle" size={28} />
        </span>
        <h1 className="fp-page-title" style={{ fontSize: 24, lineHeight: '32px' }}>
          Queue cleared. Go get a snack.
        </h1>
        <p style={{ margin: 0, fontSize: 15, color: '#4A5468' }}>Nothing is waiting for a decision.</p>
        <Link to="/history">See what you approved in History</Link>
      </div>
    </>
  )
}

function ReviewScreen({ detail, reload, onCleared }: { detail: AdDetail; reload: () => void; onCleared: () => void }) {
  const { ad, current, rules } = detail
  const navigate = useNavigate()
  const { message } = AntApp.useApp()
  const { today, refresh } = useWorkspace()
  const [selected, setSelected] = useState<number | null>(null)
  const [open, setOpen] = useState({ critical: true, caution: true, good: false, dismissed: false })
  const [busy, setBusy] = useState(false)
  const pending = ad.status === 'pending'
  const readOnly = !pending
  const resubmission = ad.current_version > 1
  const textTemplate = !isImageTemplate(current.template)

  const numbered = useMemo(() => numberFindings(current.findings, rules), [current.findings, rules])
  const layerIds = useMemo(() => new Set(current.layers.map((l) => l.id)), [current.layers])
  const comparison = useMemo(() => (resubmission ? compareVersions(detail) : null), [resubmission, detail])
  const changed = useMemo(() => (comparison ? openItems(comparison, rules) : null), [comparison, rules])
  const markers = useMemo(
    () =>
      comparison && changed
        ? compareMarkers(comparison, [...changed.stillOpen, ...changed.added], layerIds)
        : markersFor(numbered, textTemplate, layerIds),
    [comparison, changed, numbered, textTemplate, layerIds],
  )
  const active = numbered.filter((x) => x.finding.state !== 'dismissed')
  const critical = active.filter((x) => x.finding.severity === 'critical')
  const caution = active.filter((x) => x.finding.severity === 'caution')
  const dismissed = numbered.filter((x) => x.finding.state === 'dismissed')
  const goodIds = current.check?.good_rule_ids ?? []
  const reviewerFindings = current.findings.filter((f) => f.origin === 'reviewer')
  const sendableAuto = changed ? [...changed.stillOpen, ...changed.added] : active
  const sendable = [
    ...sendableAuto.filter((x) => x.finding.state === 'kept' || x.finding.state === 'edited').map((x) => sentText(x.finding)),
    ...reviewerFindings.map((f) => f.text),
  ]

  const run = async (work: () => Promise<unknown>) => {
    try {
      await work()
      reload()
    } catch (e) {
      message.error(e instanceof ApiError ? e.message : "Couldn't save that. Try again.")
      throw e
    }
  }

  const findingAction = (id: number, body: Record<string, string>) => run(() => api.post(`/api/findings/${id}`, body))

  const actions: SuggestionActions = {
    keep: (id) => void findingAction(id, { action: 'keep' }).catch(() => undefined),
    unkeep: (id) => void findingAction(id, { action: 'unkeep' }).catch(() => undefined),
    edit: (id, text) => findingAction(id, { action: 'edit', text }),
    dismiss: (id, reason) => findingAction(id, { action: 'dismiss', reason }),
    restore: (id) => void findingAction(id, { action: 'restore' }).catch(() => undefined),
  }

  const selectFromAd = (n: number) => {
    setSelected(n)
    const item = comparison ? undefined : numbered.find((x) => x.n === n)
    if (item?.finding.severity === 'critical') setOpen((o) => ({ ...o, critical: true }))
    if (item?.finding.severity === 'caution') setOpen((o) => ({ ...o, caution: true }))
    revealCard(n)
  }
  const selectFromCard = (n: number) => {
    setSelected(n)
    revealPin(n)
  }

  const decide = async (decision: Decision, text?: string) => {
    setBusy(true)
    try {
      const result = await api.post<DecisionResult>(`/api/ads/${ad.id}/decision`, { status: decision, message: text })
      refresh()
      const undo = async () => {
        message.destroy('decision')
        try {
          await api.post(`/api/undo/${result.undo}`)
          message.success('Decision undone')
          refresh()
          navigate(`/review/${ad.id}`)
          reload()
        } catch (e) {
          message.error(e instanceof ApiError ? e.message : "Couldn't undo that.")
        }
      }
      message.open({
        key: 'decision',
        duration: 5,
        content: (
          <span className="fp-toast">
            {DONE_LABEL[decision]} ·{' '}
            <button type="button" className="fp-toast-undo" onClick={undo}>
              Undo
            </button>
          </span>
        ),
      })
      if (result.next) navigate(`/review/${result.next}`)
      else onCleared()
    } catch (e) {
      message.error(e instanceof ApiError ? e.message : "Couldn't save your decision. Try again.")
    } finally {
      setBusy(false)
    }
  }

  const meta = [ad.format, PRODUCT_LABEL[ad.product], sourceLabel(ad.source)]
  if (resubmission && current.submitted_at) meta.push(`Resubmitted ${dayPhrase(current.submitted_at, today)}`)

  let groups: ReactNode
  if (comparison && changed) {
    groups = (
      <WhatChanged
        comparison={comparison}
        stillOpen={changed.stillOpen}
        added={changed.added}
        selected={selected}
        onSelect={selectFromCard}
        actions={actions}
        readOnly={readOnly}
      />
    )
  } else {
    groups = (
      <section className="fp-card fp-panel" aria-labelledby="auto-suggestions">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h2 id="auto-suggestions" className="fp-panel-title">
            Auto suggestions
          </h2>
          <CountTags critical={critical.length} caution={caution.length} good={goodIds.length} checksRun={current.check?.checks_run ?? 0} />
        </div>
        {critical.length > 0 && (
          <Group id="critical" kind="critical" title={`Critical · ${critical.length}`} open={open.critical} onToggle={() => setOpen((o) => ({ ...o, critical: !o.critical }))}>
            {critical.map((item) => (
              <ReviewSuggestionCard key={item.finding.id} item={item} selected={selected === item.n} onSelect={() => selectFromCard(item.n)} actions={actions} readOnly={readOnly} />
            ))}
          </Group>
        )}
        {caution.length > 0 && (
          <Group id="caution" kind="caution" title={`Caution · ${caution.length}`} open={open.caution} onToggle={() => setOpen((o) => ({ ...o, caution: !o.caution }))}>
            {caution.map((item) => (
              <ReviewSuggestionCard key={item.finding.id} item={item} selected={selected === item.n} onSelect={() => selectFromCard(item.n)} actions={actions} readOnly={readOnly} />
            ))}
          </Group>
        )}
        <Group id="good" kind="good" title={`Good · ${goodIds.length}`} open={open.good} onToggle={() => setOpen((o) => ({ ...o, good: !o.good }))}>
          <GoodList ruleIds={goodIds} rules={rules} />
        </Group>
        <Group id="dismissed" kind="dismissed" title={`Dismissed · ${dismissed.length}`} open={open.dismissed} onToggle={() => setOpen((o) => ({ ...o, dismissed: !o.dismissed }))}>
          {dismissed.length === 0 ? (
            <p style={{ margin: 0, fontSize: 14, color: '#4A5468' }}>Nothing dismissed.</p>
          ) : (
            dismissed.map((item) => <DismissedCard key={item.finding.id} item={item} readOnly={readOnly} onRestore={() => actions.restore(item.finding.id)} />)
          )}
        </Group>
      </section>
    )
  }

  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
          <BackLink />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h1 className="fp-page-title">{ad.name}</h1>
            {resubmission && <span className="fp-version-chip fp-version-chip-lg">v{ad.current_version}</span>}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
            {pending && ad.due_date ? (
              <Tag tone="neutral" icon={<Icon name="calendar" size={13} strokeWidth={2.2} />} style={{ padding: '3px 10px', gap: 6 }}>
                Due {dayPhrase(ad.due_date, today)}
              </Tag>
            ) : (
              <StatusTag status={ad.status} />
            )}
            <span style={{ fontSize: 13, lineHeight: '18px', color: '#4A5468' }}>{meta.join(' · ')}</span>
          </div>
        </div>
        {detail.queue && (
          <nav aria-label="Queue position" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {detail.queue.previous ? (
              <Link className="fp-pager" to={`/review/${detail.queue.previous}`}>
                <Icon name="chevronLeft" size={16} />
                Previous
              </Link>
            ) : (
              <span className="fp-pager" aria-disabled="true">
                <Icon name="chevronLeft" size={16} />
                Previous
              </span>
            )}
            <span style={{ fontSize: 13, color: '#4A5468' }}>
              {detail.queue.position} of {detail.queue.total}
            </span>
            {detail.queue.next ? (
              <Link className="fp-pager" to={`/review/${detail.queue.next}`}>
                Next
                <Icon name="chevronRight" size={16} />
              </Link>
            ) : (
              <span className="fp-pager" aria-disabled="true">
                Next
                <Icon name="chevronRight" size={16} />
              </span>
            )}
          </nav>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start' }}>
        <div style={{ flex: '1 1 420px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 24 }}>
          {comparison ? (
            <CompareVersions comparison={comparison} markers={markers} selected={selected} onSelect={selectFromAd} />
          ) : (
            <section className="fp-card" aria-label="The ad" style={{ padding: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <AdView content={current} markers={markers} selected={selected} onSelect={selectFromAd} />
            </section>
          )}
          <YourFindings
            findings={reviewerFindings}
            readOnly={readOnly}
            onAdd={(text) => run(() => api.post(`/api/ads/${ad.id}/findings`, { text }))}
            onEdit={(id, text) => run(() => api.put(`/api/reviewer-findings/${id}`, { text }))}
            onDelete={(id) => run(() => api.del(`/api/reviewer-findings/${id}`))}
          />
        </div>
        <div style={{ flex: '1 1 420px', minWidth: 0 }}>{groups}</div>
      </div>

      {pending && (
        <DecisionBar
          busy={busy}
          onDecide={decide}
          needsChangeText={sendable.length === 0}
          defaultMessage={sendable.map((t) => `- ${t}`).join('\n')}
        />
      )}
    </>
  )
}
