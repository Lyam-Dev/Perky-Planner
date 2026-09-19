# Perky Planner

A modern, cross-platform perpetual calendar and task management application built with Electron, React, TypeScript, and Tailwind CSS for Windows, macOS, and Linux. Perky Planner provides a streamlined experience for managing events, organizing daily tasks, customizing workflows, and keeping data safely stored locally using SQLite.

---

## Overview

Perky Planner is designed to simplify schedule management while providing powerful planning tools for both everyday users and power planners. It combines a modern, motion-driven user interface with reliable local data persistence, custom event categories, flexible themes, and built-in export and import tools.

---

## Features

### Calendar Engine
* Dynamic perpetual calendar grid for any past, present, or future month and year
* Full leap-year handling powered by native `Date` arithmetic
* Stable 6x7 (42-cell) grid with adjacent month days dimmed for consistent layouts
* Navigation by previous/next month, previous/next year, or instant jump to Today

### Event & Date Management
* Interactive event creation, editing, and deletion modal
* Detailed event notes and time-frame support (all-day or custom start/end times)
* Color-coded category presets with day-cell badges and overflow indicators (`+N more`)

### Daily Task Sidebar
* Persistent, collapsible sidebar for quick-entry to-dos
* Three distinct views: Today's Tasks, Upcoming, and General Notes
* Enter-to-add entry and checkbox completion toggles

### User Experience & Customization
* Five built-in themes (Light, Dark, Midnight, Neon, Sand) and five accent colors
* Adjustable glass-intensity slider and week-start toggle (Sunday/Monday)
* Custom event categories with configurable labels and color presets
* Instant undo (`⌘Z` / `Ctrl+Z`) for event, task, and category modifications
* Smooth entrance animations, bouncy modals, and micro-interactions

### Data & Synchronization
* Local-first persistence powered by SQLite (`better-sqlite3`)
* Compact share code export/import (`perky1:`) with conflict-resolution merging
* Automatic update checks through GitHub Releases
* Tombstone tracking to ensure deleted items stay deleted across devices

---

## Installation

> **Note**  
> Perky Planner is currently not code signed. Your operating system may display a security warning during the first launch. This is expected and simply indicates that the application has not yet been signed with a developer certificate.

### Windows
1. Download `Perky Planner Setup x.x.x.exe` from the latest release.
2. Run the installer.
3. If Windows SmartScreen appears, select **More info**.
4. Click **Run anyway**.
5. Complete the installation process.

### macOS
1. Download the `.dmg` from the latest release.
2. Open the downloaded file.
3. Drag `Perky Planner.app` into the Applications folder.
4. Open Terminal and run the following command to clear the quarantine attribute:
   ```bash
   xattr -c /Applications/Perky\ Planner.app
   ```
5. Launch Perky Planner from your Applications folder or Spotlight.

### Linux
1. Download the `.AppImage` from the latest release.
2. Make the file executable:
   ```bash
   chmod +x Perky-Planner-*.AppImage
   ```
3. Run the application:
   ```bash
   ./Perky-Planner-*.AppImage
   ```

---

## Getting Started

### Requirements
* Node.js 18 or later
* npm
* C++ toolchain for native modules (`better-sqlite3`):
  * **macOS:** Xcode Command Line Tools (`xcode-select --install`)
  * **Windows:** Visual Studio Build Tools
  * **Linux:** `build-essential`, `python3`, `libnss3`, `libatk1.0-0`, `libgtk-3-0`

### Development
```bash
git clone https://github.com/YOUR_USERNAME/PerkyPlanner.git
cd PerkyPlanner

npm install
npm run dev
```

### Building
```bash
# Compile main, preload, and renderer processes
npm run build

# Build for specific platforms
npm run build:mac     # Package macOS .dmg and .zip
npm run build:win     # Package Windows NSIS installer
npm run build:linux   # Package Linux AppImage, deb, and rpm
npm run build:all     # Build for all supported platforms
```

Build artifacts are generated in the `dist/` directory.

### Releasing
Create and push a semantic version tag:

```bash
git tag v1.0.0
git push origin v1.0.0
```

The release workflow will automatically build supported platform packages and publish them to GitHub Releases.

---

## Project Structure

```
PerkyPlanner/
├── src/
│   ├── main/
│   │   ├── index.ts
│   │   ├── db.ts
│   │   └── ipc.ts
│   ├── preload/
│   │   ├── index.ts
│   │   └── index.d.ts
│   ├── shared/
│   │   └── types.ts
│   └── renderer/
│       ├── index.html
│       ├── main.tsx
│       ├── App.tsx
│       ├── index.css
│       ├── lib/
│       │   └── dateEngine.ts
│       ├── hooks/
│       └── components/
├── build/
│   └── entitlements.mac.plist
├── electron.vite.config.ts
├── electron-builder.yml
├── package.json
└── .github/
    └── workflows/
        └── release.yml
```

---

## Technology

| Component | Technology |
| --- | --- |
| Runtime | Electron |
| Frontend | React + TypeScript |
| Styling | Tailwind CSS |
| Database | SQLite (`better-sqlite3`) |
| Build Tooling | electron-vite |
| Packaging | electron-builder |
| CI/CD | GitHub Actions |

---

## License

ISC License

Copyright © Lyam
