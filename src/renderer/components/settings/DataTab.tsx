import { useEffect, useState } from 'react'
import type { ImportResult, UpdateInfo } from '@shared/types'
import { DownloadIcon, ShareIcon, UploadIcon } from '../Icons'

/**
 * Data tab: pairing-code sharing (export / import) and in-app updates.
 * Talks to the preload bridge directly so the parent panel stays thin.
 */
export function DataTab(): JSX.Element {
  const [code, setCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [pasted, setPasted] = useState('')
  const [replace, setReplace] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [version, setVersion] = useState('')
  const [update, setUpdate] = useState<UpdateInfo | null>(null)

  useEffect(() => {
    window.calendar.updates.getVersion().then(setVersion)
    window.calendar.updates.getState().then(setUpdate).catch(() => undefined)
    return window.calendar.updates.onUpdate(setUpdate)
  }, [])

  const handleExport = async () => {
    setError(null)
    setCopied(false)
    try {
      setCode(await window.calendar.share.exportCode())
    } catch {
      setError('Could not export the calendar.')
    }
  }

  const handleCopy = async () => {
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Clipboard is unavailable — select the text and copy manually.')
    }
  }

  const handleImport = async () => {
    const text = pasted.trim()
    if (!text) return
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const summary = await window.calendar.share.importCode(text, replace ? 'replace' : 'merge')
      setResult(summary)
      setPasted('')
    } catch (e) {
      setError(
        e instanceof Error && e.message.includes('Unsupported')
          ? 'This code was created by a newer version of Perky Planner.'
          : 'That code could not be read. Copy it in full, starting with "perky1:".'
      )
    } finally {
      setBusy(false)
    }
  }

  const handleCheck = async () => {
    setUpdate({ status: 'checking' })
    try {
      setUpdate(await window.calendar.updates.checkForUpdates())
    } catch {
      setUpdate({ status: 'error', message: 'Update check failed.' })
    }
  }

  const downloadLabel: Record<UpdateInfo['status'], string> = {
    idle: 'Check for updates',
    checking: 'Checking…',
    available: 'Downloading…',
    downloading: 'Downloading…',
    downloaded: 'Restart to update',
    'not-available': 'You’re up to date',
    error: 'Check for updates'
  }

  return (
    <div className="space-y-6">
      {/* Export */}
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-content-subtle">Export</h3>
        <p className="mb-3 text-sm text-content-muted">
          Generate a pairing code containing your entire calendar — events, tasks, tags and
          settings. Paste it into Perky Planner on another device to sync.
        </p>
        {code === null ? (
          <button
            type="button"
            onClick={handleExport}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-700 active:translate-y-0"
          >
            <ShareIcon width={15} height={15} />
            Generate pairing code
          </button>
        ) : (
          <div className="space-y-2">
            <textarea
              readOnly
              value={code}
              onFocus={(e) => e.currentTarget.select()}
              rows={4}
              className="w-full resize-none rounded-lg border border-surface-border bg-surface-muted p-2.5 font-mono text-[11px] leading-relaxed text-content-muted outline-none"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1.5 rounded-lg border border-surface-border px-3 py-1.5 text-xs font-medium text-content-muted transition-colors hover:bg-surface-muted"
              >
                {copied ? 'Copied!' : 'Copy code'}
              </button>
              <button
                type="button"
                onClick={() => setCode(null)}
                className="rounded-lg px-2 py-1.5 text-xs text-content-subtle transition-colors hover:text-content-muted"
              >
                Hide
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Import */}
      <section className="border-t border-surface-border pt-5">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-content-subtle">Import</h3>
        <textarea
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          rows={3}
          placeholder="Paste a perky1: pairing code…"
          className="w-full resize-none rounded-lg border border-surface-border p-2.5 font-mono text-[11px] leading-relaxed text-content-muted outline-none transition-colors placeholder:font-sans placeholder:text-content-subtle focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
        />
        <label className="mt-2 flex items-center gap-2 text-xs text-content-muted">
          <input
            type="checkbox"
            checked={replace}
            onChange={(e) => setReplace(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-surface-border text-brand-600 focus:ring-brand-400"
          />
          Replace everything (otherwise changes merge in)
        </label>
        <button
          type="button"
          onClick={handleImport}
          disabled={busy || !pasted.trim()}
          className="mt-3 flex items-center gap-2 rounded-lg border border-surface-border px-4 py-2 text-sm font-semibold text-content-muted transition-all duration-200 hover:border-brand-300 hover:text-brand-700 disabled:opacity-40"
        >
          <UploadIcon width={15} height={15} />
          {busy ? 'Importing…' : replace ? 'Replace calendar' : 'Merge calendar'}
        </button>

        {result && (
          <div className="mt-3 animate-fade-in rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs leading-relaxed text-emerald-800">
            <p className="mb-1 font-semibold">
              {result.replaced ? 'Calendar replaced' : 'Import complete'}
            </p>
            <p>
              {result.eventsAdded} event{result.eventsAdded === 1 ? '' : 's'} ·{' '}
              {result.tasksAdded} task{result.tasksAdded === 1 ? '' : 's'} ·{' '}
              {result.deadlinesAdded} deadline{result.deadlinesAdded === 1 ? '' : 's'} added
            </p>
            <p>
              {result.eventsUpdated + result.tasksUpdated + result.deadlinesUpdated} updated ·{' '}
              {result.categoriesAdded + result.categoriesUpdated} tag changes
              {result.tombstonesApplied > 0 && ` · ${result.tombstonesApplied} deletions applied`}
            </p>
          </div>
        )}
        {error && (
          <p className="mt-3 animate-fade-in rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {error}
          </p>
        )}
      </section>

      {/* Updates */}
      <section className="border-t border-surface-border pt-5">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-content-subtle">Updates</h3>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-content-muted">
            Perky Planner v{version || '…'}
            {update?.version && update.status !== 'idle' && update.status !== 'error' && ` → v${update.version}`}
          </p>
          {update?.status === 'downloaded' ? (
            <button
              type="button"
              onClick={() => window.calendar.updates.quitAndInstall()}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition-all hover:bg-emerald-700"
            >
              <DownloadIcon width={14} height={14} />
              Restart to update
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCheck}
              disabled={update?.status === 'checking' || update?.status === 'downloading'}
              className="flex items-center gap-2 rounded-lg border border-surface-border px-3 py-1.5 text-xs font-medium text-content-muted transition-colors hover:bg-surface-muted disabled:opacity-40"
            >
              <DownloadIcon width={14} height={14} />
              {update ? downloadLabel[update.status] : 'Check for updates'}
            </button>
          )}
        </div>
        {update?.percent != null && update.status === 'downloading' && (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-muted">
            <div
              className="h-full rounded-full bg-brand-500 transition-all duration-300"
              style={{ width: `${Math.round(update.percent)}%` }}
            />
          </div>
        )}
        {update?.status === 'error' && update.message && (
          <p className="mt-2 text-xs text-red-500">{update.message}</p>
        )}
      </section>
    </div>
  )
}

