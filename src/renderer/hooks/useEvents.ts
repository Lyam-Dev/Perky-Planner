import { useCallback, useEffect, useState } from 'react'
import type { CalendarEvent, EventInput } from '@shared/types'

/**
 * Reactive access to events persisted via the preload bridge. Exposes the
 * full list plus helpers to create/update/remove, keeping local state in sync.
 */
export function useEvents() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const all = await window.calendar.events.list()
    setEvents(all)
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const createEvent = useCallback(async (input: EventInput) => {
    const created = await window.calendar.events.create(input)
    setEvents((prev) => [...prev, created])
    return created
  }, [])

  const updateEvent = useCallback(async (id: string, input: EventInput) => {
    const updated = await window.calendar.events.update(id, input)
    setEvents((prev) => prev.map((e) => (e.id === id ? updated : e)))
    return updated
  }, [])

  const removeEvent = useCallback(async (id: string) => {
    await window.calendar.events.remove(id)
    setEvents((prev) => prev.filter((e) => e.id !== id))
  }, [])

  return { events, loading, refresh, createEvent, updateEvent, removeEvent }
}
