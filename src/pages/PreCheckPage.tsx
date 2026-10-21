import { Alert, App as AntApp, Button, Input, Skeleton, Tooltip } from 'antd'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AdView, isImageTemplate } from '../ads/AdView'
import { useWorkspace } from '../app/workspace'
import { FilledIcon, Icon } from '../components/Icon'
import { Pager } from '../components/Pager'
import { StatusTag } from '../components/StatusTag'
import {
  AutoTitle,
  CountTags,
  FixBox,
  GoodList,
  NoteBox,
  Group,
  NumberBadge,
  ReviewerPin,
  RuleLine,
  cardStyle,
  markersFor,
  numberFindings,
  revealCard,
  revealPin,
  reviewerMarkers,
  reviewerN,
  type Numbered,
} from '../findings/parts'
import { api, ApiError } from '../lib/api'
import { dayPhrase } from '../lib/dates'
import { sentText, type AdDetail, type Finding, type Version } from '../lib/detail'
import { PRODUCT_LABEL } from '../lib/labels'
import type { Layer } from '../lib/types'
import { useApi } from '../lib/useApi'

const UNAVAILABLE = 'Auto check unavailable right now. You can still submit as usual.'

interface CheckResult {
  status: 'ok' | 'unavailable' | 'error'
}

export function PreCheckPage() {
  const adId = Number(useParams().id)
  const { version } = useWorkspace()
  const [reload, setReload] = useState(0)
  const { latest, error } = useApi<AdDetail>(`/api/ads/${adId}`, version * 1000 + reload)
  const detail = latest && latest.ad.id === adId ? latest : null

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
  return <PreCheckScreen key={adId} detail={detail} reload={() => setReload((r) => r + 1)} />
}

function BackLink() {
  return (
    <Link to="/my-ads" className="fp-back-link">
      <Icon name="chevronLeft" size={16} strokeWidth={2.2} />
      My ads
    </Link>
  )
}

/** The smallest text size that reads on screen, as the server checks it. */
const READABLE_SIZE = 11

/** How Swap stands for one suggestion, given the layer's current text. */
function wordingState(finding: Numbered['finding'], layerText: string | undefined): 'none' | 'ready' | 'used' | 'changed' {
  if (finding.fix_label !== 'Suggested wording' || !finding.quote || !finding.suggested_fix || layerText === undefined) return 'none'
  if (layerText.includes(finding.suggested_fix)) return 'used'
  return layerText.includes(finding.quote) ? 'ready' : 'changed'
}

function PreCheckCard({
  item,
  selected,
  onSelect,
  onNote,
  editable,
  layerText,
  onUseWording,
  onEditOnAd,
  onResolve,
  size,
  onMakeReadable,
  headline,
}: {
  item: Numbered
  selected: boolean
  onSelect: () => void
  onNote: (note: string) => void
  editable: boolean
  layerText: string | undefined
  onUseWording: () => void
  onEditOnAd: () => void
  onResolve: (resolved: boolean) => void
  /** Text too small to read can be made readable in one click; 'done' once it is. */
  size: 'none' | 'ready' | 'done'
  onMakeReadable: () => void
  /** The reviewer's wording, when they kept or edited this suggestion. */
  headline?: string
}) {
  const { n, finding, rule } = item
  const [noteOpen, setNoteOpen] = useState(Boolean(finding.submitter_note))
  const [note, setNote] = useState(finding.submitter_note ?? '')
  const saved = useRef(finding.submitter_note ?? '')
  const resolved = finding.resolved_by_submitter
  const wording = wordingState(finding, layerText)

  // Notes save as you type, a moment after you stop.
  useEffect(() => {
    if (note === saved.current) return
    const timer = window.setTimeout(() => {
      saved.current = note
      onNote(note)
    }, 600)
    return () => window.clearTimeout(timer)
  }, [note, onNote])

  return (
    <article
      id={`finding-${n}`}
      data-finding={n}
      data-resolved={resolved || undefined}
      style={{ ...cardStyle(selected), position: 'relative', ...(resolved ? { background: '#FBFCFD' } : {}) }}
      onClick={onSelect}
      aria-label={`Suggestion ${n}`}
    >
      <NumberBadge n={n} selected={selected} onSelect={onSelect} tone={resolved ? 'resolved' : 'default'} />
      {editable && (
        // Resolve like a comment: a check in the corner. Swap resolves on its own; this is for everything else.
        <Tooltip title={resolved ? 'Resolved. Click to reopen.' : 'Mark resolved'}>
          <button
            type="button"
            className="fp-resolve-check"
            data-on={resolved || undefined}
            aria-label={resolved ? 'Reopen' : 'Mark resolved'}
            aria-pressed={resolved}
            onClick={(e) => {
              e.stopPropagation()
              onResolve(!resolved)
            }}
          >
            <Icon name="check" size={16} strokeWidth={2.6} />
          </button>
        </Tooltip>
      )}
      <div style={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10, paddingRight: editable ? 28 : 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {resolved && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, lineHeight: '16px', fontWeight: 700, color: '#067647' }}>
              <FilledIcon name="good" size={14} />
              Resolved by you
            </span>
          )}
          <p style={{ margin: 0, fontSize: 15, lineHeight: '22px', fontWeight: 600, color: resolved ? '#4A5468' : undefined }}>{headline ?? finding.text}</p>
          <RuleLine rule={rule} />
        </div>
        {finding.suggested_fix && !resolved && (
          <FixBox
            label={finding.fix_label ?? 'Suggested wording'}
            text={finding.suggested_fix}
            action={
              editable &&
              wording !== 'none' && (
                <Tooltip
                  title={
                    wording === 'changed'
                      ? 'The flagged words have changed on the ad. Edit it there instead.'
                      : wording === 'used'
                        ? 'Swapped in on the ad'
                        : 'Swap it in on the ad'
                  }
                >
                  <button
                    type="button"
                    className="fp-swap"
                    aria-label={wording === 'used' ? 'Swapped' : 'Swap the flagged words for this wording'}
                    disabled={wording !== 'ready'}
                    onClick={(e) => {
                      e.stopPropagation()
                      onUseWording()
                    }}
                  >
                    <Icon name={wording === 'used' ? 'check' : 'swap'} size={14} strokeWidth={wording === 'used' ? 2.5 : 2} />
                    {wording === 'used' ? 'Swapped' : 'Swap'}
                  </button>
                </Tooltip>
              )
            }
          />
        )}
        {size !== 'none' && !resolved && (
          <FixBox
            label="Suggested size"
            text={`${READABLE_SIZE}px, the smallest size that reads on screen`}
            copyable={false}
            action={
              editable && (
                <button
                  type="button"
                  className="fp-swap"
                  aria-label={size === 'done' ? 'Swapped' : `Swap in ${READABLE_SIZE}px`}
                  disabled={size === 'done'}
                  onClick={(e) => {
                    e.stopPropagation()
                    onMakeReadable()
                  }}
                >
                  <Icon name={size === 'done' ? 'check' : 'swap'} size={14} strokeWidth={size === 'done' ? 2.5 : 2} />
                  {size === 'done' ? 'Swapped' : 'Swap'}
                </button>
              )
            }
          />
        )}
        {editable && (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4, margin: '2px 0 0 -8px', paddingRight: 8 }} onClick={(e) => e.stopPropagation()}>
            {!resolved && finding.layer_id && layerText !== undefined && (
              <button type="button" className="fp-quiet fp-small-button fp-card-link" onClick={onEditOnAd}>
                Edit on ad
              </button>
            )}
            <button type="button" className="fp-quiet fp-small-button fp-card-link" aria-expanded={noteOpen} onClick={() => setNoteOpen((o) => !o)}>
              Add a note
            </button>
          </div>
        )}
        {noteOpen && (
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 600, color: '#4A5468' }} onClick={(e) => e.stopPropagation()}>
            Note to your reviewer (optional)
            <Input.TextArea
              rows={2}
              value={note}
              disabled={!editable}
              onChange={(e) => setNote(e.target.value)}
              onBlur={() => {
                if (note !== saved.current) {
                  saved.current = note
                  onNote(note)
                }
              }}
              placeholder="Example: Legal approved this wording on Oct 2."
              style={{ fontSize: 14, fontWeight: 400 }}
            />
          </label>
        )}
      </div>
    </article>
  )
}

/** What the reviewer sent back, once: their message, the suggestions they kept, and their own findings. */
function FromReviewer({
  detail,
  kept,
  renderKept,
  pinnedIds,
  selected,
  onSelect,
  onEditOnAd,
}: {
  detail: AdDetail
  /** Auto suggestions the reviewer kept, as they are on the copy being edited. */
  kept: Numbered[]
  renderKept: (item: Numbered) => ReactNode
  /** Reviewer findings whose quoted words are pinned on the ad. */
  pinnedIds: Set<number>
  selected: number | null
  onSelect: (n: number) => void
  onEditOnAd: (layerId: string) => void
}) {
  const sent = detail.current.findings.filter((f) => f.sent_to_submitter)
  const own = sent.filter((f) => f.origin === 'reviewer')
  const decision = detail.events.find((e) => e.type === 'decision')
  const note = typeof decision?.detail.message === 'string' ? decision.detail.message : null
  // The message starts as a list of what was sent; show it only when the reviewer wrote more than that.
  const listed = new Set(sent.map((f) => sentText(f).trim()))
  const lines = (note ?? '').split('\n').map((l) => l.replace(/^\s*-\s*/, '').trim()).filter(Boolean)
  const message = note && !lines.every((l) => listed.has(l)) ? note : null
  if (!message && !kept.length && !own.length) return null
  const count = kept.length + own.length
  return (
    <section className="fp-card fp-panel" aria-labelledby="from-reviewer">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <h2 id="from-reviewer" className="fp-panel-title">
          From your reviewer
        </h2>
        {count > 0 && (
          <span style={{ fontSize: 12, lineHeight: '16px', fontWeight: 700, color: '#FFFFFF', background: '#0F766E', borderRadius: 9999, padding: '2px 9px' }}>
            {count}
          </span>
        )}
      </div>
      {message && <NoteBox label="Message" text={message} />}
      {kept.map((item) => renderKept(item))}
      {own.map((finding) => {
        const pinned = pinnedIds.has(finding.id)
        const n = reviewerN(finding)
        return (
          <div
            key={finding.id}
            id={`finding-${n}`}
            className="fp-sent-card"
            onClick={pinned ? () => onSelect(n) : undefined}
            style={pinned ? { cursor: 'pointer', ...(selected === n ? { borderColor: '#0F766E', boxShadow: '0 0 0 1px #0F766E' } : {}) } : undefined}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              {pinned && <ReviewerPin selected={selected === n} onSelect={() => onSelect(n)} />}
              <p style={{ margin: 0, fontSize: 15, lineHeight: '22px', fontWeight: 500 }}>{finding.text}</p>
            </div>
            {pinned && finding.layer_id && (
              <div style={{ marginLeft: -8 }} onClick={(e) => e.stopPropagation()}>
                <button type="button" className="fp-quiet fp-small-button fp-card-link" onClick={() => onEditOnAd(finding.layer_id!)}>
                  Edit on ad
                </button>
              </div>
            )}
          </div>
        )
      })}
    </section>
  )
}

function PreCheckScreen({ detail, reload }: { detail: AdDetail; reload: () => void }) {
  const { ad, rules } = detail
  const navigate = useNavigate()
  const { message } = AntApp.useApp()
  const { refresh, today } = useWorkspace()
  const editable = ad.status === 'draft' || ad.status === 'changes_required'
  const working: Version = (editable && detail.draft) || detail.current
  // Edits are marked against the copy the marketer started from.
  const [baseline] = useState<Layer[]>(() => (ad.status === 'changes_required' ? detail.current.layers : working.layers))
  const [selected, setSelected] = useState<number | null>(null)
  const [open, setOpen] = useState({ critical: true, caution: true, resolved: true, good: false })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [unavailable, setUnavailable] = useState(false)

  const textTemplate = !isImageTemplate(working.template)
  const numbered = useMemo(() => numberFindings(working.findings, rules), [working.findings, rules])
  const layerIds = useMemo(() => new Set(working.layers.map((l) => l.id)), [working.layers])
  // A suggestion the marketer marked resolved shows a green pin and moves to its own group.
  // The reviewer's findings that quote words still on the copy being edited get a pin too.
  const sentFindings = detail.current.findings
  const fromReviewer = useMemo(
    () => (ad.status === 'changes_required' ? reviewerMarkers(sentFindings.filter((f) => f.sent_to_submitter), working.layers) : []),
    [ad.status, sentFindings, working.layers],
  )
  const pinnedIds = useMemo(() => new Set(fromReviewer.map((m) => -m.n)), [fromReviewer])
  const markers = useMemo(
    () => [
      ...markersFor(numbered, textTemplate, layerIds).map((m) =>
        numbered.find((x) => x.n === m.n)?.finding.resolved_by_submitter ? { ...m, tone: 'resolved' as const } : m,
      ),
      ...fromReviewer,
    ],
    [numbered, textTemplate, layerIds, fromReviewer],
  )
  // Suggestions the reviewer kept move up into "From your reviewer"; Auto suggestions keeps the rest.
  const keptByReviewer = useMemo(() => {
    if (ad.status !== 'changes_required') return new Map<string, Finding>()
    const sent = sentFindings.filter((f) => f.origin === 'auto' && f.sent_to_submitter)
    return new Map(sent.map((f) => [`${f.rule_id}|${f.layer_id ?? '-'}`, f]))
  }, [ad.status, sentFindings])
  const keptKey = (item: Numbered) => `${item.finding.rule_id}|${item.finding.layer_id ?? '-'}`
  const kept = numbered.filter((x) => keptByReviewer.has(keptKey(x)))
  const rest = numbered.filter((x) => !keptByReviewer.has(keptKey(x)))
  const unresolved = rest.filter((x) => !x.finding.resolved_by_submitter)
  const resolvedItems = rest.filter((x) => x.finding.resolved_by_submitter)
  const critical = unresolved.filter((x) => x.finding.severity === 'critical')
  const caution = unresolved.filter((x) => x.finding.severity === 'caution')
  const layerText = (layerId: string | null) => (layerId ? working.layers.find((l) => l.id === layerId)?.text : undefined)
  const goodIds = working.check?.good_rule_ids ?? []
  const editedIds = useMemo(() => {
    const before = new Map(baseline.map((l) => [l.id, l]))
    return new Set(
      working.layers.filter((l) => before.get(l.id)?.text !== l.text || before.get(l.id)?.style?.fontSize !== l.style?.fontSize).map((l) => l.id),
    )
  }, [working.layers, baseline])

  /** Save the copy; `applied` is the suggestion this edit carries out, which then counts as resolved. */
  const saveLayer = async (layerId: string, text: string, fontSize?: number, applied?: Numbered) => {
    const layers = working.layers.map((l) =>
      l.id === layerId ? { ...l, text, ...(fontSize ? { style: { ...l.style, fontSize } } : {}) } : l,
    )
    const resolve = applied ? { rule_id: applied.finding.rule_id, layer_id: applied.finding.layer_id } : undefined
    try {
      await api.put(`/api/ads/${ad.id}/copy`, { layers, resolve })
      reload()
    } catch (e) {
      message.error(e instanceof ApiError ? e.message : "Couldn't save your edit. Try again.")
    }
  }

  const applyWording = async (item: Numbered) => {
    const { layer_id, quote, suggested_fix } = item.finding
    const text = layerText(layer_id)
    if (!layer_id || !quote || !suggested_fix || text === undefined || !text.includes(quote)) return
    await saveLayer(layer_id, text.replace(quote, suggested_fix), undefined, item)
    message.success('Swapped in on the ad, and marked resolved.')
  }

  /** A suggestion about text too small to read can be fixed here: the size is part of the ad's data. */
  const sizeState = (item: Numbered): 'none' | 'ready' | 'done' => {
    const layer = working.layers.find((l) => l.id === item.finding.layer_id)
    const before = baseline.find((l) => l.id === item.finding.layer_id)
    if (item.finding.rule_id !== 'clear-and-conspicuous' || !layer) return 'none'
    const size = layer.style?.fontSize ?? READABLE_SIZE
    if (size < READABLE_SIZE) return 'ready'
    return (before?.style?.fontSize ?? READABLE_SIZE) < READABLE_SIZE ? 'done' : 'none'
  }

  const makeReadable = async (item: Numbered) => {
    const layer = working.layers.find((l) => l.id === item.finding.layer_id)
    if (!layer) return
    await saveLayer(layer.id, layer.text, READABLE_SIZE, item)
    message.success(`Swapped in ${READABLE_SIZE}px, and marked resolved.`)
  }

  const cardProps = (item: Numbered) => ({
    item,
    selected: selected === item.n,
    onSelect: () => selectFromCard(item.n),
    onNote: (note: string) => saveNote(item.finding.id, note),
    editable,
    layerText: layerText(item.finding.layer_id),
    onUseWording: () => applyWording(item),
    onEditOnAd: () => editOnAd(item.finding.layer_id),
    onResolve: (r: boolean) => setResolved(item.finding.id, r),
    size: sizeState(item),
    onMakeReadable: () => makeReadable(item),
  })

  const editOnAd = (layerId: string | null) => {
    if (!layerId) return
    setEditingId(layerId)
    window.setTimeout(() => document.querySelector(`[data-layer="${layerId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0)
  }

  const setResolved = async (findingId: number, resolved: boolean) => {
    try {
      await api.post(`/api/findings/${findingId}`, { action: resolved ? 'resolve' : 'reopen' })
      reload()
    } catch {
      message.error("Couldn't save that. Try again.")
    }
  }

  const saveNote = async (findingId: number, note: string) => {
    try {
      await api.post(`/api/findings/${findingId}`, { action: 'note', note })
    } catch {
      message.error("Couldn't save your note. Try again.")
    }
  }

  const recheck = async () => {
    setChecking(true)
    setUnavailable(false)
    try {
      // An unsubmitted copy of a returned ad is saved first, so the check sees the edits.
      const target = working.id
      const result = await api.post<CheckResult>('/api/check', { adVersionId: target, context: 're-check' })
      if (result.status !== 'ok') setUnavailable(true)
      reload()
    } catch {
      setUnavailable(true)
    } finally {
      setChecking(false)
    }
  }

  const submit = async () => {
    setSubmitting(true)
    try {
      const result = await api.post<{ due_date: string; version: number }>(`/api/ads/${ad.id}/submit`)
      refresh()
      message.success(`Sent for review${result.version > 1 ? ` as version ${result.version}` : ''}. You'll hear back by ${dayPhrase(result.due_date, today)}.`)
      navigate('/my-ads')
    } catch (e) {
      message.error(e instanceof ApiError ? e.message : "Couldn't submit. Try again.")
    } finally {
      setSubmitting(false)
    }
  }

  const selectFromAd = (n: number) => {
    setSelected(n)
    const item = numbered.find((x) => x.n === n)
    if (item?.finding.resolved_by_submitter) setOpen((o) => ({ ...o, resolved: true }))
    else if (item?.finding.severity === 'critical') setOpen((o) => ({ ...o, critical: true }))
    else if (item?.finding.severity === 'caution') setOpen((o) => ({ ...o, caution: true }))
    revealCard(n)
  }
  const selectFromCard = (n: number) => {
    setSelected(n)
    revealPin(n)
  }

  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <BackLink />
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
            <h1 className="fp-page-title">{ad.name}</h1>
            <StatusTag status={ad.status} />
          </div>
          <span style={{ fontSize: 14, lineHeight: '20px', color: '#4A5468' }}>
            {ad.format} · {PRODUCT_LABEL[ad.product]}
          </span>
        </div>
        {detail.attention && (
          <Pager at={detail.attention} label="Ads that need your attention" href={(id) => `/ads/${id}/pre-check`} />
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start' }}>
        {/* The ad stays in view while the suggestions scroll; a tall page or email scrolls inside it. */}
        <section
          className="fp-card"
          aria-label="Your ad"
          style={{
            flex: '1 1 400px',
            minWidth: 0,
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            position: 'sticky',
            top: 24,
            maxHeight: 'calc(100vh - 48px)',
            overflowY: 'auto',
          }}
        >
          <AdView
            content={working}
            markers={markers}
            selected={selected}
            onSelect={selectFromAd}
            edit={editable ? { editedIds, onChange: saveLayer, editingId, setEditing: setEditingId } : undefined}
          />
          {editable && (
            <p style={{ margin: 0, fontSize: 13, lineHeight: '18px', color: '#4A5468', textAlign: 'center' }}>
              Click any text on the ad to edit it, then Re-check.
            </p>
          )}
        </section>

        <div style={{ flex: '1 1 420px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 24 }}>
          {ad.status === 'changes_required' && (
            <FromReviewer
              detail={detail}
              kept={kept}
              renderKept={(item) => (
                <PreCheckCard key={item.finding.id} {...cardProps(item)} headline={sentText(keptByReviewer.get(keptKey(item))!)} />
              )}
              pinnedIds={pinnedIds}
              selected={selected}
              onSelect={selectFromCard}
              onEditOnAd={editOnAd}
            />
          )}
          <section className="fp-card fp-panel" aria-labelledby="auto-suggestions" aria-busy={checking}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <AutoTitle id="auto-suggestions">Auto suggestions</AutoTitle>
              {!checking && (
                <CountTags
                  critical={critical.length}
                  caution={caution.length}
                  good={goodIds.length}
                  checksRun={working.check?.checks_run ?? 0}
                  resolved={resolvedItems.length}
                />
              )}
            </div>
            {unavailable && <Alert type="warning" showIcon message={UNAVAILABLE} />}
            {checking ? (
              <Skeleton active paragraph={{ rows: 6 }} />
            ) : (
              <>
                {critical.length > 0 && (
                  <Group id="critical" kind="critical" title={`Critical · ${critical.length}`} open={open.critical} onToggle={() => setOpen((o) => ({ ...o, critical: !o.critical }))}>
                    {critical.map((item) => (
                      <PreCheckCard key={item.finding.id} {...cardProps(item)} />
                    ))}
                  </Group>
                )}
                {caution.length > 0 && (
                  <Group id="caution" kind="caution" title={`Caution · ${caution.length}`} open={open.caution} onToggle={() => setOpen((o) => ({ ...o, caution: !o.caution }))}>
                    {caution.map((item) => (
                      <PreCheckCard key={item.finding.id} {...cardProps(item)} />
                    ))}
                  </Group>
                )}
                {resolvedItems.length > 0 && (
                  <Group id="resolved" kind="resolved" title={`Resolved by you · ${resolvedItems.length}`} open={open.resolved} onToggle={() => setOpen((o) => ({ ...o, resolved: !o.resolved }))}>
                    {resolvedItems.map((item) => (
                      <PreCheckCard key={item.finding.id} {...cardProps(item)} />
                    ))}
                  </Group>
                )}
                <Group id="good" kind="good" title={`Good · ${goodIds.length}`} open={open.good} onToggle={() => setOpen((o) => ({ ...o, good: !o.good }))}>
                  <GoodList ruleIds={goodIds} rules={rules} />
                </Group>
              </>
            )}
            {editable && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, borderTop: '1px solid #E3E6EC', paddingTop: 20 }}>
                <p style={{ margin: 0, fontSize: 14, lineHeight: '22px', color: '#4A5468' }}>
                  These are suggestions, so you can submit anytime. Your reviewer sees anything still open, what you marked resolved, and your notes.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8 }}>
                  <Button className="fp-footer-button" onClick={recheck} loading={checking} disabled={submitting}>
                    {checking ? 'Checking…' : 'Re-check'}
                  </Button>
                  <Button type="primary" className="fp-footer-button fp-footer-primary" onClick={submit} loading={submitting} disabled={checking}>
                    Submit
                  </Button>
                </div>
              </div>
            )}
            {!editable && (
              <p style={{ margin: 0, fontSize: 14, lineHeight: '22px', color: '#4A5468', borderTop: '1px solid #E3E6EC', paddingTop: 20 }}>
                {ad.status === 'pending' ? 'This ad is with your reviewer, so the copy is locked until they decide.' : 'This ad has a decision, so the copy is locked.'}
              </p>
            )}
          </section>
        </div>
      </div>
    </>
  )
}
