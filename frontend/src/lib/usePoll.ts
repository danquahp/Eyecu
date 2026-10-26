//usePoll is function created to store latest state of server or act as a refresh 

import { useEffect, useRef, useState } from 'react'

export function usePoll<T>(fetch: () => Promise<T>, intervalMs = 4000, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  
  const fetcherRef = useRef(fetch)
  fetcherRef.current = fetch


  useEffect(
    () => {
    let cancelled = false

    async function saveState() {
      try {
        const result = await fetcherRef.current()
        if (!cancelled) {
          setData(result)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) 
          setError(err instanceof Error ? err.message : String(err))
      } 
      finally {
        if (!cancelled) setLoading(false)
      }
    }

    setLoading(true)
    saveState()
    const id = setInterval(saveState, intervalMs)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  
  }, deps)

  return { data, error, loading }
}
