import { Skeleton } from 'antd'
import type { CSSProperties } from 'react'
import { useWorkspace } from '../app/workspace'
import { ComingNextButton } from '../components/ComingNext'
import { FilledIcon, Icon } from '../components/Icon'
import { Tag } from '../components/StatusTag'
import type { Rule } from '../lib/detail'
import { useApi } from '../lib/useApi'

const SECTIONS: Array<{ category: Rule['category']; sub: string }> = [
  { category: 'Claims', sub: 'What the words promise' },
  { category: 'Required elements', sub: 'Things that must be on the ad' },
  { category: 'Presentation', sub: 'How the ad looks' },
]

const APPLY_OPTIONS = [
  { value: 'personal_loan', label: 'Personal loan', plural: 'personal loans' },
  { value: 'credit_card', label: 'Credit card', plural: 'credit cards' },
  { value: 'mortgage', label: 'Mortgage', plural: 'mortgage' },
  { value: 'affiliate', label: 'Affiliate content', plural: 'affiliate content' },
]

/** "personal loans and credit cards", "all products", "affiliate content" */
export function appliesText(applies: string[]): string {
  const products = ['personal_loan', 'credit_card', 'mortgage']
  if (products.every((p) => applies.includes(p))) {
    return applies.includes('affiliate') ? 'all products and affiliate content' : 'all products'
  }
  const words = APPLY_OPTIONS.filter((o) => applies.includes(o.value)).map((o) => o.plural)
  if (words.length <= 1) return words[0] ?? 'nothing yet'
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`
}

interface ExampleLine {
  size: 'main' | 'big' | 'small' | 'tiny'
  text: string
}

function exampleLines(value: string): ExampleLine[] {
  if (value.startsWith('[')) {
    try {
      return JSON.parse(value) as ExampleLine[]
    } catch {
      // A custom rule's text that happens to start with a bracket.
    }
  }
  return [{ size: 'main', text: value }]
}

const LINE_STYLE: Record<ExampleLine['size'], CSSProperties> = {
  main: { fontSize: 15, lineHeight: '21px', fontWeight: 700 },
  big: { fontSize: 20, lineHeight: '26px', fontWeight: 800 },
  small: { fontSize: 11, lineHeight: '15px', fontWeight: 600, color: '#374151' },
  tiny: { fontSize: 7, lineHeight: '9px', color: '#4A5468' },
}

function ExampleCard({ kind, value }: { kind: 'dont' | 'do'; value: string }) {
  const lines = exampleLines(value)
  const tall = lines.some((l) => l.size === 'big')
  return (
    <div className="fp-example" style={{ minHeight: tall ? 120 : undefined }}>
      <span
        style={{
          alignSelf: 'flex-start',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '1px 7px',
          borderRadius: 4,
          fontSize: 12,
          lineHeight: '18px',
          fontWeight: 600,
          background: kind === 'dont' ? '#FEF3F2' : '#ECFDF3',
          color: kind === 'dont' ? '#B42318' : '#067647',
        }}
      >
        <FilledIcon name={kind === 'dont' ? 'critical' : 'good'} size={12} strokeWidth={2.4} />
        {kind === 'dont' ? 'Don’t' : 'Do'}
      </span>
      {lines.map((line, i) => (
        <span key={i} style={{ ...LINE_STYLE[line.size], ...(line.size === 'tiny' ? { marginTop: 'auto' } : {}), ...(line.size === 'small' && tall ? { fontSize: 12, fontWeight: 500 } : {}) }}>
          {line.text}
        </span>
      ))}
    </div>
  )
}

function RuleRow({ rule }: { rule: Rule }) {
  return (
    <div className="fp-rule-row" data-rule={rule.id}>
      <div style={{ flex: '1 1 300px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <h3 style={{ margin: 0, fontSize: 15, lineHeight: '22px', fontWeight: 600 }}>{rule.name}</h3>
          {rule.is_custom && (
            <Tag tone="neutral" icon={<Icon name="person" size={12} strokeWidth={2.2} />}>
              Added by reviewer
            </Tag>
          )}
        </div>
        <p style={{ margin: 0, fontSize: 14, lineHeight: '22px', color: '#374151' }}>{rule.description}</p>
        <p style={{ margin: 0, fontSize: 12, lineHeight: '16px', color: '#4A5468' }}>
          Applies to {appliesText(rule.applies_to)} · Flagged as {rule.severity === 'critical' ? 'Critical' : 'Caution'}
        </p>
      </div>
      <div style={{ flex: '1 1 420px', minWidth: 0, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <ExampleCard kind="dont" value={rule.dont_example} />
        <ExampleCard kind="do" value={rule.do_example} />
      </div>
    </div>
  )
}

export function RulesPage() {
  const { version } = useWorkspace()
  const { latest } = useApi<{ rules: Rule[] }>('/api/rules', version)
  const rules = latest?.rules

  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 640 }}>
          <h1 className="fp-page-title">Rules</h1>
          <p style={{ margin: 0, fontSize: 14, lineHeight: '22px', color: '#4A5468' }}>
            Every ad is checked against these {rules?.length ?? ''} rules. Each suggestion names the rule it comes from.
          </p>
        </div>
        <ComingNextButton feature="doc-rules" />
      </div>

      {!rules && <Skeleton active paragraph={{ rows: 12 }} />}
      {rules &&
        SECTIONS.map(({ category, sub }) => {
          const inSection = rules.filter((r) => r.category === category)
          if (!inSection.length) return null
          return (
            <section key={category} className="fp-rule-section" aria-labelledby={`section-${category}`}>
              <div className="fp-rule-section-header">
                <h2 id={`section-${category}`} style={{ margin: 0, fontSize: 19, lineHeight: '26px', fontWeight: 800, color: '#115E59' }}>
                  {category}
                </h2>
                <span style={{ fontSize: 12, lineHeight: '16px', fontWeight: 700, color: '#FFFFFF', background: '#0F766E', borderRadius: 9999, padding: '2px 9px' }}>
                  {inSection.length}
                </span>
                <span style={{ fontSize: 14, lineHeight: '20px', color: '#115E59' }}>{sub}</span>
              </div>
              {inSection.map((rule) => (
                <RuleRow key={rule.id} rule={rule} />
              ))}
            </section>
          )
        })}
      <p style={{ margin: 0, fontSize: 12, lineHeight: '16px', color: '#4A5468' }}>
        Rule wording is simplified for this sample workspace and is not legal advice.
      </p>

    </>
  )
}
