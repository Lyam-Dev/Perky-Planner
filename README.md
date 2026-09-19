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
