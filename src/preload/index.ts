import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/types'
import type {
  AppSettings,
  CalendarApi,
  CategoryInput,
  EventInput,
  ImportMode,
  TaskInput,
  UpdateInfo
} from '../shared/types'

/**
 * The typed API exposed to the renderer via contextBridge. Keeping the
 * surface minimal and explicit preserves context isolation while offering
 * the renderer full CRUD access to events, tasks, categories and settings.
 */
const api: CalendarApi = {
  events: {
    list: () => ipcRenderer.invoke(IPC.EVENTS_LIST),
    listByDate: (date: string) => ipcRenderer.invoke(IPC.EVENTS_LIST_BY_DATE, date),
    listByRange: (start: string, end: string) =>
      ipcRenderer.invoke(IPC.EVENTS_LIST_BY_RANGE, start, end),
    create: (input: EventInput) => ipcRenderer.invoke(IPC.EVENTS_CREATE, input),
    update: (id: string, input: EventInput) => ipcRenderer.invoke(IPC.EVENTS_UPDATE, id, input),
    remove: (id: string) => ipcRenderer.invoke(IPC.EVENTS_REMOVE, id)
  },
  tasks: {
    list: () => ipcRenderer.invoke(IPC.TASKS_LIST),
    create: (input: TaskInput) => ipcRenderer.invoke(IPC.TASKS_CREATE, input),
    update: (id: string, input: Partial<TaskInput>) =>
      ipcRenderer.invoke(IPC.TASKS_UPDATE, id, input),
    toggle: (id: string) => ipcRenderer.invoke(IPC.TASKS_TOGGLE, id),
    remove: (id: string) => ipcRenderer.invoke(IPC.TASKS_REMOVE, id)
  },
  categories: {
    list: () => ipcRenderer.invoke(IPC.CATEGORIES_LIST),
    create: (input: CategoryInput) => ipcRenderer.invoke(IPC.CATEGORIES_CREATE, input),
    update: (id: string, input: CategoryInput) =>
      ipcRenderer.invoke(IPC.CATEGORIES_UPDATE, id, input),
    remove: (id: string) => ipcRenderer.invoke(IPC.CATEGORIES_REMOVE, id)
  },
  settings: {
    getAll: () => ipcRenderer.invoke(IPC.SETTINGS_GET_ALL),
    set: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) =>
      ipcRenderer.invoke(IPC.SETTINGS_SET, key, value)
  },
  share: {
    exportCode: () => ipcRenderer.invoke(IPC.SHARE_EXPORT),
    importCode: (code: string, mode: ImportMode) =>
      ipcRenderer.invoke(IPC.SHARE_IMPORT, code, mode)
  },
  updates: {
    getVersion: () => ipcRenderer.invoke(IPC.UPDATES_GET_VERSION),
    checkForUpdates: () => ipcRenderer.invoke(IPC.UPDATES_CHECK),
    getState: () => ipcRenderer.invoke(IPC.UPDATES_STATE),
    quitAndInstall: () => ipcRenderer.invoke(IPC.UPDATES_QUIT_INSTALL),
    onUpdate: (cb: (info: UpdateInfo) => void) => {
      // Wrapped so the renderer never sees the raw IpcRendererEvent, and so
      // unsubscribing removes exactly the listener that was added.
      const listener = (_event: unknown, info: UpdateInfo): void => cb(info)
      ipcRenderer.on(IPC.UPDATES_EVENT, listener)
      return () => {
        ipcRenderer.removeListener(IPC.UPDATES_EVENT, listener)
      }
    }
  },
  platform: process.platform
}

// Use `contextBridge` APIs to expose Electron APIs to the renderer only if
// context isolation is enabled, otherwise just attach to the DOM.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('calendar', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.calendar = api
}
