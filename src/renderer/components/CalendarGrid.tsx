import { useMemo } from 'react'
import type { CalendarEvent } from '@shared/types'
import {
  WEEKDAY_LABELS,
  formatMonthYear,
  getMonthGrid,
  startOfToday,
  type DayCellData
} from '../lib/dateEngine'
import { DayCell } from './DayCell'
import { ChevronLeft, ChevronRight } from './Icons'

interface CalendarGridProps {
  year: number
  month: number
  events: CalendarEvent[]
  onChangeMonth: (year: number, month: number) => void
  onSelectDay: (cell: DayCellData) => void
  onOpenDay: (cell: DayCellData) => void
}

/**
 * The main interactive month view. Renders a stable 6x7 grid, header with
 * month/year label, prev/next navigation and a "Today" jump button.
 */
export function CalendarGrid({
  year,
  month,
  events,
  onChangeMonth,
  onSelectDay,
  onOpenDay
}: CalendarGridProps): JSX.Element {
  const grid = useMemo(() => getMonthGrid(year, month), [year, month])

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
      className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-surface-border bg-white shadow-sm animate-fade-in"
    >
      {/* Header / navigation */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-border px-4 py-3 animate-slide-up">
        <div className="flex items-center gap-2">
          <div className="flex items-center overflow-hidden rounded-lg border border-surface-border">
            <button
              type="button"
              onClick={goPrev}
              aria-label="Previous month"
              className="flex h-8 w-8 items-center justify-center text-slate-600 transition-all duration-200 hover:bg-brand-50 hover:text-brand-700 active:scale-90"
            >
              <ChevronLeft />
            </button>
            <button
              type="button"
              onClick={goNext}
              aria-label="Next month"
              className="flex h-8 w-8 items-center justify-center border-l border-surface-border text-slate-600 transition-all duration-200 hover:bg-brand-50 hover:text-brand-700 active:scale-90"
            >
              <ChevronRight />
            </button>
          </div>

          <h2 className="min-w-[9rem] text-lg font-semibold text-slate-800 animate-slide-up">
            {formatMonthYear(year, month)}
          </h2>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => jumpToYear(-1)}
            className="rounded-lg px-2 py-1 text-xs font-medium text-slate-500 transition-all duration-200 hover:-translate-x-0.5 hover:bg-surface-muted hover:text-slate-700 active:scale-95"
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
            onClick={() => jumpToYear(1)}
            className="rounded-lg px-2 py-1 text-xs font-medium text-slate-500 transition-all duration-200 hover:translate-x-0.5 hover:bg-surface-muted hover:text-slate-700 active:scale-95"
            aria-label="Next year"
          >
            Year »
          </button>
        </div>
      </header>

      {/* Weekday header */}
      <div className="grid grid-cols-7 border-b border-surface-border bg-surface-muted/70">
        {WEEKDAY_LABELS.map((label, i) => (
          <div
            key={label}
            style={{ animationDelay: `${i * 30}ms` }}
            className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500 animate-fade-in"
          >
            {label}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-6 overflow-hidden">
        {grid.map((cell, i) => (
          <div
            key={cell.iso}
            style={{ animationDelay: `${(i % 14) * 22}ms` }}
            className="flex min-h-0 animate-cell-in"
          >
            <DayCell
              cell={cell}
              events={eventsByDate.get(cell.iso) ?? []}
              onSelect={onSelectDay}
              onOpenDay={onOpenDay}
            />
          </div>
        ))}
      </div>
    </section>
  )
}
