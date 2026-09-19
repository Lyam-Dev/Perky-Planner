import { useCallback, useEffect, useState } from 'react'
import { CATEGORY_PRESETS, type Category, type CategoryInput } from '@shared/types'

/**
 * Reactive access to user-defined event categories. Falls back to the built-in
 * presets when the store is empty so the UI always has something to show.
 */
export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const all = await window.calendar.categories.list()
    setCategories(all.length > 0 ? all : presetsAsCategories())
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const createCategory = useCallback(async (input: CategoryInput) => {
    const created = await window.calendar.categories.create(input)
    setCategories((prev) => [...prev, created])
    return created
  }, [])

  const updateCategory = useCallback(async (id: string, input: CategoryInput) => {
    const updated = await window.calendar.categories.update(id, input)
    setCategories((prev) => prev.map((c) => (c.id === id ? updated : c)))
    return updated
  }, [])

  const removeCategory = useCallback(async (id: string) => {
    await window.calendar.categories.remove(id)
    setCategories((prev) => prev.filter((c) => c.id !== id))
  }, [])

  return { categories, loading, refresh, createCategory, updateCategory, removeCategory }
}

/** Wrap the built-in presets in Category shape for a graceful empty state. */
function presetsAsCategories(): Category[] {
  return CATEGORY_PRESETS.map((p, i) => ({
    id: `preset-${i}`,
    value: p.value,
    label: p.label,
    color: p.color,
    createdAt: '',
    updatedAt: ''
  }))
}
