import { useEffect, useMemo, useRef, useState } from 'react'
import type { CalendarEvent } from '@shared/types'
import {
  formatDuration,
  formatHourLabel,
  formatLongDate,
  formatTime,
  formatTimeRange,
  fromISODate,
  timeToMinutes,
  toISODate
} from '../lib/dateEngine'
import { ChevronLeft, ClockIcon, PlusIcon } from './Icons'

/** Vertical pixels representing one hour on the timeline. */
const HOUR_HEIGHT = 56
/** Minimum rendered height so very short events stay readable/clickable. */
const MIN_EVENT_HEIGHT = 26
/** Fallback duration used when an event has no usable end time. */
const DEFAULT_DURATION_MINUTES = 60

const HOURS = Array.from({ length: 24 }, (_, i) => i)

interface DayViewProps {
  /** ISO `YYYY-MM-DD` date being displayed. */
  date: string
  /** All events that fall on this date. */
  events: CalendarEvent[]
  onBack: () => void
  onAddEvent: () => void
  onEditEvent: (id: number) => void
}

interface PositionedEvent {
  event: CalendarEvent
  /** Offset from the top of the timeline, in pixels. */
  top: number
  /** Rendered height in pixels. */
  height: number
  /** Column index within its overlap cluster. */
  lane: number
  /** Total columns in that cluster (used to compute width). */
  lanes: number
  /** Duration in minutes, used for the duration badge. */
  duration: number
}

/** Normalises the event's start/end into minutes since midnight. */
function intervalOf(event: CalendarEvent): { start: number; end: number } {
  const start = timeToMinutes(event.startTime)
  const rawEnd = timeToMinutes(event.endTime)
  // Guard against missing/inverted end times so blocks always render sensibly.
  const end = rawEnd > start ? rawEnd : start + DEFAULT_DURATION_MINUTES
  return { start, end }
}

/**
 * Lays out timed events on the timeline, assigning side-by-side lanes so
 * overlapping events never cover each other.
 *
 * Events are first split into clusters of mutually overlapping entries, then
 * each cluster is packed greedily into the fewest lanes (the classic interval
 * partitioning approach).
 */
export function layoutTimedEvents(events: CalendarEvent[]): PositionedEvent[] {
  const items = events
    .map((event) => ({ event, ...intervalOf(event) }))
    .sort((a, b) => a.start - b.start || b.end - a.end)

  const positioned: PositionedEvent[] = []
  let cluster: typeof items = []
  let clusterEnd = -1

  const flush = (): void => {
    if (cluster.length === 0) return

    // Greedy interval partitioning: reuse the first lane that has finished.
    const laneEnds: number[] = []
    const laneByIndex: number[] = []

    for (const item of cluster) {
      let lane = laneEnds.findIndex((end) => end <= item.start)
      if (lane === -1) {
        lane = laneEnds.length
        laneEnds.push(item.end)
      } else {
        laneEnds[lane] = item.end
      }
      laneByIndex.push(lane)
    }

    const lanes = laneEnds.length
    cluster.forEach((item, i) => {
      positioned.push({
        event: item.event,
        top: (item.start / 60) * HOUR_HEIGHT,
        height: Math.max(((item.end - item.start) / 60) * HOUR_HEIGHT, MIN_EVENT_HEIGHT),
        lane: laneByIndex[i],
        lanes,
        duration: item.end - item.start
      })
    })

    cluster = []
    clusterEnd = -1
  }

  for (const item of items) {
    // Start a new cluster as soon as the previous one can no longer overlap.
    if (cluster.length > 0 && item.start >= clusterEnd) flush()
    cluster.push(item)
    clusterEnd = Math.max(clusterEnd, item.end)
  }
  flush()

  return positioned
}

/** Builds the tooltip shown when hovering an event block. */
function describeEvent(event: CalendarEvent): string {
  const parts = [
    event.title || 'Untitled',
    formatTimeRange(event.startTime, event.endTime, event.allDay)
  ]
  if (event.description.trim()) parts.push(event.description.trim())
  return parts.filter(Boolean).join('\n')
}

/**
 * Full-page 24-hour view for a single day. Timed events are drawn as blocks
 * positioned and sized by their duration, overlapping events are placed in
 * side-by-side lanes, and all-day events appear in a pinned banner.
 */
export function DayView({
  date,
  events,
  onBack,
  onAddEvent,
  onEditEvent
}: DayViewProps): JSX.Element {
  const selectedDate = useMemo(() => fromISODate(date), [date])
  const scrollRef = useRef<HTMLDivElement | null>(null)

  // Split the day's events into the all-day banner and the timeline.
  const { allDayEvents, timedEvents } = useMemo(() => {
    const allDayEvents: CalendarEvent[] = []
    const timedEvents: CalendarEvent[] = []
    for (const ev of events) {
      if (ev.allDay || !ev.startTime) allDayEvents.push(ev)
      else timedEvents.push(ev)
    }
    return { allDayEvents, timedEvents }
  }, [events])

  const positioned = useMemo(() => layoutTimedEvents(timedEvents), [timedEvents])

  /** Total minutes covered by timed events, shown in the header. */
  const scheduledMinutes = useMemo(
    () =>
      timedEvents.reduce((sum, ev) => {
        const { start, end } = intervalOf(ev)
        return sum + (end - start)
      }, 0),
    [timedEvents]
  )

  const isToday = date === toISODate(new Date())

  // Track the current time so the "now" line stays accurate.
  const [nowMinutes, setNowMinutes] = useState(() => {
    const d = new Date()
    return d.getHours() * 60 + d.getMinutes()
  })

  useEffect(() => {
    const id = window.setInterval(() => {
      const d = new Date()
      setNowMinutes(d.getHours() * 60 + d.getMinutes())
    }, 30_000)
    return () => window.clearInterval(id)
  }, [])

  // Scroll to the first event of the day (or 7 AM when the day is empty).
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const firstStart = timedEvents.length
      ? Math.min(...timedEvents.map((ev) => intervalOf(ev).start))
      : 7 * 60
    el.scrollTop = Math.max(0, (firstStart / 60) * HOUR_HEIGHT - 16)
    // Deliberately keyed to the date so navigating days re-scrolls.
  }, [date, timedEvents])

  const eventCount = events.length

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-surface-border bg-white shadow-sm">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-border px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1 rounded-lg border border-surface-border px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-all duration-200 hover:-translate-x-0.5 hover:bg-surface-muted active:scale-95"
          >
            <ChevronLeft width={15} height={15} />
            Calendar
          </button>
          <div>
            <h2 className="text-lg font-semibold text-slate-800">{formatLongDate(selectedDate)}</h2>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
              <ClockIcon className="text-slate-400" />
              {eventCount === 0
                ? 'No events scheduled'
                : `${eventCount} event${eventCount === 1 ? '' : 's'}`}
              {scheduledMinutes > 0 && ` · ${formatDuration(scheduledMinutes)} scheduled`}
              {allDayEvents.length > 0 && ` · ${allDayEvents.length} all-day`}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onAddEvent}
          className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-700 hover:shadow-md active:translate-y-0 active:scale-95"
        >
          <PlusIcon width={15} height={15} />
          Add event
        </button>
      </header>

      {/* All-day banner */}
      {allDayEvents.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-surface-border bg-surface-muted/60 px-4 py-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            All day
          </span>
          {allDayEvents.map((ev) => (
            <button
              key={ev.id}
              type="button"
              onClick={() => onEditEvent(ev.id)}
              title={describeEvent(ev)}
              className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-transform hover:scale-[1.03]"
              style={{ backgroundColor: `${ev.color}1a`, color: ev.color }}
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: ev.color }} />
              {ev.title || 'Untitled'}
            </button>
          ))}
        </div>
      )}

      {/* 24-hour timeline */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <div className="relative flex" style={{ height: HOURS.length * HOUR_HEIGHT }}>
          {/* Hour gutter */}
          <div className="w-16 flex-shrink-0 border-r border-surface-border">
            {HOURS.map((hour) => (
              <div key={hour} className="relative" style={{ height: HOUR_HEIGHT }}>
                <span className="absolute -top-2 right-2 text-[11px] font-medium text-slate-400">
                  {formatHourLabel(hour)}
                </span>
              </div>
            ))}
          </div>

          {/* Event canvas */}
          <div className="relative flex-1">
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="absolute left-0 right-0 border-t border-surface-border"
                style={{ top: hour * HOUR_HEIGHT }}
              />
            ))}

            {/* Current-time indicator */}
            {isToday && (
              <div
                className="pointer-events-none absolute left-0 right-0 z-20"
                style={{ top: (nowMinutes / 60) * HOUR_HEIGHT }}
              >
                <div className="relative border-t-2 border-red-500">
                  <span className="absolute -left-1 -top-[5px] h-2.5 w-2.5 rounded-full bg-red-500" />
                </div>
              </div>
            )}

            {/* Positioned timed events, sized by duration */}
            {positioned.map(({ event, top, height, lane, lanes, duration }) => {
              const widthPct = 100 / lanes
              return (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => onEditEvent(event.id)}
                  title={describeEvent(event)}
                  className="absolute overflow-hidden rounded-lg border-l-4 px-2 py-1 text-left shadow-sm transition-shadow hover:z-10 hover:shadow-md"
                  style={{
                    top,
                    height,
                    left: `calc(${lane * widthPct}% + 4px)`,
                    width: `calc(${widthPct}% - 8px)`,
                    backgroundColor: `${event.color}14`,
                    borderLeftColor: event.color,
                    color: event.color
                  }}
                >
                  <p className="truncate text-xs font-semibold leading-tight">
                    {event.title || 'Untitled'}
                  </p>
                  <p className="truncate text-[10px] leading-tight opacity-80">
                    {formatTime(event.startTime)} – {formatTime(event.endTime)}
                  </p>

                  {height > 58 && event.description.trim() && (
                    <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug opacity-70">
                      {event.description}
                    </p>
                  )}

                  {height > 42 && (
                    <span className="mt-0.5 inline-block rounded bg-white/80 px-1 py-px text-[9px] font-semibold">
                      {formatDuration(duration)}
                    </span>
                  )}
                </button>
              )
            })}

            {positioned.length === 0 && (
              <p className="absolute inset-x-0 top-16 text-center text-xs text-slate-400">
                Nothing scheduled on the timeline — click “Add event” to create something.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}