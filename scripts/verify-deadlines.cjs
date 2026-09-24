/**
 * End-to-end verification for multi-day deadlines. Run with:
 *
 *   bash scripts/run-deadline-test.sh
 *
 * Exercises the REAL modules (compiled from src/main/db.ts, src/main/share.ts
 * and the pure renderer layout helpers) inside an Electron process, so the
 * assertions cover persistence, range queries, the `perky1:` transfer round
 * trip and the grid geometry that turns a timeframe into spanning bars.
 */
const { app } = require('electron')
const fs = require('fs')

const UD = '/tmp/perky-deadline-ud'
fs.rmSync(UD, { recursive: true, force: true })
fs.mkdirSync(UD, { recursive: true })

const db = require('/tmp/perky-deadline-test/main/db.js')
const { exportSnapshotCode, decodeSnapshotCode, encodeSnapshotCode } = require(
  '/tmp/perky-deadline-test/main/share.js'
)
const { getMonthGrid } = require('/tmp/perky-deadline-test/renderer/lib/dateEngine.js')
const layout = require('/tmp/perky-deadline-test/renderer/lib/deadlineLayout.js')
const cellLayout = require('/tmp/perky-deadline-test/renderer/lib/calendarCellLayout.js')

let passed = 0
let failed = 0

/** Compares two values by their JSON form; prints either way. */
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) {
    passed++
    console.log(`PASS  ${name}`)
  } else {
    failed++
    console.log(`FAIL  ${name}`)
    console.log(`        expected: ${JSON.stringify(expected)}`)
    console.log(`        actual:   ${JSON.stringify(actual)}`)
  }
}

/** Asserts a condition is truthy. */
function ok(name, condition) {
  check(name, !!condition, true)
}

/** Builds a deadline object for the pure-layout tests. */
function d(id, title, startDate, endDate) {
  return {
    id,
    title,
    startDate,
    endDate,
    notes: '',
    category: 'other',
    color: '#4f46e5',
    createdAt: '',
    updatedAt: ''
  }
}

app.whenReady().then(() => {
  try {
    app.setPath('userData', UD)
  } catch {
    // Already resolved on a fresh process — harmless.
  }
  // --- Simulate an install that predates deadlines -------------------------
  // An upgrading user already has a calendar.db with every table except
  // `deadlines`; initDatabase() must add the table without disturbing rows.
  const Database = require('better-sqlite3')
  const { join } = require('path')
  const legacy = new Database(join(UD, 'calendar.db'))
  legacy.exec(`
    CREATE TABLE events (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
      date TEXT NOT NULL, all_day INTEGER NOT NULL DEFAULT 1, start_time TEXT, end_time TEXT,
      category TEXT NOT NULL DEFAULT 'other', color TEXT NOT NULL DEFAULT '#4f46e5',
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE tasks (
      id TEXT PRIMARY KEY, text TEXT NOT NULL, completed INTEGER NOT NULL DEFAULT 0,
      list TEXT NOT NULL DEFAULT 'today', due_date TEXT,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE categories (
      id TEXT PRIMARY KEY, value TEXT NOT NULL UNIQUE, label TEXT NOT NULL, color TEXT NOT NULL,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE tombstones (
      kind TEXT NOT NULL, id TEXT NOT NULL, deleted_at TEXT NOT NULL, PRIMARY KEY (kind, id)
    );
    INSERT INTO events
      (id, title, description, date, all_day, start_time, end_time, category, color, created_at, updated_at)
    VALUES
      ('pre-existing', 'Legacy standup', '', '2026-09-02', 1, NULL, NULL, 'work', '#4f46e5',
       '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
  `)
  const hasDeadlinesTable = legacy
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='deadlines'")
    .get()
  ok('the simulated old database has no deadlines table', !hasDeadlinesTable)
  legacy.close()

  db.initDatabase()

  console.log('=== Upgrade from a pre-deadline database ===')
  check('existing events survive the upgrade', db.listEvents().map((e) => e.title), [
    'Legacy standup'
  ])
  check('the new table starts empty', db.listDeadlines().length, 0)
  ok(
    'createDeadline works right after the upgrade',
    !!db.createDeadline({
      title: 'Upgrade probe',
      startDate: '2026-09-03',
      endDate: '2026-09-04',
      notes: '',
      category: 'other',
      color: '#4f46e5'
    }).id
  )
  check(
    'the probe deadline is stored in a range query',
    db.listDeadlinesByRange('2026-09-03', '2026-09-03').map((x) => x.title),
    ['Upgrade probe']
  )
  // Leave the database in the state the rest of the suite expects.
  const probe = db.listDeadlines()[0]
  db.deleteDeadline(probe.id)
  check('cleanup leaves no deadlines behind', db.listDeadlines().length, 0)

  console.log('=== CRUD + range queries ===')
  const sprint = db.createDeadline({
    title: 'Sprint 12',
    startDate: '2026-09-08',
    endDate: '2026-09-22',
    notes: 'two week sprint',
    category: 'work',
    color: '#4f46e5'
  })
  ok('create returns a UUID', typeof sprint.id === 'string' && sprint.id.length === 36)
  check('create stores the timeframe', [sprint.startDate, sprint.endDate], [
    '2026-09-08',
    '2026-09-22'
  ])
  check('create stores notes', sprint.notes, 'two week sprint')

  // Picking the end first is a normal user action, not an error.
  const reversed = db.createDeadline({
    title: 'Reversed',
    startDate: '2026-10-20',
    endDate: '2026-10-05',
    notes: '',
    category: 'other',
    color: '#059669'
  })
  check('reversed endpoints normalised', [reversed.startDate, reversed.endDate], [
    '2026-10-05',
    '2026-10-20'
  ])

  // Leaving the end blank means "just this day".
  const single = db.createDeadline({
    title: 'One day',
    startDate: '2026-09-30',
    endDate: '',
    notes: '',
    category: 'other',
    color: '#d97706'
  })
  check('empty end collapses to a single day', [single.startDate, single.endDate], [
    '2026-09-30',
    '2026-09-30'
  ])

  check(
    'listDeadlines is ordered by start date',
    db.listDeadlines().map((x) => x.title),
    ['Sprint 12', 'One day', 'Reversed']
  )

  let thrown = ''
  try {
    db.createDeadline({
      title: 'Bad',
      startDate: 'not-a-date',
      endDate: '',
      notes: '',
      category: 'other',
      color: '#000000'
    })
  } catch (e) {
    thrown = e.message
  }
  ok('invalid date rejected before it reaches the index', thrown.includes('Invalid deadline startDate'))

  // A deadline covering the previous month as well.
  db.createDeadline({
    title: 'Straddler',
    startDate: '2026-08-28',
    endDate: '2026-09-05',
    notes: '',
    category: 'important',
    color: '#dc2626'
  })

  const titles = (start, end) => db.listDeadlinesByRange(start, end).map((x) => x.title)
  check('range inside the span finds it', titles('2026-09-15', '2026-09-20'), ['Sprint 12'])
  check('range touching the final day still finds it', titles('2026-09-22', '2026-09-30'), [
    'Sprint 12',
    'One day'
  ])
  check('range wholly inside a gap finds nothing', titles('2026-09-23', '2026-09-29'), [])
  check('range before the span misses it', titles('2026-09-01', '2026-09-07'), ['Straddler'])
  check('deadline straddling a month boundary is found', titles('2026-09-01', '2026-09-02'), [
    'Straddler'
  ])
  check('month-wide query finds only that month', titles('2026-10-01', '2026-10-31'), ['Reversed'])
  check('august query finds the straddler', titles('2026-08-01', '2026-08-31'), ['Straddler'])

  console.log('=== Update / delete / tombstones ===')
  const updated = db.updateDeadline(sprint.id, {
    title: 'Sprint 12 (moved)',
    startDate: '2026-09-10',
    endDate: '2026-09-24',
    notes: 'slipped a week',
    category: 'work',
    color: '#4f46e5'
  })
  check('update moves the timeframe', [updated.startDate, updated.endDate], [
    '2026-09-10',
    '2026-09-24'
  ])
  check('update keeps the same id', updated.id, sprint.id)
  ok('update preserves createdAt', updated.createdAt === sprint.createdAt)
  ok('update advances updatedAt', updated.updatedAt >= sprint.updatedAt)
  check('updated row is what a query returns', titles('2026-09-12', '2026-09-12'), [
    'Sprint 12 (moved)'
  ])

  db.deleteDeadline(single.id)
  check(
    'delete removes the row',
    db.listDeadlines().map((x) => x.title),
    ['Straddler', 'Sprint 12 (moved)', 'Reversed']
  )
  const deadlineTombstones = db
    .listTombstones()
    .filter((t) => t.kind === 'deadline')
    .map((t) => t.id)
  ok('delete writes a deadline tombstone', deadlineTombstones.includes(single.id))
  ok(
    'every tombstone so far belongs to the deadline kind',
    db.listTombstones().every((t) => t.kind === 'deadline')
  )
  ok('the deleted row is gone', !db.listDeadlines().some((x) => x.id === single.id))

  // A tombstone older than the local row must NOT win (last-write-wins).
  const staleResult = db.importSnapshot(
    {
      version: 1,
      exportedAt: 'x',
      appVersion: '1.0.0',
      events: [],
      tasks: [],
      deadlines: [],
      categories: [],
      tombstones: [{ kind: 'deadline', id: sprint.id, deletedAt: '2000-01-01T00:00:00.000Z' }],
      settings: {}
    },
    'merge'
  )
  check('stale tombstone applied count', staleResult.tombstonesApplied, 0)
  ok('stale tombstone cannot delete a newer local deadline', db.listDeadlines().some((x) => x.id === sprint.id))

  // A tombstone newer than the row must delete it.
  const freshResult = db.importSnapshot(
    {
      version: 1,
      exportedAt: 'x',
      appVersion: '1.0.0',
      events: [],
      tasks: [],
      deadlines: [],
      categories: [],
      tombstones: [{ kind: 'deadline', id: 'ghost-deadline', deletedAt: '2099-01-01T00:00:00.000Z' }],
      settings: {}
    },
    'merge'
  )
  check('unknown-id tombstone applies nothing', freshResult.tombstonesApplied, 0)

  console.log('=== perky1: transfer ===')
  const code = exportSnapshotCode()
  console.log('CODE_LEN', code.length, 'prefix', code.slice(0, 6))

  const snap = decodeSnapshotCode(code)
  ok('exported code carries a deadlines array', Array.isArray(snap.deadlines))
  check('code contains every deadline', snap.deadlines.length, 3)
  check(
    'code preserves deadline titles',
    snap.deadlines.map((x) => x.title),
    ['Straddler', 'Sprint 12 (moved)', 'Reversed']
  )
  const movedInCode = snap.deadlines.find((x) => x.id === sprint.id)
  check('code preserves the timeframe', [movedInCode.startDate, movedInCode.endDate], [
    '2026-09-10',
    '2026-09-24'
  ])
  check('code preserves notes', movedInCode.notes, 'slipped a week')
  check('code preserves the colour source', movedInCode.color, '#4f46e5')

  const replaceRes = db.importSnapshot(snap, 'replace')
  check('replace import re-adds every deadline', replaceRes.deadlinesAdded, 3)
  check('replace import reports no updates', replaceRes.deadlinesUpdated, 0)
  check(
    'replace import keeps the ids',
    db.listDeadlines()
      .map((x) => x.id)
      .sort(),
    snap.deadlines
      .map((x) => x.id)
      .sort()
  )
  check('replace import keeps the ranges', db.listDeadlinesByRange('2026-09-12', '2026-09-12').map((x) => x.title), [
    'Sprint 12 (moved)'
  ])

  const mergeAgain = db.importSnapshot(snap, 'merge')
  check('re-importing the same code is a no-op', [mergeAgain.deadlinesAdded, mergeAgain.deadlinesUpdated], [0, 0])

  // A newer copy of the same deadline must win over the stale local copy.
  const newer = {
    ...movedInCode,
    title: 'Sprint 12 (final)',
    endDate: '2026-09-28',
    updatedAt: new Date(Date.now() + 60_000).toISOString()
  }
  const mergeNewer = db.importSnapshot(
    { ...snap, deadlines: [newer] },
    'merge'
  )
  check('newer copy updates the row', mergeNewer.deadlinesUpdated, 1)
  check('newer copy wins', db.listDeadlines().find((x) => x.id === sprint.id).title, 'Sprint 12 (final)')

  console.log('=== Backward compatibility with pre-deadline codes ===')
  const legacySnap = {
    version: 1,
    exportedAt: 'x',
    appVersion: '1.0.0',
    events: [],
    tasks: [],
    categories: [],
    tombstones: [],
    settings: {}
  }
  let legacyDecoded = null
  let legacyError = ''
  try {
    legacyDecoded = decodeSnapshotCode(encodeSnapshotCode(legacySnap))
  } catch (e) {
    legacyError = e.message
  }
  ok('code without a deadlines key still decodes', legacyDecoded !== null && legacyError === '')
  const legacyRes = db.importSnapshot(legacyDecoded, 'merge')
  check('legacy snapshot adds no deadlines', legacyRes.deadlinesAdded, 0)
  check('legacy snapshot leaves existing deadlines alone', db.listDeadlines().length, 3)

  let brokenError = ''
  try {
    decodeSnapshotCode(
      encodeSnapshotCode({ ...legacySnap, deadlines: 'definitely-not-an-array' })
    )
  } catch (e) {
    brokenError = e.message
  }
  ok('malformed deadlines payload is rejected', brokenError.includes('unsupported format version'))

  console.log('=== Category reassignment ===')
  const workCategory = db.listCategories().find((c) => c.value === 'work')
  db.deleteCategory(workCategory.id)
  check(
    'deleting a category moves its deadlines to "other"',
    db.listDeadlines().filter((x) => x.category === 'work').length,
    0
  )
  check('reassigned deadlines survive the category delete', db.listDeadlines().length, 3)

  console.log('=== Grid geometry: timeframe becomes a spanning bar ===')
  const grid = getMonthGrid(2026, 8, 'sunday')
  check('grid has 42 cells', grid.length, 42)
  const weeks = []
  for (let i = 0; i < grid.length; i += 7) weeks.push(grid.slice(i, i + 7))
  check('first row spans Aug 30 – Sep 5', [weeks[0][0].iso, weeks[0][6].iso], [
    '2026-08-30',
    '2026-09-05'
  ])
  check('third row spans Sep 13 – Sep 19', [weeks[2][0].iso, weeks[2][6].iso], [
    '2026-09-13',
    '2026-09-19'
  ])

  const layoutDeadlines = [
    d('a', 'Sprint', '2026-09-08', '2026-09-22'),
    d('b', 'Launch', '2026-09-14', '2026-09-30'),
    d('c', 'Standup', '2026-09-16', '2026-09-16')
  ]
  const midWeek = layout.layoutWeekDeadlines(layoutDeadlines, weeks[2])
  const barOf = (res, id) => res.bars.find((x) => x.deadline.id === id)

  check('every overlapping deadline gets a bar', midWeek.bars.length, 3)
  check('nothing overflows with three deadlines', midWeek.overflow, 0)
  check('band reserves a lane per overlapping deadline', midWeek.bandHeight, 46)

  const sprintBar = barOf(midWeek, 'a')
  check('bar starting earlier stretches to the left edge', [
    sprintBar.columnStart,
    sprintBar.columnSpan
  ], [0, 7])
  check('bar continuing past the week has square caps', [
    sprintBar.startsHere,
    sprintBar.endsHere
  ], [false, false])
  check('longest bar takes the top lane', sprintBar.lane, 0)

  const launchBar = barOf(midWeek, 'b')
  check('bar begins on its real first day', [launchBar.columnStart, launchBar.startsHere], [1, true])
  check('bar runs to the week edge when it ends later', launchBar.endsHere, false)
  check('overlapping bar drops to lane 1', launchBar.lane, 1)

  const standupBar = barOf(midWeek, 'c')
  check('single-day bar covers one column', [standupBar.columnStart, standupBar.columnSpan], [3, 1])
  check('single-day bar is capped at both ends', [standupBar.startsHere, standupBar.endsHere], [
    true,
    true
  ])
  check('third overlapping bar sits in lane 2', standupBar.lane, 2)

  // Vertical geometry must match the space DayCell reserves for the band.
  check('first lane starts below the day number', layout.barTop(0), layout.BAND_TOP)
  check('BAND_TOP equals padding + day number + gap', layout.BAND_TOP, 6 + 24 + 4)
  check('lanes are one bar plus the gap apart', layout.barTop(2) - layout.barTop(1), 16)

  const earlyWeek = layout.layoutWeekDeadlines(
    [...layoutDeadlines, d('e', 'Quick', '2026-09-01', '2026-09-02')],
    weeks[0]
  )
  const quickBar = barOf(earlyWeek, 'e')
  ok('deadline overlapping only the first row is drawn there', !!quickBar)
  check('leading days from August shift the bar right', [
    quickBar.columnStart,
    quickBar.columnSpan
  ], [2, 2])
  check('a lone bar reserves a single lane', earlyWeek.bandHeight, layout.BAR_HEIGHT)

  const disjoint = layout.layoutWeekDeadlines(
    [d('x', 'Early', '2026-09-13', '2026-09-14'), d('y', 'Late', '2026-09-16', '2026-09-17')],
    weeks[2]
  )
  check('non-overlapping bars share lane 0', disjoint.bars.map((x) => x.lane), [0, 0])
  check('lane sharing keeps the band to one row', disjoint.bandHeight, layout.BAR_HEIGHT)

  const crowdedDeadlines = [0, 1, 2, 3, 4].map((i) =>
    d(`m${i}`, `M${i}`, '2026-09-16', '2026-09-16')
  )
  const crowded = layout.layoutWeekDeadlines(crowdedDeadlines, weeks[2])
  check('lanes are capped at MAX_LANES', crowded.bars.length, layout.MAX_LANES)
  check('extra deadlines are counted as overflow', crowded.overflow, 2)
  check('the band never grows past the cap', crowded.bandHeight, 46)

  const oneDeadlineLane = layout.layoutWeekDeadlines(crowdedDeadlines, weeks[2], 1)
  check('a height-limited week can use fewer deadline lanes', oneDeadlineLane.bars.length, 1)
  check('deadlines above the available lanes are still counted', oneDeadlineLane.overflow, 4)
  check('a height-limited week reserves only the used band', oneDeadlineLane.bandHeight, layout.BAR_HEIGHT)
  const noDeadlineSpace = layout.layoutWeekDeadlines(crowdedDeadlines, weeks[2], 0)
  check('a week with no room for deadline bars keeps none', noDeadlineSpace.bars.length, 0)
  check('a week with no room for deadline bars counts them all', noDeadlineSpace.overflow, 5)
  check('deadline lane limit stays within a full row', layout.deadlineLanesForRowHeight(90), 3)
  check('deadline lane limit reduces for a short row', layout.deadlineLanesForRowHeight(89), 2)
  check('deadline lane limit is zero when a bar cannot fit', layout.deadlineLanesForRowHeight(53), 0)

  console.log('=== Day-cell capacity: content stays inside its box ===')
  check('cell space accounts for padding, date row and gap', cellLayout.dayCellEventSpace(120, 0), 80)
  check('cell space is never negative', cellLayout.dayCellEventSpace(20, 46), 0)
  check('deadline band is removed from the event budget', cellLayout.dayCellEventSpace(120, 46), 30)
  check(
    'ordinary events do not show an overflow label',
    cellLayout.dayCellEventCapacity(4, 80),
    { visibleCount: 4, hiddenCount: 0, overflowPlacement: 'none' }
  )
  check(
    'a fifth event becomes a readable overflow row',
    cellLayout.dayCellEventCapacity(5, 80),
    { visibleCount: 3, hiddenCount: 2, overflowPlacement: 'row' }
  )
  check(
    'a compact cell keeps its overflow count in the header',
    cellLayout.dayCellEventCapacity(5, 10),
    { visibleCount: 0, hiddenCount: 5, overflowPlacement: 'header' }
  )
  check(
    'a narrow event area never clips its overflow row',
    cellLayout.dayCellEventCapacity(5, 33),
    { visibleCount: 1, hiddenCount: 4, overflowPlacement: 'row' }
  )
  check(
    'the overflow row is included in the final pixel budget',
    cellLayout.dayCellEventCapacity(5, 50),
    { visibleCount: 2, hiddenCount: 3, overflowPlacement: 'row' }
  )
  check('empty cells have no overflow', cellLayout.dayCellEventCapacity(0, 0), {
    visibleCount: 0,
    hiddenCount: 0,
    overflowPlacement: 'none'
  })
  check('overflow wording names the hidden count', cellLayout.eventOverflowLabel(2), 'and 2 more…')
  check('the capacity never exposes a partially fitted event', cellLayout.dayCellEventCapacity(5, 14), {
    visibleCount: 0,
    hiddenCount: 5,
    overflowPlacement: 'row'
  })
  check('the capacity handles invalid inputs safely', cellLayout.dayCellEventCapacity(NaN, NaN), {
    visibleCount: 0,
    hiddenCount: 0,
    overflowPlacement: 'none'
  })

  const noneHere = layout.layoutWeekDeadlines([d('z', 'Far', '2027-01-01', '2027-01-10')], weeks[2])
  check('a distant deadline draws nothing', noneHere.bars.length, 0)
  check('no band is reserved when nothing overlaps', noneHere.bandHeight, 0)

  console.log('=== Colour + labelling helpers ===')
  check('pale bar gets dark text', layout.readableTextColor('#fde047'), '#0f172a')
  check('deep purple bar gets white text', layout.readableTextColor('#4f46e5'), '#ffffff')
  check('red bar gets white text', layout.readableTextColor('#dc2626'), '#ffffff')
  check('3-digit hex is expanded', layout.readableTextColor('#fff'), '#0f172a')
  check('hex without a hash still parses', layout.readableTextColor('4f46e5'), '#ffffff')
  check('garbage falls back to white', layout.readableTextColor('nope'), '#ffffff')

  check('day count is inclusive', layout.deadlineDayCount(d('q', 'Q', '2026-09-08', '2026-09-22')), 15)
  check('single-day count is 1', layout.deadlineDayCount(d('q', 'Q', '2026-09-16', '2026-09-16')), 1)
  check(
    'day count survives a daylight-saving shift',
    layout.deadlineDayCount(d('q', 'Q', '2026-10-30', '2026-11-03')),
    5
  )

  const twoWeek = d('q', 'Q', '2026-09-08', '2026-09-22')
  ok('range label names the year', layout.formatDeadlineRange(twoWeek).includes('2026'))
  check(
    'single-day label is not a range',
    layout.formatDeadlineRange(d('q', 'Q', '2026-09-16', '2026-09-16')).includes('–'),
    false
  )
  check(
    'tooltip carries title, range and notes',
    layout.deadlineTooltip({
      ...twoWeek,
      title: 'Ship it',
      notes: 'polish the edges'
    }).split('\n').length,
    3
  )

  console.log('=== SUMMARY ===')
  console.log('PASSED', passed, 'FAILED', failed)
  console.log(failed === 0 ? 'ALL_PASS' : 'SOME_FAILED')
  process.exit(failed === 0 ? 0 : 1)
}).catch((e) => {
  console.log('HARNESS_ERROR', e && e.stack ? e.stack : String(e))
  process.exit(1)
})
