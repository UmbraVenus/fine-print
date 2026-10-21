import { Button, Input, Popconfirm } from 'antd'
import { useState } from 'react'
import { Icon } from '../components/Icon'
import { ReviewerPin, reviewerN } from '../findings/parts'
import type { Finding } from '../lib/detail'

const textButton = {
  font: 'inherit',
  fontSize: 13,
  fontWeight: 600,
  background: 'transparent',
  border: 'none',
  padding: '6px 8px',
  borderRadius: 6,
  cursor: 'pointer',
} as const

function ReviewerCard({
  finding,
  onEdit,
  onDelete,
  readOnly,
  pinned,
  selected,
  onSelect,
}: {
  finding: Finding
  onEdit: (text: string) => Promise<void>
  onDelete: () => Promise<void>
  readOnly: boolean
  /** Its quoted words are on the ad, with a pin. */
  pinned: boolean
  selected: boolean
  onSelect: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(finding.text)
  return (
    <div
      id={`finding-${reviewerN(finding)}`}
      onClick={pinned ? onSelect : undefined}
      style={{
        border: `1px solid ${selected ? '#0F766E' : '#E3E6EC'}`,
        borderLeft: '3px solid #0F766E',
        boxShadow: selected ? '0 0 0 1px #0F766E' : undefined,
        borderRadius: 10,
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        scrollMarginTop: 24,
        scrollMarginBottom: 120,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {pinned && <ReviewerPin selected={selected} onSelect={onSelect} />}
          <span style={{ fontSize: 12, lineHeight: '16px', fontWeight: 700, letterSpacing: '0.04em', color: '#115E59' }}>FROM YOU</span>
        </span>
        {!readOnly && !editing && (
          <span style={{ display: 'flex', gap: 4 }} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="fp-text-button"
              style={{ ...textButton, color: '#15213B' }}
              onClick={() => {
                setDraft(finding.text)
                setEditing(true)
              }}
            >
              Edit
            </button>
            <Popconfirm title="Delete this finding?" okText="Delete" cancelText="Cancel" onConfirm={onDelete}>
              <button type="button" className="fp-text-button" style={{ ...textButton, color: '#4A5468' }}>
                Delete
              </button>
            </Popconfirm>
          </span>
        )}
      </div>
      {editing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} onClick={(e) => e.stopPropagation()}>
          <Input.TextArea aria-label="Edit your finding" autoFocus autoSize={{ minRows: 2, maxRows: 8 }} value={draft} onChange={(e) => setDraft(e.target.value)} />
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              type="primary"
              size="small"
              disabled={!draft.trim()}
              onClick={async () => {
                await onEdit(draft.trim())
                setEditing(false)
              }}
            >
              Save
            </Button>
            <Button size="small" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <p style={{ margin: 0, fontSize: 15, lineHeight: '22px', fontWeight: 500, whiteSpace: 'pre-wrap' }}>{finding.text}</p>
      )}
    </div>
  )
}

/** The reviewer's own findings: no severity, always sent to the submitter. */
export function YourFindings({
  findings,
  onAdd,
  onEdit,
  onDelete,
  readOnly,
  pinnedIds,
  selected,
  onSelect,
}: {
  findings: Finding[]
  onAdd: (text: string) => Promise<void>
  onEdit: (id: number, text: string) => Promise<void>
  onDelete: (id: number) => Promise<void>
  readOnly: boolean
  /** Findings whose quoted words are pinned on the ad. */
  pinnedIds: Set<number>
  selected: number | null
  onSelect: (n: number) => void
}) {
  const [text, setText] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState(false)

  const add = async () => {
    if (!text.trim()) {
      setError(true)
      return
    }
    setAdding(true)
    try {
      await onAdd(text.trim())
      setText('')
      setError(false)
    } finally {
      setAdding(false)
    }
  }

  return (
    <section className="fp-card" aria-labelledby="your-findings" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, overflow: 'hidden' }}>
      <div
        style={{
          margin: '-24px -24px 4px',
          padding: '16px 24px',
          background: '#E6F4F1',
          borderLeft: '4px solid #0F766E',
          borderBottom: '1px solid #CDE7E1',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <span aria-hidden="true" style={{ width: 32, height: 32, borderRadius: 9999, background: '#0F766E', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="person" size={18} strokeWidth={2.2} />
        </span>
        <h2 id="your-findings" style={{ margin: 0, fontSize: 18, lineHeight: '26px', fontWeight: 800, color: '#115E59' }}>
          Your findings
        </h2>
        {findings.length > 0 && (
          <span style={{ fontSize: 12, lineHeight: '16px', fontWeight: 700, color: '#FFFFFF', background: '#0F766E', borderRadius: 9999, padding: '2px 9px' }}>
            {findings.length}
          </span>
        )}
      </div>
      {findings.map((finding) => (
        <ReviewerCard
          key={finding.id}
          finding={finding}
          readOnly={readOnly}
          onEdit={(t) => onEdit(finding.id, t)}
          onDelete={() => onDelete(finding.id)}
          pinned={pinnedIds.has(finding.id)}
          selected={selected === reviewerN(finding)}
          onSelect={() => onSelect(reviewerN(finding))}
        />
      ))}
      {!readOnly && (
        <>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, fontWeight: 600, color: '#4A5468' }}>
            Add a finding
            <Input.TextArea
              rows={4}
              value={text}
              status={error ? 'error' : undefined}
              aria-describedby={error ? 'add-finding-error' : undefined}
              onChange={(e) => {
                setText(e.target.value)
                if (e.target.value.trim()) setError(false)
              }}
              placeholder="What does the submitter need to fix? Quote the words if you can."
              style={{ fontSize: 15, lineHeight: '22px', padding: '12px 14px', borderRadius: 10, minHeight: 104 }}
            />
          </label>
          {error && (
            <span id="add-finding-error" role="alert" style={{ marginTop: -8, fontSize: 13, color: '#B42318' }}>
              Write what needs to change first.
            </span>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button type="primary" onClick={add} loading={adding} style={{ minHeight: 40, padding: '0 18px' }}>
              Add finding
            </Button>
          </div>
        </>
      )}
      {readOnly && findings.length === 0 && <p style={{ margin: 0, fontSize: 14, color: '#4A5468' }}>No findings from you on this version.</p>}
    </section>
  )
}
