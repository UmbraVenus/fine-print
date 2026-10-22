import { LoadingOutlined } from '@ant-design/icons'
import { Popover } from 'antd'
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { api } from '../lib/api'
import { Icon } from './Icon'

export type ComingFeature = 'doc-rules' | 'upload' | 'search'

/** The roadmap: what each feature would do, in a line. */
export const COMING_NEXT: Array<{ id: ComingFeature; title: string; what: string }> = [
  {
    id: 'doc-rules',
    title: 'Turn compliance documents into rules',
    what: 'Upload a policy or a regulator’s guidance, and Fine Print drafts the rules for a reviewer to approve.',
  },
  {
    id: 'upload',
    title: 'Upload your own ads',
    what: 'Drop in an image or a PDF. Fine Print reads the words and checks them like any other ad.',
  },
  {
    id: 'search',
    title: 'Search past decisions',
    what: 'Find how similar ads were decided before, and why, before you decide this one.',
  },
]

interface VoteState {
  votes: Record<ComingFeature, number>
  voted: ComingFeature[]
}

// One copy of the votes for every card, button and sidebar item, so a vote shows everywhere at once.
let votesState: VoteState | null = null
let votesLoading = false
const listeners = new Set<() => void>()

function setVotes(next: VoteState) {
  votesState = next
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function useVotes(): VoteState | null {
  const state = useSyncExternalStore(subscribe, () => votesState)
  useEffect(() => {
    if (votesState || votesLoading) return
    votesLoading = true
    api
      .get<VoteState>('/api/votes')
      .then(setVotes)
      .catch(() => undefined)
      .finally(() => {
        votesLoading = false
      })
  }, [])
  return state
}

/** At the end of each coming-next item: a check once you've voted, a question mark until then. */
export function VoteMark({ feature, voted: votedColor = '#067647', open: openColor = '#8A93A6' }: { feature: ComingFeature; voted?: string; open?: string }) {
  const votes = useVotes()
  const voted = Boolean(votes?.voted.includes(feature))
  return (
    <span data-voted={voted ? feature : undefined} style={{ display: 'inline-flex', flexShrink: 0, color: voted ? votedColor : openColor }}>
      <Icon name={voted ? 'check' : 'question'} size={voted ? 14 : 15} strokeWidth={voted ? 2.6 : 2} />
      <span className="fp-visually-hidden">{voted ? ', you voted for this' : ', not voted yet'}</span>
    </span>
  )
}

/** Counted as votes, not people: nobody needs to know who wanted what. */
function voteCount(n: number): string {
  return n === 1 ? '1 vote' : `${n} votes`
}

/** What a coming-next feature would do, and a vote for it. Opened from the sidebar or where it would live. */
function VoteCard({ feature }: { feature: ComingFeature }) {
  const item = COMING_NEXT.find((f) => f.id === feature)!
  const state = useVotes()
  const [saving, setSaving] = useState(false)
  // The server knows this browser's votes (by an anonymous cookie), so a vote counts once.
  const voted = Boolean(state?.voted.includes(feature))
  const votes = state ? state.votes[feature] : null

  const [failed, setFailed] = useState(false)
  const vote = async () => {
    setSaving(true)
    setFailed(false)
    try {
      setVotes(await api.post<VoteState>('/api/votes', { feature }))
    } catch {
      setFailed(true)
    } finally {
      setSaving(false)
    }
  }

  const unvote = async () => {
    setSaving(true)
    setFailed(false)
    try {
      setVotes(await api.del<VoteState>('/api/votes', { feature }))
    } catch {
      setFailed(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ width: 280, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <span style={{ fontSize: 12, lineHeight: '16px', fontWeight: 700, letterSpacing: '0.04em', color: '#4A5468' }}>COMING NEXT</span>
      <strong style={{ fontSize: 15, lineHeight: '22px' }}>{item.title}</strong>
      <p style={{ margin: 0, fontSize: 14, lineHeight: '20px', color: '#4A5468' }}>{item.what}</p>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 4 }}>
        {voted ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#067647' }}>
            <Icon name="check" size={14} strokeWidth={2.5} />
            Thanks, noted
            <span aria-hidden="true" style={{ color: '#8A93A6' }}>·</span>
            <button type="button" className="fp-quiet" style={{ font: 'inherit', fontWeight: 600, padding: '2px 4px', borderRadius: 4 }} onClick={unvote} disabled={saving}>
              {saving && <LoadingOutlined aria-hidden="true" style={{ marginRight: 4 }} />}
              {saving ? 'Undoing…' : 'Undo'}
            </button>
          </span>
        ) : (
          <button type="button" className="fp-copy-button" onClick={vote} disabled={saving}>
            {saving && <LoadingOutlined aria-hidden="true" style={{ marginRight: 6 }} />}
            {saving ? 'Saving…' : 'I’d use this'}
          </button>
        )}
        {votes !== null && <span aria-live="polite" style={{ fontSize: 13, color: '#4A5468' }}>{voteCount(votes)}</span>}
      </div>
      {failed && (
        <span role="alert" style={{ fontSize: 13, color: '#B42318' }}>
          Couldn't save that. Try again.
        </span>
      )}
    </div>
  )
}

export function ComingNextPopover({
  feature,
  placement = 'bottomRight',
  children,
}: {
  feature: ComingFeature
  placement?: 'bottomRight' | 'right' | 'rightBottom'
  children: ReactNode
}) {
  return (
    <Popover trigger="click" placement={placement} content={<VoteCard feature={feature} />} destroyOnHidden>
      {children}
    </Popover>
  )
}

/** Where the feature would live: a quiet button, clearly marked as coming next. */
export function ComingNextButton({ feature }: { feature: ComingFeature }) {
  const item = COMING_NEXT.find((f) => f.id === feature)!
  return (
    <ComingNextPopover feature={feature}>
      <button type="button" className="fp-coming-door" aria-haspopup="dialog">
        {item.title}
        <span className="fp-coming-tag">Coming next</span>
        <VoteMark feature={feature} />
      </button>
    </ComingNextPopover>
  )
}
