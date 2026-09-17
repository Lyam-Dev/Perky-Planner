/**
 * Shared domain types used by both the main process (persistence layer)
 * and the renderer process (React UI). Kept dependency-free so it can be
 * imported from either context safely.
 */

/** Category presets for color-coded events. */
export type EventCategory = 'work' | 'personal' | 'important' | 'other'

/** Which sidebar list a task belongs to. */
export type TaskList = 'today' | 'upcoming' | 'notes'

/** A calendar event, optionally spanning a time range or all-day. */
export interface CalendarEvent {
  id: number
  title: string
  description: string
  /** ISO date string `YYYY-MM-DD` (local date of the event). */
  date: string
  allDay: boolean
  /** 24h time string `HH:mm`, or null when all-day. */
  startTime: string | null
  /** 24h time string `HH:mm`, or null when all-day. */
  endTime: string | null
  category: EventCategory
  /** Hex color used for the event badge. */
  color: string
  createdAt: string
  updatedAt: string
}

/** Fields accepted when creating or updating an event. */
export type EventInput = Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>

/** A short daily task / to-do item. */
export interface Task {
  id: number
  text: string
  completed: boolean
  list: TaskList
  /** Optional ISO date `YYYY-MM-DD` for Today/Upcoming organization. */
  dueDate: string | null
  createdAt: string
}

/** Fields accepted when creating or updating a task. */
export type TaskInput = Omit<Task, 'id' | 'createdAt'>

/** Category metadata for the UI (label + color). */
export interface CategoryMeta {
  value: EventCategory
  label: string
  color: string
}

export const CATEGORY_PRESETS: CategoryMeta[] = [
  { value: 'work', label: 'Work', color: '#4f46e5' },
  { value: 'personal', label: 'Personal', color: '#059669' },
  { value: 'important', label: 'Important', color: '#dc2626' },
  { value: 'other', label: 'Other', color: '#d97706' }
]

/** The typed surface exposed to the renderer via the preload bridge. */
export interface CalendarApi {
  events: {
    list(): Promise<CalendarEvent[]>
    /** All events for a single `YYYY-MM-DD` date. */
    listByDate(date: string): Promise<CalendarEvent[]>
    /** All events between two ISO dates inclusive. */
    listByRange(start: string, end: string): Promise<CalendarEvent[]>
    create(input: EventInput): Promise<CalendarEvent>
    update(id: number, input: EventInput): Promise<CalendarEvent>
    remove(id: number): Promise<void>
  }
  tasks: {
    list(): Promise<Task[]>
    create(input: TaskInput): Promise<Task>
    update(id: number, input: Partial<TaskInput>): Promise<Task>
    toggle(id: number): Promise<Task>
    remove(id: number): Promise<void>
  }
  platform: NodeJS.Platform
}

/** IPC channel names, shared to avoid string drift. */
export const IPC = {
  EVENTS_LIST: 'events:list',
  EVENTS_LIST_BY_DATE: 'events:listByDate',
  EVENTS_LIST_BY_RANGE: 'events:listByRange',
  EVENTS_CREATE: 'events:create',
  EVENTS_UPDATE: 'events:update',
  EVENTS_REMOVE: 'events:remove',
  TASKS_LIST: 'tasks:list',
  TASKS_CREATE: 'tasks:create',
  TASKS_UPDATE: 'tasks:update',
  TASKS_TOGGLE: 'tasks:toggle',
  TASKS_REMOVE: 'tasks:remove'
} as const
