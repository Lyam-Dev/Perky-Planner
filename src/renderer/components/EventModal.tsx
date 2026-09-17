import { useEffect, useMemo, useState } from 'react'
import {
  CATEGORY_PRESETS,
  type CalendarEvent,
  type EventCategory,
  type EventInput
} from '@shared/types'
import { formatLongDate, formatTimeRange, fromISODate } from '../lib/dateEngine'
import { CloseIcon, ClockIcon, PlusIcon, TrashIcon } from './Icons'

interface EventModalProps {
  /** ISO date the modal is open for. */
  date: string
  /** All events already on that date. */
  dayEvents: CalendarEvent[]
  /** Event being edited, or null when creating. */
  editing: CalendarEvent | null
  onClose: () => void
  onSave: (input: EventInput, editingId: number | null) => Promise<void>
  onDelete: (id: number) => Promise<void>
  /** Switch the modal into edit mode for an existing event. */
  onEdit: (id: number) => void
}

interface FormState {
  title: string
  description: string
  allDay: boolean
  startTime: string
  endTime: string
  category: EventCategory
  color: string
}

const EMPTY_FORM: FormState = {
  title: '',
  description: '',
  allDay: true,
  startTime: '09:00',
  endTime: '10:00',
  category: 'personal',
  color: CATEGORY_PRESETS[1].color
}

/**
 * Modal form for creating, editing and deleting events. Supports full-day and
 * timed events, category color tagging, and lists the day's existing events.
 */
export function EventModal({
  date,
  dayEvents,
  editing,
  onClose,
  onSave,
  onDelete,
  onEdit
}: EventModalProps): JSX.Element {
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Sync form when the editing target changes.
  useEffect(() => {
    if (editing) {
      setForm({
        title: editing.title,
        description: editing.description,
        allDay: editing.allDay,
        startTime: editing.startTime ?? '09:00',
        endTime: editing.endTime ?? '10:00',
        category: editing.category,
        color: editing.color
      })
    } else {
      const preset = CATEGORY_PRESETS.find((c) => c.value === 'personal') ?? CATEGORY_PRESETS[0]
      setForm({ ...EMPTY_FORM, color: preset.color })
    }
    setError(null)
  }, [editing, date])

  const selectedDate = useMemo(() => fromISODate(date), [date])

  const handleCategory = (value: EventCategory, color: string) => {
    setForm((f) => ({ ...f, category: value, color }))
  }

  const validate = (): string | null => {
    if (!form.title.trim()) return 'Please enter a title.'
    if (!form.allDay) {
      if (!form.startTime) return 'Please set a start time.'
      if (form.startTime && form.endTime && form.endTime <= form.startTime) {
        return 'End time must be after the start time.'
      }
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
      const input: EventInput = {
        title: form.title.trim(),
        description: form.description.trim(),
        date,
        allDay: form.allDay,
        startTime: form.allDay ? null : form.startTime,
        endTime: form.allDay ? null : form.endTime,
        category: form.category,
        color: form.color
      }
      await onSave(input, editing ? editing.id : null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong saving the event.')
    } finally {
      setSaving(false)
    }
  }

  const destroy = async (id: number) => {
    setSaving(true)
    try {
      await onDelete(id)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px] animate-fade-in"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl animate-pop-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="flex items-start justify-between gap-4 border-b border-surface-border px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-800">
              {editing ? 'Edit event' : 'New event'}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">{formatLongDate(selectedDate)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-all duration-200 hover:rotate-90 hover:bg-surface-muted hover:text-slate-600 active:scale-90"
          >
            <CloseIcon />
          </button>
        </header>

        {/* Body */}
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="animate-slide-up" style={{ animationDelay: '40ms' }}>
            <label className="mb-1 block text-xs font-medium text-slate-600">Title</label>
            <input
              autoFocus
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Event title"
              className="w-full rounded-lg border border-surface-border px-3 py-2 text-sm text-slate-800 outline-none transition-all duration-200 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 focus:shadow-[0_0_0_4px_rgba(99,102,241,0.08)]"
            />
          </div>

          <div className="animate-slide-up" style={{ animationDelay: '90ms' }}>
            <label className="mb-1 block text-xs font-medium text-slate-600">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Notes, agenda, location…"
              rows={3}
              className="w-full resize-none rounded-lg border border-surface-border px-3 py-2 text-sm text-slate-800 outline-none transition-all duration-200 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 focus:shadow-[0_0_0_4px_rgba(99,102,241,0.08)]"
            />
          </div>

          {/* All-day toggle */}
          <div className="flex items-center justify-between rounded-lg border border-surface-border px-3 py-2 animate-slide-up" style={{ animationDelay: '140ms' }}>
            <span className="flex items-center gap-2 text-sm text-slate-700">
              <ClockIcon className="text-slate-400" />
              All-day event
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={form.allDay}
              onClick={() => setForm((f) => ({ ...f, allDay: !f.allDay }))}
              className={[
                'relative h-5 w-9 rounded-full transition-colors',
                form.allDay ? 'bg-brand-600' : 'bg-slate-300'
              ].join(' ')}
            >
              <span
                className={[
                  // `left-0.5` pins the knob to the track edge. Without an
                  // explicit `left`, the absolutely-positioned knob falls back
                  // to its centred static position and the translate pushes it
                  // off the end of the track.
                  'absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
                  form.allDay ? 'translate-x-4' : 'translate-x-0'
                ].join(' ')}
              />
            </button>
          </div>

          {/* Time range — springs open when the all-day toggle flips off */}
          {!form.allDay && (
            <div className="grid grid-cols-2 gap-3 animate-expand-in">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Start</label>
                <input
                  type="time"
                  value={form.startTime}
                  onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                  className="w-full rounded-lg border border-surface-border px-3 py-2 text-sm text-slate-800 outline-none transition-all duration-200 focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">End</label>
                <input
                  type="time"
                  value={form.endTime}
                  onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                  className="w-full rounded-lg border border-surface-border px-3 py-2 text-sm text-slate-800 outline-none transition-all duration-200 focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                />
              </div>
            </div>
          )}

          {/* Category / color */}
          <div className="animate-slide-up" style={{ animationDelay: '190ms' }}>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">Category</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_PRESETS.map((preset, i) => {
                const active = form.category === preset.value
                return (
                  <button
                    key={preset.value}
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
                        : 'border-surface-border text-slate-600 hover:bg-surface-muted'
                    ].join(' ')}
                  >
                    <span
                      className="h-2 w-2 rounded-full transition-transform duration-200"
                      style={{ backgroundColor: active ? '#ffffff' : preset.color, transform: active ? 'scale(1.25)' : undefined }}
                    />
                    {preset.label}
                  </button>
                )
              })}
            </div>
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600 animate-shake">
              {error}
            </p>
          )}

          {/* Existing events for the day */}
          {dayEvents.length > 0 && (
            <div className="border-t border-surface-border pt-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                On this day
              </p>
              <ul className="space-y-1.5">
                {dayEvents.map((ev, i) => (
                  <li
                    key={ev.id}
                    style={{ animationDelay: `${i * 45}ms` }}
                    className="group flex animate-slide-up items-start justify-between gap-2 rounded-lg bg-surface-muted px-3 py-2 transition-colors hover:bg-brand-50/70"
                  >
                    <button
                      type="button"
                      onClick={() => onEdit(ev.id)}
                      title="Click to edit this event"
                      className="flex min-w-0 flex-1 items-start gap-2 rounded text-left transition-transform duration-150 hover:translate-x-0.5"
                    >
                      <span
                        className="mt-1 h-2 w-2 flex-shrink-0 rounded-full"
                        style={{ backgroundColor: ev.color }}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-700">
                          {ev.title || 'Untitled'}
                        </p>
                        <p className="truncate text-[11px] text-slate-400">
                          {formatTimeRange(ev.startTime, ev.endTime, ev.allDay)}
                        </p>
                        {ev.description.trim() && (
                          <p className="mt-0.5 line-clamp-3 whitespace-pre-wrap text-[11px] leading-snug text-slate-500">
                            {ev.description}
                          </p>
                        )}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => destroy(ev.id)}
                      aria-label="Delete event"
                      className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-slate-400 transition-all duration-200 hover:scale-110 hover:bg-white hover:text-red-500 active:scale-95"
                    >
                      <TrashIcon />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="flex items-center justify-between gap-3 border-t border-surface-border px-5 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition-all duration-200 hover:bg-surface-muted active:scale-95"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-700 hover:shadow-md active:translate-y-0 active:scale-95 disabled:opacity-60"
          >
            {!editing && <PlusIcon width={16} height={16} />}
            {editing ? 'Save changes' : 'Add event'}
          </button>
        </footer>
      </div>
    </div>
  )
}
