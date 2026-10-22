import { useEffect, useState } from 'react'
import { api } from './api'

interface Result<T> {
  key: string
  data?: T
  error?: unknown
}

/**
 * The newest response for each URL, for pages that can show slightly old data while they refresh
 * (tables, Rules, Insights). Kept across visits and refreshes, so a page seen before shows at once.
 */
const cache = new Map<string, unknown>()

/** Fetch a URL into the cache ahead of time, e.g. the next page or another table. */
export function prefetch(url: string) {
  if (cache.has(url)) return
  api.get(url).then((data) => cache.set(url, data)).catch(() => undefined)
}

/** Change a cached response in place, so a page shows the result of an action before it refreshes. */
export function patchCache<T>(url: string, change: (data: T) => T) {
  const data = cache.get(url) as T | undefined
  if (data !== undefined) cache.set(url, change(data))
}

/** After Reset, nothing cached is true any more. */
export function clearCache() {
  cache.clear()
}

/**
 * GET a URL and refetch when it (or `version`) changes. With `cached`, this URL's last response
 * shows at once while it refreshes in the background. While a new request is in flight,
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
        if (cached) cache.set(url, data)
      })
      .catch((error: unknown) => !cancelled && setResult({ key, error }))
    return () => {
      cancelled = true
    }
  }, [url, key, cached])

  const hit = cached && url ? (cache.get(url) as T | undefined) : undefined
  const current = result?.key === key ? result : null
  return {
    data: current?.data,
    /** The newest data we have: this URL's, possibly from before a refresh, or else an older URL's. */
    latest: current?.data ?? hit ?? last?.data,
    /** True while the data on screen is for a different URL (not just from before a refresh). */
    stale: !current && hit === undefined && last?.url !== url,
    error: current?.error,
    loading: Boolean(url) && !current,
  }
}
