import { app } from 'electron'
import Database from 'better-sqlite3'
import { join } from 'path'
import type { CalendarEvent, EventInput, Task, TaskInput } from '../shared/types'

/**
 * Local persistence layer backed by SQLite (better-sqlite3).
 *
 * The database file lives in the OS-specific userData directory so that
 * user data survives app restarts and upgrades. All statements are
 * prepared once and reused for performance.
 */

let db: Database.Database

interface EventRow {
  id: number
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
  id: number
  text: string
  completed: number
  list: string
  due_date: string | null
  created_at: string
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
    category: row.category as CalendarEvent['category'],
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
    createdAt: row.created_at
  }
}

/** Initialise the database connection and run schema migrations. */
export function initDatabase(): void {
  const dbPath = join(app.getPath('userData'), 'calendar.db')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
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
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      text       TEXT    NOT NULL,
      completed  INTEGER NOT NULL DEFAULT 0,
      list       TEXT    NOT NULL DEFAULT 'today',
      due_date   TEXT,
      created_at TEXT    NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);
    CREATE INDEX IF NOT EXISTS idx_tasks_due   ON tasks(due_date);
    CREATE INDEX IF NOT EXISTS idx_tasks_list  ON tasks(list);
  `)
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
  const now = new Date().toISOString()
  const info = db
    .prepare(
      `INSERT INTO events
        (title, description, date, all_day, start_time, end_time, category, color, created_at, updated_at)
       VALUES
        (@title, @description, @date, @allDay, @startTime, @endTime, @category, @color, @createdAt, @updatedAt)`
    )
    .run({
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

  const row = db
    .prepare('SELECT * FROM events WHERE id = ?')
    .get(info.lastInsertRowid) as EventRow
  return rowToEvent(row)
}

export function updateEvent(id: number, input: EventInput): CalendarEvent {
  const now = new Date().toISOString()
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

export function deleteEvent(id: number): void {
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
  const now = new Date().toISOString()
  const info = db
    .prepare(
      `INSERT INTO tasks (text, completed, list, due_date, created_at)
       VALUES (@text, @completed, @list, @dueDate, @createdAt)`
    )
    .run({
      text: input.text,
      completed: input.completed ? 1 : 0,
      list: input.list,
      dueDate: input.dueDate,
      createdAt: now
    })

  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(info.lastInsertRowid) as TaskRow
  return rowToTask(row)
}

export function updateTask(id: number, input: Partial<TaskInput>): Task {
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRow | undefined
  if (!existing) throw new Error(`Task ${id} not found`)

  const merged = {
    id,
    text: input.text ?? existing.text,
    completed: (input.completed ?? existing.completed === 1) ? 1 : 0,
    list: input.list ?? existing.list,
    dueDate: input.dueDate !== undefined ? input.dueDate : existing.due_date
  }

  db.prepare(
    `UPDATE tasks SET text = @text, completed = @completed, list = @list, due_date = @dueDate
     WHERE id = @id`
  ).run(merged)

  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRow
  return rowToTask(row)
}

export function toggleTask(id: number): Task {
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRow | undefined
  if (!existing) throw new Error(`Task ${id} not found`)
  const next = existing.completed === 1 ? 0 : 1
  db.prepare('UPDATE tasks SET completed = ? WHERE id = ?').run(next, id)
  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRow
  return rowToTask(row)
}

export function deleteTask(id: number): void {
  db.prepare('DELETE FROM tasks WHERE id = ?').run(id)
}
