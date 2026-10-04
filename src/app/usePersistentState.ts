import { useCallback, useRef, useState } from 'react'
import { loadState, saveState, type StoredState } from './storage'

/**
 * History, settings and the last variant, kept in localStorage under one versioned key.
 * Every change is written immediately; failures surface as a notice instead of breaking the app.
 */
export function usePersistentState(poolIds: readonly string[]) {
  const [initial] = useState(() => loadState(poolIds))
  const [state, setState] = useState(initial.state)
  const [notice, setNotice] = useState<string | null>(initial.problem)
  const current = useRef(state)
  const update = useCallback((change: (state: StoredState) => StoredState) => {
    const next = change(current.current)
    current.current = next
    setState(next)
    setNotice(saveState(next))
  }, [])
  return { state, update, notice, setNotice }
}
