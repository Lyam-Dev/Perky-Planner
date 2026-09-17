import { useCallback, useMemo, useState } from 'react'
import type { EventInput, TaskList } from '@shared/types'
import { useEvents } from './hooks/useEvents'
import { useTasks } from './hooks/useTasks'
import { CalendarGrid } from './components/CalendarGrid'
import { DayView } from './components/DayView'
import { EventModal } from './components/EventModal'
import { TaskSidebar } from './components/TaskSidebar'
import { CalendarIcon } from './components/Icons'
import { startOfToday, type DayCellData } from './lib/dateEngine'

/**
 * Root application shell. Owns the currently displayed month, the selected
 * day / modal state, and wires the calendar grid to the task sidebar.
 */
export function App(): JSX.Element {
  const today = useMemo(() => startOfToday(), [])
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  /** When set, the full 24-hour day view is shown instead of the month grid. */
  const [dayViewDate, setDayViewDate] = useState<string | null>(null)

  const { events, createEvent, updateEvent, removeEvent } = useEvents()
  const { tasks, createTask, toggleTask, removeTask } = useTasks()

  const isMac = window.calendar.platform === 'darwin'

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
    async (input: EventInput, id: number | null) => {
      if (id != null) await updateEvent(id, input)
      else await createEvent(input)
      setSelectedDate(null)
      setEditingId(null)
    },
    [createEvent, updateEvent]
  )

  const handleDelete = useCallback(
    async (id: number) => {
      await removeEvent(id)
      // Deleting the event being edited closes the modal; deleting any other
      // event leaves the modal open so the whole day can be managed in place.
      if (editingId === id) {
        setEditingId(null)
        setSelectedDate(null)
      }
    },
    [removeEvent, editingId]
  )

  const handleCreateTask = useCallback(
    async (list: TaskList, text: string) => {
      await createTask({ text, completed: false, list, dueDate: null })
    },
    [createTask]
  )

  return (
    <div className="flex h-screen flex-col bg-surface-muted text-slate-800">
      {/* Draggable title bar (macOS traffic lights / Windows controls) */}
      <header
        className={[
          'flex h-12 flex-shrink-0 items-center border-b border-surface-border bg-white',
          isMac ? 'pl-20 pr-4' : 'px-4'
        ].join(' ')}
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 animate-float items-center justify-center rounded-lg bg-brand-600 text-white transition-transform hover:animate-wiggle">
            <CalendarIcon width={16} height={16} />
          </span>
          <h1 className="text-sm font-semibold text-slate-800">Perky Planner</h1>
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
          collapsed={sidebarCollapsed}
          onToggleCollapsed={() => setSidebarCollapsed((c) => !c)}
          onCreate={handleCreateTask}
          onToggle={toggleTask}
          onRemove={removeTask}
        />
      </div>

      {/* Event modal */}
      {selectedDate && (
        <EventModal
          date={selectedDate}
          dayEvents={dayEvents}
          editing={editingEvent}
          onClose={() => {
            setSelectedDate(null)
            setEditingId(null)
          }}
          onSave={handleSave}
          onDelete={handleDelete}
          onEdit={(id) => setEditingId(id)}
        />
      )}
    </div>
  )
}
