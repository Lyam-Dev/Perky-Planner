import { useCallback, useRef, useState } from 'react'
import type { HistoryEntry } from '@shared/types'

const MAX_HISTORY = 50

/**
 * Session-scoped undo history for events, tasks and categories. Each entry
 * stores enough of the before/after row to invert the mutation via the
 * preload bridge. History is intentionally not persisted — it lives only as
 * long as the window does.
 */
export function useHistory() {
  // A ref (not state) holds the stack so `undo()` can pop synchronously;
  // a counter state just drives re-renders for `canUndo`.
  const pastRef = useRef<HistoryEntry[]>([])
  const [, bumpRender] = useState(0)

  /** Record a completed mutation so it can be undone later. */
  const record = useCallback((entry: HistoryEntry) => {
    pastRef.current = [...pastRef.current.slice(-(MAX_HISTORY - 1)), entry]
    bumpRender((n) => n + 1)
  }, [])

  /** Whether there is anything to undo (drives button enabled state). */
  const canUndo = pastRef.current.length > 0

  /**
   * Revert the most recent mutation directly through the bridge and return
   * the entry that was undone, or null when history is empty. Callers should
   * refresh their data hooks afterwards.
   */
  const undo = useCallback(async (): Promise<HistoryEntry | null> => {
    const entry = pastRef.current.pop() ?? null
    if (!entry) return null
    bumpRender((n) => n + 1)

    switch (entry.type) {
      case 'event.create':
        await window.calendar.events.remove(entry.after.id)
        break
      case 'event.update':
        await window.calendar.events.update(entry.before.id, stripRowIds(entry.before))
        break
      case 'event.delete':
        await window.calendar.events.create(stripRowIds(entry.before))
        break
      case 'task.create':
        await window.calendar.tasks.remove(entry.after.id)
        break
      case 'task.update':
        await window.calendar.tasks.update(entry.before.id, stripRowIds(entry.before))
        break
      case 'task.delete':
        await window.calendar.tasks.create(stripRowIds(entry.before))
        break
      case 'deadline.create':
        await window.calendar.deadlines.remove(entry.after.id)
        break
      case 'deadline.update':
        await window.calendar.deadlines.update(entry.before.id, stripRowIds(entry.before))
        break
      case 'deadline.delete':
        await window.calendar.deadlines.create(stripRowIds(entry.before))
        break
      case 'category.create':
        await window.calendar.categories.remove(entry.after.id)
        break
      case 'category.update':
        await window.calendar.categories.update(entry.before.id, stripRowIds(entry.before))
        break
      case 'category.delete':
        await window.calendar.categories.create(stripRowIds(entry.before))
        break
    }
    return entry
  }, [])

  return { canUndo, record, undo }
}

/** Removes id/timestamps so a stored row can be re-sent as an `*Input`. */
function stripRowIds<T extends { id: string; createdAt: string; updatedAt: string }>(
  row: T
): Omit<T, 'id' | 'createdAt' | 'updatedAt'> {
  const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = row
  return rest
}
