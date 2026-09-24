/**
 * Geometry for multi-day deadline bars in the month grid.
 *
 * The grid is six week rows of seven equal columns. A deadline is drawn as a
 * single absolutely-positioned bar per week row it touches, expressed as a
 * percentage of that row — so a bar crossing a week boundary visually
 * continues on the next row, and overlapping deadlines are stacked into lanes
 * instead of covering each other.
 *
 * Everything here is pure so the layout can be reasoned about (and tested)
 * without a DOM.
 */

import type { Deadline } from '@shared/types'
import { fromISODate, type DayCellData } from './dateEngine'
import { CELL_GAP, CELL_PADDING, DAY_NUMBER_HEIGHT } from './calendarCellLayout'
export { CELL_GAP, CELL_PADDING, DAY_NUMBER_HEIGHT } from './calendarCellLayout'

/** Pixel offset from a week row's top to the first deadline lane. */
export const BAND_TOP = CELL_PADDING + DAY_NUMBER_HEIGHT + CELL_GAP

export const BAR_HEIGHT = 14
export const BAR_GAP = 2
/** Weeks stack at most this many lanes; the rest collapse into a “+N” badge. */
export const MAX_LANES = 3

/** A single horizontal deadline segment inside one week row. */
export interface DeadlineBar {
  deadline: Deadline
  /** Zero-based starting column (0–6). */
  columnStart: number
  /** Number of columns covered (1–7). */
  columnSpan: number
  /** Lane index inside the week (0 = topmost). */
  lane: number
  /** The deadline genuinely begins in this week (left cap is rounded). */
  startsHere: boolean
  /** The deadline genuinely ends in this week (right cap is rounded). */
  endsHere: boolean
}

/** Everything a week row needs to draw its deadline band. */
export interface WeekDeadlines {
  bars: DeadlineBar[]
  /** Deadlines that did not fit inside the available lanes. */
  overflow: number
  /** Height to reserve inside each day cell of this week, in pixels. */
  bandHeight: number
}

/** Reserved band height for a number of stacked lanes. */
export function bandHeightFor(lanes: number): number {
  if (lanes <= 0) return 0
  return lanes * BAR_HEIGHT + (lanes - 1) * BAR_GAP
}

/** Top offset of a lane, relative to the start of a week row. */
export function barTop(lane: number): number {
  return BAND_TOP + lane * (BAR_HEIGHT + BAR_GAP)
}

/**
 * Largest number of deadline lanes that fit below the date row in a week row.
 *
 * The month grid gives each row an equal share of the available height. At
 * smaller window sizes that share can be less than the old fixed three-lane
 * band, so the renderer uses this to avoid drawing a bar outside its day box.
 */
export function deadlineLanesForRowHeight(rowHeight: number): number {
  if (!Number.isFinite(rowHeight)) return MAX_LANES

  const availableBandHeight =
    rowHeight - CELL_PADDING * 2 - DAY_NUMBER_HEIGHT - CELL_GAP * 2
  if (availableBandHeight < BAR_HEIGHT) return 0

  return Math.min(
    MAX_LANES,
    Math.floor((availableBandHeight + BAR_GAP) / (BAR_HEIGHT + BAR_GAP))
  )
}

/**
 * Lays out every deadline that overlaps a week.
 *
 * Bars are sorted by start column and then longest-first, then packed greedily
 * into the first lane whose previous bar has already finished. That order keeps
 * the long bars on top and lets short ones slot in beneath them.
 */
export function layoutWeekDeadlines(
  deadlines: Deadline[],
  week: DayCellData[],
  requestedMaxLanes = MAX_LANES
): WeekDeadlines {
  if (week.length === 0) return { bars: [], overflow: 0, bandHeight: 0 }

  const laneLimit = Math.min(
    MAX_LANES,
    Math.max(0, Math.floor(Number.isFinite(requestedMaxLanes) ? requestedMaxLanes : MAX_LANES))
  )

  const weekStart = week[0].iso
  const weekEnd = week[week.length - 1].iso

  const candidates: DeadlineBar[] = []
  for (const deadline of deadlines) {
    // Inclusive overlap test — a bar that started last month still shows.
    if (deadline.startDate > weekEnd || deadline.endDate < weekStart) continue

    const columnStart = week.findIndex((cell) => cell.iso >= deadline.startDate)
    let columnEnd = -1
    for (let i = week.length - 1; i >= 0; i--) {
      if (week[i].iso <= deadline.endDate) {
        columnEnd = i
        break
      }
    }
    // A span that misses every column cannot be drawn; skip rather than guess.
    if (columnStart === -1 || columnEnd < columnStart) continue

    candidates.push({
      deadline,
      columnStart,
      columnSpan: columnEnd - columnStart + 1,
      lane: 0,
      startsHere: deadline.startDate >= weekStart,
      endsHere: deadline.endDate <= weekEnd
    })
  }

  candidates.sort((a, b) => a.columnStart - b.columnStart || b.columnSpan - a.columnSpan)

  // Greedy interval partitioning over columns.
  const laneEnds: number[] = []
  const bars: DeadlineBar[] = []
  let overflow = 0

  for (const bar of candidates) {
    let lane = laneEnds.findIndex((end) => end < bar.columnStart)
    if (lane === -1) {
      if (laneEnds.length >= laneLimit) {
        overflow++
        continue
      }
      lane = laneEnds.length
      laneEnds.push(0)
    }
    laneEnds[lane] = bar.columnStart + bar.columnSpan - 1
    bars.push({ ...bar, lane })
  }

  return { bars, overflow, bandHeight: bandHeightFor(laneEnds.length) }
}

/**
 * Picks a readable foreground for a coloured bar using perceived brightness
 * (the classic YIQ approximation), which handles the pastel-to-deep range of
 * category colours better than a fixed white label would.
 */
export function readableTextColor(hex: string): string {
  const rgb = parseHexColor(hex)
  if (!rgb) return '#ffffff'
  const [r, g, b] = rgb
  const yiq = (r * 299 + g * 587 + b * 114) / 1000
  return yiq >= 150 ? '#0f172a' : '#ffffff'
}

/** Parses `#rgb` / `#rrggbb` (with or without `#`) into channel values. */
function parseHexColor(hex: string): [number, number, number] | null {
  const value = hex.trim().replace(/^#/, '')
  const expanded =
    value.length === 3
      ? value
          .split('')
          .map((c) => c + c)
          .join('')
      : value
  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) return null
  return [
    parseInt(expanded.slice(0, 2), 16),
    parseInt(expanded.slice(2, 4), 16),
    parseInt(expanded.slice(4, 6), 16)
  ]
}

/** Human label for a deadline's timeframe, e.g. "Sep 8 – Sep 22, 2026". */
export function formatDeadlineRange(deadline: Deadline): string {
  const start = fromISODate(deadline.startDate)
  const end = fromISODate(deadline.endDate)
  const long = { month: 'short', day: 'numeric', year: 'numeric' } as const

  if (deadline.startDate === deadline.endDate) return start.toLocaleDateString(undefined, long)

  const sameYear = start.getFullYear() === end.getFullYear()
  const startLabel = start.toLocaleDateString(
    undefined,
    sameYear ? { month: 'short', day: 'numeric' } : long
  )
  return `${startLabel} – ${end.toLocaleDateString(undefined, long)}`
}

/** Number of days a deadline covers, inclusive of both ends. */
export function deadlineDayCount(deadline: Deadline): number {
  const start = fromISODate(deadline.startDate).getTime()
  const end = fromISODate(deadline.endDate).getTime()
  return Math.round((end - start) / 86_400_000) + 1
}

/** Hover tooltip for a deadline bar, including notes when present. */
export function deadlineTooltip(deadline: Deadline): string {
  const parts = [deadline.title || 'Deadline', formatDeadlineRange(deadline)]
  if (deadline.notes.trim()) parts.push(deadline.notes.trim())
  return parts.join('\n')
}
