import { ipcMain } from 'electron'
import { IPC } from '../shared/types'
import type { EventInput, TaskInput } from '../shared/types'
import * as db from './db'

/**
 * Registers all IPC handlers that bridge the renderer's typed API to the
 * SQLite persistence layer. Each handler is a thin, synchronous wrapper.
 */
export function registerIpcHandlers(): void {
  // --- Events -------------------------------------------------------------
  ipcMain.handle(IPC.EVENTS_LIST, () => db.listEvents())
  ipcMain.handle(IPC.EVENTS_LIST_BY_DATE, (_e, date: string) => db.listEventsByDate(date))
  ipcMain.handle(IPC.EVENTS_LIST_BY_RANGE, (_e, start: string, end: string) =>
    db.listEventsByRange(start, end)
  )
  ipcMain.handle(IPC.EVENTS_CREATE, (_e, input: EventInput) => db.createEvent(input))
  ipcMain.handle(IPC.EVENTS_UPDATE, (_e, id: number, input: EventInput) =>
    db.updateEvent(id, input)
  )
  ipcMain.handle(IPC.EVENTS_REMOVE, (_e, id: number) => db.deleteEvent(id))

  // --- Tasks --------------------------------------------------------------
  ipcMain.handle(IPC.TASKS_LIST, () => db.listTasks())
  ipcMain.handle(IPC.TASKS_CREATE, (_e, input: TaskInput) => db.createTask(input))
  ipcMain.handle(IPC.TASKS_UPDATE, (_e, id: number, input: Partial<TaskInput>) =>
    db.updateTask(id, input)
  )
  ipcMain.handle(IPC.TASKS_TOGGLE, (_e, id: number) => db.toggleTask(id))
  ipcMain.handle(IPC.TASKS_REMOVE, (_e, id: number) => db.deleteTask(id))
}
