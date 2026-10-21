import { Tooltip } from 'antd'
import type { CSSProperties } from 'react'
import type { Stat } from '../lib/types'
import { Icon, type IconName } from './Icon'

const TILE: Record<Stat['tone'], CSSProperties> = {
  warning: { background: '#FFF4E5', color: '#A15C07' },
  success: { background: '#ECFDF3', color: '#067647' },
  primary: { background: '#E6F4F1', color: '#0F766E' },
}

const ICONS: Record<string, IconName> = {
  attention: 'attention',
  clock: 'clock',
  check: 'checkCircle',
  inbox: 'inbox',
  calendar: 'calendar',
  timer: 'timer',
  target: 'target',
}

export function trendText(trend: NonNullable<Stat['trend']>): string {
  const text = `${trend.value}${trend.unit === 'pts' ? ' pts' : '%'}`
  return `${trend.direction === 'up' ? 'Up' : 'Down'} ${text} ${trend.compared_to}`
}

/** `inert` inside a clickable card: the card's own label says the trend instead. */
export function TrendBadge({ trend, inert = false }: { trend: NonNullable<Stat['trend']>; inert?: boolean }) {
  const text = `${trend.value}${trend.unit === 'pts' ? ' pts' : '%'}`
  return (
    <Tooltip title={trend.compared_to}>
      <span
        tabIndex={inert ? undefined : 0}
        aria-label={inert ? undefined : trendText(trend)}
        aria-hidden={inert || undefined}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 3,
          padding: '2px 8px',
          borderRadius: 9999,
          fontSize: 12,
          lineHeight: '16px',
          fontWeight: 700,
          // Green only when the change is good; otherwise neutral, never alarming red.
          background: trend.good ? '#ECFDF3' : '#EEF2F7',
          color: trend.good ? '#067647' : '#4A5468',
        }}
      >
        <Icon name={trend.direction === 'up' ? 'arrowUp' : 'arrowDown'} size={11} strokeWidth={2.8} />
        {text}
      </span>
    </Tooltip>
  )
}

/** A card that filters the table below it, on or off. */
export type StatAction = { active: boolean; onClick: () => void }

export function StatCards({ stats, actions = {} }: { stats: Stat[]; actions?: Record<string, StatAction> }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
      {stats.map((stat) => {
        const action = actions[stat.key]
        const active = Boolean(action?.active)
        const content = (
          <>
            <span
              aria-hidden="true"
              style={{
                flexShrink: 0,
                width: 44,
                height: 44,
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                ...TILE[stat.tone],
              }}
            >
              <Icon name={ICONS[stat.icon] ?? 'checkCircle'} size={22} />
            </span>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'left' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span data-stat-value style={{ fontSize: 26, lineHeight: '32px', fontWeight: 800 }}>
                  {stat.display ?? (stat.value === null ? '–' : stat.value.toLocaleString('en-US'))}
                </span>
                {stat.trend && <TrendBadge trend={stat.trend} inert={Boolean(action)} />}
              </span>{' '}
              <span style={{ fontSize: 13, lineHeight: '16px', color: '#4A5468' }}>{stat.label}</span>
              {active && <span style={{ fontSize: 12, lineHeight: '16px', fontWeight: 600, color: '#115E59' }}>Showing only these</span>}
              {action && (
                // The card's name is what it shows, plus what the badge and a click mean.
                <span className="fp-visually-hidden">
                  {stat.trend ? `, ${trendText(stat.trend)}` : ''}
                  {active ? '. Click to show all' : '. Filter the table to these'}
                </span>
              )}
            </span>
            {action && (
              // The same funnel as the table's column filters: this card filters the table.
              <span aria-hidden="true" className="fp-stat-funnel" style={{ color: active ? '#0F766E' : '#8A93A6' }}>
                <Icon name="filter" size={14} strokeWidth={2.2} />
              </span>
            )}
          </>
        )
        const style: CSSProperties = {
          flex: '1 1 0',
          minWidth: 200,
          maxWidth: 264,
          background: '#FFFFFF',
          border: `1px solid ${active ? '#0F766E' : '#E3E6EC'}`,
          boxShadow: active ? '0 0 0 1px #0F766E' : undefined,
          borderRadius: 14,
          padding: '16px 22px 16px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          boxSizing: 'border-box',
          position: 'relative',
          font: 'inherit',
          color: 'inherit',
          textDecoration: 'none',
        }
        if (action) {
          return (
            <button
              key={stat.key}
              type="button"
              data-stat={stat.key}
              className="fp-stat-card"
              style={style}
              aria-pressed={active}
              onClick={action.onClick}
            >
              {content}
            </button>
          )
        }
        return (
          <div key={stat.key} data-stat={stat.key} style={style}>
            {content}
          </div>
        )
      })}
    </div>
  )
}
