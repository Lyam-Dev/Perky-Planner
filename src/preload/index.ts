import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/types'
import type { CalendarApi, EventInput, TaskInput } from '../shared/types'

/**
 * The typed API exposed to the renderer via contextBridge. Keeping the
 * surface minimal and explicit preserves context isolation while offering
 * the renderer full CRUD access to events and tasks.
 */
const api: CalendarApi = {
  events: {
    list: () => ipcRenderer.invoke(IPC.EVENTS_LIST),
    listByDate: (date: string) => ipcRenderer.invoke(IPC.EVENTS_LIST_BY_DATE, date),
    listByRange: (start: string, end: string) =>
      ipcRenderer.invoke(IPC.EVENTS_LIST_BY_RANGE, start, end),
    create: (input: EventInput) => ipcRenderer.invoke(IPC.EVENTS_CREATE, input),
    update: (id: number, input: EventInput) => ipcRenderer.invoke(IPC.EVENTS_UPDATE, id, input),
    remove: (id: number) => ipcRenderer.invoke(IPC.EVENTS_REMOVE, id)
  },
  tasks: {
    list: () => ipcRenderer.invoke(IPC.TASKS_LIST),
    create: (input: TaskInput) => ipcRenderer.invoke(IPC.TASKS_CREATE, input),
    update: (id: number, input: Partial<TaskInput>) =>
      ipcRenderer.invoke(IPC.TASKS_UPDATE, id, input),
    toggle: (id: number) => ipcRenderer.invoke(IPC.TASKS_TOGGLE, id),
    remove: (id: number) => ipcRenderer.invoke(IPC.TASKS_REMOVE, id)
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
