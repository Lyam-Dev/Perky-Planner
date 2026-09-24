/**
 * Fixed measurements and pure capacity rules for a month-grid day cell.
 *
 * DayCell uses the same values in its Tailwind classes and as inline sizing.
 * Keeping these rules here makes it possible to verify that events, their
 * overflow label, and deadline bands all fit the *rendered* cell height rather
 * than relying on a fixed number of events per day.
 */

export const CELL_PADDING = 6
export const CELL_VERTICAL_PADDING = CELL_PADDING * 2
export const DAY_NUMBER_HEIGHT = 24
export const CELL_GAP = 4

export const EVENT_CHIP_HEIGHT = 16
export const EVENT_LIST_GAP = 2
export const EVENT_OVERFLOW_HEIGHT = 14

export type OverflowPlacement = 'none' | 'row' | 'header'

export interface DayCellEventCapacity {
  /** Events that can be rendered as full chips in the available space. */
  visibleCount: number
  /** Events represented by the overflow label. */
  hiddenCount: number
  /** Where the overflow label must be rendered to remain inside the cell. */
  overflowPlacement: OverflowPlacement
}

/**
 * Returns the space left for event chips after the day number, padding, gaps,
 * and the deadline band have been accounted for.
 *
 * A zero-height deadline band is not rendered, so it consumes only one gap,
 * rather than the two gaps needed when the band is present.
 */
export function dayCellEventSpace(cellHeight: number, deadlineBandHeight: number): number {
  const height = Math.max(0, Number.isFinite(cellHeight) ? cellHeight : 0)
  const band = Math.max(0, Number.isFinite(deadlineBandHeight) ? deadlineBandHeight : 0)
  // Rendered CSS has two physical gaps when the band is present (date → band
  // → events), but only one when it is absent (date → events).
  const gapCount = band > 0 ? 2 : 1

  return Math.max(
    0,
    height - CELL_VERTICAL_PADDING - DAY_NUMBER_HEIGHT - gapCount * CELL_GAP - band
  )
}

/**
 * Chooses how many event chips can be rendered in a given vertical space.
 *
 * If some events do not fit, the overflow label is part of the budget from the
 * start — never a row that gets clipped at the bottom. When even that label
 * cannot fit below the deadline band, `header` asks the date row to show a
 * compact `+N` count instead.
 */
export function dayCellEventCapacity(
  eventCount: number,
  availableHeight: number
): DayCellEventCapacity {
  const total = Math.max(0, Math.floor(Number.isFinite(eventCount) ? eventCount : 0))
  const available = Math.max(0, Number.isFinite(availableHeight) ? availableHeight : 0)
  if (total === 0) return { visibleCount: 0, hiddenCount: 0, overflowPlacement: 'none' }

  const chipSlot = EVENT_CHIP_HEIGHT + EVENT_LIST_GAP
  const fitsWithoutOverflow = Math.floor((available + EVENT_LIST_GAP) / chipSlot)
  if (total <= fitsWithoutOverflow) {
    return {
      visibleCount: total,
      hiddenCount: 0,
      overflowPlacement: 'none'
    }
  }

  if (available < EVENT_OVERFLOW_HEIGHT) {
    return { visibleCount: 0, hiddenCount: total, overflowPlacement: 'header' }
  }

  // A stack with n chips plus an overflow row is:
  // n * (chip + gap) + overflowHeight. A zero-chip stack is just its label.
  const visibleCount = Math.min(
    total,
    Math.floor((available - EVENT_OVERFLOW_HEIGHT) / chipSlot)
  )

  return {
    visibleCount,
    hiddenCount: total - visibleCount,
    overflowPlacement: 'row'
  }
}

/** A readable overflow label used in the event list. */
export function eventOverflowLabel(hiddenCount: number): string {
  return `and ${Math.max(0, hiddenCount)} more…`
}
