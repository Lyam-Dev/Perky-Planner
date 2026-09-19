import { app } from 'electron'
import Database from 'better-sqlite3'
import { join } from 'path'
import { mkdirSync } from 'fs'
import { randomUUID } from 'crypto'
import type {
  AppSettings,
  CalendarEvent,
  Category,
  CategoryInput,
  EventInput,
  CalendarSnapshot,
  ImportMode,
  ImportResult,
  Task,
  TaskInput,
  Tombstone
} from '../shared/types'
import { CATEGORY_PRESETS, DEFAULT_SETTINGS } from '../shared/types'

/**
 * Local persistence layer backed by SQLite (better-sqlite3).
 *
 * The database file lives in the OS-specific userData directory so that
 * user data survives app restarts and upgrades. All statements are
 * prepared once and reused for performance.
 *
 * Schema notes:
 * - All ids are UUID strings so calendars from different devices can be
 *   merged without collisions (`legacy-*` ids belong to migrated rows).
 */

let db: Database.Database

interface EventRow {
  id: string
  title: string
  description: string
  date: string
  all_day: number
  start_time: string | null
  end_time: string | null
  category: string
  color: string
  created_at: string
  updated_at: string
}

interface TaskRow {
  id: string
  text: string
  completed: number
  list: string
  due_date: string | null
  created_at: string
  updated_at: string
}

interface CategoryRow {
  id: string
  value: string
  label: string
  color: string
  created_at: string
  updated_at: string
}

function rowToEvent(row: EventRow): CalendarEvent {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    date: row.date,
    allDay: row.all_day === 1,
    startTime: row.start_time,
    endTime: row.end_time,
    category: row.category,
    color: row.color,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    text: row.text,
    completed: row.completed === 1,
    list: row.list as Task['list'],
    dueDate: row.due_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function rowToCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    value: row.value,
    label: row.label,
    color: row.color,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function nowIso(): string {
  return new Date().toISOString()
}

/** Turns a human label into a stable, URL-safe category key. */
function slugifyCategoryLabel(label: string): string {
  return (
    label
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32) || 'custom'
  )
}

/** Initialise the database connection and run schema migrations. */
export function initDatabase(): void {
  // The userData dir can be missing (e.g. a removed volume or a fresh
  // PERKY_USER_DATA_DIR in tests) — better-sqlite3 fails hard in that case.
  const dataDir = app.getPath('userData')
  mkdirSync(dataDir, { recursive: true })
  const dbPath = join(dataDir, 'calendar.db')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id          TEXT    PRIMARY KEY,
      title       TEXT    NOT NULL,
      description TEXT    NOT NULL DEFAULT '',
      date        TEXT    NOT NULL,
      all_day     INTEGER NOT NULL DEFAULT 1,
      start_time  TEXT,
      end_time    TEXT,
      category    TEXT    NOT NULL DEFAULT 'other',
      color       TEXT    NOT NULL DEFAULT '#4f46e5',
      created_at  TEXT    NOT NULL,
      updated_at  TEXT    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id         TEXT    PRIMARY KEY,
      text       TEXT    NOT NULL,
      completed  INTEGER NOT NULL DEFAULT 0,
      list       TEXT    NOT NULL DEFAULT 'today',
      due_date   TEXT,
      created_at TEXT    NOT NULL,
      updated_at TEXT    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      id         TEXT    PRIMARY KEY,
      value      TEXT    NOT NULL UNIQUE,
      label      TEXT    NOT NULL,
      color      TEXT    NOT NULL,
      created_at TEXT    NOT NULL,
      updated_at TEXT    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Tombstones let deletes merge across devices.
    CREATE TABLE IF NOT EXISTS tombstones (
      kind       TEXT NOT NULL,
      id         TEXT NOT NULL,
      deleted_at TEXT NOT NULL,
      PRIMARY KEY (kind, id)
    );

    CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);
    CREATE INDEX IF NOT EXISTS idx_tasks_due   ON tasks(due_date);
    CREATE INDEX IF NOT EXISTS idx_tasks_list  ON tasks(list);
  `)

  migrateIntegerIds()
  migrateTaskUpdatedAt()
  seedCategories()
}

/**
 * One-time migration from v1.0 (integer autoincrement ids) to v1.1 UUID ids.
 *
 * SQLite cannot store TEXT in an INTEGER PRIMARY KEY (it is a rowid alias —
 * an UPDATE with a non-numeric value fails with "datatype mismatch"), so the
 * old tables are rebuilt: a fresh TEXT-keyed table is filled from the old one
 * with `legacy-<n>` ids, the old table is dropped, and the new one is renamed
 * into place. All existing rows are preserved.
 */
function migrateIntegerIds(): void {
  const rebuild = db.transaction(() => {
    // --- events -------------------------------------------------------------
    const evInfo = db.prepare('PRAGMA table_info(events)').all() as {
      name: string
      type: string
    }[]
    const evId = evInfo.find((c) => c.name === 'id')
    if (evId && !evId.type.toUpperCase().startsWith('TEXT')) {
      const hasUpdatedAt = evInfo.some((c) => c.name === 'updated_at')
      db.exec(`
        CREATE TABLE events_new (
          id          TEXT    PRIMARY KEY,
          title       TEXT    NOT NULL,
          description TEXT    NOT NULL DEFAULT '',
          date        TEXT    NOT NULL,
          all_day     INTEGER NOT NULL DEFAULT 1,
          start_time  TEXT,
          end_time    TEXT,
          category    TEXT    NOT NULL DEFAULT 'other',
          color       TEXT    NOT NULL DEFAULT '#4f46e5',
          created_at  TEXT    NOT NULL,
          updated_at  TEXT    NOT NULL
        );

        INSERT INTO events_new
          (id, title, description, date, all_day, start_time, end_time,
           category, color, created_at, updated_at)
        SELECT
          'legacy-' || id, title, description, date, all_day, start_time, end_time,
          category, color, created_at,
          ${hasUpdatedAt ? 'updated_at' : 'created_at'}
        FROM events;

        DROP TABLE events;
        ALTER TABLE events_new RENAME TO events;
        CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);
      `)
    }

    // --- tasks ---------------------------------------------------------------
    // v1.0 tasks had no `updated_at` column at all, so the rebuilt table is
    // filled with created_at as the initial value for both timestamps.
    const taskInfo = db.prepare('PRAGMA table_info(tasks)').all() as {
      name: string
      type: string
    }[]
    const taskId = taskInfo.find((c) => c.name === 'id')
    if (taskId && !taskId.type.toUpperCase().startsWith('TEXT')) {
      const hasUpdatedAt = taskInfo.some((c) => c.name === 'updated_at')
      db.exec(`
        CREATE TABLE tasks_new (
          id         TEXT    PRIMARY KEY,
          text       TEXT    NOT NULL,
          completed  INTEGER NOT NULL DEFAULT 0,
          list       TEXT    NOT NULL DEFAULT 'today',
          due_date   TEXT,
          created_at TEXT    NOT NULL,
          updated_at TEXT    NOT NULL
        );

        INSERT INTO tasks_new
          (id, text, completed, list, due_date, created_at, updated_at)
        SELECT
          'legacy-' || id, text, completed, list, due_date, created_at,
          ${hasUpdatedAt ? 'updated_at' : 'created_at'}
        FROM tasks;

        DROP TABLE tasks;
        ALTER TABLE tasks_new RENAME TO tasks;
        CREATE INDEX IF NOT EXISTS idx_tasks_due  ON tasks(due_date);
        CREATE INDEX IF NOT EXISTS idx_tasks_list ON tasks(list);
      `)
    }
  })
  rebuild()
}


/**
 * Adds `updated_at` to a pre-1.1 `tasks` table, then backfills every row.
 *
 * `CREATE TABLE IF NOT EXISTS` silently leaves older tables untouched, so the
 * column has to be added explicitly for users upgrading from v1.0 (whose
 * schema only tracked `created_at` on tasks).
 */
function migrateTaskUpdatedAt(): void {
  const columns = db.prepare('PRAGMA table_info(tasks)').all() as { name: string }[]
  if (!columns.some((c) => c.name === 'updated_at')) {
    // Older SQLite cannot add a NOT NULL column without a constant default.
    db.exec('ALTER TABLE tasks ADD COLUMN updated_at TEXT')
  }
  db.exec(`UPDATE tasks SET updated_at = created_at WHERE updated_at IS NULL OR updated_at = ''`)
}

/** Seed the four built-in categories on first launch. */
function seedCategories(): void {
  const now = nowIso()
  const insert = db.prepare(
    `INSERT OR IGNORE INTO categories (id, value, label, color, created_at, updated_at)
     VALUES (@id, @value, @label, @color, @createdAt, @updatedAt)`
  )
  const seed = db.transaction(() => {
    for (const preset of CATEGORY_PRESETS) {
      insert.run({
        id: `builtin-${preset.value}`,
        value: preset.value,
        label: preset.label,
        color: preset.color,
        createdAt: now,
        updatedAt: now
      })
    }
  })
  seed()
}

// ---------------------------------------------------------------------------
// Events CRUD
// ---------------------------------------------------------------------------

export function listEvents(): CalendarEvent[] {
  const rows = db
    .prepare('SELECT * FROM events ORDER BY date ASC, start_time ASC')
    .all() as EventRow[]
  return rows.map(rowToEvent)
}

export function listEventsByDate(date: string): CalendarEvent[] {
  const rows = db
    .prepare('SELECT * FROM events WHERE date = ? ORDER BY start_time ASC')
    .all(date) as EventRow[]
  return rows.map(rowToEvent)
}

export function listEventsByRange(start: string, end: string): CalendarEvent[] {
  const rows = db
    .prepare(
      'SELECT * FROM events WHERE date >= ? AND date <= ? ORDER BY date ASC, start_time ASC'
    )
    .all(start, end) as EventRow[]
  return rows.map(rowToEvent)
}

export function createEvent(input: EventInput): CalendarEvent {
  const id = randomUUID()
  const now = nowIso()
  db.prepare(
    `INSERT INTO events
        (id, title, description, date, all_day, start_time, end_time, category, color, created_at, updated_at)
       VALUES
        (@id, @title, @description, @date, @allDay, @startTime, @endTime, @category, @color, @createdAt, @updatedAt)`
  ).run({
    id,
    title: input.title,
    description: input.description ?? '',
    date: input.date,
    allDay: input.allDay ? 1 : 0,
    startTime: input.allDay ? null : input.startTime,
    endTime: input.allDay ? null : input.endTime,
    category: input.category,
    color: input.color,
    createdAt: now,
    updatedAt: now
  })

  const row = db.prepare('SELECT * FROM events WHERE id = ?').get(id) as EventRow
  return rowToEvent(row)
}

export function updateEvent(id: string, input: EventInput): CalendarEvent {
  const now = nowIso()
  db.prepare(
    `UPDATE events SET
        title = @title,
        description = @description,
        date = @date,
        all_day = @allDay,
        start_time = @startTime,
        end_time = @endTime,
        category = @category,
        color = @color,
        updated_at = @updatedAt
     WHERE id = @id`
  ).run({
    id,
    title: input.title,
    description: input.description ?? '',
    date: input.date,
    allDay: input.allDay ? 1 : 0,
    startTime: input.allDay ? null : input.startTime,
    endTime: input.allDay ? null : input.endTime,
    category: input.category,
    color: input.color,
    updatedAt: now
  })

  const row = db.prepare('SELECT * FROM events WHERE id = ?').get(id) as EventRow
  return rowToEvent(row)
}

export function deleteEvent(id: string): void {
  recordTombstone('event', id)
  db.prepare('DELETE FROM events WHERE id = ?').run(id)
}

// ---------------------------------------------------------------------------
// Tasks CRUD
// ---------------------------------------------------------------------------

export function listTasks(): Task[] {
  const rows = db
    .prepare('SELECT * FROM tasks ORDER BY completed ASC, created_at DESC')
    .all() as TaskRow[]
  return rows.map(rowToTask)
}

export function createTask(input: TaskInput): Task {
  const id = randomUUID()
  const now = nowIso()
  db.prepare(
    `INSERT INTO tasks (id, text, completed, list, due_date, created_at, updated_at)
     VALUES (@id, @text, @completed, @list, @dueDate, @createdAt, @updatedAt)`
  ).run({
    id,
    text: input.text,
    completed: input.completed ? 1 : 0,
    list: input.list,
    dueDate: input.dueDate,
    createdAt: now,
    updatedAt: now
  })

  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRow
  return rowToTask(row)
}

export function updateTask(id: string, input: Partial<TaskInput>): Task {
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRow | undefined
  if (!existing) throw new Error(`Task ${id} not found`)

  const merged = {
    id,
    text: input.text ?? existing.text,
    completed: (input.completed ?? existing.completed === 1) ? 1 : 0,
    list: input.list ?? existing.list,
    dueDate: input.dueDate !== undefined ? input.dueDate : existing.due_date,
    updatedAt: nowIso()
  }

  db.prepare(
    `UPDATE tasks SET text = @text, completed = @completed, list = @list, due_date = @dueDate,
     updated_at = @updatedAt WHERE id = @id`
  ).run(merged)

  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRow
  return rowToTask(row)
}

export function toggleTask(id: string): Task {
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRow | undefined
  if (!existing) throw new Error(`Task ${id} not found`)
  const next = existing.completed === 1 ? 0 : 1
  db.prepare('UPDATE tasks SET completed = ?, updated_at = ? WHERE id = ?').run(next, nowIso(), id)
  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRow
  return rowToTask(row)
}

export function deleteTask(id: string): void {
  recordTombstone('task', id)
  db.prepare('DELETE FROM tasks WHERE id = ?').run(id)
}

// ---------------------------------------------------------------------------
// Categories CRUD
// ---------------------------------------------------------------------------

export function listCategories(): Category[] {
  const rows = db.prepare('SELECT * FROM categories ORDER BY label ASC').all() as CategoryRow[]
  return rows.map(rowToCategory)
}

export function createCategory(input: CategoryInput): Category {
  const base = slugifyCategoryLabel(input.label)
  let value = base
  let suffix = 2
  while (db.prepare('SELECT value FROM categories WHERE value = ?').get(value)) {
    value = `${base}-${suffix}`
    suffix += 1
  }
  const id = randomUUID()
  const now = nowIso()
  db.prepare(
    `INSERT INTO categories (id, value, label, color, created_at, updated_at)
     VALUES (@id, @value, @label, @color, @createdAt, @updatedAt)`
  ).run({ id, value, label: input.label.trim(), color: input.color, createdAt: now, updatedAt: now })

  const row = db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as CategoryRow
  return rowToCategory(row)
}

export function updateCategory(id: string, input: CategoryInput): Category {
  const now = nowIso()
  db.prepare(
    `UPDATE categories SET label = @label, color = @color, updated_at = @updatedAt WHERE id = @id`
  ).run({ id, label: input.label.trim(), color: input.color, updatedAt: now })

  const row = db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as CategoryRow
  return rowToCategory(row)
}

export function deleteCategory(id: string): void {
  const row = db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as CategoryRow | undefined
  const tx = db.transaction(() => {
    if (row) {
      // Reassign affected events to `other` and bump them so merges converge.
      db.prepare(`UPDATE events SET category = 'other', updated_at = ? WHERE category = ?`).run(
        nowIso(),
        row.value
      )
    }
    recordTombstone('category', id)
    db.prepare('DELETE FROM categories WHERE id = ?').run(id)
  })
  tx()
}

// ---------------------------------------------------------------------------
// Settings (key/value)
// ---------------------------------------------------------------------------

export function getSettings(): AppSettings {
  const rows = db.prepare('SELECT key, value FROM settings').all() as {
    key: string
    value: string
  }[]
  const stored: Partial<AppSettings> = {}
  for (const row of rows) {
    try {
      ;(stored as Record<string, unknown>)[row.key] = JSON.parse(row.value)
    } catch {
      // Ignore corrupt entries and fall through to defaults.
    }
  }
  return { ...DEFAULT_SETTINGS, ...stored }
}

export function setSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): AppSettings {
  db.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES (@key, @value, @updatedAt)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).run({ key, value: JSON.stringify(value), updatedAt: nowIso() })
  return getSettings()
}

// ---------------------------------------------------------------------------
// Tombstones (delete propagation for pairing-code sync)
// ---------------------------------------------------------------------------

function recordTombstone(kind: Tombstone['kind'], id: string): void {
  recordTombstoneAt(kind, id, nowIso())
}

/**
 * Records a tombstone with an explicit timestamp. When a tombstone already
 * exists the newest delete wins, so replaying an older snapshot cannot
 * resurrect stale deletes.
 */
export function recordTombstoneAt(
  kind: Tombstone['kind'],
  id: string,
  deletedAt: string
): void {
  db.prepare(
    `INSERT INTO tombstones (kind, id, deleted_at) VALUES (@kind, @id, @deletedAt)
     ON CONFLICT(kind, id) DO UPDATE SET deleted_at = MAX(deleted_at, excluded.deleted_at)`
  ).run({ kind, id, deletedAt })
}

export function listTombstones(): Tombstone[] {
  const rows = db.prepare('SELECT kind, id, deleted_at FROM tombstones').all() as {
    kind: Tombstone['kind']
    id: string
    deleted_at: string
  }[]
  return rows.map((r) => ({ kind: r.kind, id: r.id, deletedAt: r.deleted_at }))
}

// ---------------------------------------------------------------------------
// Snapshot export / import (the `perky1:` pairing-code format)
// ---------------------------------------------------------------------------

/** A complete, portable copy of the local calendar. */
export function buildSnapshot(): CalendarSnapshot {
  return {
    version: 1,
    exportedAt: nowIso(),
    appVersion: app.getVersion(),
    events: listEvents(),
    tasks: listTasks(),
    categories: listCategories(),
    tombstones: listTombstones(),
    settings: getSettings()
  }
}

/** Outcome of a single row conflict resolution during an import. */
type UpsertOutcome = 'added' | 'updated' | 'skipped'

/**
 * Validates a row identity coming from an untrusted snapshot. SQLite TEXT
 * PRIMARY KEY columns silently accept NULL, so a malformed snapshot id must
 * be rejected here — throwing inside `importSnapshot`'s transaction rolls
 * the whole import back atomically.
 */
function assertImportableRow(id: unknown, updatedAt: unknown, kind: string): void {
  if (typeof id !== 'string' || id.trim() === '') {
    throw new Error(`Invalid ${kind} id in snapshot: ${JSON.stringify(id)}`)
  }
  if (typeof updatedAt !== 'string' || Number.isNaN(Date.parse(updatedAt))) {
    throw new Error(`Invalid ${kind} updatedAt in snapshot: ${JSON.stringify(updatedAt)}`)
  }
}

/**
 * Last-write-wins merge for one event. Rows are only overwritten when the
 * incoming copy is strictly newer, so importing the same code twice is a
 * no-op and an older backup can never clobber recent edits.
 */
function upsertEventRow(ev: CalendarEvent): UpsertOutcome {
  assertImportableRow(ev.id, ev.updatedAt, 'event')
  const existing = db.prepare('SELECT * FROM events WHERE id = ?').get(ev.id) as EventRow | undefined

  const params = {
    id: ev.id,
    title: ev.title,
    description: ev.description ?? '',
    date: ev.date,
    allDay: ev.allDay ? 1 : 0,
    startTime: ev.allDay ? null : ev.startTime,
    endTime: ev.allDay ? null : ev.endTime,
    category: ev.category,
    color: ev.color,
    createdAt: ev.createdAt,
    updatedAt: ev.updatedAt
  }

  if (existing) {
    if (existing.updated_at >= ev.updatedAt) return 'skipped'
    db.prepare(
      `UPDATE events SET
          title = @title, description = @description, date = @date, all_day = @allDay,
          start_time = @startTime, end_time = @endTime, category = @category,
          color = @color, updated_at = @updatedAt
       WHERE id = @id`
    ).run(params)
    return 'updated'
  }

  db.prepare(
    `INSERT INTO events
        (id, title, description, date, all_day, start_time, end_time, category, color, created_at, updated_at)
     VALUES
        (@id, @title, @description, @date, @allDay, @startTime, @endTime, @category, @color, @createdAt, @updatedAt)`
  ).run(params)
  return 'added'
}

/** Last-write-wins merge for one task. */
function upsertTaskRow(task: Task): UpsertOutcome {
  assertImportableRow(task.id, task.updatedAt, 'task')
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(task.id) as
    | TaskRow
    | undefined

  const params = {
    id: task.id,
    text: task.text,
    completed: task.completed ? 1 : 0,
    list: task.list,
    dueDate: task.dueDate,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt
  }

  if (existing) {
    if (existing.updated_at >= task.updatedAt) return 'skipped'
    db.prepare(
      `UPDATE tasks SET text = @text, completed = @completed, list = @list,
          due_date = @dueDate, updated_at = @updatedAt
       WHERE id = @id`
    ).run(params)
    return 'updated'
  }

  db.prepare(
    `INSERT INTO tasks (id, text, completed, list, due_date, created_at, updated_at)
     VALUES (@id, @text, @completed, @list, @dueDate, @createdAt, @updatedAt)`
  ).run(params)
  return 'added'
}

/** Last-write-wins merge for one category. */
function upsertCategoryRow(category: Category): UpsertOutcome {
  assertImportableRow(category.id, category.updatedAt, 'category')
  const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(category.id) as
    | CategoryRow
    | undefined

  const params = {
    id: category.id,
    value: category.value,
    label: category.label,
    color: category.color,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt
  }

  if (existing) {
    if (existing.updated_at >= category.updatedAt) return 'skipped'
    db.prepare(
      `UPDATE categories SET value = @value, label = @label, color = @color,
          updated_at = @updatedAt
       WHERE id = @id`
    ).run(params)
    return 'updated'
  }

  // `value` is UNIQUE — skip rather than throw when another id already owns it.
  if (db.prepare('SELECT id FROM categories WHERE value = ?').get(category.value)) return 'skipped'

  db.prepare(
    `INSERT INTO categories (id, value, label, color, created_at, updated_at)
     VALUES (@id, @value, @label, @color, @createdAt, @updatedAt)`
  ).run(params)
  return 'added'
}

/** Looks up a row's `updated_at`, or null when the row does not exist. */
function rowUpdatedAt(table: 'events' | 'tasks' | 'categories', id: string): string | null {
  const row = db.prepare(`SELECT updated_at FROM ${table} WHERE id = ?`).get(id) as
    | { updated_at: string }
    | undefined
  return row ? row.updated_at : null
}

/**
 * Replays tombstones. A row is deleted only when the tombstone is newer than
 * the local copy — a newer local edit wins, which resurrects the row.
 */
function applyTombstones(tombstones: Tombstone[]): number {
  const tableOf: Record<Tombstone['kind'], 'events' | 'tasks' | 'categories'> = {
    event: 'events',
    task: 'tasks',
    category: 'categories'
  }
  const statements = {
    events: db.prepare('DELETE FROM events WHERE id = ?'),
    tasks: db.prepare('DELETE FROM tasks WHERE id = ?'),
    categories: db.prepare('DELETE FROM categories WHERE id = ?')
  }

  let applied = 0
  const run = db.transaction(() => {
    for (const t of tombstones) {
      const table = tableOf[t.kind]
      if (!table) continue
      const local = rowUpdatedAt(table, t.id)
      if (local !== null && local > t.deletedAt) continue
      if (local !== null) {
        statements[table].run(t.id)
        applied++
      }
      recordTombstoneAt(t.kind, t.id, t.deletedAt)
    }
  })
  run()
  return applied
}

/** Wipes user data so a `replace` import starts from a clean slate. */
function clearAllData(): void {
  db.exec(`
    DELETE FROM events;
    DELETE FROM tasks;
    DELETE FROM categories;
    DELETE FROM tombstones;
  `)
}

/** Persists incoming settings without clobbering keys the snapshot omits. */
function applySettings(settings: Partial<AppSettings>): void {
  const current = getSettings()
  const merged = { ...current, ...settings }
  for (const key of Object.keys(merged) as (keyof AppSettings)[]) {
    setSetting(key, merged[key])
  }
}

/**
 * Imports a snapshot either by merging (last-write-wins per row) or by
 * replacing all local data. Runs inside a transaction so a malformed
 * snapshot can never leave the database half-written.
 */
export function importSnapshot(snapshot: CalendarSnapshot, mode: ImportMode): ImportResult {
  const result: ImportResult = {
    eventsAdded: 0,
    eventsUpdated: 0,
    tasksAdded: 0,
    tasksUpdated: 0,
    categoriesAdded: 0,
    categoriesUpdated: 0,
    tombstonesApplied: 0,
    replaced: mode === 'replace'
  }

  const run = db.transaction(() => {
    if (mode === 'replace') clearAllData()

    for (const category of snapshot.categories ?? []) {
      const outcome = upsertCategoryRow(category)
      if (outcome === 'added') result.categoriesAdded++
      else if (outcome === 'updated') result.categoriesUpdated++
    }

    for (const event of snapshot.events ?? []) {
      const outcome = upsertEventRow(event)
      if (outcome === 'added') result.eventsAdded++
      else if (outcome === 'updated') result.eventsUpdated++
    }

    for (const task of snapshot.tasks ?? []) {
      const outcome = upsertTaskRow(task)
      if (outcome === 'added') result.tasksAdded++
      else if (outcome === 'updated') result.tasksUpdated++
    }

    result.tombstonesApplied = applyTombstones(snapshot.tombstones ?? [])

    // `value` must stay unique; the seeded presets are guaranteed to exist.
    seedCategories()

    if (snapshot.settings) applySettings(snapshot.settings)
  })

  run()
  return result
}

