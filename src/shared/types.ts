/**
 * Shared domain types used by both the main process (persistence layer)
 * and the renderer process (React UI). Kept dependency-free so it can be
 * imported from either context safely.
 */

/** A UUID string, e.g. "9f4a3b2c-1d5e-4a7b-8c9d-0e1f2a3b4c5d". */
export type UUID = string

/** Category identifiers for color-coded events. Built-in values exist, but
 * users may add custom ones — so this stays an open string, not a union. */
export type EventCategory = string

/** Which sidebar list a task belongs to. */
export type TaskList = 'today' | 'upcoming' | 'notes'

/** A calendar event, optionally spanning a time range or all-day. */
export interface CalendarEvent {
  id: UUID
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
  id: UUID
  text: string
  completed: boolean
  list: TaskList
  /** Optional ISO date `YYYY-MM-DD` for Today/Upcoming organization. */
  dueDate: string | null
  createdAt: string
  updatedAt: string
}

/** Fields accepted when creating or updating a task. */
export type TaskInput = Omit<Task, 'id' | 'createdAt' | 'updatedAt'>

/**
 * A deadline that spans a continuous timeframe across the calendar.
 *
 * Unlike an event (which is pinned to a single day), a deadline covers every
 * day from `startDate` to `endDate` inclusive and is drawn as a colour bar
 * stretching across those days in the month grid.
 */
export interface Deadline {
  id: UUID
  title: string
  /** ISO date string `YYYY-MM-DD` — first day the deadline covers. */
  startDate: string
  /** ISO date string `YYYY-MM-DD` — last day covered (inclusive). */
  endDate: string
  notes: string
  category: EventCategory
  /** Hex color used for the bar. */
  color: string
  createdAt: string
  updatedAt: string
}

/** Fields accepted when creating or updating a deadline. */
export type DeadlineInput = Omit<Deadline, 'id' | 'createdAt' | 'updatedAt'>

/**
 * Orders a deadline's endpoints and guarantees they are valid ISO dates.
 *
 * The UI lets users pick the two ends in either order (and may leave the end
 * blank for a single-day deadline), so normalisation happens in one place
 * rather than at every call site.
 */
export function normalizeDeadlineRange(startDate: string, endDate: string): {
  startDate: string
  endDate: string
} {
  const start = startDate.trim()
  const end = endDate.trim() || start
  // ISO `YYYY-MM-DD` strings sort correctly with a plain lexicographic compare.
  return start <= end ? { startDate: start, endDate: end } : { startDate: end, endDate: start }
}

/** True when a deadline covers the given ISO date (inclusive on both ends). */
export function deadlineSpansDate(deadline: Deadline, iso: string): boolean {
  return deadline.startDate <= iso && iso <= deadline.endDate
}

/** A user-defined event category with a display label and badge color. */
export interface Category {
  id: UUID
  value: string
  label: string
  color: string
  createdAt: string
  updatedAt: string
}

/** Fields accepted when creating or updating a category. */
export type CategoryInput = Omit<Category, 'id' | 'createdAt' | 'updatedAt'>

/** Category metadata for the UI (label + color). */
export interface CategoryMeta {
  value: string
  label: string
  color: string
}

export const CATEGORY_PRESETS: CategoryMeta[] = [
  { value: 'work', label: 'Work', color: '#4f46e5' },
  { value: 'personal', label: 'Personal', color: '#059669' },
  { value: 'important', label: 'Important', color: '#dc2626' },
  { value: 'other', label: 'Other', color: '#d97706' }
]

/** Available UI themes. */
export type ThemeName = 'light' | 'dark' | 'neon' | 'sand' | 'midnight'

/** Accent swatches a theme can be tinted with. */
export type AccentName = 'indigo' | 'violet' | 'cyan' | 'emerald' | 'amber'

/** Weekend rendering preference for the grid. */
export type WeekStart = 'sunday' | 'monday'

/** Persisted user settings (key/value store in SQLite). */
export interface AppSettings {
  theme: ThemeName
  accent: AccentName
  glassIntensity: number
  weekStart: WeekStart
  sidebarVisible: boolean
  updateChannel: 'stable'
}

/** Settings applied on very first launch, and the fallback if the DB is empty. */
export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'light',
  accent: 'indigo',
  glassIntensity: 60,
  weekStart: 'sunday',
  sidebarVisible: true,
  updateChannel: 'stable'
}

/** Selectable themes, in the order they appear in Settings. */
export const THEME_PRESETS: { value: ThemeName; label: string; hint: string }[] = [
  { value: 'light', label: 'Light', hint: 'Crisp and bright' },
  { value: 'dark', label: 'Dark', hint: 'Slate, easy on the eyes' },
  { value: 'midnight', label: 'Midnight', hint: 'Deep navy contrast' },
  { value: 'neon', label: 'Neon', hint: 'Dark violet glow' },
  { value: 'sand', label: 'Sand', hint: 'Warm paper' }
]

/** Selectable accent colors, in the order they appear in Settings. */
export const ACCENT_PRESETS: { value: AccentName; label: string; hex: string }[] = [
  { value: 'indigo', label: 'Indigo', hex: '#4f46e5' },
  { value: 'violet', label: 'Violet', hex: '#7c3aed' },
  { value: 'cyan', label: 'Cyan', hex: '#0891b2' },
  { value: 'emerald', label: 'Emerald', hex: '#059669' },
  { value: 'amber', label: 'Amber', hex: '#d97706' }
]

/** Clamps arbitrary input into the valid `glassIntensity` range (0–100). */
export function normalizeGlassIntensity(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_SETTINGS.glassIntensity
  return Math.min(100, Math.max(0, Math.round(value)))
}

/** Update lifecycle state reported to the renderer. */
export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error'

export interface UpdateInfo {
  status: UpdateStatus
  version?: string
  percent?: number
  message?: string
}

/** One tombstone marking a deleted row so deletes merge across devices. */
export interface Tombstone {
  kind: 'event' | 'task' | 'category' | 'deadline'
  id: UUID
  deletedAt: string
}

/** Portable snapshot used by the pairing-code share format (`perky1:`). */
export interface CalendarSnapshot {
  /** Snapshot format version — used to reject unsupported future formats. */
  version: 1
  exportedAt: string
  appVersion: string
  events: CalendarEvent[]
  tasks: Task[]
  /**
   * Multi-day deadlines. Optional so codes produced before deadlines existed
   * (the shipped `1.0.0v` build) still decode and import cleanly.
   */
  deadlines?: Deadline[]
  categories: Category[]
  tombstones: Tombstone[]
  settings: Partial<AppSettings>
}

export type ImportMode = 'merge' | 'replace'

/** Summary of what an import did, shown in the confirmation dialog. */
export interface ImportResult {
  eventsAdded: number
  eventsUpdated: number
  tasksAdded: number
  tasksUpdated: number
  deadlinesAdded: number
  deadlinesUpdated: number
  categoriesAdded: number
  categoriesUpdated: number
  tombstonesApplied: number
  replaced: boolean
}

/** Undoable mutation recorded in the renderer's session history. */
export type HistoryEntry =
  | { type: 'event.create'; after: CalendarEvent }
  | { type: 'event.update'; before: CalendarEvent; after: CalendarEvent }
  | { type: 'event.delete'; before: CalendarEvent }
  | { type: 'task.create'; after: Task }
  | { type: 'task.update'; before: Task; after: Task }
  | { type: 'task.delete'; before: Task }
  | { type: 'deadline.create'; after: Deadline }
  | { type: 'deadline.update'; before: Deadline; after: Deadline }
  | { type: 'deadline.delete'; before: Deadline }
  | { type: 'category.create'; after: Category }
  | { type: 'category.update'; before: Category; after: Category }
  | { type: 'category.delete'; before: Category }

/** The typed surface exposed to the renderer via the preload bridge. */
export interface CalendarApi {
  events: {
    list(): Promise<CalendarEvent[]>
    /** All events for a single `YYYY-MM-DD` date. */
    listByDate(date: string): Promise<CalendarEvent[]>
    /** All events between two ISO dates inclusive. */
    listByRange(start: string, end: string): Promise<CalendarEvent[]>
    create(input: EventInput): Promise<CalendarEvent>
    update(id: UUID, input: EventInput): Promise<CalendarEvent>
    remove(id: UUID): Promise<void>
  }
  tasks: {
    list(): Promise<Task[]>
    create(input: TaskInput): Promise<Task>
    update(id: UUID, input: Partial<TaskInput>): Promise<Task>
    toggle(id: UUID): Promise<Task>
    remove(id: UUID): Promise<void>
  }
  deadlines: {
    list(): Promise<Deadline[]>
    /** Deadlines overlapping the inclusive `YYYY-MM-DD` range. */
    listByRange(start: string, end: string): Promise<Deadline[]>
    create(input: DeadlineInput): Promise<Deadline>
    update(id: UUID, input: DeadlineInput): Promise<Deadline>
    remove(id: UUID): Promise<void>
  }
  categories: {
    list(): Promise<Category[]>
    create(input: CategoryInput): Promise<Category>
    update(id: UUID, input: CategoryInput): Promise<Category>
    remove(id: UUID): Promise<void>
  }
  settings: {
    getAll(): Promise<AppSettings>
    /** Persist a single setting; returns the updated settings object. */
    set<K extends keyof AppSettings>(key: K, value: AppSettings[K]): Promise<AppSettings>
  }
  share: {
    /** Encoded `perky1:` snapshot of the whole calendar. */
    exportCode(): Promise<string>
    /** Merge or replace the local calendar from a pasted code or file text. */
    importCode(code: string, mode: ImportMode): Promise<ImportResult>
  }
  updates: {
    /** The running app version (from package.json). */
    getVersion(): Promise<string>
    /** Ask the main process to check for a pending GitHub release. */
    checkForUpdates(): Promise<UpdateInfo>
    /** The most recent update state (for late-mounting components). */
    getState(): Promise<UpdateInfo>
    /** Quit and install a downloaded update. */
    quitAndInstall(): Promise<void>
    /** Subscribe to update lifecycle events; returns an unsubscribe function. */
    onUpdate(cb: (info: UpdateInfo) => void): () => void
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
  TASKS_REMOVE: 'tasks:remove',
  DEADLINES_LIST: 'deadlines:list',
  DEADLINES_LIST_BY_RANGE: 'deadlines:listByRange',
  DEADLINES_CREATE: 'deadlines:create',
  DEADLINES_UPDATE: 'deadlines:update',
  DEADLINES_REMOVE: 'deadlines:remove',
  CATEGORIES_LIST: 'categories:list',
  CATEGORIES_CREATE: 'categories:create',
  CATEGORIES_UPDATE: 'categories:update',
  CATEGORIES_REMOVE: 'categories:remove',
  SETTINGS_GET_ALL: 'settings:getAll',
  SETTINGS_SET: 'settings:set',
  SHARE_EXPORT: 'share:export',
  SHARE_IMPORT: 'share:import',
  UPDATES_GET_VERSION: 'updates:getVersion',
  UPDATES_CHECK: 'updates:check',
  UPDATES_QUIT_INSTALL: 'updates:quitAndInstall',
  UPDATES_STATE: 'updates:state',
  UPDATES_EVENT: 'updates:event'
} as const
