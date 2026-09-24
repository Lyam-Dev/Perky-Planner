import { useCallback, useEffect, useState } from 'react'
import type { Deadline, DeadlineInput } from '@shared/types'

/**
 * Reactive access to multi-day deadlines persisted via the preload bridge.
 * Mirrors `useEvents`: a local copy is kept in sync with every mutation so the
 * calendar grid re-renders its spanning bars without a round trip.
 */
export function useDeadlines() {
  const [deadlines, setDeadlines] = useState<Deadline[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const all = await window.calendar.deadlines.list()
    setDeadlines(all)
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const createDeadline = useCallback(async (input: DeadlineInput) => {
    const created = await window.calendar.deadlines.create(input)
    setDeadlines((prev) => [...prev, created])
    return created
  }, [])

  const updateDeadline = useCallback(async (id: string, input: DeadlineInput) => {
    const updated = await window.calendar.deadlines.update(id, input)
    setDeadlines((prev) => prev.map((d) => (d.id === id ? updated : d)))
    return updated
  }, [])

  const removeDeadline = useCallback(async (id: string) => {
    await window.calendar.deadlines.remove(id)
    setDeadlines((prev) => prev.filter((d) => d.id !== id))
  }, [])

  return { deadlines, loading, refresh, createDeadline, updateDeadline, removeDeadline }
}
