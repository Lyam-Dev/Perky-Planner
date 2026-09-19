import { BrowserWindow } from 'electron'
import type { UpdateInfo } from '../shared/types'

/**
 * Auto-update orchestration built on `electron-updater`.
 *
 * `electron-updater` is loaded lazily so the module (and its network stack)
 * is never pulled in during development, where no signed release exists.
 * Every state change is broadcast to the renderer, which renders the banner.
 */

/** The most recent update state, replayed to renderers that connect late. */
let lastInfo: UpdateInfo = { status: 'idle' }

/** Lazily resolved `electron-updater` module, or null when unavailable. */
type AutoUpdater = typeof import('electron-updater').autoUpdater
let updater: AutoUpdater | null = null
let wired = false

/** Sends the update state to every open window. */
function broadcast(info: UpdateInfo): void {
  lastInfo = info
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send('updates:event', info)
  }
}

/** Loads `electron-updater` on first use and attaches lifecycle listeners. */
function getUpdater(): AutoUpdater | null {
  if (updater) return updater
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { autoUpdater } = require('electron-updater') as typeof import('electron-updater')
    updater = autoUpdater
  } catch {
    return null
  }

  if (!wired) {
    wired = true
    updater.autoDownload = true
    updater.autoInstallOnAppQuit = true
    updater.logger = null

    updater.on('checking-for-update', () => broadcast({ status: 'checking' }))
    updater.on('update-available', (info) =>
      broadcast({ status: 'available', version: info?.version })
    )
    updater.on('update-not-available', () => broadcast({ status: 'not-available' }))
    updater.on('download-progress', (progress) =>
      broadcast({ status: 'downloading', percent: Math.round(progress?.percent ?? 0) })
    )
    updater.on('update-downloaded', (info) =>
      broadcast({ status: 'downloaded', version: info?.version })
    )
    updater.on('error', (error) =>
      broadcast({ status: 'error', message: String(error?.message ?? error) })
    )
  }

  return updater
}

/**
 * Checks GitHub releases for a newer build. In development there is no
 * published release to compare against, so the call resolves immediately with
 * a not-available state rather than surfacing a confusing network error.
 */
export async function checkForUpdates(): Promise<UpdateInfo> {
  const instance = getUpdater()
  if (!instance) {
    broadcast({
      status: 'error',
      message: 'Update support is unavailable in this build.'
    })
    return lastInfo
  }

  try {
    broadcast({ status: 'checking' })
    await instance.checkForUpdates()
  } catch (error) {
    broadcast({
      status: 'error',
      message: error instanceof Error ? error.message : String(error)
    })
  }
  return lastInfo
}

/** The last known update state (used when a renderer first mounts). */
export function getUpdateState(): UpdateInfo {
  return lastInfo
}

/** Quits and installs a previously downloaded update. */
export function quitAndInstallUpdate(): void {
  if (updater && lastInfo.status === 'downloaded') {
    updater.quitAndInstall()
  }
}