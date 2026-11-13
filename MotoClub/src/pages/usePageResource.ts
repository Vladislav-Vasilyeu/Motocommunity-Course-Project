import { useCallback, useEffect, useState } from 'react'
import { api, getErrorMessage } from '../shared/api'

/** Reset private data immediately when the request or signed-in account changes. */
export function usePageResource<T>(path: string | null, scope = '') {
  const [revision, setRevision] = useState(0)
  const key = `${scope}:${path ?? ''}:${revision}`
  const [state, setState] = useState<{ key: string; data?: T; error: string; loading: boolean }>({ key: '', error: '', loading: true })
  const reload = useCallback(() => setRevision((value) => value + 1), [])
  useEffect(() => {
    if (!path) return
    const controller = new AbortController()
    api<T>(path, { signal: controller.signal })
      .then((data) => { if (!controller.signal.aborted) setState({ key, data, error: '', loading: false }) })
      .catch((error: unknown) => { if (!controller.signal.aborted) setState({ key, error: getErrorMessage(error), loading: false }) })
    return () => controller.abort()
  }, [key, path, revision])
  return { data: path && state.key === key ? state.data : undefined, error: path && state.key === key ? state.error : '', loading: Boolean(path) && (state.key !== key || state.loading), reload }
}

export function useDebouncedValue(value: string, delay = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => { const timer = window.setTimeout(() => setDebounced(value), delay); return () => window.clearTimeout(timer) }, [value, delay])
  return debounced
}
