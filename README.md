# Perky Planner

A cross-platform desktop calendar application for **Windows**, **macOS** and **Linux**,
built with **Electron**, **React**, **TypeScript** and **Tailwind CSS**. Events and tasks
are stored locally in **SQLite** (`better-sqlite3`) so data persists across restarts.

## Features

### Dynamic perpetual calendar engine
- Accurate month grids for **any** month and year — past, present or future.
- Full leap-year handling via native `Date` arithmetic.
- Always renders a stable **6 x 7 (42-cell)** grid; days from adjacent months are shown
  dimmed so the layout never shifts.
- Navigate with previous/next month, previous/next **year**, or jump to **Today**.

### Event & important date management
- Click any day cell to open an interactive modal to **add, edit or delete** events.
- Each event supports a **title**, full **description/notes**.
- **Time frames**: all-day events, or custom start/end times (e.g. `9:00 AM – 10:30 AM`).
- **Color-coded categories**: Work, Personal, Important, Other.
- Event badges appear directly in the day cells with a `+N more` overflow indicator.

### Daily quick-task sidebar
- Persistent, **collapsible** sidebar for short tasks/to-dos.
- Quick entry with **Enter** to add, and checkbox toggles for completion.
- Three distinct views: **Today's Tasks**, **Upcoming** and **General Notes**.

### Cross-platform UI & architecture
- macOS: native traffic lights (`titleBarStyle: 'hiddenInset'`) with a draggable header.
- Windows: standard window frame with native window controls.
- Linux: packaged as **AppImage**, **deb** and **rpm** with a desktop entry and icons.
- Secure Electron setup: `contextIsolation: true`, `nodeIntegration: false`, and a typed
  `contextBridge` API as the only renderer-to-main surface.

### Motion & polish
- Staggered day-cell and event-chip entrances when the month changes.
- Bouncy modal pop-in, hover lift/rotate/scale micro-interactions on all buttons.
- Checkbox tick bounce in the task sidebar and a floating app logo.

## Project structure

```
.
├── electron.vite.config.ts        # electron-vite build config (main / preload / renderer)
├── electron-builder.yml           # cross-platform packaging (dmg/zip + nsis)
├── tailwind.config.js
├── postcss.config.js
├── tsconfig.json                  # references the two project configs
├── tsconfig.node.json             # main + preload + shared
├── tsconfig.web.json              # renderer
├── build/
│   └── entitlements.mac.plist
└── src/
    ├── main/
    │   ├── index.ts               # app lifecycle, BrowserWindow, OS frame handling
    │   ├── db.ts                  # SQLite init, schema, events + tasks CRUD
    │   └── ipc.ts                 # ipcMain handlers bridging renderer -> database
    ├── preload/
    │   ├── index.ts               # contextBridge exposure of the typed API
    │   └── index.d.ts             # global Window typings
    ├── shared/
    │   └── types.ts               # domain types + IPC channel constants
    └── renderer/
        ├── index.html
        ├── main.tsx               # React root
        ├── App.tsx                # app shell wiring everything together
        ├── index.css              # Tailwind layers + scrollbar styling
        ├── lib/
        │   └── dateEngine.ts      # perpetual calendar grid + formatting utilities
        ├── hooks/
        │   ├── useEvents.ts       # reactive events state (CRUD)
        │   └── useTasks.ts        # reactive tasks state (CRUD)
        └── components/
            ├── CalendarGrid.tsx   # 6x7 grid, month/year navigation, Today
            ├── DayCell.tsx        # single day cell with event badges
            ├── EventModal.tsx     # create/edit/delete event form
            ├── TaskSidebar.tsx    # collapsible task sidebar with 3 views
            └── Icons.tsx          # dependency-free inline SVG icon set
```

## Data model

Stored at `app.getPath('userData')/calendar.db`.

**events**

| column | type | notes |
| --- | --- | --- |
| `id` | INTEGER | primary key |
| `title` | TEXT | required |
| `description` | TEXT | notes/details |
| `date` | TEXT | `YYYY-MM-DD` (indexed) |
| `all_day` | INTEGER | `0`/`1` |
| `start_time` / `end_time` | TEXT | `HH:mm`, `NULL` when all-day |
| `category` | TEXT | `work` \| `personal` \| `important` \| `other` |
| `color` | TEXT | hex color used for the badge |
| `created_at` / `updated_at` | TEXT | ISO timestamps |

**tasks**

| column | type | notes |
| --- | --- | --- |
| `id` | INTEGER | primary key |
| `text` | TEXT | required |
| `completed` | INTEGER | `0`/`1` |
| `list` | TEXT | `today` \| `upcoming` \| `notes` (indexed) |
| `due_date` | TEXT | optional `YYYY-MM-DD` (indexed) |
| `created_at` | TEXT | ISO timestamp |

## Getting started

```bash
npm install          # also rebuilds better-sqlite3 against Electron's ABI
npm run dev          # launch the app with hot reload
```

### Scripts

| script | description |
| --- | --- |
| `npm run dev` | run in development with HMR |
| `npm run build` | compile main, preload and renderer into `out/` |
| `npm start` | preview the production build |
| `npm run typecheck` | typecheck both the Node and web projects |
| `npm run rebuild` | manually rebuild the native `better-sqlite3` module |
| `npm run build:mac` | package a macOS `.dmg` + `.zip` |
| `npm run build:win` | package a Windows NSIS installer |
| `npm run build:linux` | package Linux `AppImage` + `deb` + `rpm` |
| `npm run build:all` | package for all three platforms |

Packaged installers are written to `dist/`.

### Requirements

- Node.js 18+
- A C++ toolchain for building `better-sqlite3`:
  - macOS: Xcode Command Line Tools (`xcode-select --install`)
  - Windows: Visual Studio Build Tools
  - Linux: `build-essential`, `python3`, `libnss3`, `libatk1.0-0`, `libgtk-3-0`
    (runtime libs for Electron) and `rpm`/`dpkg` tooling only if packaging locally.
  `electron-builder install-app-deps` runs automatically after `npm install`.

## Linux specifics

- Install via `sudo dpkg -i perky-planner_1.0.0_amd64.deb`, `sudo rpm -i perky-planner-1.0.0.x86_64.rpm`
  or by making the `AppImage` executable and running it directly.
- The database lives under `~/.config/perky-planner/calendar.db`.
- A `.desktop` entry (`StartupWMClass: perky-planner`) is installed by the deb/rpm packages
  so the app integrates with GNOME, KDE and other desktop environments.

## Notes

- `better-sqlite3` is a native module. If you switch Electron versions, re-run
  `npm run rebuild`.
- The renderer never touches Node APIs directly; everything flows through the typed
  `window.calendar` bridge defined in `src/preload/index.ts`.