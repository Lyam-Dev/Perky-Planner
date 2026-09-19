/**
 * Perpetual calendar date engine.
 *
 * Pure, dependency-light helpers that generate the 6x7 (42-cell) grid used by
 * the calendar view. All date math is delegated to the native `Date` object,
 * which correctly handles leap years for any year (past, present or future).
 */

import type { WeekStart } from '@shared/types'

export interface DayCellData {
  /** The actual date for this cell. */
  date: Date
  /** ISO `YYYY-MM-DD` string for persistence/keys. */
  iso: string
  /** Day of month (1-31). */
  day: number
  /** Whether this day belongs to the currently displayed month. */
  inCurrentMonth: boolean
  /** Whether this cell is "today". */
  isToday: boolean
  /** 0 = Sunday ... 6 = Saturday. */
  weekday: number
}

export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Pads a number to two digits. */
function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

/** Formats a Date as a local `YYYY-MM-DD` string (no timezone shifting). */
export function toISODate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Parses a `YYYY-MM-DD` string into a local Date (midnight). */
export function fromISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Number of days in a given month (accounts for leap years). */
export function getDaysInMonth(year: number, month: number): number {
  // Day 0 of the next month is the last day of this month.
  return new Date(year, month + 1, 0).getDate()
}

/** Whether a year is a leap year. */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

/** Returns a new Date at midnight today. */
export function startOfToday(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

/** True when two dates fall on the same calendar day. */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/** Adds `amount` months to a year/month pair, normalising overflow. */
export function addMonths(
  year: number,
  month: number,
  amount: number
): { year: number; month: number } {
  const d = new Date(year, month + amount, 1)
  return { year: d.getFullYear(), month: d.getMonth() }
}

/**
 * Builds the full 6-week grid for a month. Always returns 42 cells so the
 * layout stays perfectly stable (no jumping row counts), with days from the
 * adjacent months filling the leading/trailing slots. Honors the configured
 * week start (Sunday or Monday).
 */
export function getMonthGrid(
  year: number,
  month: number,
  weekStart: WeekStart = 'sunday'
): DayCellData[] {
  const today = startOfToday()
  const firstOfMonth = new Date(year, month, 1)
  const firstDayOfWeek = weekStart === 'monday' ? 1 : 0

  // Days to back-pedal so the grid starts on the configured first weekday.
  const offset = (firstOfMonth.getDay() - firstDayOfWeek + 7) % 7
  const gridStart = new Date(year, month, 1 - offset)

  const cells: DayCellData[] = []
  for (let i = 0; i < 42; i++) {
    const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i)
    cells.push({
      date,
      iso: toISODate(date),
      day: date.getDate(),
      inCurrentMonth: date.getMonth() === month && date.getFullYear() === year,
      isToday: isSameDay(date, today),
      weekday: date.getDay()
    })
  }
  return cells
}

/**
 * Weekday header labels rotated to match the configured week start.
 * `WEEKDAY_LABELS` is indexed by the native `Date.getDay()` (Sun = 0).
 */
export function getWeekdayLabels(weekStart: WeekStart = 'sunday'): string[] {
  if (weekStart === 'monday') return [...WEEKDAY_LABELS.slice(1), WEEKDAY_LABELS[0]]
  return WEEKDAY_LABELS
}

/** Human readable month + year, e.g. "September 2026". */
export function formatMonthYear(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleString(undefined, {
    month: 'long',
    year: 'numeric'
  })
}

/** Formats a 24h `HH:mm` string into a localized 12h label, e.g. "9:00 AM". */
export function formatTime(time: string | null): string {
  if (!time) return ''
  const [h, m] = time.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${hour12}:${pad(m)} ${period}`
}

/** Formats a start/end pair into a compact range label. */
export function formatTimeRange(start: string | null, end: string | null, allDay: boolean): string {
  if (allDay) return 'All day'
  if (start && end) return `${formatTime(start)} – ${formatTime(end)}`
  if (start) return formatTime(start)
  return ''
}

/** Converts a 24h `HH:mm` string into minutes since midnight. */
export function timeToMinutes(time: string | null): number {
  if (!time) return 0
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

/** Converts minutes since midnight back into a 24h `HH:mm` string. */
export function minutesToTime(minutes: number): string {
  const clamped = Math.max(0, Math.min(minutes, 24 * 60 - 1))
  return `${pad(Math.floor(clamped / 60))}:${pad(clamped % 60)}`
}

/** Formats a duration in minutes as a friendly label, e.g. "1h 30m". */
export function formatDuration(minutes: number): string {
  if (minutes <= 0) return ''
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h && m) return `${h}h ${m}m`
  if (h) return `${h}h`
  return `${m}m`
}

/** Compact hour gutter label, e.g. "12 AM", "1 PM". */
export function formatHourLabel(hour: number): string {
  const period = hour >= 12 ? 'PM' : 'AM'
  const hour12 = hour % 12 === 0 ? 12 : hour % 12
  return `${hour12} ${period}`
}

/** Long, friendly date label, e.g. "Wednesday, September 16, 2026". */
export function formatLongDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  })
}
