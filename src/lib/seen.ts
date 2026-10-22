import { useEffect } from 'react'
import type { Role } from './types'

/**
 * "Updated" marks: what changed since you last opened it, like unread mail. Kept in this browser:
 * when you first came (or last reset), and when you last opened each ad.
 */
const SINCE_KEY = 'fp_seen_since'

/** Each role has its own marks: a reviewer opening an ad doesn't mean the marketer has seen the change. */
function seenKey(role: Role): string {
  return `fp_seen_${role}`
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Private windows can refuse storage; the marks just don't persist.
  }
}

function since(): string {
  const saved = read<string | null>(SINCE_KEY, null)
  if (saved) return saved
  const now = wholeSecond()
  write(SINCE_KEY, now)
  return now
}

/** The server keeps times to the second; a change in the same second as this must still count as newer. */
function wholeSecond(): string {
  return new Date(Math.floor(Date.now() / 1000) * 1000 - 1000).toISOString()
}

/** Start over: nothing counts as updated before now (after a reset, the sample data is all new). */
export function resetSeen() {
  write(SINCE_KEY, wholeSecond())
  write('fp_seen_marketer', {})
  write('fp_seen_reviewer', {})
}

/** True when the ad changed after you last opened it (and after your first visit). */
export function isUpdated(role: Role, adId: number, updatedAt: string | null | undefined): boolean {
  if (!updatedAt) return false
  const seen = read<Record<string, string>>(seenKey(role), {})[adId] ?? since()
  return Date.parse(updatedAt) > Date.parse(seen)
}

/**
 * Opening an ad marks it seen for the role looking at it, now and whenever it reloads. Pass null until
 * the loaded data is this page's ad (a page moving to the next ad briefly still holds the last one).
 */
export function useMarkSeen(role: Role, adId: number | null, updatedAt: string | null | undefined) {
  useEffect(() => {
    if (adId === null) return
    const seen = read<Record<string, string>>(seenKey(role), {})
    seen[adId] = new Date(Math.max(Date.now(), updatedAt ? Date.parse(updatedAt) : 0)).toISOString()
    write(seenKey(role), seen)
  }, [role, adId, updatedAt])
}
