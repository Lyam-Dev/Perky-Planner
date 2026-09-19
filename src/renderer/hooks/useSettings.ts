import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_SETTINGS, normalizeGlassIntensity, type AppSettings } from '@shared/types'

/**
 * Reactive access to persisted app settings plus the DOM side-effect of
 * applying the chosen theme/accent to the document root so every Tailwind
 * utility reading the CSS variables stays in sync.
 */
export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const all = await window.calendar.settings.getAll()
    setSettings({ ...DEFAULT_SETTINGS, ...all, glassIntensity: normalizeGlassIntensity(all.glassIntensity) })
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  /** Persist one setting and sync local state with the returned record. */
  const update = useCallback(
    async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
      const next = await window.calendar.settings.set(key, value)
      setSettings(next)
    },
    []
  )

  // Reflect theme + accent onto <html> so themes.css variables apply globally.
  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = settings.theme
    root.dataset.accent = settings.accent
    // `--glass-strength` (0–100) drives both the panel alpha and the blur
    // radius in themes.css, so the slider now controls both opacity and frost.
    root.style.setProperty('--glass-strength', String(settings.glassIntensity))
    // A single toggle attribute lets CSS disable the (expensive) blur outright
    // when the user slides glass all the way off, keeping things sharp.
    root.setAttribute('data-glass', settings.glassIntensity === 0 ? 'off' : 'on')
    const colorScheme = settings.theme === 'light' || settings.theme === 'sand' ? 'light' : 'dark'
    root.style.colorScheme = colorScheme
  }, [settings.theme, settings.accent, settings.glassIntensity])

  return { settings, loading, update }
}
