/**
 * Geometry for multi-day deadline bars in the month grid.
 *
 * The grid is six week rows of seven equal columns. A deadline is drawn as a
 * single absolutely-positioned bar per week row it touches, expressed as a
 * percentage of that row — so a bar crossing a week boundary visually
 * continues on the next row, and overlapping deadlines are stacked into lanes
 * instead of covering each other. A row draws full-height bars while they fit
 * and squeezes them (down to `MIN_BAR_HEIGHT`) when more deadlines overlap the
 * week than it has lanes, so a deadline is never dropped from the grid just
 * because the week is busy.
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

/** Height of a deadline bar when a week row has room for it. */
export const BAR_HEIGHT = 14
/**
 * Floor a bar is squeezed to when a row has more overlapping deadlines than
 * full-height lanes. Every deadline keeps a (still clickable) bar instead of
 * being dropped from the grid.
 */
export const MIN_BAR_HEIGHT = 8
export const BAR_GAP = 2
/** Weeks stack at most this many lanes before bars start shrinking. */
export const MAX_LANES = 3
/** Rendered height of the "N more deadlines" affordance in a week row. */
export const OVERFLOW_BADGE_HEIGHT = 14

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
  /** Pixel offset of the bar's top edge from the week row's top. */
  top: number
  /** Rendered bar height in pixels for this week. */
  height: number
}

/** Everything a week row needs to draw its deadline band. */
export interface WeekDeadlines {
  bars: DeadlineBar[]
  /** Deadlines that did not fit in the available lanes. */
  overflow: number
  /** The same deadlines, in bar order, so the UI can list them. */
  overflowDeadlines: Deadline[]
  /** Height to reserve inside each day cell of this week, in pixels. */
  bandHeight: number
  /** Bar height used by this week (shrinks when the row is crowded). */
  barHeight: number
  /** Offset for the "+N more" affordance, or null when nothing overflows. */
  overflowTop: number | null
}

/** Reserved band height for a number of stacked lanes. */
export function bandHeightFor(lanes: number, barHeight: number = BAR_HEIGHT): number {
  if (lanes <= 0) return 0
  return lanes * barHeight + (lanes - 1) * BAR_GAP
}

/** Top offset of a lane, relative to the start of a week row. */
export function barTop(lane: number, barHeight: number = BAR_HEIGHT): number {
  return BAND_TOP + lane * (barHeight + BAR_GAP)
}

/**
 * Vertical room a week row can give the deadline band without breaking the
 * day cell it is drawn inside.
 *
 * The band sits between the date row and the event chips, so the padding, the
 * date row and the two gaps it needs are removed from the row height first.
 */
export function deadlineBandRoom(rowHeight: number): number {
  if (!Number.isFinite(rowHeight)) return bandHeightFor(MAX_LANES)
  return Math.max(
    0,
    rowHeight - CELL_PADDING * 2 - DAY_NUMBER_HEIGHT - CELL_GAP * 2
  )
}

/**
 * Band room to use for a week row, given the row height React last measured.
 *
 * A row height of zero (or a non-finite one) is *not* a real measurement: it is
 * what the grid reports while the window is still hidden, before the first
 * paint. Treating it as the truth starves the band of every lane, which makes
 * saved deadlines silently collapse into a "N more" count, so an unmeasured row
 * falls back to the room three full-height lanes need.
 */
export function bandRoomForRowHeight(rowHeight: number | null): number {
  if (rowHeight == null || !Number.isFinite(rowHeight) || rowHeight <= 0) {
    return bandHeightFor(MAX_LANES)
  }
  return Math.min(deadlineBandRoom(rowHeight), bandHeightFor(MAX_LANES))
}

/**
 * Largest number of deadline lanes a band of `room` pixels can hold.
 *
 * Lanes are allowed to shrink down to `MIN_BAR_HEIGHT` so a crowded week shows
 * every deadline it can rather than hiding the extra ones.
 */
export function maxDeadlineLanes(room: number): number {
  const usable = Number.isFinite(room) ? room : bandHeightFor(MAX_LANES)
  if (usable < MIN_BAR_HEIGHT) return 0
  return Math.floor((usable + BAR_GAP) / (MIN_BAR_HEIGHT + BAR_GAP))
}

/**
 * Bar height for `lanes` lanes inside `room` pixels.
 *
 * Full height while the room allows it; squeezed down to `MIN_BAR_HEIGHT`
 * (never further) when many deadlines overlap the same week.
 */
export function deadlineBarHeight(room: number, lanes: number): number {
  if (lanes <= 0) return 0
  const usable = Number.isFinite(room) ? room : bandHeightFor(MAX_LANES)
  const perLane = Math.floor((usable - (lanes - 1) * BAR_GAP) / lanes)
  return Math.max(MIN_BAR_HEIGHT, Math.min(BAR_HEIGHT, perLane))
}

/**
 * Number of full-height deadline lanes a week row can show.
 *
 * Used to reason about capacity (and by the verification suite); the renderer
 * lays bars out through `layoutWeekDeadlines`, which keeps squeezing bars below
 * this number so busy weeks still show every deadline they can.
 */
export function deadlineLanesForRowHeight(rowHeight: number): number {
  const room = deadlineBandRoom(rowHeight)
  if (room < BAR_HEIGHT) return 0
  return Math.min(MAX_LANES, Math.floor((room + BAR_GAP) / (BAR_HEIGHT + BAR_GAP)))
}

/**
 * Lays out every deadline that overlaps a week.
 *
 * Bars are sorted by start column and then longest-first, then packed greedily
 * into the first lane whose previous bar has already finished. That order keeps
 * the long bars on top and lets short ones slot in beneath them.
 *
 * `bandRoom` is the vertical space the week row can spare for the band. Bars
 * start at full height and are squeezed down to `MIN_BAR_HEIGHT` when more
 * deadlines overlap the week than full-height lanes — so a deadline that the
 * user just created still gets a visible, clickable bar instead of silently
 * disappearing. Only when even the squeezed lanes run out do the remaining
 * deadlines collapse into the `overflow` count.
 */
export function layoutWeekDeadlines(
  deadlines: Deadline[],
  week: DayCellData[],
  bandRoom: number = bandHeightFor(MAX_LANES)
): WeekDeadlines {
  const empty: WeekDeadlines = {
    bars: [],
    overflow: 0,
    overflowDeadlines: [],
    bandHeight: 0,
    barHeight: 0,
    overflowTop: null
  }
  if (week.length === 0) return empty

  // The band never grows past the room three full-height lanes always had, so
  // a crowded week can never squeeze the day cell's event chips out.
  const room = Math.min(
    Number.isFinite(bandRoom) ? bandRoom : bandHeightFor(MAX_LANES),
    bandHeightFor(MAX_LANES)
  )

  const weekStart = week[0].iso
  const weekEnd = week[week.length - 1].iso

  const candidates: Omit<DeadlineBar, 'top' | 'height'>[] = []
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

  const laneLimit = maxDeadlineLanes(room)
  if (candidates.length === 0 || laneLimit === 0) {
    return {
      ...empty,
      overflow: candidates.length,
      overflowDeadlines: candidates.map((candidate) => candidate.deadline)
    }
  }

  candidates.sort((a, b) => a.columnStart - b.columnStart || b.columnSpan - a.columnSpan)

  // Greedy interval partitioning over columns.
  const laneEnds: number[] = []
  const packed: typeof candidates = []
  const overflowDeadlines: Deadline[] = []

  for (const bar of candidates) {
    let lane = laneEnds.findIndex((end) => end < bar.columnStart)
    if (lane === -1) {
      if (laneEnds.length >= laneLimit) {
        overflowDeadlines.push(bar.deadline)
        continue
      }
      lane = laneEnds.length
      laneEnds.push(0)
    }
    laneEnds[lane] = bar.columnStart + bar.columnSpan - 1
    packed.push({ ...bar, lane })
  }

  const lanes = laneEnds.length
  const barHeight = deadlineBarHeight(room, lanes)
  const bars: DeadlineBar[] = packed.map((bar) => ({
    ...bar,
    top: barTop(bar.lane, barHeight),
    height: barHeight
  }))

  // The "N more" affordance sits at the right edge of the last lane, clamped so
  // it always stays inside the week row.
  const lastLaneTop = barTop(lanes - 1, barHeight)

  return {
    bars,
    overflow: overflowDeadlines.length,
    overflowDeadlines,
    bandHeight: bandHeightFor(lanes, barHeight),
    barHeight,
    overflowTop:
      overflowDeadlines.length > 0
        ? Math.max(0, lastLaneTop + barHeight - OVERFLOW_BADGE_HEIGHT)
        : null
  }
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
