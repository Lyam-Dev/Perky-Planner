import { ACCENT_PRESETS, THEME_PRESETS, normalizeGlassIntensity, type AppSettings } from '@shared/types'
import { CheckIcon } from '../Icons'

type ChangeSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<void>

/** Theme / accent / glass-intensity / layout preferences. */
export function AppearanceTab({
  settings,
  onChange
}: {
  settings: AppSettings
  onChange: ChangeSetting
}): JSX.Element {
  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-content-subtle">Theme</h3>
        <div className="grid grid-cols-5 gap-2">
          {THEME_PRESETS.map((t) => {
            const active = settings.theme === t.value
            return (
              <button
                key={t.value}
                type="button"
                title={t.hint}
                onClick={() => onChange('theme', t.value)}
                className={[
                  'flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 transition-all duration-200 hover:-translate-y-0.5',
                  active
                    ? 'border-brand-500 bg-brand-50 shadow-sm'
                    : 'border-surface-border hover:border-brand-300'
                ].join(' ')}
              >
                <span className={`h-8 w-full rounded-md ring-1 ring-inset ring-black/10 theme-swatch-${t.value}`} />
                <span
                  className={[
                    'text-[11px] font-medium',
                    active ? 'text-brand-700' : 'text-content-muted'
                  ].join(' ')}
                >
                  {t.label}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-content-subtle">Accent color</h3>
        <div className="flex gap-2">
          {ACCENT_PRESETS.map((a) => {
            const active = settings.accent === a.value
            return (
              <button
                key={a.value}
                type="button"
                title={a.label}
                onClick={() => onChange('accent', a.value)}
                className={[
                  'flex h-9 w-9 items-center justify-center rounded-full transition-all duration-200 hover:scale-110 active:scale-95',
                                    active ? 'ring-2 ring-offset-2 ring-brand-500' : 'ring-1 ring-content/15'
                ].join(' ')}
                style={{ backgroundColor: a.hex }}
              >
                {active && <CheckIcon width={14} height={14} className="text-brand-50" />}
              </button>
            )
          })}
        </div>
      </section>

      <section>
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-content-subtle">Glass intensity</h3>
          <span className="text-xs font-medium text-content-muted">{settings.glassIntensity}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={settings.glassIntensity}
          onChange={(e) => onChange('glassIntensity', normalizeGlassIntensity(Number(e.target.value)))}
          className="w-full accent-brand-600"
        />
        <p className="mt-1 text-[11px] text-content-subtle">Controls the translucency of panels and overlays.</p>
      </section>

      <section className="flex items-center justify-between rounded-xl border border-surface-border p-4">
        <div>
          <p className="text-sm font-medium text-content">Show task sidebar</p>
          <p className="text-[11px] text-content-subtle">Daily to-dos beside the calendar</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={settings.sidebarVisible}
          onClick={() => onChange('sidebarVisible', !settings.sidebarVisible)}
          className={[
            'relative h-6 w-11 rounded-full transition-colors duration-200',
            settings.sidebarVisible ? 'bg-brand-600' : 'bg-surface-border'
          ].join(' ')}
        >
          <span
            className={[
              'absolute top-0.5 h-5 w-5 rounded-full bg-surface shadow transition-all duration-200',
              settings.sidebarVisible ? 'left-[22px]' : 'left-0.5'
            ].join(' ')}
          />
        </button>
      </section>

      <section className="flex items-center justify-between rounded-xl border border-surface-border p-4">
        <p className="text-sm font-medium text-content">Week starts on</p>
        <div className="flex overflow-hidden rounded-lg border border-surface-border">
          {(['sunday', 'monday'] as const).map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => onChange('weekStart', w)}
              className={[
                'px-3 py-1.5 text-xs font-medium capitalize transition-colors',
                settings.weekStart === w
                  ? 'bg-brand-600 text-white'
                  : 'text-content-muted hover:bg-surface-muted'
              ].join(' ')}
            >
              {w}
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
