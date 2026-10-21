import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { EqualHousingIcon, HouseIcon } from '../components/Icon'
import type { AdContent, Layer, Template } from '../lib/types'
import { MissingChip, OutlinedSpan, UnderlinedSpan, segment, type Marker, type MarkerState } from './markers'

/** Editing copy in place (Pre-check). */
export interface EditState {
  editedIds: Set<string>
  onChange: (layerId: string, text: string) => void
  /** Which layer is open for editing; kept by the page so a card's "Edit on ad" can open one. */
  editingId: string | null
  setEditing: (layerId: string | null) => void
}

export interface AdViewProps {
  content: AdContent
  markers?: Marker[]
  selected?: number | null
  onSelect?: (n: number) => void
  edit?: EditState
  /** Thumbnails skip markers, editing and focusable pins. */
  still?: boolean
}

export const IMAGE_TEMPLATES: Template[] = ['social-square', 'social-portrait', 'banner']
export const NATURAL_WIDTH: Record<Template, number> = {
  'social-square': 360,
  'social-portrait': 360,
  banner: 480,
  email: 380,
  'landing-page': 380,
  'blog-post': 380,
}

export function isImageTemplate(template: Template): boolean {
  return IMAGE_TEMPLATES.includes(template)
}

interface LayerProps {
  layer: Layer | undefined
  state: MarkerState
  edit?: EditState
  style?: CSSProperties
  kind: 'outline' | 'underline'
  as?: 'div' | 'span' | 'p'
  underlineOffset?: number
  prefix?: ReactNode
}

function AutoTextarea({ value, onCommit, onCancel, style }: { value: string; onCommit: (text: string) => void; onCancel: () => void; style: CSSProperties }) {
  const [text, setText] = useState(value)
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = `${el.scrollHeight}px`
  }, [text])
  useEffect(() => {
    ref.current?.focus()
    ref.current?.select()
  }, [])
  return (
    <textarea
      ref={ref}
      aria-label="Edit text"
      value={text}
      rows={1}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => onCommit(text)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          onCancel()
        }
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          onCommit(text)
        }
      }}
      style={{
        ...style,
        display: 'block',
        width: '100%',
        boxSizing: 'border-box',
        resize: 'none',
        overflow: 'hidden',
        background: 'rgba(255,255,255,0.12)',
        border: 'none',
        outline: '2px solid #0F766E',
        outlineOffset: 2,
        borderRadius: 4,
        padding: 0,
        margin: 0,
        font: 'inherit',
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        lineHeight: style.lineHeight,
        letterSpacing: style.letterSpacing,
        color: 'inherit',
      }}
    />
  )
}

function LayerText({ layer, state, edit, style, kind, as = 'div', underlineOffset, prefix }: LayerProps) {
  const editing = Boolean(edit && layer && edit.editingId === layer.id)
  if (!layer) return null
  const Tag = as
  const mine = state.markers.filter((m) => m.layerId === layer.id)
  const edited = edit?.editedIds.has(layer.id)

  if (edit && editing) {
    return (
      <Tag style={{ ...style, position: 'relative' }}>
        <AutoTextarea
          value={layer.text}
          style={style ?? {}}
          onCancel={() => edit.setEditing(null)}
          onCommit={(text) => {
            edit.setEditing(null)
            const clean = text.replace(/\s+\n/g, '\n').trim()
            if (clean && clean !== layer.text) edit.onChange(layer.id, clean)
          }}
        />
      </Tag>
    )
  }

  const small = (style?.fontSize as number | undefined) !== undefined && (style!.fontSize as number) < 10
  const content = segment(layer.text, mine).map((seg, i) => {
    if (!seg.markers.length) return <span key={i}>{seg.text}</span>
    return kind === 'outline' ? (
      <OutlinedSpan key={i} markers={seg.markers} state={state} small={small}>
        {seg.text}
      </OutlinedSpan>
    ) : (
      <UnderlinedSpan key={i} markers={seg.markers} state={state} offset={underlineOffset}>
        {seg.text}
      </UnderlinedSpan>
    )
  })

  const segments = segment(layer.text, mine)
  // A marker on the whole layer also takes in its icon, like the Equal Housing logo.
  const wholeLayer = prefix && segments.length === 1 && segments[0].markers.length > 0
  const body = wholeLayer ? (
    kind === 'outline' ? (
      <OutlinedSpan markers={segments[0].markers} state={state} small={small}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {prefix}
          {layer.text}
        </span>
      </OutlinedSpan>
    ) : (
      <UnderlinedSpan markers={segments[0].markers} state={state} offset={underlineOffset}>
        {prefix}
        {layer.text}
      </UnderlinedSpan>
    )
  ) : (
    <>
      {prefix}
      {content}
    </>
  )

  if (!edit) return <Tag style={style} data-layer={layer.id}>{body}</Tag>

  // Click the words to edit them; keyboard users get a separate Edit button, so no control sits inside another.
  return (
    <Tag style={{ ...style, position: 'relative' }} data-layer={layer.id}>
      <span className="fp-editable" data-edited={edited || undefined} onClick={() => edit.setEditing(layer.id)}>
        {body}
        {edited && <span className="fp-edited-badge">Edited</span>}
      </span>
      <button type="button" className="fp-edit-layer" aria-label={`Edit ${layer.role}: ${layer.text}`} onClick={() => edit.setEditing(layer.id)}>
        Edit
      </button>
    </Tag>
  )
}

function byRole(layers: Layer[], role: Layer['role']): Layer[] {
  return layers.filter((l) => l.role === role)
}

// ---------------------------------------------------------------- image templates

function SocialAd({ content, state, edit, portrait }: { content: AdContent; state: MarkerState; edit?: EditState; portrait: boolean }) {
  const { theme, layers } = content
  const fg = theme.fg ?? '#15213B'
  const eyebrow = byRole(layers, 'eyebrow')[0]
  const headline = byRole(layers, 'headline')[0]
  const bodies = byRole(layers, 'body')
  const cta = byRole(layers, 'cta')[0]
  const disclosures = byRole(layers, 'disclosure')
  const avatar = theme.avatar
  const center = Boolean(avatar)
  const layer = (l: Layer | undefined, style: CSSProperties) => (
    <LayerText key={l?.id} layer={l} state={state} edit={edit} kind="outline" style={{ position: 'relative', ...style }} />
  )
  return (
    <div
      style={{
        position: 'relative',
        width: 360,
        height: portrait ? 450 : 360,
        background: theme.bg ?? '#FFFFFF',
        borderRadius: 12,
        boxShadow: '0 1px 2px #15213B14',
        boxSizing: 'border-box',
        padding: 28,
        display: 'flex',
        flexDirection: 'column',
        alignItems: center ? 'center' : 'stretch',
        textAlign: center ? 'center' : 'left',
        gap: center ? 18 : 30,
        color: fg,
        overflow: 'hidden',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {(theme.shapes ?? []).map((s, i) => (
        <span
          key={i}
          aria-hidden="true"
          style={{
            position: 'absolute',
            right: s.right,
            bottom: s.bottom,
            width: s.w,
            height: s.h,
            borderRadius: s.shape === 'circle' ? 9999 : s.radius ?? 8,
            background: s.color,
          }}
        />
      ))}
      {avatar && <span aria-hidden="true" style={{ width: 96, height: 96, borderRadius: 9999, background: avatar, flexShrink: 0 }} />}
      {layer(eyebrow, { fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', lineHeight: 1.3 })}
      {layer(headline, {
        fontSize: headline?.style?.fontSize ?? 32,
        lineHeight: 1.12,
        fontWeight: headline?.style?.weight ?? 800,
      })}
      {bodies.map((b) =>
        layer(b, { fontSize: b.style?.fontSize ?? 15, lineHeight: 1.35, fontWeight: b.style?.weight ?? 400 }),
      )}
      {cta && (
        <div style={{ position: 'relative', alignSelf: center ? 'center' : 'flex-start' }}>
          <LayerText
            layer={cta}
            state={state}
            edit={edit}
            kind="outline"
            style={{
              background: theme.cta_bg ?? fg,
              color: theme.cta_fg ?? '#FFFFFF',
              fontSize: 14,
              lineHeight: '20px',
              fontWeight: 600,
              padding: '10px 16px',
              borderRadius: 6,
            }}
          />
        </div>
      )}
      {disclosures.length > 0 && <div style={{ flexGrow: 1 }} />}
      {disclosures.map((d) =>
        layer(d, {
          alignSelf: 'flex-start',
          fontSize: d.style?.fontSize ?? 7,
          lineHeight: 1.3,
          maxWidth: (d.style?.fontSize ?? 7) < 10 && theme.fine ? 150 : undefined,
          color: theme.fine ?? fg,
        }),
      )}
    </div>
  )
}

function BannerAd({ content, state, edit }: { content: AdContent; state: MarkerState; edit?: EditState }) {
  const { theme, layers } = content
  const fg = theme.fg ?? '#15213B'
  const eyebrow = byRole(layers, 'eyebrow')[0]
  const headline = byRole(layers, 'headline')[0]
  const cta = byRole(layers, 'cta')[0]
  const disclosures = byRole(layers, 'disclosure')
  return (
    <div
      style={{
        width: 480,
        background: theme.bg ?? '#FFFFFF',
        borderRadius: 12,
        padding: '22px 24px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        color: fg,
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <LayerText layer={eyebrow} state={state} edit={edit} kind="outline" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em' }} />
          <LayerText layer={headline} state={state} edit={edit} kind="outline" style={{ fontSize: 22, lineHeight: 1.15, fontWeight: 800 }} />
          {cta && (
            <div style={{ alignSelf: 'flex-start' }}>
              <LayerText
                layer={cta}
                state={state}
                edit={edit}
                kind="outline"
                style={{
                  background: theme.cta_bg ?? fg,
                  color: theme.cta_fg ?? '#FFFFFF',
                  fontSize: 12,
                  lineHeight: '18px',
                  fontWeight: 700,
                  padding: '7px 12px',
                  borderRadius: 6,
                }}
              />
            </div>
          )}
        </div>
        {theme.art === 'house' && <HouseIcon size={80} color={theme.art_color ?? '#3A6EA5'} />}
        {theme.art === 'card' && (
          <span aria-hidden="true" style={{ flexShrink: 0, width: 72, height: 48, borderRadius: 6, background: theme.art_color ?? '#F2C94C' }} />
        )}
      </div>
      {disclosures.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 20, paddingTop: 6 }}>
          {disclosures.map((d) =>
            d.style?.icon === 'equal-housing' ? (
              <LayerText
                key={d.id}
                layer={d}
                state={state}
                edit={edit}
                kind="outline"
                as="span"
                prefix={<EqualHousingIcon size={14} color={fg} />}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 8, fontWeight: 800, letterSpacing: '0.04em' }}
              />
            ) : (
              <LayerText key={d.id} layer={d} state={state} edit={edit} kind="outline" as="span" style={{ fontSize: 10, fontWeight: 600 }} />
            ),
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- text templates

const FRAME: CSSProperties = {
  width: '100%',
  minWidth: 0,
  border: '1px solid #D8DCE3',
  borderRadius: 12,
  display: 'flex',
  flexDirection: 'column',
  minHeight: 300,
  boxSizing: 'border-box',
  overflow: 'hidden',
  background: '#FFFFFF',
  color: '#15213B',
  fontFamily: 'Inter, system-ui, sans-serif',
}

function Placeholder({ width }: { width: string }) {
  return <div aria-hidden="true" style={{ height: 6, width, background: '#EEF0F4', borderRadius: 3, flexShrink: 0 }} />
}

function MissingChips({ state }: { state: MarkerState }) {
  const missing = state.markers.filter((m) => m.layerId === null)
  return (
    <>
      {missing.map((m) => (
        <MissingChip key={m.n} marker={m} state={state} />
      ))}
    </>
  )
}

function EmailAd({ content, state, edit }: { content: AdContent; state: MarkerState; edit?: EditState }) {
  const { theme, layers } = content
  const from = byRole(layers, 'from')[0]
  const subject = byRole(layers, 'subject')[0]
  const bodies = byRole(layers, 'body')
  const cta = byRole(layers, 'cta')[0]
  const disclosures = byRole(layers, 'disclosure')
  return (
    <div style={FRAME}>
      {theme.accent && <div aria-hidden="true" style={{ height: 6, background: theme.accent, flexShrink: 0 }} />}
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10, flexGrow: 1 }}>
        <MissingChips state={state} />
        <LayerText layer={from} state={state} edit={edit} kind="underline" prefix="From: " style={{ fontSize: 12, color: '#4A5468' }} />
        <LayerText
          layer={subject}
          state={state}
          edit={edit}
          kind="underline"
          prefix={<span style={{ color: '#4A5468', fontWeight: 400 }}>Subject: </span>}
          style={{ fontSize: 14, lineHeight: '22px', fontWeight: 700 }}
        />
        <div aria-hidden="true" style={{ height: 1, background: '#E3E6EC', flexShrink: 0 }} />
        {bodies.map((b, i) => (
          <LayerText
            key={b.id}
            layer={b}
            state={state}
            edit={edit}
            kind="underline"
            as="p"
            style={{ margin: 0, fontSize: 14, lineHeight: '22px', color: i === 0 ? '#15213B' : '#374151' }}
          />
        ))}
        {cta && (
          <div style={{ alignSelf: 'flex-start' }}>
            <LayerText
              layer={cta}
              state={state}
              edit={edit}
              kind="underline"
              style={{ background: '#15213B', color: '#FFFFFF', fontSize: 13, lineHeight: '18px', fontWeight: 600, padding: '9px 14px', borderRadius: 6 }}
            />
          </div>
        )}
        <Placeholder width="80%" />
        <Placeholder width="60%" />
        {disclosures.map((d) => (
          <LayerText key={d.id} layer={d} state={state} edit={edit} kind="underline" style={{ fontSize: 11, lineHeight: '16px', color: '#4A5468' }} />
        ))}
      </div>
    </div>
  )
}

function UrlBar({ url }: { url?: string }) {
  return (
    <div style={{ padding: '8px 12px', background: '#F6F7F9', borderBottom: '1px solid #E3E6EC', fontSize: 12, lineHeight: '16px', color: '#4A5468' }}>
      {url}
    </div>
  )
}

function LandingPageAd({ content, state, edit }: { content: AdContent; state: MarkerState; edit?: EditState }) {
  const { theme, layers } = content
  const headline = byRole(layers, 'headline')[0]
  const bodies = byRole(layers, 'body')
  const cta = byRole(layers, 'cta')[0]
  const disclosures = byRole(layers, 'disclosure')
  return (
    <div style={FRAME}>
      <UrlBar url={theme.url} />
      <div style={{ padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 10, flexGrow: 1 }}>
        <MissingChips state={state} />
        <LayerText layer={headline} state={state} edit={edit} kind="underline" style={{ fontSize: 21, lineHeight: 1.2, fontWeight: 800 }} />
        {bodies.map((b) => (
          <LayerText
            key={b.id}
            layer={b}
            state={state}
            edit={edit}
            kind="underline"
            style={{ fontSize: b.style?.fontSize ?? 15, lineHeight: '22px', fontWeight: b.style?.weight ?? 600 }}
          />
        ))}
        {cta && (
          <div style={{ alignSelf: 'flex-start' }}>
            <LayerText
              layer={cta}
              state={state}
              edit={edit}
              kind="underline"
              style={{
                background: theme.cta_bg ?? '#15213B',
                color: theme.cta_fg ?? '#FFFFFF',
                fontSize: 13,
                lineHeight: '18px',
                fontWeight: 600,
                padding: '9px 14px',
                borderRadius: 6,
              }}
            />
          </div>
        )}
        <Placeholder width="90%" />
        <Placeholder width="75%" />
        <div style={{ flexGrow: 1, minHeight: 20 }} />
        {disclosures.map((d) => (
          <LayerText key={d.id} layer={d} state={state} edit={edit} kind="underline" underlineOffset={3} style={{ fontSize: 9, lineHeight: '14px', color: '#4A5468' }} />
        ))}
      </div>
    </div>
  )
}

function BlogPostAd({ content, state, edit }: { content: AdContent; state: MarkerState; edit?: EditState }) {
  const { theme, layers } = content
  const headline = byRole(layers, 'headline')[0]
  const bodies = byRole(layers, 'body')
  const disclosures = byRole(layers, 'disclosure')
  return (
    <div style={FRAME}>
      <UrlBar url={theme.url} />
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <MissingChips state={state} />
        {disclosures.map((d) => (
          <LayerText key={d.id} layer={d} state={state} edit={edit} kind="underline" style={{ fontSize: 12, lineHeight: '18px', color: '#4A5468' }} />
        ))}
        <LayerText layer={headline} state={state} edit={edit} kind="underline" style={{ fontSize: 19, lineHeight: 1.25, fontWeight: 800 }} />
        {bodies.map((b) => (
          <LayerText key={b.id} layer={b} state={state} edit={edit} kind="underline" as="p" style={{ margin: 0, fontSize: 14, lineHeight: '22px', color: '#374151' }} />
        ))}
        <Placeholder width="85%" />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- entry points

function Template({ content, state, edit }: { content: AdContent; state: MarkerState; edit?: EditState }) {
  switch (content.template) {
    case 'social-square':
      return <SocialAd content={content} state={state} edit={edit} portrait={false} />
    case 'social-portrait':
      return <SocialAd content={content} state={state} edit={edit} portrait />
    case 'banner':
      return <BannerAd content={content} state={state} edit={edit} />
    case 'email':
      return <EmailAd content={content} state={state} edit={edit} />
    case 'landing-page':
      return <LandingPageAd content={content} state={state} edit={edit} />
    case 'blog-post':
      return <BlogPostAd content={content} state={state} edit={edit} />
  }
}

/** Fixed-size templates scale down to fit their container, never squashed. */
function ScaleToFit({ width, children }: { width: number; children: ReactNode }) {
  const outer = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ scale: 1, height: 0, available: width })
  useLayoutEffect(() => {
    const measure = () => {
      if (!outer.current || !inner.current) return
      const available = outer.current.clientWidth
      const scale = Math.min(1, available / width)
      setBox({ scale, height: inner.current.offsetHeight * scale, available })
    }
    measure()
    const observer = new ResizeObserver(measure)
    if (outer.current) observer.observe(outer.current)
    if (inner.current) observer.observe(inner.current)
    return () => observer.disconnect()
  }, [width])
  const left = Math.max(0, (box.available - width * box.scale) / 2)
  return (
    <div ref={outer} style={{ width: '100%', height: box.height || undefined, position: 'relative' }}>
      <div ref={inner} style={{ width, position: 'absolute', top: 0, left, transform: `scale(${box.scale})`, transformOrigin: '0 0' }}>
        {children}
      </div>
    </div>
  )
}

/** The ad itself, drawn from its data. The same renderer serves thumbnails, the drawer, Review and Pre-check. */
export function AdView({ content, markers = [], selected = null, onSelect, edit }: AdViewProps) {
  const state: MarkerState = { markers, selected, onSelect }
  if (!isImageTemplate(content.template)) return <Template content={content} state={state} edit={edit} />
  const missing = markers.filter((m) => m.layerId === null)
  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <ScaleToFit width={NATURAL_WIDTH[content.template]}>
        <Template content={content} state={state} edit={edit} />
      </ScaleToFit>
      {missing.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
          {missing.map((m) => (
            <MissingChip key={m.n} marker={m} state={state} />
          ))}
        </div>
      )}
    </div>
  )
}

/** A 56px thumbnail: the renderer scaled with CSS, cropped to a square, never squashed. */
export function AdThumbnail({ content, size = 56 }: { content: AdContent; size?: number }) {
  const width = NATURAL_WIDTH[content.template]
  const image = isImageTemplate(content.template)
  const scale = content.template === 'banner' ? (size / 160) : size / width
  const state: MarkerState = { markers: [] }
  return (
    <span
      aria-hidden="true"
      style={{
        position: 'relative',
        flex: `0 0 ${size}px`,
        width: size,
        height: size,
        borderRadius: 8,
        overflow: 'hidden',
        background: image ? content.theme.bg ?? '#FFFFFF' : '#FFFFFF',
        border: image ? undefined : '1px solid #E3E6EC',
        boxSizing: 'border-box',
        display: 'block',
        pointerEvents: 'none',
      }}
    >
      <span
        inert
        style={{ position: 'absolute', left: 0, top: 0, width, transform: `scale(${scale})`, transformOrigin: '0 0', display: 'block' }}
      >
        <Template content={content} state={state} />
      </span>
    </span>
  )
}
