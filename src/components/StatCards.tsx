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

function TrendBadge({ trend }: { trend: NonNullable<Stat['trend']> }) {
  const text = `${trend.value}${trend.unit === 'pts' ? ' pts' : '%'}`
  const word = trend.direction === 'up' ? 'Up' : 'Down'
  return (
    <Tooltip title={trend.compared_to}>
      <span
        tabIndex={0}
        aria-label={`${word} ${text} ${trend.compared_to}`}
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

export function StatCards({ stats }: { stats: Stat[] }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
      {stats.map((stat) => (
        <div
          key={stat.key}
          data-stat={stat.key}
          style={{
            flex: '1 1 0',
            minWidth: 200,
            maxWidth: 264,
            background: '#FFFFFF',
            border: '1px solid #E3E6EC',
            borderRadius: 14,
            padding: '16px 22px 16px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            boxSizing: 'border-box',
          }}
        >
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span data-stat-value style={{ fontSize: 26, lineHeight: '32px', fontWeight: 800 }}>
                {stat.display ?? (stat.value === null ? '–' : stat.value.toLocaleString('en-US'))}
              </span>
              {stat.trend && <TrendBadge trend={stat.trend} />}
            </span>
            <span style={{ fontSize: 13, lineHeight: '16px', color: '#4A5468' }}>{stat.label}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
