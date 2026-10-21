import type { AdDetail, Finding, Rule, Version } from '../lib/detail'
import type { Layer } from '../lib/types'

export interface Resolved {
  n: number
  finding: Finding
  rule: Rule | null
  /** How the new version fixes it, in a few words. */
  how: string
  /** The v2 layer that carries the fix, for the green marker. */
  layerId: string | null
}

export interface Comparison {
  previous: Version
  current: Version
  resolved: Resolved[]
  stillOpen: Finding[]
  added: Finding[]
  /** The reviewer's own findings on the previous version. */
  reviewerNotes: Finding[]
  /** Reviewer findings whose quoted words are still on the new version. */
  reviewerStillOpen: Finding[]
}

const key = (f: Finding) => `${f.rule_id}|${f.layer_id ?? '-'}`

function quoteShort(text: string, max = 70): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text
}

/** “Words” as the end of a sentence, without doubling the quote's own full stop. */
function quoted(text: string, max = 70): string {
  const short = quoteShort(text, max)
  return /[.!?…]$/.test(short) ? `“${short}”` : `“${short}”.`
}

/**
 * Compare what was sent back on the previous version with the current version's check,
 * by rule and layer: gone means resolved, still there means still open, and anything else is new.
 */
export function compareVersions(detail: AdDetail): Comparison | null {
  const { versions, current, rules } = detail
  const previous = versions.find((v) => v.version === current.version - 1)
  if (!previous) return null
  const byRule = new Map(rules.map((r) => [r.id, r]))
  const sent = previous.findings.filter((f) => f.origin === 'auto' && f.sent_to_submitter)
  const now = current.findings.filter((f) => f.origin === 'auto' && f.state !== 'dismissed')
  const nowKeys = new Set(now.map(key))
  const sentKeys = new Set(sent.map(key))

  const oldLayers = new Map(previous.layers.map((l) => [l.id, l]))
  const newLayers = new Map(current.layers.map((l) => [l.id, l]))
  const added: Layer[] = current.layers.filter((l) => !oldLayers.has(l.id))
  let addedIndex = 0

  const rank = (f: Finding) => (f.severity === 'critical' ? 0 : 1)
  const resolved: Resolved[] = sent
    .filter((f) => !nowKeys.has(key(f)))
    .sort((a, b) => rank(a) - rank(b) || a.position - b.position)
    .map((finding, i) => {
      let how = 'Passes the check now.'
      let layerId: string | null = null
      const before = finding.layer_id ? oldLayers.get(finding.layer_id) : undefined
      const after = finding.layer_id ? newLayers.get(finding.layer_id) : undefined
      if (!finding.layer_id) {
        const layer = added[addedIndex++]
        if (layer) {
          how = `Added ${quoted(layer.text)}`
          layerId = layer.id
        }
      } else if (before && !after) {
        how = `Removed ${quoted(finding.quote ?? before.text)}`
      } else if (before && after && before.text !== after.text) {
        how = finding.quote && !after.text.includes(finding.quote)
          ? `Reworded ${quoted(finding.quote, 60)}`
          : `Changed to ${quoted(after.text)}`
        layerId = after.id
      }
      return { n: i + 1, finding, rule: finding.rule_id ? byRule.get(finding.rule_id) ?? null : null, how, layerId }
    })

  // A reviewer finding that quoted words on the ad is resolved once those words are gone.
  const reviewerNotes = previous.findings.filter((f) => f.origin === 'reviewer' && f.sent_to_submitter)
  const quotedNotes = reviewerNotes.filter((f) => f.layer_id && f.quote)
  const stillThere = (f: Finding) => Boolean(newLayers.get(f.layer_id!)?.text.includes(f.quote!))
  for (const finding of quotedNotes.filter((f) => !stillThere(f))) {
    const after = newLayers.get(finding.layer_id!)
    resolved.push({
      n: resolved.length + 1,
      finding,
      rule: null,
      how: after ? `Reworded ${quoted(finding.quote!, 60)}` : `Removed ${quoted(finding.quote!)}`,
      layerId: after ? after.id : null,
    })
  }

  return {
    previous,
    current,
    resolved,
    stillOpen: now.filter((f) => sentKeys.has(key(f))),
    added: now.filter((f) => !sentKeys.has(key(f))),
    reviewerNotes,
    reviewerStillOpen: quotedNotes.filter(stillThere),
  }
}

/** "Had 2 Critical: no NMLS ID on the banner, no Equal Housing logo" */
export function previousSummary(comparison: Comparison): string {
  const sent = comparison.previous.findings.filter((f) => f.origin === 'auto' && f.sent_to_submitter)
  const critical = sent.filter((f) => f.severity === 'critical').length
  const caution = sent.filter((f) => f.severity === 'caution').length
  const parts = [critical && `${critical} Critical`, caution && `${caution} Caution`].filter(Boolean) as string[]
  const notes = comparison.reviewerNotes.length
  if (notes) parts.push(`${notes} finding${notes === 1 ? '' : 's'} from you`)
  if (!parts.length) return 'Nothing was sent back on this version.'
  const lead = `Had ${parts.join(' and ')}`
  const reasons = sent.slice(0, 3).map((f) => {
    const text = (f.state === 'edited' && f.edited_text ? f.edited_text : f.text).replace(/\.$/, '')
    return text.charAt(0).toLowerCase() + text.slice(1)
  })
  return reasons.length && !notes ? `${lead}: ${reasons.join(', ')}` : lead
}
