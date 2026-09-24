import { useEffect, useMemo, useState } from 'react'
import type { Category, Deadline, DeadlineInput } from '@shared/types'
import { normalizeDeadlineRange } from '@shared/types'
import { formatLongDate, fromISODate } from '../lib/dateEngine'
import { deadlineDayCount, formatDeadlineRange, readableTextColor } from '../lib/deadlineLayout'
import { CloseIcon, FlagIcon, PlusIcon, RangeIcon, TrashIcon } from './Icons'

interface DeadlineModalProps {
  /** Deadline being edited, or null when creating a new one. */
  editing: Deadline | null
  /** ISO date used to prefill a new deadline's timeframe. */
  initialDate: string
  /** Available categories (built-ins plus user-defined ones). */
  categories: Category[]
  onClose: () => void
  onSave: (input: DeadlineInput, editingId: string | null) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

interface FormState {
  title: string
  startDate: string
  endDate: string
  notes: string
  category: string
  color: string
}

/** Fallback bar color when no category exists at all. */
const FALLBACK_COLOR = '#4f46e5'

/**
 * Modal form for creating, editing and deleting a multi-day deadline.
 *
 * A deadline differs from an event: instead of one day it claims a whole
 * timeframe, which the month grid then paints as a colour bar spanning those
 * days. The two date fields are interchangeable — the range is normalised on
 * save, so picking the end before the start still produces a sensible result.
 */
export function DeadlineModal({
  editing,
  initialDate,
  categories,
  onClose,
  onSave,
  onDelete
}: DeadlineModalProps): JSX.Element {
  const [form, setForm] = useState<FormState>(() => ({
    title: '',
    startDate: initialDate,
    endDate: initialDate,
    notes: '',
    category: '',
    color: ''
  }))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fallbackCategory = useMemo(() => categories[0] ?? null, [categories])

  // Sync the form whenever the editing target (or seed day) changes.
  useEffect(() => {
    if (editing) {
      setForm({
        title: editing.title,
        startDate: editing.startDate,
        endDate: editing.endDate,
        notes: editing.notes,
        category: editing.category,
        color: editing.color
      })
    } else {
      setForm({
        title: '',
        startDate: initialDate,
        endDate: initialDate,
        notes: '',
        category: fallbackCategory?.value ?? '',
        color: fallbackCategory?.color ?? FALLBACK_COLOR
      })
    }
    setError(null)
  }, [editing, initialDate, fallbackCategory])

  const handleCategory = (value: string, color: string) => {
    setForm((f) => ({ ...f, category: value, color }))
  }

  /** Live preview of the normalised timeframe, so the grid result is obvious. */
  const preview = useMemo(() => {
    const { startDate, endDate } = normalizeDeadlineRange(form.startDate, form.endDate)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return null
    const draft: Deadline = {
      id: '',
      title: form.title,
      startDate,
      endDate,
      notes: form.notes,
      category: form.category,
      color: form.color || FALLBACK_COLOR,
      createdAt: '',
      updatedAt: ''
    }
    return { label: formatDeadlineRange(draft), days: deadlineDayCount(draft) }
  }, [form])

  const swatch = form.color || FALLBACK_COLOR

  const validate = (): string | null => {
    if (!form.title.trim()) return 'Please give the deadline a title.'
    if (!form.startDate) return 'Please pick a start date.'
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.startDate)) return 'The start date is not a valid date.'
    if (form.endDate && !/^\d{4}-\d{2}-\d{2}$/.test(form.endDate)) {
      return 'The end date is not a valid date.'
    }
    return null
  }

  const submit = async () => {
    const err = validate()
    if (err) {
      setError(err)
      return
    }
    setSaving(true)
    try {
      const { startDate, endDate } = normalizeDeadlineRange(form.startDate, form.endDate)
      await onSave(
        {
          title: form.title.trim(),
          startDate,
          endDate,
          notes: form.notes.trim(),
          category: form.category,
          color: form.color || FALLBACK_COLOR
        },
        editing ? editing.id : null
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong saving the deadline.')
    } finally {
      setSaving(false)
    }
  }

  const destroy = async (id: string) => {
    setSaving(true)
    try {
      await onDelete(id)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim/45 p-4 backdrop-blur-[2px] animate-fade-in"
      onClick={onClose}
    >
      <div
        className="glass-panel relative z-10 flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl shadow-2xl animate-pop-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="flex items-start justify-between gap-4 border-b border-surface-border px-5 py-4">
          <div className="flex items-start gap-3">
            <span
              className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg text-white shadow-sm"
              style={{ backgroundColor: swatch }}
            >
              <FlagIcon width={16} height={16} />
            </span>
            <div>
              <h2 className="text-base font-semibold text-content">
                {editing ? 'Edit deadline' : 'New deadline'}
              </h2>
              <p className="mt-0.5 text-xs text-content-muted">
                Spans a timeframe across the calendar
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-content-subtle transition-all duration-200 hover:rotate-90 hover:bg-surface-muted hover:text-content-muted active:scale-90"
          >
            <CloseIcon />
          </button>
        </header>

        {/* Body */}
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="animate-slide-up" style={{ animationDelay: '40ms' }}>
            <label className="mb-1 block text-xs font-medium text-content-muted">Title</label>
            <input
              autoFocus
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="What has to be done?"
              className="w-full rounded-lg border border-surface-border px-3 py-2 text-sm text-content outline-none transition-all duration-200 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 focus:shadow-[0_0_0_4px_rgba(99,102,241,0.08)]"
            />
          </div>

          {/* Timeframe */}
          <div
            className="rounded-xl border border-surface-border bg-surface-muted/50 p-3 animate-slide-up"
            style={{ animationDelay: '90ms' }}
          >
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-content-subtle">
              <RangeIcon className="text-content-subtle" />
              Timeframe
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-content-muted">Starts</label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                  className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-content outline-none transition-all duration-200 focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-content-muted">Ends</label>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                  className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-content outline-none transition-all duration-200 focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                />
              </div>
            </div>

            {preview && (
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <span
                  className="flex h-5 items-center rounded px-2 text-[10px] font-semibold"
                  style={{ backgroundColor: swatch, color: readableTextColor(swatch) }}
                >
                  {form.title.trim() || 'Deadline'}
                </span>
                <span className="text-[11px] font-medium text-content-muted">
                  {preview.label} · {preview.days} day{preview.days === 1 ? '' : 's'}
                </span>
              </div>
            )}
          </div>

          <div className="animate-slide-up" style={{ animationDelay: '140ms' }}>
            <label className="mb-1 block text-xs font-medium text-content-muted">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Extra context, links, checklist…"
              rows={3}
              className="w-full resize-none rounded-lg border border-surface-border px-3 py-2 text-sm text-content outline-none transition-all duration-200 focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
          </div>

          {/* Category / colour */}
          <div className="animate-slide-up" style={{ animationDelay: '190ms' }}>
            <label className="mb-1.5 block text-xs font-medium text-content-muted">Colour</label>
            {categories.length === 0 ? (
              <p className="text-xs text-content-subtle">
                No categories yet — add some in Settings → Categories.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {categories.map((preset, i) => {
                  const active = form.category === preset.value
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleCategory(preset.value, preset.color)}
                      style={{
                        animationDelay: `${190 + i * 50}ms`,
                        ...(active ? { backgroundColor: preset.color } : {})
                      }}
                      className={[
                        'flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium animate-chip-in transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-95',
                        active
                          ? 'border-transparent text-white shadow-sm scale-105'
                          : 'border-surface-border text-content-muted hover:bg-surface-muted'
                      ].join(' ')}
                    >
                      <span
                        className="h-2 w-2 rounded-full transition-transform duration-200"
                        style={{
                          backgroundColor: active ? '#ffffff' : preset.color,
                          transform: active ? 'scale(1.25)' : undefined
                        }}
                      />
                      {preset.label}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
              {error}
            </p>
          )}

          {/* When editing, show exactly which days are covered */}
          {editing && (
            <div className="border-t border-surface-border pt-3">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-content-subtle">
                Currently covers
              </p>
              <p className="text-xs text-content-muted">
                {formatDeadlineRange(editing)} · starting{' '}
                {formatLongDate(fromISODate(editing.startDate))}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="flex items-center justify-between gap-3 border-t border-surface-border px-5 py-3.5">
          {editing ? (
            <button
              type="button"
              onClick={() => destroy(editing.id)}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-red-500 transition-all duration-200 hover:bg-red-50 active:scale-95 disabled:opacity-60"
            >
              <TrashIcon width={15} height={15} />
              Delete
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3 py-2 text-sm font-medium text-content-muted transition-all duration-200 hover:bg-surface-muted active:scale-95"
            >
              Cancel
            </button>
          )}

          <div className="flex items-center gap-2">
            {editing && (
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-3 py-2 text-sm font-medium text-content-muted transition-all duration-200 hover:bg-surface-muted active:scale-95"
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              onClick={submit}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-700 hover:shadow-md active:translate-y-0 active:scale-95 disabled:opacity-60"
            >
              {!editing && <PlusIcon width={16} height={16} />}
              {editing ? 'Save changes' : 'Add deadline'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
