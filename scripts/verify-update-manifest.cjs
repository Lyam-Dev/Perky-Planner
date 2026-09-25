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

// A mac bundle that does not verify can never be installed by ShipIt, no matter
// how good the download was, so check the real bundle the zip contains.
if (present.has('latest-mac.yml')) {
  const { execFileSync } = require('node:child_process')
  const os = require('node:os')
  const zip = fs
    .readFileSync(path.join(distDir, 'latest-mac.yml'), 'utf8')
    .match(/^\s*-?\s*url:\s*(.+\.zip)$/m)
  const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'perky-verify-'))
  try {
    if (zip) {
      execFileSync('unzip', ['-q', path.join(distDir, zip[1].trim()), '-d', staging], { stdio: 'pipe' })
      const appEntry = fs.readdirSync(staging).find((n) => n.endsWith('.app'))
      const appDir = appEntry ? path.join(staging, appEntry) : null
      let valid = false
      let detail = ''
      if (appDir) {
        try {
          execFileSync('codesign', ['--verify', '--deep', '--strict', appDir], { stdio: 'pipe' })
          valid = true
        } catch (error) {
          detail = String(error.stderr || error.message).trim().split('\n').pop()
        }
      } else {
        detail = 'no .app bundle inside the zip'
      }
      check('the mac bundle in the zip passes codesign', valid, true)
      if (!valid) console.log(`        ${detail}`)

      // ShipIt validates the incoming update against the *installed* app's
      // designated requirement. A build-specific requirement (a bare cdhash)
      // changes every build, so no future update could ever replace the app it
      // shipped from — it fails with "code failed to satisfy specified code
      // requirement(s)". Require a stable, identifier-based one instead.
      if (appDir) {
        let dr = ''
        try {
          dr = execFileSync('codesign', ['-d', '-r-', appDir], {
            stdio: 'pipe',
            encoding: 'utf8'
          })
            .trim()
            .split('\n')
            .pop()
        } catch {
          dr = '(could not be read)'
        }
        const stable = /identifier\s+"/.test(dr) && !/cdhash/.test(dr)
        check('the mac bundle has a stable (non-cdhash) requirement', stable, true)
        if (!stable) console.log(`        designated requirement: ${dr}`)
      }
    }
  } finally {
    fs.rmSync(staging, { recursive: true, force: true })
  }
}

console.log('=== SUMMARY ===')
console.log(`PASSED ${passed} FAILED ${failed}`)
process.exit(failed ? 1 : 0)
