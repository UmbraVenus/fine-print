import { Tooltip } from 'antd'
import { Link } from 'react-router-dom'
import { useWorkspace } from '../app/workspace'
import { Icon } from '../components/Icon'
import { trendText } from '../components/StatCards'
import { SeverityTag } from '../components/StatusTag'
import type { Trend } from '../lib/types'
import { useApi } from '../lib/useApi'
import { Loading } from '../components/Loading'

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
  metrics: Metric[]
  issues: Array<{ rule_id: string; name: string; share: number }>
  affiliates: Array<{ source: string; score: number; ads: number; status: 'good' | 'watch' | 'at_risk' }>
}

const AFFILIATE_TAG = {
  good: { kind: 'good', label: 'Good' },
  watch: { kind: 'caution', label: 'Watch' },
  at_risk: { kind: 'critical', label: 'At risk' },
} as const

/** How each metric's values read on the chart's axis. */
const FORMAT: Record<string, (v: number) => string> = {
  approved: (v) => `${Math.round(v)}`,
  turnaround: (v) => `${Math.round(v)}h`,
  rounds: (v) => v.toFixed(1),
  first_round: (v) => `${Math.round(v)}%`,
}

/** The weekly values as a small line chart, with its scale: highest and lowest on the left, weeks along the bottom. */
function Sparkline({ series, label, format }: { series: Array<number | null>; label: string; format: (v: number) => string }) {
  const points = series.map((v, i) => [i, v] as const).filter((p): p is readonly [number, number] => p[1] !== null)
  if (points.length < 2) return null
  const values = points.map((p) => p[1])
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const width = 180
  const height = 48
  const step = width / (series.length - 1)
  const y = (v: number) => height - 3 - ((v - min) / range) * (height - 6)
  const line = points.map(([i, v]) => `${(i * step).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const axis = { fontSize: 11, lineHeight: '14px', color: '#6B7385' } as const
  return (
    <figure style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 8, rowGap: 4 }}>
      <div aria-hidden="true" style={{ ...axis, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', textAlign: 'right' }}>
        <span>{format(max)}</span>
        <span>{format(min)}</span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`${label}, week by week from 8 weeks ago to this week: ${values.map(format).join(', ')}`}
        style={{ width: '100%', height, display: 'block' }}
      >
        <line x1={0} x2={width} y1={y(max)} y2={y(max)} stroke="#EEF2F7" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        <line x1={0} x2={width} y1={height - 0.5} y2={height - 0.5} stroke="#C9CED8" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        <polyline points={line} fill="none" stroke="#0F766E" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <span />
      <div aria-hidden="true" style={{ ...axis, display: 'flex', justifyContent: 'space-between' }}>
        <span>8 wks ago</span>
        <span>This week</span>
      </div>
    </figure>
  )
}

function MetricCard({ metric }: { metric: Metric }) {
  return (
    <section className="fp-card" aria-label={metric.label} style={{ padding: '24px 22px 22px', display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
      <h2 style={{ margin: 0, fontSize: 17, lineHeight: '24px', fontWeight: 700 }}>{metric.label}</h2>
      {/* The change takes the stage; the number it's based on sits under it. */}
      {metric.trend ? (
        <Tooltip title={metric.trend.compared_to}>
          <span
            tabIndex={0}
            aria-label={trendText(metric.trend)}
            style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 40, lineHeight: '48px', fontWeight: 800, letterSpacing: '-0.02em', color: metric.trend.good ? '#067647' : '#15213B' }}
          >
            <Icon name={metric.trend.direction === 'up' ? 'arrowUp' : 'arrowDown'} size={28} strokeWidth={3} />
            {metric.trend.value}
            {metric.trend.unit === 'pts' ? ' pts' : '%'}
          </span>
        </Tooltip>
      ) : (
        <span style={{ fontSize: 40, lineHeight: '48px', fontWeight: 800, letterSpacing: '-0.02em' }}>{metric.display}</span>
      )}
      <p style={{ margin: 0, fontSize: 13, lineHeight: '18px', color: '#4A5468', minHeight: 36 }}>
        {metric.trend && (
          <>
            <span data-insight={metric.key} style={{ fontSize: 15, fontWeight: 700, color: '#15213B' }}>
              {metric.display}
            </span>
            {' · '}
          </>
        )}
        {metric.note}
      </p>
      {/* Pinned to the bottom, so the four charts line up whatever the text above them. */}
      <div style={{ marginTop: 'auto', paddingTop: 6 }}>
        <Sparkline series={metric.series} label={metric.label} format={FORMAT[metric.key] ?? String} />
      </div>
    </section>
  )
}

export function InsightsPage() {
  const { latest: data, error } = useApi<Insights>('/api/insights', 0, true)
  const { pending } = useWorkspace()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <h1 className="fp-page-title">Insights</h1>
          <span style={{ fontSize: 14, lineHeight: '20px', color: '#4A5468' }}>Last 8 weeks</span>
        </div>
        <Link to="/queue" className="fp-hero-button">
          Open the Queue{pending !== null ? ` · ${pending}` : ''}
          <Icon name="arrowRight" size={16} strokeWidth={2.2} />
        </Link>
      </div>
      {error ? (
        <p role="alert" style={{ margin: 0, fontSize: 15, color: '#4A5468' }}>
          Insights didn't load. Reload the page to try again.
        </p>
      ) : !data ? (
        <Loading text="Adding up the numbers…" />
      ) : (
        <>
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
