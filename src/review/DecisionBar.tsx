import { Input, Modal } from 'antd'
import { useState } from 'react'

export type Decision = 'approved' | 'approved_with_changes' | 'changes_required' | 'rejected'

const MODAL_COPY: Record<'changes_required' | 'rejected' | 'approved_with_changes', { title: string; label: string; ok: string; help: string }> = {
  changes_required: {
    title: 'Request changes',
    label: 'Message to the submitter',
    ok: 'Request changes',
    help: 'They get this with your kept suggestions and findings, then fix and resubmit as a new version.',
  },
  rejected: {
    title: 'Reject this ad',
    label: 'Message to the submitter',
    ok: 'Reject',
    help: "Rejected ads can't run in any form. The message stays in the ad's activity.",
  },
  approved_with_changes: {
    title: 'Approve with changes',
    label: 'What needs to change before it goes live?',
    ok: 'Approve with changes',
    help: 'Keep it small and exact. The submitter makes the edit and launches, with no second review.',
  },
}

/** The bottom bar. Nothing the auto check finds ever disables a decision. */
export function DecisionBar({
  onDecide,
  defaultMessage,
  needsChangeText,
  busy,
}: {
  onDecide: (decision: Decision, message?: string) => Promise<void>
  defaultMessage: string
  /** Approve with changes asks what to change only when nothing is kept or added yet. */
  needsChangeText: boolean
  busy: boolean
}) {
  const [modal, setModal] = useState<keyof typeof MODAL_COPY | null>(null)
  const [message, setMessage] = useState('')

  const open = (decision: keyof typeof MODAL_COPY) => {
    setMessage(decision === 'approved_with_changes' ? '' : defaultMessage)
    setModal(decision)
  }

  const copy = modal ? MODAL_COPY[modal] : null

  return (
    <div className="fp-decision-bar" role="region" aria-label="Your decision">
      <span style={{ fontSize: 16, lineHeight: '24px', fontWeight: 600 }}>Your decision</span>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <button type="button" className="fp-decision fp-decision-reject" disabled={busy} onClick={() => open('rejected')}>
          Reject
        </button>
        <button type="button" className="fp-decision" disabled={busy} onClick={() => open('changes_required')}>
          Request changes
        </button>
        <button
          type="button"
          className="fp-decision"
          disabled={busy}
          onClick={() => (needsChangeText ? open('approved_with_changes') : onDecide('approved_with_changes'))}
        >
          Approve with changes
        </button>
        <button type="button" className="fp-decision fp-decision-approve" disabled={busy} onClick={() => onDecide('approved')}>
          Approve
        </button>
      </div>
      <Modal
        open={Boolean(modal)}
        title={copy?.title}
        okText={copy?.ok}
        cancelText="Cancel"
        okButtonProps={{ disabled: !message.trim(), loading: busy, danger: modal === 'rejected' }}
        onCancel={() => setModal(null)}
        onOk={async () => {
          if (!modal || !message.trim()) return
          await onDecide(modal, message.trim())
          setModal(null)
        }}
        destroyOnHidden
      >
        <label style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, fontWeight: 600, color: '#4A5468' }}>
          {copy?.label}
          <Input.TextArea autoFocus autoSize={{ minRows: 4, maxRows: 10 }} value={message} onChange={(e) => setMessage(e.target.value)} />
        </label>
        <p style={{ margin: '8px 0 0', fontSize: 13, color: '#4A5468' }}>{copy?.help}</p>
      </Modal>
    </div>
  )
}
