import { useState } from 'react'
import type { Category, CategoryInput } from '@shared/types'
import { CheckIcon, CloseIcon, PencilIcon, PlusIcon, TrashIcon } from '../Icons'

interface CategoriesTabProps {
  categories: Category[]
  onCreate: (input: CategoryInput) => Promise<unknown>
  onUpdate: (id: string, input: CategoryInput) => Promise<unknown>
  onDelete: (id: string) => Promise<unknown>
}

/** Hand-picked swatches offered as one-click choices when creating a tag. */
const PALETTE = [
  '#4f46e5', '#7c3aed', '#0891b2', '#059669', '#16a34a',
  '#d97706', '#dc2626', '#e11d48', '#db2777', '#2563eb'
]

/** Compact ten-swatch color row shared by the create and edit forms. */
function ColorPicker({
  value,
  onChange
}: {
  value: string
  onChange: (hex: string) => void
}): JSX.Element {
  return (
    <div className="flex items-center gap-1">
      {PALETTE.map((hex) => (
        <button
          key={hex}
          type="button"
          aria-label={`Use color ${hex}`}
          onClick={() => onChange(hex)}
          className={[
            'h-4 w-4 rounded-full transition-transform hover:scale-125',
                        value === hex ? 'ring-2 ring-brand-400 ring-offset-1' : ''
          ].join(' ')}
          style={{ backgroundColor: hex }}
        />
      ))}
      <label
        title="Custom color"
        className="flex h-4 w-4 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-surface-border"
        style={{ background: 'conic-gradient(red, orange, yellow, green, blue, purple, red)' }}
      >
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-0 w-0 opacity-0"
        />
      </label>
    </div>
  )
}

/**
 * Settings tab for managing event categories — the color-coded tags users can
 * attach to events. Supports create, rename, recolor and delete. Built-in
 * presets (virtual rows with no persistence id) are shown read-only.
 */
export function CategoriesTab({
  categories,
  onCreate,
  onUpdate,
  onDelete
}: CategoriesTabProps): JSX.Element {
  const [draftLabel, setDraftLabel] = useState('')
  const [draftColor, setDraftColor] = useState(PALETTE[0])
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [editColor, setEditColor] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /** A preset row is a UI-only fallback; it cannot be persisted to. */
  const isVirtual = (c: Category) => c.createdAt === ''

  const slugify = (label: string) => label.toLowerCase().replace(/\s+/g, '-')

  const submitCreate = async () => {
    const label = draftLabel.trim()
    if (!label) return
    setBusy(true)
    setError(null)
    try {
      await onCreate({ value: slugify(label), label, color: draftColor })
      setDraftLabel('')
      setAdding(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the category.')
    } finally {
      setBusy(false)
    }
  }

  const startEdit = (c: Category) => {
    setEditingId(c.id)
    setEditLabel(c.label)
    setEditColor(c.color)
  }

  const submitEdit = async () => {
    if (!editingId) return
    const label = editLabel.trim()
    if (!label) return
    setBusy(true)
    setError(null)
    try {
      await onUpdate(editingId, { value: slugify(label), label, color: editColor })
      setEditingId(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update the category.')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: string) => {
    setBusy(true)
    setError(null)
    try {
      await onDelete(id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete the category.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs leading-relaxed text-content-muted">
        Tags are the colored labels you can attach to events. Changes apply everywhere instantly.
      </p>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}

      <ul className="space-y-1.5">
        {categories.map((c) => (
          <li
            key={c.id}
            className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-surface-muted"
          >
            <span
                            className="h-3.5 w-3.5 flex-shrink-0 rounded-full ring-1 ring-inset ring-content/15"
              style={{ backgroundColor: editingId === c.id ? editColor : c.color }}
            />
            {editingId === c.id ? (
              <div className="flex min-w-0 flex-1 items-center gap-1.5">
                <input
                  autoFocus
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submitEdit()
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                  className="min-w-0 flex-1 rounded-md border border-brand-400 px-2 py-1 text-sm outline-none ring-2 ring-brand-100"
                />
                <ColorPicker value={editColor} onChange={setEditColor} />
                <button
                  type="button"
                  onClick={submitEdit}
                  disabled={busy}
                  aria-label="Save category"
                  className="flex h-6 w-6 items-center justify-center rounded-md text-brand-600 hover:bg-brand-50 disabled:opacity-40"
                >
                  <CheckIcon width={14} height={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  aria-label="Cancel editing"
                  className="flex h-6 w-6 items-center justify-center rounded-md text-content-subtle hover:bg-surface-muted"
                >
                  <CloseIcon width={14} height={14} />
                </button>
              </div>
            ) : (
              <>
                <span className="min-w-0 flex-1 truncate text-sm text-content">{c.label}</span>
                {isVirtual(c) ? (
                  <span className="text-[10px] font-medium uppercase tracking-wide text-content-faint">
                    Built-in
                  </span>
                ) : (
                  <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => startEdit(c)}
                      aria-label={`Edit ${c.label}`}
                      className="flex h-6 w-6 items-center justify-center rounded-md text-content-subtle hover:bg-surface hover:text-brand-600"
                    >
                      <PencilIcon width={13} height={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(c.id)}
                      disabled={busy}
                      aria-label={`Delete ${c.label}`}
                      className="flex h-6 w-6 items-center justify-center rounded-md text-content-subtle hover:bg-surface hover:text-red-500 disabled:opacity-40"
                    >
                      <TrashIcon width={13} height={13} />
                    </button>
                  </div>
                )}
              </>
            )}
          </li>
        ))}
      </ul>

      {adding ? (
        <div className="flex items-center gap-2 rounded-lg border border-brand-300 bg-brand-50/50 px-2.5 py-2">
          <span
                        className="h-3.5 w-3.5 flex-shrink-0 rounded-full ring-1 ring-inset ring-content/15"
            style={{ backgroundColor: draftColor }}
          />
          <input
            autoFocus
            value={draftLabel}
            onChange={(e) => setDraftLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitCreate()
              if (e.key === 'Escape') setAdding(false)
            }}
            placeholder="Category name"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-content-subtle"
          />
          <ColorPicker value={draftColor} onChange={setDraftColor} />
          <button
            type="button"
            onClick={submitCreate}
            disabled={busy || !draftLabel.trim()}
            aria-label="Create category"
            className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40"
          >
            <CheckIcon width={14} height={14} />
          </button>
          <button
            type="button"
            onClick={() => setAdding(false)}
            aria-label="Cancel"
            className="flex h-6 w-6 items-center justify-center rounded-md text-content-subtle hover:bg-surface"
          >
            <CloseIcon width={14} height={14} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-brand-600 transition-colors hover:bg-brand-50"
        >
          <PlusIcon width={15} height={15} />
          Add tag
        </button>
      )}
    </div>
  )
}

