import { useState } from 'react'
import { AdView } from '../ads/AdView'
import type { Marker } from '../ads/markers'
import { SeverityTag } from '../components/StatusTag'
import { AutoTitle, Group, NumberBadge, ReviewerPin, cardStyle, reviewerN, type Numbered } from '../findings/parts'
import type { Rule } from '../lib/detail'
import { ReviewSuggestionCard, type SuggestionActions } from './SuggestionCards'
import { previousSummary, type Comparison } from './compare'

/** Still-open and new suggestions, numbered after the resolved ones so every pin on v2 is unique. */
export function openItems(comparison: Comparison, rules: Rule[]): { stillOpen: Numbered[]; added: Numbered[] } {
  const byRule = new Map(rules.map((r) => [r.id, r]))
  const rank = (s: string | null) => (s === 'critical' ? 0 : 1)
  let n = comparison.resolved.length
  const number = (list: typeof comparison.stillOpen) =>
    [...list]
      .sort((a, b) => rank(a.severity) - rank(b.severity) || a.position - b.position)
      .map((finding) => ({ n: ++n, finding, rule: finding.rule_id ? byRule.get(finding.rule_id) ?? null : null }))
  const stillOpen = number(comparison.stillOpen)
  const added = number(comparison.added)
  return { stillOpen, added }
}

export function compareMarkers(comparison: Comparison, open: Numbered[], layerIds: Set<string>): Marker[] {
  const resolved: Marker[] = comparison.resolved
    .filter((r) => r.layerId)
    .map((r) => ({ n: r.n, layerId: r.layerId, quote: null, tone: 'resolved', label: r.how }))
  const remaining: Marker[] = open.map(({ n, finding, rule }) => {
    const onAd = finding.layer_id && layerIds.has(finding.layer_id)
    return {
      n,
      layerId: onAd ? finding.layer_id : null,
      quote: onAd ? finding.quote : null,
      label: finding.text,
      missingLabel: onAd ? undefined : `No ${rule?.name.toLowerCase() ?? 'required element'} on this ad`,
    }
  })
  const yours: Marker[] = comparison.reviewerStillOpen.map((f) => ({
    n: reviewerN(f),
    layerId: f.layer_id,
    quote: f.quote,
    label: f.text,
    kind: 'reviewer',
  }))
  return [...resolved, ...remaining, ...yours]
}

/** v1 above v2, so the reviewer sees only what changed. Resolved items are green on v2. */
export function CompareVersions({
  comparison,
  markers,
  selected,
  onSelect,
}: {
  comparison: Comparison
  markers: Marker[]
  selected: number | null
  onSelect: (n: number) => void
}) {
  const { previous, current } = comparison
  return (
    <section className="fp-card fp-panel" aria-labelledby="compare-versions">
      <h2 id="compare-versions" className="fp-panel-title">
        Compare versions
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span className="fp-version-label">Version {previous.version}</span>
        <AdView content={previous} />
        <span style={{ fontSize: 13, lineHeight: '18px', color: '#4A5468' }}>{previousSummary(comparison)}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span className="fp-version-label">Version {current.version}</span>
        <AdView content={current} markers={markers} selected={selected} onSelect={onSelect} />
      </div>
    </section>
  )
}

export function WhatChanged({
  comparison,
  stillOpen,
  added,
  selected,
  onSelect,
  actions,
  readOnly,
}: {
  comparison: Comparison
  stillOpen: Numbered[]
  added: Numbered[]
  selected: number | null
  onSelect: (n: number) => void
  actions: SuggestionActions
  readOnly: boolean
}) {
  const [userOpen, setOpen] = useState({ resolved: true, stillOpen: false, added: false })
  // Picking a pin on the ad opens the group its card is in.
  const open = {
    resolved: userOpen.resolved || comparison.resolved.some((r) => r.n === selected),
    stillOpen:
      userOpen.stillOpen ||
      stillOpen.some((x) => x.n === selected) ||
      comparison.reviewerStillOpen.some((f) => reviewerN(f) === selected),
    added: userOpen.added || added.some((x) => x.n === selected),
  }
  const openFindings = [...stillOpen, ...added]
  const critical = openFindings.filter((x) => x.finding.severity === 'critical').length
  const caution = openFindings.filter((x) => x.finding.severity === 'caution').length
  const check = comparison.current.check
  const checkedLine =
    check?.kind === 'compared'
      ? `· Compared with version ${comparison.previous.version}`
      : `· Re-checked version ${comparison.current.version}`

  return (
    <section className="fp-card fp-panel" aria-labelledby="what-changed">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <AutoTitle id="what-changed">What changed</AutoTitle>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          {critical === 0 && caution === 0 && <SeverityTag kind="good">Good standing</SeverityTag>}
          {critical > 0 && <SeverityTag kind="critical">{critical} Critical</SeverityTag>}
          {caution > 0 && <SeverityTag kind="caution">{caution} Caution</SeverityTag>}
          <span style={{ fontSize: 13, color: '#4A5468' }}>{checkedLine}</span>
        </div>
      </div>

      <Group
        id="resolved"
        kind="resolved"
        title={`Resolved · ${comparison.resolved.length}`}
        open={open.resolved}
        onToggle={() => setOpen((o) => ({ ...o, resolved: !open.resolved }))}
      >
        {comparison.resolved.length === 0 && <p style={{ margin: 0, fontSize: 14, color: '#4A5468' }}>Nothing from version {comparison.previous.version} is resolved yet.</p>}
        {comparison.resolved.map((item) => (
          <article key={item.finding.id} id={`finding-${item.n}`} style={cardStyle(selected === item.n)} onClick={() => onSelect(item.n)} aria-label={`Resolved ${item.n}`}>
            <NumberBadge n={item.n} selected={false} tone="resolved" onSelect={item.layerId ? () => onSelect(item.n) : undefined} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 15, lineHeight: '22px', fontWeight: 600 }}>{item.how}</p>
              {!item.layerId && (
                <p style={{ margin: 0, fontSize: 14, lineHeight: '20px', color: '#4A5468' }}>
                  {item.finding.state === 'edited' && item.finding.edited_text ? item.finding.edited_text : item.finding.text}
                </p>
              )}
              <p className="fp-mono" style={{ margin: 0, fontSize: 12, lineHeight: '16px', color: '#4A5468' }}>
                {item.finding.origin === 'reviewer' ? (
                  'Was your finding'
                ) : (
                  <>
                    Was {item.finding.severity === 'critical' ? 'Critical' : 'Caution'}
                    {item.rule && ` · ${item.rule.category} · ${item.rule.name}`}
                  </>
                )}
              </p>
            </div>
          </article>
        ))}
      </Group>

      <Group
        id="still-open"
        kind="neutral"
        title={`Still open · ${stillOpen.length + comparison.reviewerStillOpen.length}`}
        open={open.stillOpen}
        onToggle={() => setOpen((o) => ({ ...o, stillOpen: !open.stillOpen }))}
      >
        {stillOpen.length + comparison.reviewerStillOpen.length === 0 && (
          <p style={{ margin: 0, fontSize: 14, color: '#4A5468' }}>Everything sent back was fixed.</p>
        )}
        {stillOpen.map((item) => (
          <ReviewSuggestionCard key={item.finding.id} item={item} selected={selected === item.n} onSelect={() => onSelect(item.n)} actions={actions} readOnly={readOnly} />
        ))}
        {comparison.reviewerStillOpen.map((finding) => (
          <article
            key={finding.id}
            id={`finding-${reviewerN(finding)}`}
            style={cardStyle(selected === reviewerN(finding))}
            onClick={() => onSelect(reviewerN(finding))}
            aria-label="Your finding, still open"
          >
            <ReviewerPin selected={selected === reviewerN(finding)} onSelect={() => onSelect(reviewerN(finding))} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 15, lineHeight: '22px', fontWeight: 600 }}>{finding.text}</p>
              <p className="fp-mono" style={{ margin: 0, fontSize: 12, lineHeight: '16px', color: '#4A5468' }}>
                Your finding on version {comparison.previous.version}
              </p>
            </div>
          </article>
        ))}
      </Group>

      <Group
        id="new"
        kind="neutral"
        title={`New suggestions · ${added.length}`}
        open={open.added}
        onToggle={() => setOpen((o) => ({ ...o, added: !open.added }))}
      >
        {added.length === 0 && <p style={{ margin: 0, fontSize: 14, color: '#4A5468' }}>The new version didn't raise anything new.</p>}
        {added.map((item) => (
          <ReviewSuggestionCard key={item.finding.id} item={item} selected={selected === item.n} onSelect={() => onSelect(item.n)} actions={actions} readOnly={readOnly} />
        ))}
      </Group>
    </section>
  )
}
