import type { CSSProperties, ReactNode } from 'react'
import { STATUS_LABEL } from '../lib/labels'
import type { AdStatus } from '../lib/types'
import { FilledIcon, Icon } from './Icon'

export type Tone = 'critical' | 'warning' | 'success' | 'neutral'

const TONES: Record<Tone, CSSProperties> = {
  critical: { background: '#FEF3F2', color: '#B42318' },
  warning: { background: '#FFF4E5', color: '#A15C07' },
  success: { background: '#ECFDF3', color: '#067647' },
  neutral: { background: '#EEF2F7', color: '#15213B', border: '1px solid #C9CED8' },
}

const BASE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  padding: '3px 8px',
  borderRadius: 4,
  fontSize: 12,
  lineHeight: '16px',
  fontWeight: 600,
  whiteSpace: 'nowrap',
}

/** A tag is always an icon plus a word, never colour alone. */
export function Tag({ tone, icon, children, style }: { tone: Tone; icon: ReactNode; children: ReactNode; style?: CSSProperties }) {
  return (
    <span style={{ ...BASE, ...TONES[tone], ...style }}>
      {icon}
      {children}
    </span>
  )
}

const STATUS_TONE: Record<AdStatus, Tone> = {
  draft: 'neutral',
  pending: 'neutral',
  changes_required: 'warning',
  approved_with_changes: 'success',
  approved: 'success',
  rejected: 'critical',
}

function statusIcon(status: AdStatus): ReactNode {
  switch (status) {
    case 'draft':
      return <Icon name="pencil" size={13} strokeWidth={2.2} />
    case 'pending':
      return <Icon name="clock" size={13} strokeWidth={2.2} />
    case 'changes_required':
      return <FilledIcon name="caution" size={13} strokeWidth={2.4} />
    case 'rejected':
      return <FilledIcon name="critical" size={13} strokeWidth={2.4} />
    default:
      return <FilledIcon name="good" size={13} strokeWidth={2.4} />
  }
}

export function StatusTag({ status }: { status: AdStatus }) {
  return (
    <Tag tone={STATUS_TONE[status]} icon={statusIcon(status)}>
      {STATUS_LABEL[status]}
    </Tag>
  )
}

export type SeverityKind = 'critical' | 'caution' | 'good'

const SEVERITY_TONE: Record<SeverityKind, Tone> = { critical: 'critical', caution: 'warning', good: 'success' }

/** "3 Critical", "1 Caution", "5 Good" or "Good standing". */
export function SeverityTag({ kind, children }: { kind: SeverityKind; children: ReactNode }) {
  return (
    <Tag tone={SEVERITY_TONE[kind]} icon={<FilledIcon name={kind} size={13} strokeWidth={2.4} />}>
      {children}
    </Tag>
  )
}

/** The Auto check column: the most serious open count, or Good standing. */
export function AutoCheckTag({ critical, caution }: { critical: number; caution: number }) {
  if (critical > 0) return <SeverityTag kind="critical">{critical} Critical</SeverityTag>
  if (caution > 0) return <SeverityTag kind="caution">{caution} Caution</SeverityTag>
  return <SeverityTag kind="good">Good standing</SeverityTag>
}
