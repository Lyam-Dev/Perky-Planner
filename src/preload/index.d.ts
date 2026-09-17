import type { CalendarApi } from '../shared/types'

declare global {
  interface Window {
    calendar: CalendarApi
  }
}

export {}
