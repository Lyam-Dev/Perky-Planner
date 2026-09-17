import { useMemo, useState } from 'react'
import { type Task, type TaskList } from '@shared/types'
import { CheckIcon, PanelIcon, PlusIcon, TrashIcon } from './Icons'

interface TaskSidebarProps {
  tasks: Task[]
  collapsed: boolean
  onToggleCollapsed: () => void
  /** Returns the created task; the return value is ignored by the sidebar. */
  onCreate: (list: TaskList, text: string) => Promise<unknown>
  /** Returns the toggled task; the return value is ignored by the sidebar. */
  onToggle: (id: number) => Promise<unknown>
  onRemove: (id: number) => Promise<unknown>
}

const VIEWS: { key: TaskList; label: string; hint: string }[] = [
  { key: 'today', label: "Today's Tasks", hint: 'Quick to-dos for today' },
  { key: 'upcoming', label: 'Upcoming', hint: 'Things coming up soon' },
  { key: 'notes', label: 'General Notes', hint: 'Scratchpad & reminders' }
]

/**
 * Persistent, collapsible sidebar for short daily tasks. Organised into three
 * views (Today / Upcoming / Notes) with quick entry and checkbox toggles.
 */
export function TaskSidebar({
  tasks,
  collapsed,
  onToggleCollapsed,
  onCreate,
  onToggle,
  onRemove
}: TaskSidebarProps): JSX.Element {
  const [view, setView] = useState<TaskList>('today')
  const [draft, setDraft] = useState('')

  const visible = useMemo(() => tasks.filter((t) => t.list === view), [tasks, view])

  const remaining = visible.filter((t) => !t.completed).length

  const submit = async () => {
    const text = draft.trim()
    if (!text) return
    setDraft('')
    await onCreate(view, text)
  }

  if (collapsed) {
    return (
      <aside className="flex w-12 flex-col items-center gap-3 border-l border-surface-border bg-white py-3 animate-slide-in-right">
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label="Expand task sidebar"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-all duration-200 hover:scale-110 hover:bg-brand-50 hover:text-brand-600 active:scale-95"
        >
          <PanelIcon />
        </button>
        <span className="rotate-180 text-[11px] font-semibold uppercase tracking-widest text-slate-400 [writing-mode:vertical-rl]">
          Tasks
        </span>
      </aside>
    )
  }

  return (
    <aside className="flex w-72 flex-col border-l border-surface-border bg-white animate-slide-in-right">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-surface-border px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-800">Tasks</h2>
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label="Collapse task sidebar"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-all duration-200 hover:rotate-90 hover:bg-surface-muted hover:text-slate-600 active:scale-90"
        >
          <PanelIcon />
        </button>
      </div>

      {/* View tabs */}
      <div className="flex gap-1 border-b border-surface-border px-2 py-2">
        {VIEWS.map((v) => {
          const active = view === v.key
          const count = tasks.filter((t) => t.list === v.key && !t.completed).length
          return (
            <button
              key={v.key}
              type="button"
              onClick={() => setView(v.key)}
              className={[
                'flex-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold transition-all duration-200 active:scale-95',
                active
                  ? 'bg-brand-50 text-brand-700 shadow-sm'
                  : 'text-slate-500 hover:-translate-y-0.5 hover:bg-surface-muted hover:text-slate-700'
              ].join(' ')}
            >
              {v.label.split(' ')[0]}
              {count > 0 && <span className="ml-1 text-slate-400">{count}</span>}
            </button>
          )
        })}
      </div>

      {/* Quick add */}
      <div className="border-b border-surface-border px-3 py-2.5">
        <div className="flex items-center gap-1.5 rounded-lg border border-surface-border px-2 transition-all duration-200 focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-100">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit()
            }}
            placeholder={VIEWS.find((v) => v.key === view)?.hint}
            className="flex-1 bg-transparent py-1.5 text-sm text-slate-800 outline-none placeholder:text-slate-400"
          />
          <button
            type="button"
            onClick={submit}
            aria-label="Add task"
            className="flex h-6 w-6 items-center justify-center rounded-md text-brand-600 transition-all duration-200 hover:scale-110 hover:bg-brand-50 active:scale-90 disabled:opacity-40"
            disabled={!draft.trim()}
          >
            <PlusIcon width={16} height={16} />
          </button>
        </div>
      </div>

      {/* Task list */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2.5">
        {visible.length === 0 ? (
          <p className="mt-6 text-center text-xs text-slate-400">Nothing here yet.</p>
        ) : (
          <ul className="space-y-1">
            {visible.map((task, i) => (
              <li
                key={task.id}
                style={{ animationDelay: `${i * 35}ms` }}
                className="group flex animate-slide-up items-start gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-surface-muted"
              >
                <button
                  type="button"
                  onClick={() => onToggle(task.id)}
                  aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
                  className={[
                    'mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition-all duration-200 active:scale-75',
                    task.completed
                      ? 'animate-check-pop border-brand-600 bg-brand-600 text-white'
                      : 'border-slate-300 text-transparent hover:scale-110 hover:border-brand-400'
                  ].join(' ')}
                >
                  <CheckIcon />
                </button>
                <span
                  className={[
                    'flex-1 break-words text-sm leading-snug transition-all duration-200',
                    task.completed ? 'text-slate-400 line-through' : 'text-slate-700'
                  ].join(' ')}
                >
                  {task.text}
                </span>
                <button
                  type="button"
                  onClick={() => onRemove(task.id)}
                  aria-label="Delete task"
                  className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-slate-300 opacity-0 transition-all duration-200 hover:scale-110 hover:text-red-500 group-hover:opacity-100"
                >
                  <TrashIcon width={13} height={13} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Footer summary */}
      <div className="border-t border-surface-border px-4 py-2.5">
        <p className="text-[11px] text-slate-400">
          {remaining === 0 ? 'All caught up 🎉' : `${remaining} remaining`}
        </p>
      </div>
    </aside>
  )
}