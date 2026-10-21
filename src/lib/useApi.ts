import { useEffect, useState } from 'react'
import { api } from './api'

interface Result<T> {
  key: string
  data?: T
  error?: unknown
}

/**
 * GET a URL and refetch when it (or `version`) changes. While a new request is in flight,
 * the last data stays on screen and `loading` is true.
 */
export function useApi<T>(url: string | null, version = 0) {
  const key = `${url}#${version}`
  const [result, setResult] = useState<Result<T> | null>(null)
  const [last, setLast] = useState<T | undefined>(undefined)

  useEffect(() => {
    if (!url) return
    let cancelled = false
    api
      .get<T>(url)
      .then((data) => {
        if (cancelled) return
        setResult({ key, data })
        setLast(data)
      })
      .catch((error: unknown) => !cancelled && setResult({ key, error }))
    return () => {
      cancelled = true
    }
  }, [url, key])

  const current = result?.key === key ? result : null
  return {
    data: current?.data,
    /** The newest data we have, even if it's for an older URL. */
    latest: current?.data ?? last,
    error: current?.error,
    loading: Boolean(url) && !current,
  }
}
