/**
 * End-to-end verification that the `perky1:` pairing-code transfer round-trips
 * tasks (to-do's), not just events. Run with:
 *
 *   bash scripts/run-xfer-test.sh
 *
 * The runner compiles src/main/db.ts + share.ts to CJS in /tmp/perky-xfer-test
 * (symlinking this project's node_modules so the Electron-ABI better-sqlite3
 * resolves), then drives the REAL persistence+share code inside Electron.
 */
const { app } = require('electron')
const fs = require('fs')

const UD = '/tmp/perky-xfer-ud'
fs.rmSync(UD, { recursive: true, force: true })
fs.mkdirSync(UD, { recursive: true })

const {
  initDatabase,
  buildSnapshot,
  importSnapshot,
  createTask,
  createEvent,
  listTasks,
  listEvents,
  getSettings,
  setSetting
} = require('/tmp/perky-xfer-test/main/db.js')
const { exportSnapshotCode, decodeSnapshotCode } = require('/tmp/perky-xfer-test/main/share.js')

app.whenReady().then(async () => {
  try {
    app.setPath('userData', UD)
  } catch {
    // Already resolved on a fresh process — harmless.
  }
  initDatabase()

  // --- Seed a couple of tasks + one event, then export a code. ---
  createTask({ text: 'Buy milk', completed: false, list: 'today', dueDate: null })
  createTask({ text: 'Review Q3 docs', completed: true, list: 'upcoming', dueDate: '2026-09-20' })
  createEvent({
    title: 'Retro',
    description: 'Sprint retro',
    date: '2026-09-20',
    allDay: true,
    startTime: null,
    endTime: null,
    category: 'work',
    color: '#4f46e5'
  })
    setSetting('theme', 'dark')

  const code = exportSnapshotCode()
  console.log('CODE_LEN', code.length, 'prefix', code.slice(0, 6))

  const snap = decodeSnapshotCode(code)
  console.log('SNAP_HAS_TASKS', Array.isArray(snap.tasks), 'count', snap.tasks.length)
  console.log('SNAP_HAS_EVENTS', snap.events.length === 1)
  console.log('TASK_SAMPLE', JSON.stringify(snap.tasks[0]).slice(0, 70))

  // --- Replace import: wipe local data, then re-import the code. ---
  const res = importSnapshot(snap, 'replace')
  const afterTasks = listTasks()
  const afterEvents = listEvents()
  console.log('IMPORT_RESULT', JSON.stringify(res))
  console.log('TASKS_AFTER_IMPORT', afterTasks.length, JSON.stringify(afterTasks.map((t) => t.text)))
  console.log('EVENTS_AFTER_IMPORT', afterEvents.length)
  console.log('SETTINGS_PERSISTED_DARK', getSettings().theme === 'dark')
  console.log('TASKS_TRANSFERRED', afterTasks.length === 2)

  const ok =
    afterTasks.length === 2 &&
    snap.tasks.length === 2 &&
    snap.events.length === 1 &&
    res.tasksAdded === 2 &&
    getSettings().theme === 'dark'
  console.log(ok ? 'ALL_PASS' : 'FAILURE')
  app.quit()
})

