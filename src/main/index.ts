import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { initDatabase } from './db'
import { registerIpcHandlers } from './ipc'
import { checkForUpdates } from './updater'

const isMac = process.platform === 'darwin'

/** Resolves the app icon for platforms that use a per-window icon (Linux). */
function windowIcon(): string | undefined {
  if (process.platform !== 'linux') return undefined
  // In production the `resources/` folder is unpacked next to the app;
  // in development it lives at the project root.
  return is.dev
    ? join(app.getAppPath(), 'resources', 'icon.png')
    : join(process.resourcesPath, 'icon.png')
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    show: false,
    backgroundColor: '#f8fafc',
    // macOS: keep native traffic lights but hide the bar for a seamless look.
    // Windows/Linux: use a standard frame so native window controls work.
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    trafficLightPosition: isMac ? { x: 16, y: 18 } : undefined,
    frame: true,
    autoHideMenuBar: true,
    icon: windowIcon(),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer based on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  // Test/CI hook: allow redirecting the userData dir (where calendar.db
  // lives) via env var. macOS Electron ignores $HOME, so this is the only
  // reliable way to run the app against a scratch profile.
  const userDataOverride = process.env.PERKY_USER_DATA_DIR
  if (userDataOverride) app.setPath('userData', userDataOverride)

  // Set app user model id for windows
  electronApp.setAppUserModelId('com.perkyplanner.app')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Initialise local persistence and IPC before creating the window.
  initDatabase()
  registerIpcHandlers()

  createWindow()

  // Silently look for a newer published release once the window is up. Only
  // meaningful for packaged builds, so development stays quiet.
  if (app.isPackaged) {
    mainWindowReadyHook()
  }

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

/** Kicks off a background update check after the first paint. */
function mainWindowReadyHook(): void {
  const window = BrowserWindow.getAllWindows()[0]
  if (!window) return
  window.webContents.once('did-finish-load', () => {
    void checkForUpdates()
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
