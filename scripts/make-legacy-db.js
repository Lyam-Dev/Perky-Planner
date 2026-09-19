/**
 * Creates a v1.0-schema (integer ids, no tasks.updated_at) database for
 * verifying the v1.1 id migration. Uses the sqlite3 CLI because the bundled
 * better-sqlite3 is compiled against Electron's ABI, not system Node's.
 *
 * Verify with the built app (the PERKY_USER_DATA_DIR override is honoured by
 * src/main/index.ts — a plain HOME override is NOT, Electron resolves its own
 * home dir before the override could take effect):
 *
 *   npm run build
 *   node scripts/make-legacy-db.js
 *   PERKY_USER_DATA_DIR="$TMPDIR/perky-legacy-test/Home/Library/Application Support/Electron" \
 *     npx electron out/main/index.js
 *   # then inspect the same calendar.db: ids should be `legacy-1`… (TEXT),
 *   # tasks gain updated_at, 4 categories seeded; relaunching is a no-op.
 *
 * Run: node scripts/make-legacy-db.js
 */
const path = require('path')
const fs = require('fs')
const { execFileSync } = require('child_process')

const home = path.join(process.env.TMPDIR || '/tmp', 'perky-legacy-test', 'Home')
const dir = path.join(home, 'Library', 'Application Support', 'Electron')
fs.mkdirSync(dir, { recursive: true })
const dbPath = path.join(dir, 'calendar.db')
if (fs.existsSync(dbPath)) fs.rmSync(dbPath)

const sql = `
CREATE TABLE events (
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
CREATE TABLE tasks (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  text       TEXT    NOT NULL,
  completed  INTEGER NOT NULL DEFAULT 0,
  list       TEXT    NOT NULL DEFAULT 'today',
  due_date   TEXT,
  created_at TEXT    NOT NULL
);
INSERT INTO events (title, description, date, all_day, start_time, end_time, category, color, created_at, updated_at)
  VALUES ('Legacy standup', 'daily sync', '2026-09-16', 0, '09:00', '09:30', 'work', '#4f46e5', '2026-09-01T10:00:00.000Z', '2026-09-01T10:00:00.000Z');
INSERT INTO events (title, description, date, all_day, start_time, end_time, category, color, created_at, updated_at)
  VALUES ('Legacy birthday', '', '2026-09-20', 1, NULL, NULL, 'important', '#dc2626', '2026-09-02T11:00:00.000Z', '2026-09-02T11:00:00.000Z');
INSERT INTO tasks (text, completed, list, due_date, created_at)
  VALUES ('Legacy task one', 0, 'today', '2026-09-16', '2026-09-15T08:00:00.000Z');
INSERT INTO tasks (text, completed, list, due_date, created_at)
  VALUES ('Legacy note', 0, 'notes', NULL, '2026-09-15T09:00:00.000Z');
`

execFileSync('sqlite3', [dbPath], { input: sql, stdio: ['pipe', 'ignore', 'inherit'] })
console.log('legacy db written to', dbPath)
