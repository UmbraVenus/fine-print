import { useEffect } from 'react'

/**
 * "Updated" marks: what changed since you last opened it, like unread mail. Kept in this browser:
 * when you first came (or last reset), and when you last opened each ad.
 */
const SINCE_KEY = 'fp_seen_since'
const SEEN_KEY = 'fp_seen'

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
  const now = new Date().toISOString()
  write(SINCE_KEY, now)
  return now
}

/** Start over: nothing counts as updated before now (after a reset, the sample data is all new). */
export function resetSeen() {
  write(SINCE_KEY, new Date().toISOString())
  write(SEEN_KEY, {})
}

/** True when the ad changed after you last opened it (and after your first visit). */
export function isUpdated(adId: number, updatedAt: string | null | undefined): boolean {
  if (!updatedAt) return false
  const seen = read<Record<string, string>>(SEEN_KEY, {})[adId] ?? since()
  return Date.parse(updatedAt) > Date.parse(seen)
}

/** Opening an ad marks it seen, now and again whenever it reloads. */
export function useMarkSeen(adId: number | null, updatedAt: string | null | undefined) {
  useEffect(() => {
    if (adId === null) return
    const seen = read<Record<string, string>>(SEEN_KEY, {})
    seen[adId] = new Date(Math.max(Date.now(), updatedAt ? Date.parse(updatedAt) : 0)).toISOString()
    write(SEEN_KEY, seen)
  }, [adId, updatedAt])
}
