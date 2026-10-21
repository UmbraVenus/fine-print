import { Skeleton } from 'antd'
import { Link } from 'react-router-dom'
import { useWorkspace } from '../app/workspace'
import { Icon } from '../components/Icon'
import { TrendBadge } from '../components/StatCards'
import { SeverityTag } from '../components/StatusTag'
import type { Trend } from '../lib/types'
import { useApi } from '../lib/useApi'

interface Metric {
  key: string
  label: string
  display: string
  trend: Trend | null
  note: string
  /** Weekly values, oldest first: the week before Fine Print, then the 8 weeks since. */
  series: Array<number | null>
}

interface Insights {
  hero: { line: string } | null
  metrics: Metric[]
  issues: Array<{ rule_id: string; name: string; share: number }>
  affiliates: Array<{ source: string; score: number; ads: number; status: 'good' | 'watch' | 'at_risk' }>
}

const AFFILIATE_TAG = {
  good: { kind: 'good', label: 'Good' },
  watch: { kind: 'caution', label: 'Watch' },
  at_risk: { kind: 'critical', label: 'At risk' },
} as const

/** A teal line through the weekly values; the trend badge and note carry the meaning in words. */
function Sparkline({ series, label }: { series: Array<number | null>; label: string }) {
  const points = series.map((v, i) => [i, v] as const).filter((p): p is readonly [number, number] => p[1] !== null)
  if (points.length < 2) return null
  const values = points.map((p) => p[1])
  const min = Math.min(...values)
  const range = Math.max(...values) - min || 1
  const width = 180
  const height = 32
  const step = width / (series.length - 1)
  const line = points.map(([i, v]) => `${(i * step).toFixed(1)},${(height - 2 - ((v - min) / range) * (height - 4)).toFixed(1)}`).join(' ')
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`${label}, week by week: from ${values[0]} to ${values[values.length - 1]}`}
      style={{ width: '100%', height }}
    >
      <polyline points={line} fill="none" stroke="#0F766E" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

function MetricCard({ metric }: { metric: Metric }) {
  return (
    <section className="fp-card" aria-label={metric.label} style={{ padding: '24px 22px 22px', display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
      <h2 style={{ margin: 0, fontSize: 13, lineHeight: '18px', fontWeight: 600, color: '#4A5468' }}>{metric.label}</h2>
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <span data-insight={metric.key} style={{ fontSize: 40, lineHeight: '48px', fontWeight: 800, letterSpacing: '-0.02em' }}>
          {metric.display}
        </span>
        {metric.trend && <TrendBadge trend={metric.trend} />}
      </div>
      <p style={{ margin: 0, fontSize: 13, lineHeight: '18px', color: '#4A5468', minHeight: 36 }}>{metric.note}</p>
      <div style={{ marginTop: 6 }}>
        <Sparkline series={metric.series} label={metric.label} />
      </div>
    </section>
  )
}

/** One line of the throughput story, and the way into today's work. */
function Hero({ hero, pending }: { hero: NonNullable<Insights['hero']>; pending: number | null }) {
  return (
    <section
      aria-label="This week"
      style={{
        background: '#E6F4F1',
        borderLeft: '4px solid #0F766E',
        borderRadius: 12,
        padding: '16px 20px 16px 24px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
      }}
    >
      <p data-insight="hero" style={{ margin: 0, fontSize: 18, lineHeight: '26px', fontWeight: 700 }}>
        {hero.line}
      </p>
      <Link to="/queue" className="fp-hero-button">
        Open the Queue{pending !== null ? ` · ${pending}` : ''}
        <Icon name="arrowRight" size={16} strokeWidth={2.2} />
      </Link>
    </section>
  )
}

export function InsightsPage() {
  const { data, error } = useApi<Insights>('/api/insights')
  const { pending } = useWorkspace()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <h1 className="fp-page-title">Insights</h1>
        <span style={{ fontSize: 14, lineHeight: '20px', color: '#4A5468' }}>Last 8 weeks</span>
      </div>
      {error ? (
        <p role="alert" style={{ margin: 0, fontSize: 15, color: '#4A5468' }}>
          Insights didn't load. Reload the page to try again.
        </p>
      ) : !data ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : (
        <>
          {data.hero && <Hero hero={data.hero} pending={pending} />}
          <div className="fp-insight-metrics">
            {data.metrics.map((metric) => (
              <MetricCard key={metric.key} metric={metric} />
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, alignItems: 'start' }}>
            <section className="fp-card" aria-labelledby="top-issues" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <h2 id="top-issues" style={{ margin: 0, fontSize: 18, lineHeight: '26px', fontWeight: 700 }}>
                Top issue types
              </h2>
              {data.issues.length === 0 && <p style={{ margin: 0, fontSize: 14, color: '#4A5468' }}>Nothing flagged in the last 8 weeks.</p>}
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
                {data.issues.map((issue) => (
                  <li key={issue.rule_id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 15, lineHeight: '20px' }}>
                      <span>{issue.name}</span>
                      <span style={{ fontWeight: 700 }}>{issue.share}%</span>
                    </span>
                    <span aria-hidden="true" style={{ height: 8, borderRadius: 9999, background: '#EEF2F7', overflow: 'hidden' }}>
                      <span style={{ display: 'block', height: '100%', width: `${issue.share}%`, background: '#15213B', borderRadius: 9999 }} />
                    </span>
                  </li>
                ))}
              </ul>
              <Link to="/rules" className="fp-text-link" style={{ alignSelf: 'flex-start', fontSize: 14, fontWeight: 600 }}>
                See all rules
              </Link>
            </section>
            <section className="fp-card" aria-labelledby="affiliates" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <h2 id="affiliates" style={{ margin: 0, fontSize: 18, lineHeight: '26px', fontWeight: 700 }}>
                  Affiliate compliance
                </h2>
                <span style={{ fontSize: 13, lineHeight: '18px', color: '#4A5468' }}>Score out of 100, from first-round approvals</span>
              </div>
              {data.affiliates.length === 0 && <p style={{ margin: 0, fontSize: 14, color: '#4A5468' }}>No affiliate ads in the last 8 weeks.</p>}
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {data.affiliates.map((a, i) => {
                  const tag = AFFILIATE_TAG[a.status]
                  return (
                    <li
                      key={a.source}
                      data-affiliate={a.source}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderTop: i ? '1px solid #E3E6EC' : undefined, fontSize: 15 }}
                    >
                      <span style={{ flexGrow: 1, minWidth: 0 }}>{a.source}</span>
                      <span style={{ fontWeight: 700 }} aria-label={`Score ${a.score} out of 100`}>
                        {a.score}
                      </span>
                      <span style={{ width: 80, display: 'flex' }}>
                        <SeverityTag kind={tag.kind}>{tag.label}</SeverityTag>
                      </span>
                    </li>
                  )
                })}
              </ul>
            </section>
          </div>
        </>
      )}
    </div>
  )
}
