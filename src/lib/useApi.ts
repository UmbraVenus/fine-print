import { useEffect, useState } from 'react'
import { api } from './api'

interface Result<T> {
  key: string
  data?: T
  error?: unknown
}

/** Responses kept for tables, by URL and version, so a page or filter seen before shows at once. */
const cache = new Map<string, unknown>()

/** Fetch a URL into the cache ahead of time, e.g. the next page. */
export function prefetch(url: string, version = 0) {
  const key = `${url}#${version}`
  if (cache.has(key)) return
  api.get(url).then((data) => cache.set(key, data)).catch(() => undefined)
}

/**
 * GET a URL and refetch when it (or `version`) changes. With `cached`, a response seen before shows
 * at once while it refreshes in the background. While a new request is in flight,
 * the last data stays on screen and `loading` is true.
 */
export function useApi<T>(url: string | null, version = 0, cached = false) {
  const key = `${url}#${version}`
  const [result, setResult] = useState<Result<T> | null>(null)
  const [last, setLast] = useState<{ url: string; data: T } | undefined>(undefined)

  useEffect(() => {
    if (!url) return
    let cancelled = false
    api
      .get<T>(url)
      .then((data) => {
        if (cancelled) return
        setResult({ key, data })
        setLast({ url, data })
        if (cached) cache.set(key, data)
      })
      .catch((error: unknown) => !cancelled && setResult({ key, error }))
    return () => {
      cancelled = true
    }
  }, [url, key, cached])

  const hit = cached ? (cache.get(key) as T | undefined) : undefined
  const current = result?.key === key ? result : hit !== undefined ? { key, data: hit } : null
  return {
    data: current?.data,
    /** The newest data we have, even if it's for an older URL. */
    latest: current?.data ?? last?.data,
    /** True while the newest data on screen is for a different URL (not just an older version). */
    stale: !current && last?.url !== url,
    error: current?.error,
    loading: Boolean(url) && !current,
  }
}
