import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import type { CalendarEvent, Deadline, WeekStart } from '@shared/types'
import {
  formatMonthYear,
  getMonthGrid,
  getWeekdayLabels,
  startOfToday,
  type DayCellData
} from '../lib/dateEngine'
import {
  OVERFLOW_BADGE_HEIGHT,
  bandRoomForRowHeight,
  deadlineTooltip,
  formatDeadlineRange,
  layoutWeekDeadlines,
  readableTextColor
} from '../lib/deadlineLayout'
import { DayCell } from './DayCell'
import { ChevronLeft, ChevronRight, CloseIcon, FlagIcon } from './Icons'

interface CalendarGridProps {
  year: number
  month: number
  events: CalendarEvent[]
  /** Multi-day deadlines drawn as colour bars across their timeframe. */
  deadlines: Deadline[]
  /** Which day the week starts on (drives grid order + header labels). */
  weekStart: WeekStart
  onChangeMonth: (year: number, month: number) => void
  onSelectDay: (cell: DayCellData) => void
  onOpenDay: (cell: DayCellData) => void
  /** Open the deadline modal to create a new deadline. */
  onCreateDeadline: () => void
  /** Open the deadline modal for an existing deadline. */
  onEditDeadline: (id: string) => void
}

/** Days per row — the grid is always seven columns wide. */
const DAYS_PER_WEEK = 7

/**
 * The main interactive month view. Renders a stable 6x7 grid, header with
 * month/year label, prev/next navigation and a "Today" jump button.
 */
export function CalendarGrid({
  year,
  month,
  events,
  deadlines,
  weekStart,
  onChangeMonth,
  onSelectDay,
  onOpenDay,
  onCreateDeadline,
  onEditDeadline
}: CalendarGridProps): JSX.Element {
  const grid = useMemo(() => getMonthGrid(year, month, weekStart), [year, month, weekStart])
  const labels = useMemo(() => getWeekdayLabels(weekStart), [weekStart])

  // Split the flat 42-cell grid into the six rows that make up the weeks.
  const weeks = useMemo(() => {
    const rows: DayCellData[][] = []
    for (let i = 0; i < grid.length; i += DAYS_PER_WEEK) {
      rows.push(grid.slice(i, i + DAYS_PER_WEEK))
    }
    return rows
  }, [grid])

  // A callback ref (not `useRef`) so the observer is re-attached to the *new*
  // element every time the keyed section remounts on a month change. With a
  // plain ref the effect's `weeks.length` dependency never changes, so the
  // observer keeps watching the detached old node and `rowHeight` stays stuck
  // at whatever the still-hidden window reported.
  const [gridEl, setGridEl] = useState<HTMLDivElement | null>(null)
  const [rowHeight, setRowHeight] = useState<number | null>(null)

  // All six rows share the grid's real rendered height. Measuring here keeps
  // deadline lanes inside the day boxes even at the minimum window size.
  useLayoutEffect(() => {
    if (!gridEl) return

    const measure = () => {
      // `clientHeight` is 0 until the window is actually shown, so ignore a
      // non-positive reading instead of letting it starve the lane math.
      const total = gridEl.clientHeight
      if (total <= 0) return
      const nextHeight = total / weeks.length
      setRowHeight((previous) =>
        previous != null && Math.abs(previous - nextHeight) < 0.5 ? previous : nextHeight
      )
    }
    measure()

    // The observer keeps the lane math in sync with real layout changes (a
    // window resize, the update banner appearing, a wrapped header). The
    // `resize` listener is a safety net for layouts that change while the
    // window is not painting, where ResizeObserver callbacks are deferred.
    window.addEventListener('resize', measure)

    if (typeof ResizeObserver === 'undefined') {
      return () => window.removeEventListener('resize', measure)
    }

    const observer = new ResizeObserver(measure)
    observer.observe(gridEl)
    return () => {
      window.removeEventListener('resize', measure)
      observer.disconnect()
    }
  }, [gridEl, weeks.length])

  // Group events by ISO date for O(1) lookup inside each cell.
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const ev of events) {
      const list = map.get(ev.date)
      if (list) list.push(ev)
      else map.set(ev.date, [ev])
    }
    return map
  }, [events])

  /**
   * Vertical space each week row can spare for deadline bars. An unmeasured row
   * (the window is still hidden, or the grid has just remounted on a month
   * change) falls back to the room three full-height lanes need, so deadlines
   * render immediately instead of waiting for a resize to appear.
   */
  const bandRoom = bandRoomForRowHeight(rowHeight)

  /**
   * Deadline bars per week. Computed per row (not globally) because a bar
   * breaks at each week boundary, and each row packs its own lanes.
   */
  const weekDeadlines = useMemo(
    () => weeks.map((week) => layoutWeekDeadlines(deadlines, week, bandRoom)),
    [weeks, deadlines, bandRoom]
  )

  /**
   * Which week's "N more deadlines" list is open (keyed by the week's first
   * ISO date) and where its fixed-position popover should be anchored.
   */
  const [overflowWeek, setOverflowWeek] = useState<string | null>(null)
  const [overflowAnchor, setOverflowAnchor] = useState<{ top: number; right: number } | null>(null)

  const closeOverflow = useCallback(() => {
    setOverflowWeek(null)
    setOverflowAnchor(null)
  }, [])

  const toggleOverflow = useCallback(
    (weekIso: string, element: HTMLElement) => {
      if (overflowWeek === weekIso) {
        closeOverflow()
        return
      }
      const rect = element.getBoundingClientRect()
      setOverflowAnchor({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
      setOverflowWeek(weekIso)
    },
    [overflowWeek, closeOverflow]
  )

  // A new month (or new deadlines) invalidates an open overflow list.
  useEffect(() => {
    closeOverflow()
  }, [year, month, deadlines.length, closeOverflow])

  /** Deadlines hidden by the open week's overflow list, when one is open. */
  const openOverflow = useMemo(() => {
    if (overflowWeek == null) return null
    const index = weeks.findIndex((week) => week[0].iso === overflowWeek)
    if (index === -1) return null
    const entry = weekDeadlines[index]
    return entry && entry.overflowDeadlines.length > 0 ? entry.overflowDeadlines : null
  }, [overflowWeek, weeks, weekDeadlines])

  const goPrev = () => {
    const d = new Date(year, month - 1, 1)
    onChangeMonth(d.getFullYear(), d.getMonth())
  }

  const goNext = () => {
    const d = new Date(year, month + 1, 1)
    onChangeMonth(d.getFullYear(), d.getMonth())
  }

  const goToday = () => {
    const t = startOfToday()
    onChangeMonth(t.getFullYear(), t.getMonth())
  }

  const jumpToYear = (delta: number) => {
    onChangeMonth(year + delta, month)
  }

  return (
    <section
      key={`${year}-${month}`}
      className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-surface-border bg-surface shadow-sm animate-fade-in"
    >
      {/* Header / navigation */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-border px-4 py-3 animate-slide-up">
        <div className="flex items-center gap-2">
          <div className="flex items-center overflow-hidden rounded-lg border border-surface-border">
            <button
              type="button"
              onClick={goPrev}
              aria-label="Previous month"
              className="flex h-8 w-8 items-center justify-center text-content-muted transition-all duration-200 hover:bg-brand-50 hover:text-brand-700 active:scale-90"
            >
              <ChevronLeft />
            </button>
            <button
              type="button"
              onClick={goNext}
              aria-label="Next month"
              className="flex h-8 w-8 items-center justify-center border-l border-surface-border text-content-muted transition-all duration-200 hover:bg-brand-50 hover:text-brand-700 active:scale-90"
            >
              <ChevronRight />
            </button>
          </div>

          <h2 className="min-w-[9rem] text-lg font-semibold text-content animate-slide-up">
            {formatMonthYear(year, month)}
          </h2>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => jumpToYear(-1)}
            className="rounded-lg px-2 py-1 text-xs font-medium text-content-muted transition-all duration-200 hover:-translate-x-0.5 hover:bg-surface-muted hover:text-content active:scale-95"
            aria-label="Previous year"
          >
            « Year
          </button>
          <button
            type="button"
            onClick={goToday}
            className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-700 hover:shadow-md active:translate-y-0 active:scale-95"
          >
            Today
          </button>
          <button
            type="button"
            onClick={onCreateDeadline}
            title="Add a deadline that spans a timeframe"
            className="flex items-center gap-1.5 rounded-lg border border-brand-400/60 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-100 hover:shadow-md active:translate-y-0 active:scale-95"
          >
            <FlagIcon width={14} height={14} />
            Deadline
          </button>
          <button
            type="button"
            onClick={() => jumpToYear(1)}
            className="rounded-lg px-2 py-1 text-xs font-medium text-content-muted transition-all duration-200 hover:translate-x-0.5 hover:bg-surface-muted hover:text-content active:scale-95"
            aria-label="Next year"
          >
            Year »
          </button>
        </div>
      </header>

      {/* Weekday header */}
      <div className="grid grid-cols-7 border-b border-surface-border bg-surface-muted/70">
        {labels.map((label, i) => (
          <div
            key={label}
            style={{ animationDelay: `${i * 30}ms` }}
            className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-content-muted animate-fade-in"
          >
            {label}
          </div>
        ))}
      </div>

      {/* Day grid: six week rows, each with its own deadline bar overlay */}
      <div ref={setGridEl} className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {weeks.map((week, weekIndex) => {
          const { bars, overflow, overflowDeadlines, bandHeight, barHeight, overflowTop } =
            weekDeadlines[weekIndex]
          const overflowOpen = overflowWeek === week[0].iso
          return (
            <div
              key={week[0].iso}
              className="relative grid min-h-0 flex-1 grid-cols-7 overflow-hidden"
            >
              {week.map((cell, dayIndex) => (
                <div
                  key={cell.iso}
                  style={{ animationDelay: `${((weekIndex * DAYS_PER_WEEK + dayIndex) % 14) * 22}ms` }}
                  className="flex min-h-0 min-w-0 animate-cell-in"
                >
                  <DayCell
                    cell={cell}
                    events={eventsByDate.get(cell.iso) ?? []}
                    deadlineBandHeight={bandHeight}
                    deadlineOverflow={bars.length === 0 ? overflow : 0}
                    deadlineOverflowTitles={
                      bars.length === 0 ? overflowDeadlines.map((deadline) => deadline.title) : []
                    }
                    onSelect={onSelectDay}
                    onOpenDay={onOpenDay}
                  />
                </div>
              ))}

              {/*
                Deadline bars. The layer is pointer-transparent so day cells
                keep receiving clicks; only the bars themselves are clickable.
              */}
              {bars.length > 0 && (
                <div className="pointer-events-none absolute inset-0 z-10">
                  {bars.map((bar) => {
                    const color = bar.deadline.color
                    return (
                      <button
                        key={bar.deadline.id}
                        type="button"
                        onClick={() => onEditDeadline(bar.deadline.id)}
                        title={deadlineTooltip(bar.deadline)}
                        style={{
                          left: `${(bar.columnStart / DAYS_PER_WEEK) * 100}%`,
                          width: `${(bar.columnSpan / DAYS_PER_WEEK) * 100}%`,
                          top: bar.top,
                          height: bar.height,
                          backgroundColor: color,
                          color: readableTextColor(color),
                          borderTopLeftRadius: bar.startsHere ? '9999px' : 0,
                          borderBottomLeftRadius: bar.startsHere ? '9999px' : 0,
                          borderTopRightRadius: bar.endsHere ? '9999px' : 0,
                          borderBottomRightRadius: bar.endsHere ? '9999px' : 0,
                          animationDelay: `${bar.lane * 60}ms`
                        }}
                        className={[
                          'pointer-events-auto absolute flex items-center overflow-hidden px-1.5 font-semibold leading-none shadow-sm animate-chip-in transition duration-150 hover:brightness-110 hover:shadow-md active:brightness-95',
                          barHeight < 12 ? 'text-[9px]' : 'text-[10px]'
                        ].join(' ')}
                      >
                        <span className="truncate">{bar.deadline.title || 'Deadline'}</span>
                      </button>
                    )
                  })}

                  {/*
                    Deadlines that did not fit the week's lanes stay reachable
                    instead of vanishing: the badge is a real control that lists
                    them, and each entry opens that deadline for editing.
                  */}
                  {overflow > 0 && overflowTop != null && (
                    <button
                      type="button"
                      onClick={(event) => toggleOverflow(week[0].iso, event.currentTarget)}
                      title={`${overflow} more deadline${overflow === 1 ? '' : 's'} this week:\n${overflowDeadlines
                        .map((deadline) => `• ${deadline.title || 'Deadline'}`)
                        .join('\n')}`}
                      aria-label={`Show ${overflow} more deadline${
                        overflow === 1 ? '' : 's'
                      } in this week`}
                      aria-expanded={overflowOpen}
                      style={{ top: overflowTop, height: OVERFLOW_BADGE_HEIGHT }}
                      className={[
                        'pointer-events-auto absolute right-1.5 flex items-center gap-1 rounded-full px-1.5 text-[9px] font-bold shadow-sm ring-1 transition duration-150',
                        overflowOpen
                          ? 'bg-brand-600 text-white ring-brand-600'
                          : 'bg-surface text-content-muted ring-surface-border hover:bg-brand-50 hover:text-brand-700'
                      ].join(' ')}
                    >
                      <FlagIcon width={10} height={10} />
                      +{overflow}
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {/* Overflow list: every deadline the week had no room to draw. */}
        {openOverflow && overflowAnchor && (
          <>
            <div
              className="pointer-events-auto fixed inset-0 z-20"
              onClick={closeOverflow}
              aria-hidden="true"
            />
            <div
              role="dialog"
              aria-label="Deadlines with no room left this week"
              className="glass-panel pointer-events-auto fixed z-30 w-64 overflow-hidden rounded-xl border border-surface-border shadow-2xl animate-pop-in"
              style={{
                top: Math.min(overflowAnchor.top, Math.max(8, window.innerHeight - 180)),
                right: Math.max(8, overflowAnchor.right)
              }}
            >
              <div className="flex items-center justify-between border-b border-surface-border px-3 py-2">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-content-subtle">
                  {openOverflow.length} more deadline{openOverflow.length === 1 ? '' : 's'}
                </span>
                <button
                  type="button"
                  onClick={closeOverflow}
                  aria-label="Close"
                  className="flex h-5 w-5 items-center justify-center rounded text-content-subtle transition-all duration-200 hover:bg-surface-muted hover:text-content active:scale-90"
                >
                  <CloseIcon width={13} height={13} />
                </button>
              </div>
              <ul className="max-h-56 space-y-0.5 overflow-y-auto p-1.5">
                {openOverflow.map((deadline) => (
                  <li key={deadline.id}>
                    <button
                      type="button"
                      onClick={() => {
                        closeOverflow()
                        onEditDeadline(deadline.id)
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors duration-150 hover:bg-surface-muted"
                    >
                      <span
                        className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                        style={{ backgroundColor: deadline.color }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium text-content">
                          {deadline.title || 'Deadline'}
                        </span>
                        <span className="block truncate text-[10px] text-content-subtle">
                          {formatDeadlineRange(deadline)}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>
    </section>
  )
}
