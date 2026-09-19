import { useCallback, useEffect, useMemo, useState } from 'react'
import type { EventInput, TaskList, UpdateInfo } from '@shared/types'
import { useEvents } from './hooks/useEvents'
import { useTasks } from './hooks/useTasks'
import { useCategories } from './hooks/useCategories'
import { useSettings } from './hooks/useSettings'
import { useHistory } from './hooks/useHistory'
import { CalendarGrid } from './components/CalendarGrid'
import { DayView } from './components/DayView'
import { EventModal } from './components/EventModal'
import { TaskSidebar } from './components/TaskSidebar'
import { SettingsPanel } from './components/SettingsPanel'
import { CalendarIcon, GearIcon, UndoIcon } from './components/Icons'
import { startOfToday, type DayCellData } from './lib/dateEngine'

/**
 * Root application shell. Owns the displayed month, day/modal state, global
 * undo, the settings panel and the update banner, and wires the calendar grid
 * to the task sidebar.
 */
export function App(): JSX.Element {
  const today = useMemo(() => startOfToday(), [])
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  /** When set, the full 24-hour day view is shown instead of the month grid. */
  const [dayViewDate, setDayViewDate] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const { settings, update: updateSetting } = useSettings()
  const {
    categories,
    refresh: refreshCategories,
    createCategory,
    updateCategory,
    removeCategory
  } = useCategories()
  const { events, refresh: refreshEvents, createEvent, updateEvent, removeEvent } = useEvents()
  const { tasks, refresh: refreshTasks, createTask, toggleTask, removeTask } = useTasks()
  const { canUndo, record, undo } = useHistory()

  const [updateInfo, setUpdateInfo] = useState<UpdateInfo>({ status: 'idle' })

  const isMac = window.calendar.platform === 'darwin'
  const sidebarVisible = settings.sidebarVisible

  // Subscribe to updater lifecycle events for the banner.
  useEffect(() => {
    let mounted = true
    window.calendar.updates.getState().then((s) => {
      if (mounted) setUpdateInfo(s)
    })
    const off = window.calendar.updates.onUpdate((s) => setUpdateInfo(s))
    return () => {
      mounted = false
      off()
    }
  }, [])

  const dayEvents = useMemo(
    () => (selectedDate ? events.filter((e) => e.date === selectedDate) : []),
    [events, selectedDate]
  )

  /** Events for the day currently shown in the 24-hour day view. */
  const dayViewEvents = useMemo(
    () => (dayViewDate ? events.filter((e) => e.date === dayViewDate) : []),
    [events, dayViewDate]
  )

  const editingEvent = useMemo(
    () => (editingId != null ? events.find((e) => e.id === editingId) ?? null : null),
    [events, editingId]
  )

  const handleSelectDay = useCallback((cell: DayCellData) => {
    setSelectedDate(cell.iso)
    setEditingId(null)
  }, [])

  /** Double-clicking a day opens the full 24-hour timeline for that day. */
  const handleOpenDay = useCallback((cell: DayCellData) => {
    setDayViewDate(cell.iso)
    setSelectedDate(null)
    setEditingId(null)
  }, [])

  /** Opens the create-event modal for the day currently shown in the day view. */
  const handleAddFromDayView = useCallback(() => {
    if (dayViewDate) {
      setSelectedDate(dayViewDate)
      setEditingId(null)
    }
  }, [dayViewDate])

  const handleSave = useCallback(
    async (input: EventInput, id: string | null) => {
      if (id != null) {
        const before = events.find((e) => e.id === id)
        const after = await updateEvent(id, input)
        if (before) record({ type: 'event.update', before, after })
      } else {
        const created = await createEvent(input)
        record({ type: 'event.create', after: created })
      }
      setSelectedDate(null)
      setEditingId(null)
    },
    [events, createEvent, updateEvent, record]
  )

  const handleDelete = useCallback(
    async (id: string) => {
      const before = events.find((e) => e.id === id)
      await removeEvent(id)
      if (before) record({ type: 'event.delete', before })
      // Deleting the event being edited closes the modal; deleting any other
      // event leaves the modal open so the whole day can be managed in place.
      if (editingId === id) {
        setEditingId(null)
        setSelectedDate(null)
      }
    },
    [events, removeEvent, record, editingId]
  )

  const handleCreateTask = useCallback(
    async (list: TaskList, text: string) => {
      const created = await createTask({ text, completed: false, list, dueDate: null })
      record({ type: 'task.create', after: created })
    },
    [createTask, record]
  )

  const handleToggleTask = useCallback(
    async (id: string) => {
      const before = tasks.find((t) => t.id === id)
      const after = await toggleTask(id)
      if (before) record({ type: 'task.update', before, after })
    },
    [tasks, toggleTask, record]
  )

  const handleRemoveTask = useCallback(
    async (id: string) => {
      const before = tasks.find((t) => t.id === id)
      await removeTask(id)
      if (before) record({ type: 'task.delete', before })
    },
    [tasks, removeTask, record]
  )

  /** Undo the latest mutation and resync every data hook. */
  const handleUndo = useCallback(async () => {
    const undone = await undo()
    if (!undone) return
    await Promise.all([refreshEvents(), refreshTasks(), refreshCategories()])
  }, [undo, refreshEvents, refreshTasks, refreshCategories])

  const handleToggleSidebar = useCallback(() => {
    updateSetting('sidebarVisible', !sidebarVisible)
  }, [updateSetting, sidebarVisible])

  const updateBanner = useMemo(() => {
    switch (updateInfo.status) {
      case 'available':
        return { text: `Version ${updateInfo.version ?? ''} available — downloading…`, ready: false }
      case 'downloading':
        return {
          text: `Downloading update… ${Math.round(updateInfo.percent ?? 0)}%`,
          ready: false
        }
      case 'downloaded':
        return { text: 'Update downloaded and ready to install.', ready: true }
      default:
        return null
    }
  }, [updateInfo])

    return (
    <div className="flex h-screen flex-col bg-surface-muted text-content">
      {/* Decorative backdrop behind frosted panels (pointer-through). */}
      <div className="ambient-backdrop" />

      {/* Update banner */}
      {updateBanner && (
        <div className="flex animate-fade-in items-center justify-center gap-3 bg-brand-600 px-4 py-1.5 text-xs font-medium text-white">
          <span>{updateBanner.text}</span>
          {updateBanner.ready && (
            <button
              type="button"
              onClick={() => window.calendar.updates.quitAndInstall()}
              className="rounded-full bg-surface px-3 py-0.5 text-[11px] font-semibold text-brand-700 transition-transform duration-150 hover:scale-105 active:scale-95"
            >
              Restart to update
            </button>
          )}
        </div>
      )}

            {/* Draggable title bar (macOS traffic lights / Windows controls) */}
      <header
        className={[
          'glass-panel relative z-10 flex h-12 flex-shrink-0 items-center border-b border-surface-border',
          isMac ? 'pl-20 pr-4' : 'px-4'
        ].join(' ')}
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 animate-float items-center justify-center rounded-lg bg-brand-600 text-white transition-transform hover:animate-wiggle">
            <CalendarIcon width={16} height={16} />
          </span>
          <h1 className="text-sm font-semibold text-content">Perky Planner</h1>
        </div>

        {/* Window-level actions (must not participate in dragging) */}
        <div
          className="ml-auto flex items-center gap-1"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <button
            type="button"
            onClick={handleUndo}
            disabled={!canUndo}
            title="Undo last change"
            aria-label="Undo last change"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-content-muted transition-all duration-200 hover:scale-110 hover:bg-surface-muted hover:text-content active:scale-95 disabled:opacity-30 disabled:hover:scale-100 disabled:hover:bg-transparent"
          >
            <UndoIcon />
          </button>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            title="Settings"
            aria-label="Open settings"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-content-muted transition-all duration-200 hover:rotate-45 hover:scale-110 hover:bg-surface-muted hover:text-content active:scale-95"
          >
            <GearIcon />
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex min-h-0 flex-1">
        <main className="flex min-h-0 flex-1 flex-col p-4">
          {dayViewDate ? (
            <DayView
              date={dayViewDate}
              events={dayViewEvents}
              onBack={() => setDayViewDate(null)}
              onAddEvent={handleAddFromDayView}
              onEditEvent={(id) => {
                setSelectedDate(dayViewDate)
                setEditingId(id)
              }}
            />
          ) : (
            <CalendarGrid
              year={year}
              month={month}
              events={events}
              weekStart={settings.weekStart}
              onChangeMonth={(y, m) => {
                setYear(y)
                setMonth(m)
              }}
              onSelectDay={handleSelectDay}
              onOpenDay={handleOpenDay}
            />
          )}
        </main>

        <TaskSidebar
          tasks={tasks}
          collapsed={!sidebarVisible}
          onToggleCollapsed={handleToggleSidebar}
          onCreate={handleCreateTask}
          onToggle={handleToggleTask}
          onRemove={handleRemoveTask}
        />
      </div>

      {/* Event modal */}
      {selectedDate && (
        <EventModal
          date={selectedDate}
          dayEvents={dayEvents}
          editing={editingEvent}
          categories={categories}
          onClose={() => {
            setSelectedDate(null)
            setEditingId(null)
          }}
          onSave={handleSave}
          onDelete={handleDelete}
          onEdit={(id) => setEditingId(id)}
        />
      )}

      {/* Settings overlay */}
      {settingsOpen && (
        <SettingsPanel
          settings={settings}
          categories={categories}
          onClose={() => setSettingsOpen(false)}
          onChange={updateSetting}
          onCreateCategory={createCategory}
          onUpdateCategory={updateCategory}
          onDeleteCategory={removeCategory}
        />
      )}
    </div>
  )
}
