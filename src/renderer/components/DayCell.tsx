import { useEffect, useRef } from 'react'
import type { CalendarEvent } from '@shared/types'
import type { DayCellData } from '../lib/dateEngine'
import { formatTimeRange } from '../lib/dateEngine'

interface DayCellProps {
  cell: DayCellData
  events: CalendarEvent[]
  /** Single click: open the quick add/edit modal for this day. */
  onSelect: (cell: DayCellData) => void
  /** Double click: open the full 24-hour day view for this day. */
  onOpenDay: (cell: DayCellData) => void
}

/** Builds the hover tooltip, including the description when one exists. */
function buildTooltip(ev: CalendarEvent): string {
  const parts = [ev.title || 'Untitled', formatTimeRange(ev.startTime, ev.endTime, ev.allDay)]
  if (ev.description.trim()) parts.push(ev.description.trim())
  return parts.filter(Boolean).join('\n')
}

/**
 * A single day cell in the calendar grid. Shows the day number and up to three
 * event chips (with a "+N more" indicator). A single click opens the event
 * modal; a double click opens the full 24-hour day view. Adjacent-month days
 * are dimmed.
 */
export function DayCell({ cell, events, onSelect, onOpenDay }: DayCellProps): JSX.Element {
  const visible = events.slice(0, 3)
  const overflow = events.length - visible.length

  // Disambiguate single vs. double click. Waiting a short beat before firing
  // "select" prevents the modal from covering the cell and swallowing the
  // second click of a double click.
  const clickTimer = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (clickTimer.current != null) window.clearTimeout(clickTimer.current)
    }
  }, [])

  const handleClick = () => {
    if (clickTimer.current != null) return
    clickTimer.current = window.setTimeout(() => {
      clickTimer.current = null
      onSelect(cell)
    }, 200)
  }

  const handleDoubleClick = () => {
    if (clickTimer.current != null) {
      window.clearTimeout(clickTimer.current)
      clickTimer.current = null
    }
    onOpenDay(cell)
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      title="Click to add an event · Double-click for the day view"
      className={[
        'group relative flex h-full w-full min-h-[92px] flex-col gap-1 border-b border-r border-surface-border p-1.5 text-left transition-all duration-200',
        cell.inCurrentMonth
          ? 'bg-white hover:bg-brand-50/60 hover:shadow-[inset_0_0_0_2px_rgba(99,102,241,0.25)]'
          : 'bg-surface-muted/60 hover:bg-brand-50/40',
        'hover:z-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-inset active:scale-[0.99]'
      ].join(' ')}
    >
      <div className="flex items-center justify-between">
        <span
          className={[
            'flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold',
            cell.isToday
              ? 'bg-brand-600 text-white'
              : cell.inCurrentMonth
                ? 'text-slate-700'
                : 'text-slate-400'
          ].join(' ')}
        >
          {cell.day}
        </span>
        {events.length > 0 && (
          <span className="text-[10px] font-medium text-slate-400">{events.length}</span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
        {visible.map((ev, i) => (
          <div
            key={ev.id}
            style={{ backgroundColor: `${ev.color}1a`, color: ev.color, animationDelay: `${i * 40}ms` }}
            className="flex items-center gap-1 truncate rounded px-1 py-0.5 text-[10px] leading-tight animate-chip-in transition-transform duration-150 hover:scale-105"
            title={buildTooltip(ev)}
          >
            <span
              className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
              style={{ backgroundColor: ev.color }}
            />
            <span className="truncate font-medium">{ev.title || 'Untitled'}</span>
          </div>
        ))}
        {overflow > 0 && (
          <span className="px-1 text-[10px] font-medium text-slate-400">+{overflow} more</span>
        )}
      </div>

      {/* Hover affordance for the day view */}
      <span className="pointer-events-none absolute bottom-1 right-1 rounded bg-slate-900/70 px-1 py-0.5 text-[9px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
        Day view
      </span>
    </button>
  )
}
