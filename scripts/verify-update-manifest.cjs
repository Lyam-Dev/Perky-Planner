#!/usr/bin/env node
/**
 * Guards the electron-updater feed against the failure that made auto-update
 * 404 on every macOS release: the zip written to `dist/` had a different name
 * than the `url` electron-builder recorded in `latest-mac.yml`.
 *
 * `mac.artifactName` exists precisely to pin those two together. If a future
 * config change lets them drift again, every installed client fails at the
 * download step, so this fails the build instead.
 *
 * Usage: node scripts/verify-update-manifest.cjs [distDir]
 */
const fs = require('node:fs')
const path = require('node:path')

const distDir = path.resolve(process.argv[2] || 'dist')

/** Channel manifest -> the artifact types that must exist for that platform. */
const CHANNELS = [
  { file: 'latest-mac.yml', exts: ['.zip', '.dmg'] },
  { file: 'latest.yml', exts: ['.exe'] },
  { file: 'latest-linux.yml', exts: ['.AppImage'] }
]

let passed = 0
let failed = 0

function check(label, actual, expected) {
  if (actual === expected) {
    passed++
    console.log(`PASS  ${label}`)
  } else {
    failed++
    console.log(`FAIL  ${label}\n        expected: ${expected}\n        actual:   ${actual}`)
  }
}

if (!fs.existsSync(distDir)) {
  console.log(`No build output at ${distDir}. Run "npm run build:mac" (or the matching target) first.`)
  process.exit(0)
}

const present = new Set(fs.readdirSync(distDir))

for (const { file, exts } of CHANNELS) {
  const manifestPath = path.join(distDir, file)
  if (!present.has(file)) {
    // The mac build only emits the mac channel, and vice versa, so a missing
    // channel is expected when packaging a single platform.
    console.log(`SKIP  ${file} (not produced by this build)`)
    continue
  }

  const manifest = fs.readFileSync(manifestPath, 'utf8')
  const urls = [...manifest.matchAll(/^\s*-?\s*url:\s*(.+)$/gm)].map((m) => m[1].trim())

  check(`${file} lists at least one file`, urls.length > 0, true)

  for (const url of urls) {
    // This is the assertion that matters: the updater requests exactly this
    // name, so a name with no matching file on disk is a guaranteed 404.
    check(`${file} -> ${url} exists in dist`, present.has(url), true)
  }

  for (const ext of exts) {
    check(
      `${file} references a ${ext} artifact`,
      urls.some((u) => u.endsWith(ext)),
      true
    )
  }

  // A macOS channel whose zip name contains a space-derived "." in the file but
  // a "-" in the manifest is the historical bug; keep both spellings identical
  // by construction and assert the manifest never names a productName default.
  if (file === 'latest-mac.yml') {
    const zip = urls.find((u) => u.endsWith('.zip'))
    if (zip) {
      check('mac zip name does not use the productName default', !/^Perky\.Planner/.test(zip), true)
    }
  }
}

console.log('=== SUMMARY ===')
console.log(`PASSED ${passed} FAILED ${failed}`)
process.exit(failed ? 1 : 0)
