import { app, ipcMain } from 'electron'
import { IPC } from '../shared/types'
import type {
  AppSettings,
  CategoryInput,
  EventInput,
  ImportMode,
  TaskInput
} from '../shared/types'
import * as db from './db'
import { exportSnapshotCode, importSnapshotCode } from './share'
import { checkForUpdates, getUpdateState, quitAndInstallUpdate } from './updater'

/**
 * Registers all IPC handlers that bridge the renderer's typed API to the
 * SQLite persistence layer. Handlers are thin, synchronous wrappers except for
 * imports and update checks, which are genuinely asynchronous.
 */
export function registerIpcHandlers(): void {
  // --- Events -------------------------------------------------------------
  ipcMain.handle(IPC.EVENTS_LIST, () => db.listEvents())
  ipcMain.handle(IPC.EVENTS_LIST_BY_DATE, (_e, date: string) => db.listEventsByDate(date))
  ipcMain.handle(IPC.EVENTS_LIST_BY_RANGE, (_e, start: string, end: string) =>
    db.listEventsByRange(start, end)
  )
  ipcMain.handle(IPC.EVENTS_CREATE, (_e, input: EventInput) => db.createEvent(input))
  ipcMain.handle(IPC.EVENTS_UPDATE, (_e, id: string, input: EventInput) =>
    db.updateEvent(id, input)
  )
  ipcMain.handle(IPC.EVENTS_REMOVE, (_e, id: string) => db.deleteEvent(id))

  // --- Tasks --------------------------------------------------------------
  ipcMain.handle(IPC.TASKS_LIST, () => db.listTasks())
  ipcMain.handle(IPC.TASKS_CREATE, (_e, input: TaskInput) => db.createTask(input))
  ipcMain.handle(IPC.TASKS_UPDATE, (_e, id: string, input: Partial<TaskInput>) =>
    db.updateTask(id, input)
  )
  ipcMain.handle(IPC.TASKS_TOGGLE, (_e, id: string) => db.toggleTask(id))
  ipcMain.handle(IPC.TASKS_REMOVE, (_e, id: string) => db.deleteTask(id))

  // --- Categories ---------------------------------------------------------
  ipcMain.handle(IPC.CATEGORIES_LIST, () => db.listCategories())
  ipcMain.handle(IPC.CATEGORIES_CREATE, (_e, input: CategoryInput) => db.createCategory(input))
  ipcMain.handle(IPC.CATEGORIES_UPDATE, (_e, id: string, input: CategoryInput) =>
    db.updateCategory(id, input)
  )
  ipcMain.handle(IPC.CATEGORIES_REMOVE, (_e, id: string) => db.deleteCategory(id))

  // --- Settings -----------------------------------------------------------
  ipcMain.handle(IPC.SETTINGS_GET_ALL, () => db.getSettings())
  ipcMain.handle(IPC.SETTINGS_SET, (_e, key: keyof AppSettings, value: AppSettings[keyof AppSettings]) =>
    db.setSetting(key, value)
  )

  // --- Share (pairing codes) ---------------------------------------------
  ipcMain.handle(IPC.SHARE_EXPORT, () => exportSnapshotCode())
  ipcMain.handle(IPC.SHARE_IMPORT, (_e, code: string, mode: ImportMode) =>
    importSnapshotCode(code, mode)
  )

  // --- Updates ------------------------------------------------------------
  ipcMain.handle(IPC.UPDATES_GET_VERSION, () => app.getVersion())
  ipcMain.handle(IPC.UPDATES_CHECK, async () => checkForUpdates())
  ipcMain.handle(IPC.UPDATES_QUIT_INSTALL, () => quitAndInstallUpdate())
  // Lets a freshly mounted renderer pick up state it may have missed.
  ipcMain.handle(IPC.UPDATES_STATE, () => getUpdateState())
}
