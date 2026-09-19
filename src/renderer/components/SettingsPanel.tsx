import { useState } from 'react'
import type { AppSettings, Category, CategoryInput } from '@shared/types'
import { CloseIcon, GearIcon, PaletteIcon, ShareIcon } from './Icons'
import { AppearanceTab } from './settings/AppearanceTab'
import { CategoriesTab } from './settings/CategoriesTab'
import { DataTab } from './settings/DataTab'

interface SettingsPanelProps {
  settings: AppSettings
  categories: Category[]
  onClose: () => void
  /** Persist a single setting (same signature as the bridge). */
  onChange: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<void>
  onCreateCategory: (input: CategoryInput) => Promise<unknown>
  onUpdateCategory: (id: string, input: CategoryInput) => Promise<unknown>
  onDeleteCategory: (id: string) => Promise<unknown>
}

type TabKey = 'appearance' | 'categories' | 'data'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'appearance', label: 'Appearance' },
  { key: 'categories', label: 'Categories' },
  { key: 'data', label: 'Sync & Updates' }
]

/**
 * Full-screen settings overlay with tabbed sections for appearance, category
 * management and pairing-code sync / app updates.
 */
export function SettingsPanel({
  settings,
  categories,
  onClose,
  onChange,
  onCreateCategory,
  onUpdateCategory,
  onDeleteCategory
}: SettingsPanelProps): JSX.Element {
  const [tab, setTab] = useState<TabKey>('appearance')

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-scrim/45 p-6 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Settings"
        onClick={(e) => e.stopPropagation()}
                className="glass-panel relative z-10 flex max-h-[85vh] w-full max-w-2xl animate-scale-in flex-col overflow-hidden rounded-2xl border border-surface-border shadow-2xl"
      >
        {/* Header */}
        <header className="flex items-center justify-between border-b border-surface-border px-5 py-3.5">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
              <GearIcon width={15} height={15} />
            </span>
            <h2 className="text-sm font-semibold text-content">Settings</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-content-subtle transition-all duration-200 hover:rotate-90 hover:bg-surface-muted hover:text-content-muted active:scale-90"
          >
            <CloseIcon />
          </button>
        </header>

        {/* Tabs */}
        <nav className="flex gap-1 border-b border-surface-border px-4 py-2">
          {TABS.map((t) => {
            const active = tab === t.key
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={[
                  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200',
                  active
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-content-muted hover:bg-surface-muted hover:text-content'
                ].join(' ')}
              >
                {t.key === 'appearance' && <PaletteIcon width={14} height={14} />}
                {t.key === 'data' && <ShareIcon width={14} height={14} />}
                {t.label}
              </button>
            )
          })}
        </nav>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {tab === 'appearance' && <AppearanceTab settings={settings} onChange={onChange} />}
          {tab === 'categories' && (
            <CategoriesTab
              categories={categories}
              onCreate={onCreateCategory}
              onUpdate={onUpdateCategory}
              onDelete={onDeleteCategory}
            />
          )}
          {tab === 'data' && <DataTab />}
        </div>
      </div>
    </div>
  )
}
