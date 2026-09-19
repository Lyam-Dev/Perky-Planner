import { useCallback, useEffect, useState } from 'react'
import type { Task, TaskInput } from '@shared/types'

/**
 * Reactive access to sidebar tasks persisted via the preload bridge.
 * Provides create/update/toggle/remove with optimistic local state sync.
 */
export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const all = await window.calendar.tasks.list()
    setTasks(all)
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const createTask = useCallback(async (input: TaskInput) => {
    const created = await window.calendar.tasks.create(input)
    setTasks((prev) => [created, ...prev])
    return created
  }, [])

  const updateTask = useCallback(async (id: string, input: Partial<TaskInput>) => {
    const updated = await window.calendar.tasks.update(id, input)
    setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)))
    return updated
  }, [])

  const toggleTask = useCallback(async (id: string) => {
    const updated = await window.calendar.tasks.toggle(id)
    setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)))
    return updated
  }, [])

  const removeTask = useCallback(async (id: string) => {
    await window.calendar.tasks.remove(id)
    setTasks((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return { tasks, loading, refresh, createTask, updateTask, toggleTask, removeTask }
}
