import type { CSSProperties, ReactNode } from 'react'
import { Icon } from '../components/Icon'

/** A finding drawn on the ad: a numbered pin anchored to a layer, and to a quote inside it when there is one. */
export interface Marker {
  n: number
  layerId: string | null
  quote: string | null
  /** Shown as a chip when the finding is about something missing from the ad. */
  missingLabel?: string
  label?: string
  tone?: 'default' | 'resolved'
  /** A reviewer's own finding: its pin shows a person, not a number. */
  kind?: 'auto' | 'reviewer'
}

export interface MarkerState {
  markers: Marker[]
  selected?: number | null
  onSelect?: (n: number) => void
}

export interface Segment {
  text: string
  markers: Marker[]
}

/** Split a layer's text around the quoted words of its markers (first occurrence of each, no overlaps). */
export function segment(text: string, markers: Marker[]): Segment[] {
  const ranges: Array<{ start: number; end: number; marker: Marker }> = []
  const whole: Marker[] = []
  for (const marker of markers) {
    const start = marker.quote ? text.indexOf(marker.quote) : -1
    if (!marker.quote || start < 0) {
      whole.push(marker)
      continue
    }
    const end = start + marker.quote.length
    const overlapping = ranges.find((r) => start < r.end && end > r.start)
    if (overlapping && overlapping.start === start && overlapping.end === end) {
      // Two findings on the same words share one outline with two pins.
      ranges.push({ start, end, marker })
    } else if (!overlapping) {
      ranges.push({ start, end, marker })
    } else {
      whole.push(marker)
    }
  }
  if (whole.length) return [{ text, markers: [...whole, ...ranges.map((r) => r.marker)] }]
  ranges.sort((a, b) => a.start - b.start || a.marker.n - b.marker.n)
  const segments: Segment[] = []
  let cursor = 0
  for (const range of ranges) {
    if (range.start < cursor) {
      segments[segments.length - 1].markers.push(range.marker)
      continue
    }
    if (range.start > cursor) segments.push({ text: text.slice(cursor, range.start), markers: [] })
    segments.push({ text: text.slice(range.start, range.end), markers: [range.marker] })
    cursor = range.end
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), markers: [] })
  return segments
}

const TEAL = '#0F766E'
const INK = '#15213B'
const GREEN = '#067647'

function markerColor(marker: Marker, selected: boolean): string {
  if (marker.tone === 'resolved') return GREEN
  return selected ? TEAL : INK
}

function pinLabel(marker: Marker): string {
  const prefix =
    marker.kind === 'reviewer' ? 'Reviewer finding' : marker.tone === 'resolved' ? `Resolved ${marker.n}` : `Finding ${marker.n}`
  return marker.label ? `${prefix}: ${marker.label}` : prefix
}

function Pin({
  marker,
  state,
  size,
  style,
}: {
  marker: Marker
  state: MarkerState
  size: number
  style?: CSSProperties
}) {
  const selected = state.selected === marker.n
  const color = markerColor(marker, selected)
  return (
    <button
      type="button"
      className="fp-pin"
      aria-label={pinLabel(marker)}
      aria-pressed={state.onSelect ? selected : undefined}
      data-pin={marker.n}
      onClick={(event) => {
        event.stopPropagation()
        state.onSelect?.(marker.n)
      }}
      style={{
        width: size,
        height: size,
        borderRadius: 9999,
        background: color,
        color: '#FFFFFF',
        fontSize: size >= 24 ? 13 : size >= 20 ? 11 : 10,
        fontWeight: 700,
        lineHeight: 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 'none',
        padding: 0,
        cursor: state.onSelect ? 'pointer' : 'default',
        fontFamily: 'Inter, system-ui, sans-serif',
        letterSpacing: 0,
        ...style,
      }}
    >
      {marker.kind === 'reviewer' ? <Icon name="person" size={Math.round(size * 0.6)} strokeWidth={2.6} /> : marker.n}
    </button>
  )
}

/** Image-style templates: a thin ink outline with a white keyline and a pin at the top-right. Never filled. */
export function OutlinedSpan({
  markers,
  state,
  children,
  small,
  block,
}: {
  markers: Marker[]
  state: MarkerState
  children: ReactNode
  small?: boolean
  block?: boolean
}) {
  const selected = markers.some((m) => m.n === state.selected)
  const color = markerColor(markers[0], selected)
  const pinSize = markers[0].tone === 'resolved' ? 22 : 26
  return (
    <span
      data-marker={markers.map((m) => m.n).join(' ')}
      onClick={() => state.onSelect?.(markers[0].n)}
      style={{
        position: 'relative',
        display: block ? 'block' : 'inline-block',
        padding: small ? '0 2px' : '0 3px',
        outline: `2px solid ${color}`,
        outlineOffset: 1,
        boxShadow: '0 0 0 1px #FFFFFF',
        borderRadius: small ? 2 : 4,
        cursor: state.onSelect ? 'pointer' : undefined,
      }}
    >
      {children}
      {markers.map((marker, index) =>
        small ? (
          <Pin
            key={marker.n}
            marker={marker}
            state={state}
            size={pinSize}
            style={{ position: 'absolute', top: -pinSize - 6, left: -6 + index * (pinSize + 4), boxShadow: '0 0 0 2px #FFFFFF' }}
          />
        ) : (
          <Pin
            key={marker.n}
            marker={marker}
            state={state}
            size={pinSize}
            style={{
              position: 'absolute',
              top: -(pinSize * 0.7),
              right: -(pinSize * 0.7) + index * (pinSize + 4) * -1,
              boxShadow: '0 0 0 2px #FFFFFF',
            }}
          />
        ),
      )}
    </span>
  )
}

/** Text templates: a 2px underline on the quoted words, and the same numbered pin. */
export function UnderlinedSpan({
  markers,
  state,
  children,
  offset = 4,
}: {
  markers: Marker[]
  state: MarkerState
  children: ReactNode
  offset?: number
}) {
  const selected = markers.some((m) => m.n === state.selected)
  const color = markerColor(markers[0], selected)
  return (
    <>
      <span
        data-marker={markers.map((m) => m.n).join(' ')}
        onClick={() => state.onSelect?.(markers[0].n)}
        style={{
          textDecoration: 'underline',
          textDecorationThickness: 2,
          textUnderlineOffset: offset,
          textDecorationColor: color,
          cursor: state.onSelect ? 'pointer' : undefined,
        }}
      >
        {children}
      </span>
      {markers.map((marker) => (
        <Pin
          key={marker.n}
          marker={marker}
          state={state}
          size={18}
          style={{ verticalAlign: 'super', marginLeft: 3, fontSize: 10 }}
        />
      ))}
    </>
  )
}

/** A finding about something missing from the ad, like an affiliate disclosure. */
export function MissingChip({ marker, state }: { marker: Marker; state: MarkerState }) {
  const selected = state.selected === marker.n
  return (
    <span
      data-marker={marker.n}
      onClick={() => state.onSelect?.(marker.n)}
      style={{
        alignSelf: 'flex-start',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 12,
        lineHeight: '18px',
        fontWeight: 600,
        color: '#4A5468',
        background: '#F6F7F9',
        border: `1px solid ${selected ? TEAL : '#C9CED8'}`,
        borderRadius: 6,
        padding: '3px 8px',
        fontFamily: 'Inter, system-ui, sans-serif',
        letterSpacing: 0,
        cursor: state.onSelect ? 'pointer' : undefined,
      }}
    >
      {marker.missingLabel}
      <Pin marker={marker} state={state} size={18} />
    </span>
  )
}
