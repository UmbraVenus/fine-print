import { Alert, App as AntApp, Button, Input, Skeleton, Tooltip } from 'antd'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AdView, isImageTemplate } from '../ads/AdView'
import { useWorkspace } from '../app/workspace'
import { FilledIcon, Icon } from '../components/Icon'
import { StatusTag } from '../components/StatusTag'
import {
  CountTags,
  FixBox,
  GoodList,
  NoteBox,
  Group,
  NumberBadge,
  RuleLine,
  cardStyle,
  markersFor,
  numberFindings,
  revealCard,
  revealPin,
  type Numbered,
} from '../findings/parts'
import { api, ApiError } from '../lib/api'
import { dayPhrase } from '../lib/dates'
import { sentText, type AdDetail, type Version } from '../lib/detail'
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

/** How "Use this wording" stands for one suggestion, given the layer's current text. */
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
      style={{ ...cardStyle(selected), ...(resolved ? { background: '#FBFCFD' } : {}) }}
      onClick={onSelect}
      aria-label={`Suggestion ${n}`}
    >
      <NumberBadge n={n} selected={selected} onSelect={onSelect} tone={resolved ? 'resolved' : 'default'} />
      <div style={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {resolved && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, lineHeight: '16px', fontWeight: 700, color: '#067647' }}>
              <FilledIcon name="good" size={14} />
              Resolved by you
            </span>
          )}
          <p style={{ margin: 0, fontSize: 15, lineHeight: '22px', fontWeight: 600, color: resolved ? '#4A5468' : undefined }}>{finding.text}</p>
          <RuleLine rule={rule} />
        </div>
        {finding.suggested_fix && !resolved && (
          <FixBox label={finding.fix_label ?? 'Suggested wording'} text={finding.suggested_fix}>
            {editable && wording !== 'none' && (
              <Tooltip title={wording === 'changed' ? 'The flagged words have changed on the ad. Edit it there instead.' : undefined}>
                <button
                  type="button"
                  className="fp-copy-button"
                  disabled={wording !== 'ready'}
                  onClick={(e) => {
                    e.stopPropagation()
                    onUseWording()
                  }}
                >
                  {wording === 'used' ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <Icon name="check" size={14} strokeWidth={2.5} />
                      Wording used
                    </span>
                  ) : (
                    'Use this wording'
                  )}
                </button>
              </Tooltip>
            )}
          </FixBox>
        )}
        {editable && (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }} onClick={(e) => e.stopPropagation()}>
            {!resolved && finding.layer_id && layerText !== undefined && (
              <button type="button" className="fp-secondary fp-small-button" onClick={onEditOnAd}>
                Edit on ad
              </button>
            )}
            <button type="button" className="fp-secondary fp-small-button" aria-expanded={noteOpen} onClick={() => setNoteOpen((o) => !o)}>
              Add a note
            </button>
            <button
              type="button"
              className={`fp-small-button ${resolved ? 'fp-secondary' : 'fp-resolve'}`}
              style={{ marginLeft: 'auto' }}
              aria-pressed={resolved}
              onClick={() => onResolve(!resolved)}
            >
              {resolved ? 'Reopen' : 'Mark resolved'}
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

function FromReviewer({ detail }: { detail: AdDetail }) {
  const sent = detail.current.findings.filter((f) => f.sent_to_submitter)
  const decision = detail.events.find((e) => e.type === 'decision')
  const note = typeof decision?.detail.message === 'string' ? decision.detail.message : null
  if (!sent.length && !note) return null
  return (
    <section className="fp-card fp-panel" aria-labelledby="from-reviewer">
      <h2 id="from-reviewer" className="fp-panel-title">
        From your reviewer
      </h2>
      {note && <NoteBox label="Message" text={note} />}
      {sent.map((finding) => (
        <div key={finding.id} className="fp-sent-card">
          <p style={{ margin: 0, fontSize: 15, lineHeight: '22px', fontWeight: 500 }}>{sentText(finding)}</p>
          {finding.origin === 'auto' && finding.suggested_fix && (
            <p style={{ margin: 0, fontSize: 14, lineHeight: '20px', color: '#4A5468' }}>
              {finding.fix_label}: {finding.suggested_fix}
            </p>
          )}
        </div>
      ))}
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
  const markers = useMemo(
    () =>
      markersFor(numbered, textTemplate, layerIds).map((m) =>
        numbered.find((x) => x.n === m.n)?.finding.resolved_by_submitter ? { ...m, tone: 'resolved' as const } : m,
      ),
    [numbered, textTemplate, layerIds],
  )
  const unresolved = numbered.filter((x) => !x.finding.resolved_by_submitter)
  const resolvedItems = numbered.filter((x) => x.finding.resolved_by_submitter)
  const critical = unresolved.filter((x) => x.finding.severity === 'critical')
  const caution = unresolved.filter((x) => x.finding.severity === 'caution')
  const layerText = (layerId: string | null) => (layerId ? working.layers.find((l) => l.id === layerId)?.text : undefined)
  const goodIds = working.check?.good_rule_ids ?? []
  const editedIds = useMemo(() => {
    const before = new Map(baseline.map((l) => [l.id, l.text]))
    return new Set(working.layers.filter((l) => before.get(l.id) !== l.text).map((l) => l.id))
  }, [working.layers, baseline])

  const saveLayer = async (layerId: string, text: string) => {
    const layers = working.layers.map((l) => (l.id === layerId ? { ...l, text } : l))
    try {
      await api.put(`/api/ads/${ad.id}/copy`, { layers })
      reload()
    } catch (e) {
      message.error(e instanceof ApiError ? e.message : "Couldn't save your edit. Try again.")
    }
  }

  const applyWording = async (item: Numbered) => {
    const { layer_id, quote, suggested_fix } = item.finding
    const text = layerText(layer_id)
    if (!layer_id || !quote || !suggested_fix || text === undefined || !text.includes(quote)) return
    await saveLayer(layer_id, text.replace(quote, suggested_fix))
    message.success('Wording used on the ad. Mark it resolved once it reads right.')
  }

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
      message.success(`Submitted${result.version > 1 ? ` as version ${result.version}` : ''}. Due ${dayPhrase(result.due_date, today)}.`)
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

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start' }}>
        <section className="fp-card" aria-label="Your ad" style={{ flex: '1 1 400px', minWidth: 0, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
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
          {ad.status === 'changes_required' && <FromReviewer detail={detail} />}
          <section className="fp-card fp-panel" aria-labelledby="auto-suggestions" aria-busy={checking}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <h2 id="auto-suggestions" className="fp-panel-title">
                Auto suggestions
              </h2>
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
                      <PreCheckCard key={item.finding.id} item={item} selected={selected === item.n} onSelect={() => selectFromCard(item.n)} onNote={(note) => saveNote(item.finding.id, note)} editable={editable} layerText={layerText(item.finding.layer_id)} onUseWording={() => applyWording(item)} onEditOnAd={() => editOnAd(item.finding.layer_id)} onResolve={(r) => setResolved(item.finding.id, r)} />
                    ))}
                  </Group>
                )}
                {caution.length > 0 && (
                  <Group id="caution" kind="caution" title={`Caution · ${caution.length}`} open={open.caution} onToggle={() => setOpen((o) => ({ ...o, caution: !o.caution }))}>
                    {caution.map((item) => (
                      <PreCheckCard key={item.finding.id} item={item} selected={selected === item.n} onSelect={() => selectFromCard(item.n)} onNote={(note) => saveNote(item.finding.id, note)} editable={editable} layerText={layerText(item.finding.layer_id)} onUseWording={() => applyWording(item)} onEditOnAd={() => editOnAd(item.finding.layer_id)} onResolve={(r) => setResolved(item.finding.id, r)} />
                    ))}
                  </Group>
                )}
                {resolvedItems.length > 0 && (
                  <Group id="resolved" kind="resolved" title={`Resolved by you · ${resolvedItems.length}`} open={open.resolved} onToggle={() => setOpen((o) => ({ ...o, resolved: !o.resolved }))}>
                    {resolvedItems.map((item) => (
                      <PreCheckCard key={item.finding.id} item={item} selected={selected === item.n} onSelect={() => selectFromCard(item.n)} onNote={(note) => saveNote(item.finding.id, note)} editable={editable} layerText={layerText(item.finding.layer_id)} onUseWording={() => applyWording(item)} onEditOnAd={() => editOnAd(item.finding.layer_id)} onResolve={(r) => setResolved(item.finding.id, r)} />
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
