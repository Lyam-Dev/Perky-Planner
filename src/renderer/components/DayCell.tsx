import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CalendarEvent } from '@shared/types'
import type { DayCellData } from '../lib/dateEngine'
import { formatTimeRange } from '../lib/dateEngine'
import {
  CELL_GAP,
  CELL_PADDING,
  DAY_NUMBER_HEIGHT,
  EVENT_CHIP_HEIGHT,
  EVENT_LIST_GAP,
  EVENT_OVERFLOW_HEIGHT,
  dayCellEventCapacity,
  dayCellEventSpace,
  eventOverflowLabel
} from '../lib/calendarCellLayout'

interface DayCellProps {
  cell: DayCellData
  events: CalendarEvent[]
  /**
   * Vertical space (px) to keep clear for deadline bars drawn over this row.
   * Comes from `layoutWeekDeadlines` so every cell in a week reserves the same
   * band and the absolute bars line up across the row.
   */
  deadlineBandHeight?: number
  /** Deadlines omitted because the row has no room for another lane. */
  deadlineOverflow?: number
  /** Titles of those omitted deadlines, used for the hover tooltip. */
  deadlineOverflowTitles?: string[]
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
 * A single day cell in the calendar grid. Renders only the events that fit its
 * actual measured height and keeps an overflow count inside the cell. A single
 * click on any item opens a scrollable EventModal whose “On this day” list
 * contains every hidden item, so the compact month cell is not a dead end. A
 * double click opens the full 24-hour day view. Adjacent-month days are dimmed.
 */
export function DayCell({
  cell,
  events,
  deadlineBandHeight = 0,
  deadlineOverflow = 0,
  deadlineOverflowTitles = [],
  onSelect,
  onOpenDay
}: DayCellProps): JSX.Element {
  const cellRef = useRef<HTMLButtonElement | null>(null)
  const [cellHeight, setCellHeight] = useState<number | null>(null)

  /** Tooltip for the flag badge, naming the deadlines the week cannot draw. */
  const deadlineOverflowLabel =
    deadlineOverflowTitles.length > 0
      ? `${deadlineOverflow} more deadline${deadlineOverflow === 1 ? '' : 's'} this week:\n${deadlineOverflowTitles
          .map((title) => `• ${title || 'Deadline'}`)
          .join('\n')}`
      : `${deadlineOverflow} more deadline${deadlineOverflow === 1 ? '' : 's'} this week`

  // Measure the row itself rather than guessing from the window height. The
  // parent grid gives all six rows a flex share, and this also follows any
  // future header wrapping or window resize.
  useLayoutEffect(() => {
    const element = cellRef.current
    if (!element) return

    const measure = () => {
      const nextHeight = element.clientHeight
      setCellHeight((previous) => (previous === nextHeight ? previous : nextHeight))
    }
    measure()

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }

    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [cell.iso, deadlineBandHeight])

  const eventSpace = dayCellEventSpace(cellHeight ?? 0, deadlineBandHeight)
  const capacity = dayCellEventCapacity(events.length, eventSpace)
  const visible = events.slice(0, capacity.visibleCount)
  const overflow = capacity.hiddenCount
  const overflowInHeader = capacity.overflowPlacement === 'header'
  const showDayViewHint = cellHeight == null || cellHeight >= 72

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
      ref={cellRef}
      type="button"
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      style={{ padding: CELL_PADDING, rowGap: CELL_GAP }}

      title="Click to add an event · Double-click for the day view"
      className={[
        'group relative flex h-full w-full min-h-0 flex-col overflow-hidden border-b border-r border-surface-border text-left transition-all duration-200',
        cell.inCurrentMonth
          ? 'bg-surface hover:bg-brand-50/60 hover:shadow-[inset_0_0_0_2px_rgba(99,102,241,0.25)]'
          : 'bg-surface-muted/60 hover:bg-brand-50/40',
        'hover:z-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-inset active:scale-[0.99]'
      ].join(' ')}
    >
      <div
        style={{ height: DAY_NUMBER_HEIGHT }}
        className="flex flex-shrink-0 items-center justify-between"
      >
        <span
          className={[
            'flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold',
            cell.isToday
              ? 'bg-brand-600 text-white'
              : cell.inCurrentMonth
                ? 'text-content'
                : 'text-content-subtle'
          ].join(' ')}
        >
          {cell.day}
        </span>
        {events.length > 0 && (
          <div className="flex min-w-0 items-center gap-1.5">
            {deadlineOverflow > 0 && (
              <span
                className="inline-flex flex-shrink-0 items-center text-[9px] font-semibold text-content-subtle"
                title={deadlineOverflowLabel}
                aria-label={`${deadlineOverflow} more deadlines this week`}
              >
                ⚑+{deadlineOverflow}
              </span>
            )}
            <span
              className="text-[10px] font-medium text-content-subtle"
              title={`${events.length} event${events.length === 1 ? '' : 's'} on this day`}
              aria-label={`${events.length} events on this day`}
            >
              {overflowInHeader ? `+${overflow}` : events.length}
            </span>
          </div>
        )}
        {events.length === 0 && deadlineOverflow > 0 && (
          <span
            className="text-[9px] font-semibold text-content-subtle"
            title={deadlineOverflowLabel}
            aria-label={`${deadlineOverflow} more deadlines this week`}
          >
            ⚑+{deadlineOverflow}
          </span>
        )}
      </div>

      {/* Space held for the deadline bars drawn over this week row. */}
      {deadlineBandHeight > 0 && (
        <div aria-hidden style={{ height: deadlineBandHeight }} className="flex-shrink-0" />
      )}

      <div
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
        style={{ gap: EVENT_LIST_GAP }}
      >
        {visible.map((ev, i) => (
          <div
            key={ev.id}
            style={{
              backgroundColor: `${ev.color}1a`,
              color: ev.color,
              animationDelay: `${i * 40}ms`,
              height: EVENT_CHIP_HEIGHT,
              flexShrink: 0
            }}
            className="flex items-center gap-1 truncate rounded px-1 text-[10px] leading-tight animate-chip-in transition-transform duration-150 hover:scale-105"
            title={buildTooltip(ev)}
          >
            <span
              className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
              style={{ backgroundColor: ev.color }}
            />
            <span className="truncate font-medium">{ev.title || 'Untitled'}</span>
          </div>
        ))}
        {capacity.overflowPlacement === 'row' && overflow > 0 && (
          <span
            className="flex flex-shrink-0 items-center truncate px-1 text-[10px] font-medium leading-none text-content-subtle"
            style={{ height: EVENT_OVERFLOW_HEIGHT }}
            title={`${overflow} more event${overflow === 1 ? '' : 's'} on this day`}
          >
            {eventOverflowLabel(overflow)}
          </span>
        )}
      </div>

      {showDayViewHint && (
        <span className="pointer-events-none absolute bottom-1 right-1 rounded bg-scrim/70 px-1 py-0.5 text-[9px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
          Day view
        </span>
      )}
    </button>
  )
}
