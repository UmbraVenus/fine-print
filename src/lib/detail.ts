import type { AdContent, AdStatus, Product, Role, Severity, Template, Theme, Layer } from './types'

export interface Rule {
  id: string
  name: string
  category: 'Claims' | 'Required elements' | 'Presentation'
  severity: Severity
  description: string
  applies_to: string[]
  dont_example: string
  do_example: string
  is_custom: boolean
  position: number
  created_at: string
}

export type FindingState = 'open' | 'kept' | 'edited' | 'dismissed'

export interface Finding {
  id: number
  ad_version_id: number
  check_run_id: number | null
  origin: 'auto' | 'reviewer'
  rule_id: string | null
  severity: Severity | null
  layer_id: string | null
  quote: string | null
  text: string
  fix_label: 'Suggested fix' | 'Suggested wording' | null
  suggested_fix: string | null
  state: FindingState
  edited_text: string | null
  dismiss_reason: string | null
  submitter_note: string | null
  sent_to_submitter: boolean
  resolved_by_submitter: boolean
  position: number
  created_at: string
}

export interface CheckRun {
  id: number
  kind: 'seeded' | 'live' | 'compared'
  good_rule_ids: string[]
  checks_run: number
  created_at: string
  error: string | null
}

export interface Version extends AdContent {
  id: number
  ad_id: number
  version: number
  template: Template
  theme: Theme
  layers: Layer[]
  submitted_at: string | null
  created_at: string
  findings: Finding[]
  check: CheckRun | null
}

export interface AdEvent {
  id: number
  ad_id: number
  at: string
  actor: 'Marketer' | 'Reviewer' | 'Auto check'
  type: string
  detail: Record<string, unknown>
}

export interface Ad {
  id: number
  name: string
  format: string
  product: Product
  source: string
  status: AdStatus
  current_version: number
  is_mine: boolean
  due_date: string | null
  created_at: string
  updated_at: string
  closed_at: string | null
  live_since: string | null
}

export interface AdDetail {
  ad: Ad
  versions: Version[]
  current: Version
  draft: Version | null
  events: AdEvent[]
  rules: Rule[]
  queue: { position: number; total: number; previous: number | null; next: number | null } | null
}

const DECISION_WORDS: Record<string, string> = {
  approved: 'approved',
  approved_with_changes: 'approved with changes',
  changes_required: 'requested changes',
  rejected: 'rejected',
}

function counts(detail: Record<string, unknown>): string {
  const critical = Number(detail.critical ?? 0)
  const caution = Number(detail.caution ?? 0)
  const parts = [critical && `${critical} Critical`, caution && `${caution} Caution`].filter(Boolean)
  return parts.length ? parts.join(', ') : 'good standing'
}

/** One line of the activity timeline, worded for whoever is looking. */
export function activityText(event: AdEvent, viewer: Role): string {
  const d = event.detail
  switch (event.type) {
    case 'submitted':
      return `${viewer === 'marketer' ? 'You' : 'Marketer'} submitted version ${d.version}`
    case 'resubmitted':
      return `${viewer === 'marketer' ? 'You' : 'Marketer'} resubmitted version ${d.version}`
    case 'check_ran': {
      if (d.error) return 'Auto check unavailable'
      const label = d.context === 'pre-check' ? 'Pre-check' : d.context === 're-check' ? 'Re-check' : 'Auto check'
      return `${label}: ${counts(d)}`
    }
    case 'decision': {
      const word = DECISION_WORDS[String(d.status)] ?? 'decided'
      const who = viewer === 'reviewer' && d.by_you ? 'You' : 'Reviewer'
      return `${who} ${word}`
    }
    case 'went_live':
      return 'Went live'
    default:
      return event.type
  }
}

/** What the submitter gets: kept and edited suggestions plus the reviewer's own findings. */
export function sentText(finding: Finding): string {
  if (finding.state === 'edited' && finding.edited_text) return finding.edited_text
  return finding.text
}
