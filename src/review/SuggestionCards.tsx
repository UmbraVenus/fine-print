import { Button, Input, Modal } from 'antd'
import { useState } from 'react'
import { Icon } from '../components/Icon'
import type { Rule } from '../lib/detail'
import { FixBox, NoteBox, NumberBadge, RuleLine, cardStyle, type Numbered } from '../findings/parts'

export interface SuggestionActions {
  keep: (id: number) => void
  unkeep: (id: number) => void
  edit: (id: number, text: string) => Promise<void>
  dismiss: (id: number, reason: string) => Promise<void>
  restore: (id: number) => void
}

const actionButton = {
  font: 'inherit',
  fontSize: 13,
  fontWeight: 600,
  minHeight: 36,
  borderRadius: 8,
  padding: '7px 12px',
} as const

/** A suggestion as the reviewer sees it: Keep, Edit, Dismiss… */
export function ReviewSuggestionCard({
  item,
  selected,
  onSelect,
  actions,
  readOnly,
}: {
  item: Numbered
  selected: boolean
  onSelect: () => void
  actions: SuggestionActions
  readOnly: boolean
}) {
  const { n, finding, rule } = item
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const kept = finding.state === 'kept' || finding.state === 'edited'
  const headline = finding.state === 'edited' && finding.edited_text ? finding.edited_text : finding.text

  const save = async () => {
    if (!draft.trim()) return
    setSaving(true)
    try {
      await actions.edit(finding.id, draft.trim())
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <article id={`finding-${n}`} data-finding={n} style={cardStyle(selected)} onClick={onSelect} aria-label={`Finding ${n}`}>
      <NumberBadge n={n} selected={selected} onSelect={onSelect} />
      <div style={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {editing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} onClick={(e) => e.stopPropagation()}>
              <Input.TextArea
                aria-label="Text sent to the submitter"
                autoSize={{ minRows: 2, maxRows: 6 }}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                autoFocus
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <Button type="primary" size="small" onClick={save} loading={saving} disabled={!draft.trim()}>
                  Save
                </Button>
                <Button size="small" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: 15, lineHeight: '22px', fontWeight: 600 }}>{headline}</p>
          )}
          {finding.state === 'edited' && !editing && (
            <span style={{ fontSize: 12, lineHeight: '16px', color: '#4A5468' }}>Edited by you. This is what the submitter sees.</span>
          )}
          <RuleLine rule={rule} />
        </div>
        {finding.submitter_note && <NoteBox label="Note from submitter" text={finding.submitter_note} />}
        {finding.suggested_fix && <FixBox label={finding.fix_label ?? 'Suggested fix'} text={finding.suggested_fix} />}
        {!readOnly && (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              aria-pressed={kept}
              className={kept ? 'fp-kept' : 'fp-secondary'}
              style={actionButton}
              onClick={() => (kept ? actions.unkeep(finding.id) : actions.keep(finding.id))}
            >
              {kept && <Icon name="check" size={14} strokeWidth={2.5} />}
              {kept ? 'Kept' : 'Keep'}
            </button>
            <button
              type="button"
              className="fp-secondary"
              style={actionButton}
              onClick={() => {
                setDraft(headline)
                setEditing(true)
              }}
            >
              Edit
            </button>
            <DismissButton n={n} onDismiss={(reason) => actions.dismiss(finding.id, reason)} />
          </div>
        )}
      </div>
    </article>
  )
}

function DismissButton({ n, onDismiss }: { n: number; onDismiss: (reason: string) => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const submit = async () => {
    if (!reason.trim()) return
    setSaving(true)
    try {
      await onDismiss(reason.trim())
      setOpen(false)
      setReason('')
    } finally {
      setSaving(false)
    }
  }
  return (
    <>
      <button type="button" className="fp-quiet" style={{ ...actionButton, marginLeft: 'auto', padding: '7px 4px' }} onClick={() => setOpen(true)}>
        Dismiss…
      </button>
      <Modal
        open={open}
        title={`Dismiss suggestion ${n}?`}
        okText="Dismiss"
        cancelText="Cancel"
        onOk={submit}
        okButtonProps={{ disabled: !reason.trim(), loading: saving }}
        onCancel={() => setOpen(false)}
        destroyOnHidden
      >
        <label style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, fontWeight: 600, color: '#4A5468' }}>
          Why doesn't it apply?
          <Input.TextArea
            autoFocus
            autoSize={{ minRows: 3, maxRows: 6 }}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="For example: Legal approved this wording."
          />
        </label>
        <p style={{ margin: '8px 0 0', fontSize: 13, color: '#4A5468' }}>The reason stays in the ad's record. You can restore it from Dismissed.</p>
      </Modal>
    </>
  )
}

/** A dismissed suggestion: its reason, and a way back. */
export function DismissedCard({ item, onRestore, readOnly }: { item: Numbered; onRestore: () => void; readOnly: boolean }) {
  const { n, finding, rule } = item
  return (
    <article id={`finding-${n}`} style={{ ...cardStyle(false), background: '#FBFCFD' }} aria-label={`Dismissed finding ${n}`}>
      <NumberBadge n={n} selected={false} />
      <div style={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <p style={{ margin: 0, fontSize: 15, lineHeight: '22px', fontWeight: 600, color: '#4A5468' }}>{finding.edited_text ?? finding.text}</p>
        <RuleLine rule={rule} />
        <NoteBox label="Dismissed because" text={finding.dismiss_reason ?? ''} />
        {!readOnly && (
          <div>
            <button type="button" className="fp-secondary" style={actionButton} onClick={onRestore}>
              Restore
            </button>
          </div>
        )}
      </div>
    </article>
  )
}

export function rulesById(rules: Rule[]) {
  return new Map(rules.map((r) => [r.id, r]))
}
