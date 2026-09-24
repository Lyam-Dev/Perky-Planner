import { deflateRawSync, inflateRawSync } from 'zlib'
import type { CalendarSnapshot, ImportMode, ImportResult } from '../shared/types'
import { buildSnapshot, importSnapshot } from './db'

/**
 * Pairing-code share format.
 *
 * A snapshot is serialised to JSON, deflated with raw DEFLATE and encoded as
 * base64url, producing a compact, URL-safe, copy/pasteable string:
 *
 *   perky1:eJx1VW1v2zYQ...
 *
 * Encoding is lossless and deterministic enough for diffing; importing the
 * same code twice is a no-op thanks to the last-write-wins merge in `db.ts`.
 */

const PREFIX = 'perky1:'

/** Refuse absurd payloads before inflating them, to bound memory use. */
const MAX_ENCODED_BYTES = 64 * 1024 * 1024

/** Encodes any snapshot into a `perky1:` code. */
export function encodeSnapshotCode(snapshot: CalendarSnapshot): string {
  const json = JSON.stringify(snapshot)
  const deflated = deflateRawSync(Buffer.from(json, 'utf8'), { level: 9 })
  return PREFIX + deflated.toString('base64url')
}

/**
 * Validates the shape of a decoded payload. Returning a typed snapshot is not
 * enough on its own — the object arrives from outside the app, so every field
 * the database layer will touch is checked here.
 */
function isSnapshot(value: unknown): value is CalendarSnapshot {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<CalendarSnapshot>
  return (
    candidate.version === 1 &&
    Array.isArray(candidate.events) &&
    Array.isArray(candidate.tasks) &&
    Array.isArray(candidate.categories) &&
    Array.isArray(candidate.tombstones) &&
    // Deadlines are newer than the rest of the format: a code exported by the
    // original 1.0.0 build has no such key, and must still import. When the
    // key *is* present it has to be a real array, so a malformed payload is
    // still rejected rather than silently dropping every deadline.
    (candidate.deadlines === undefined || Array.isArray(candidate.deadlines))
  )
}

/**
 * Decodes a `perky1:` code (whitespace around it is tolerated, so pasted
 * codes that wrapped across lines still work).
 */
export function decodeSnapshotCode(code: string): CalendarSnapshot {
  const trimmed = code.trim()
  if (!trimmed.startsWith(PREFIX)) {
    throw new Error('That does not look like a Perky Planner code (expected a "perky1:" prefix).')
  }

  const payload = trimmed.slice(PREFIX.length).replace(/\s+/g, '')
  if (!payload) throw new Error('The code is empty.')

  let inflated: Buffer
  try {
    const raw = Buffer.from(payload, 'base64url')
    if (raw.byteLength > MAX_ENCODED_BYTES) throw new Error('too large')
    inflated = inflateRawSync(raw)
  } catch {
    throw new Error('The code could not be decoded — it may be truncated or corrupted.')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(inflated.toString('utf8'))
  } catch {
    throw new Error('The code contained invalid data.')
  }

  if (!isSnapshot(parsed)) {
    throw new Error('The code uses an unsupported format version.')
  }
  return parsed
}

/** Builds a share code for everything currently stored locally. */
export function exportSnapshotCode(): string {
  return encodeSnapshotCode(buildSnapshot())
}

/** Imports a share code using the requested conflict-resolution mode. */
export function importSnapshotCode(code: string, mode: ImportMode): ImportResult {
  return importSnapshot(decodeSnapshotCode(code), mode)
}