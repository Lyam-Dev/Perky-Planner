import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CalendarEvent, Deadline, WeekStart } from '@shared/types'
import {
  formatMonthYear,
  getMonthGrid,
  getWeekdayLabels,
  startOfToday,
  type DayCellData
} from '../lib/dateEngine'
import {
  BAR_HEIGHT,
  MAX_LANES,
  barTop,
  deadlineLanesForRowHeight,
  deadlineTooltip,
  layoutWeekDeadlines,
  readableTextColor
} from '../lib/deadlineLayout'
import { DayCell } from './DayCell'
import { ChevronLeft, ChevronRight, FlagIcon } from './Icons'

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

  const gridRef = useRef<HTMLDivElement | null>(null)
  const [rowHeight, setRowHeight] = useState<number | null>(null)

  // All six rows share the grid's real rendered height. Measuring here keeps
  // deadline lanes inside the day boxes even at the minimum window size.
  useLayoutEffect(() => {
    const gridElement = gridRef.current
    if (!gridElement) return

    const measure = () => {
      const nextHeight = gridElement.clientHeight / weeks.length
      setRowHeight((previous) => (previous === nextHeight ? previous : nextHeight))
    }
    measure()

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }

    const observer = new ResizeObserver(measure)
    observer.observe(gridElement)
    return () => observer.disconnect()
  }, [weeks.length])

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

  const maxDeadlineLanes = rowHeight == null ? MAX_LANES : deadlineLanesForRowHeight(rowHeight)

  /**
   * Deadline bars per week. Computed per row (not globally) because a bar
   * breaks at each week boundary, and each row packs its own lanes.
   */
  const weekDeadlines = useMemo(
    () => weeks.map((week) => layoutWeekDeadlines(deadlines, week, maxDeadlineLanes)),
    [weeks, deadlines, maxDeadlineLanes]
  )

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
      <div ref={gridRef} className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {weeks.map((week, weekIndex) => {
          const { bars, overflow, bandHeight } = weekDeadlines[weekIndex]
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
                          top: barTop(bar.lane),
                          height: BAR_HEIGHT,
                          backgroundColor: color,
                          color: readableTextColor(color),
                          borderTopLeftRadius: bar.startsHere ? '9999px' : 0,
                          borderBottomLeftRadius: bar.startsHere ? '9999px' : 0,
                          borderTopRightRadius: bar.endsHere ? '9999px' : 0,
                          borderBottomRightRadius: bar.endsHere ? '9999px' : 0,
                          animationDelay: `${bar.lane * 60}ms`
                        }}
                        className="pointer-events-auto absolute flex items-center overflow-hidden px-1.5 text-[10px] font-semibold leading-none shadow-sm animate-chip-in transition duration-150 hover:brightness-110 hover:shadow-md active:brightness-95"
                      >
                        <span className="truncate">{bar.deadline.title || 'Deadline'}</span>
                      </button>
                    )
                  })}

                  {overflow > 0 && bars.length > 0 && (
                    <span
                      className="absolute right-1.5 rounded bg-surface/80 px-1 text-[9px] font-bold text-content-muted"
                      style={{ top: barTop(bars.reduce((max, bar) => Math.max(max, bar.lane), 0)) + 2 }}
                      title={`${overflow} more deadline${overflow === 1 ? '' : 's'} this week`}
                      aria-label={`${overflow} more deadline${overflow === 1 ? '' : 's'} this week`}
                    >
                      +{overflow}
                    </span>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
