import { Tooltip } from 'antd'
import type { CSSProperties, ReactNode } from 'react'
import { FilledIcon, Icon } from '../components/Icon'
import { SeverityTag } from '../components/StatusTag'
import type { Finding, Rule } from '../lib/detail'
import type { Marker } from '../ads/markers'

export interface Numbered {
  n: number
  finding: Finding
  rule: Rule | null
}

/** Auto findings numbered Critical first, then Caution. Numbers stay put when a card is dismissed. */
export function numberFindings(findings: Finding[], rules: Rule[]): Numbered[] {
  const byId = new Map(rules.map((r) => [r.id, r]))
  const rank = (f: Finding) => (f.severity === 'critical' ? 0 : 1)
  return findings
    .filter((f) => f.origin === 'auto')
    .sort((a, b) => rank(a) - rank(b) || a.position - b.position || a.id - b.id)
    .map((finding, i) => ({ n: i + 1, finding, rule: finding.rule_id ? byId.get(finding.rule_id) ?? null : null }))
}

export function missingLabel(rule: Rule | null, textTemplate: boolean): string {
  const what = rule ? rule.name.toLowerCase() : 'required element'
  return `No ${what} on this ${textTemplate ? 'page' : 'ad'}`
}

export function markersFor(numbered: Numbered[], textTemplate: boolean, layerIds: Set<string>): Marker[] {
  return numbered
    .filter(({ finding }) => finding.state !== 'dismissed')
    .map(({ n, finding, rule }) => {
      const onAd = finding.layer_id && layerIds.has(finding.layer_id)
      return {
        n,
        layerId: onAd ? finding.layer_id : null,
        quote: onAd ? finding.quote : null,
        label: finding.edited_text ?? finding.text,
        missingLabel: onAd ? undefined : missingLabel(rule, textTemplate),
      }
    })
}

export function CountTags({
  critical,
  caution,
  good,
  checksRun,
  resolved = 0,
}: {
  critical: number
  caution: number
  good: number
  checksRun: number
  resolved?: number
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
      {critical > 0 && <SeverityTag kind="critical">{critical} Critical</SeverityTag>}
      {caution > 0 && <SeverityTag kind="caution">{caution} Caution</SeverityTag>}
      {good > 0 && <SeverityTag kind="good">{good} Good</SeverityTag>}
      <span style={{ fontSize: 13, color: '#4A5468' }}>· {checksRun} checks run</span>
      {resolved > 0 && <span style={{ fontSize: 13, color: '#4A5468' }}>· {resolved} marked resolved</span>}
    </div>
  )
}

const GROUP_COLOR = { critical: '#B42318', caution: '#A15C07', good: '#067647', dismissed: '#4A5468', neutral: '#4A5468', resolved: '#067647' }

export type GroupKind = keyof typeof GROUP_COLOR

function groupIcon(kind: GroupKind): ReactNode {
  if (kind === 'critical') return <FilledIcon name="critical" size={16} />
  if (kind === 'caution') return <FilledIcon name="caution" size={16} />
  if (kind === 'good' || kind === 'resolved') return <FilledIcon name="good" size={16} />
  if (kind === 'dismissed') return <Icon name="dismissed" size={16} />
  return null
}

/** A collapsible group: a bordered grey header bar with a dark chevron. */
export function Group({
  id,
  kind,
  title,
  open,
  onToggle,
  children,
}: {
  id: string
  kind: GroupKind
  title: string
  open: boolean
  onToggle: () => void
  children?: ReactNode
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`group-${id}`}
        onClick={onToggle}
        className="fp-group-header"
        style={{ color: GROUP_COLOR[kind] }}
      >
        {groupIcon(kind)}
        {title}
        <span style={{ flexGrow: 1 }} />
        <Icon name={open ? 'chevronUp' : 'chevronDown'} size={20} strokeWidth={2.4} color="#15213B" />
      </button>
      {open && (
        <div id={`group-${id}`} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {children}
        </div>
      )}
    </div>
  )
}

export function RuleLine({ rule }: { rule: Rule | null }) {
  if (!rule) return null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span className="fp-mono" style={{ fontSize: 12, lineHeight: '16px', color: '#4A5468' }}>
        {rule.category} · {rule.name}
      </span>
      <Tooltip title={rule.description}>
        <button type="button" className="fp-info" aria-label={`About ${rule.name}: ${rule.description}`}>
          <Icon name="info" size={15} />
        </button>
      </Tooltip>
    </div>
  )
}

export function FixBox({ label, text }: { label: string; text: string }) {
  return (
    <div
      style={{
        background: '#D5EEE8',
        borderLeft: '3px solid #0F766E',
        borderRadius: 6,
        padding: '10px 12px 10px 13px',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      <span style={{ fontSize: 12, lineHeight: '16px', fontWeight: 700, color: '#115E59' }}>{label}</span>
      <span style={{ fontSize: 14, lineHeight: '22px', fontWeight: 500 }}>{text}</span>
    </div>
  )
}

export function NoteBox({ label, text }: { label: string; text: string }) {
  return (
    <div style={{ background: '#F6F7F9', borderRadius: 8, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 12, lineHeight: '16px', fontWeight: 600, color: '#4A5468' }}>{label}</span>
      <span style={{ fontSize: 14, lineHeight: '22px' }}>{text}</span>
    </div>
  )
}

/** The numbered badge on a card; a button that shows the finding on the ad. */
export function NumberBadge({ n, selected, onSelect, tone = 'default' }: { n: number; selected: boolean; onSelect?: () => void; tone?: 'default' | 'resolved' }) {
  const background = tone === 'resolved' ? '#067647' : selected ? '#0F766E' : '#15213B'
  const style: CSSProperties = {
    flexShrink: 0,
    width: 24,
    height: 24,
    borderRadius: 9999,
    background,
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    padding: 0,
    fontFamily: 'inherit',
  }
  if (!onSelect) return <span style={style}>{n}</span>
  return (
    <button type="button" aria-label={`Show finding ${n} on the ad`} onClick={onSelect} style={{ ...style, cursor: 'pointer' }}>
      {n}
    </button>
  )
}

export function cardStyle(selected: boolean): CSSProperties {
  return {
    border: selected ? '2px solid #0F766E' : '1px solid #E3E6EC',
    borderRadius: 12,
    padding: selected ? 15 : 16,
    display: 'flex',
    gap: 12,
    background: '#FFFFFF',
    scrollMarginTop: 24,
    scrollMarginBottom: 120,
  }
}

export function GoodList({ ruleIds, rules }: { ruleIds: string[]; rules: Rule[] }) {
  const byId = new Map(rules.map((r) => [r.id, r]))
  return (
    <ul className="fp-good-list">
      {ruleIds.map((id) => {
        const rule = byId.get(id)
        if (!rule) return null
        return (
          <li key={id}>
            <span style={{ color: '#067647', display: 'inline-flex' }}>
              <FilledIcon name="good" size={16} />
            </span>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 14, lineHeight: '20px', fontWeight: 600 }}>{rule.name}</span>
              <span className="fp-mono" style={{ fontSize: 12, lineHeight: '16px', color: '#4A5468' }}>
                {rule.category}
              </span>
            </span>
          </li>
        )
      })}
    </ul>
  )
}

/** Scroll a pin on the ad and a card in the list into view together. */
export function revealPin(n: number) {
  document.querySelector(`[data-pin="${n}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
}

export function revealCard(n: number) {
  window.setTimeout(() => {
    document.getElementById(`finding-${n}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, 0)
}
