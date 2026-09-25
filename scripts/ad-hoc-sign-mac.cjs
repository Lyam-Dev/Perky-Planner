/**
 * Re-signs the packaged macOS bundle ad-hoc after electron-builder packages it.
 *
 * CI has no signing certificate, so `mac.identity` is `null` and electron-builder
 * skips codesigning. That leaves the app carrying only the linker's partial
 * signature: valid in isolation, but with no sealed resource directory. When
 * Squirrel's ShipIt installs such a bundle it refuses it with
 *
 *   "code has no resources but signature indicates they must be present"
 *
 * so an in-app update downloads successfully and then fails to install. Signing
 * ad-hoc ("-") seals the entire bundle, which makes the update installable.
 *
 * Wired in as `afterPack` in electron-builder.yml, because electron-builder
 * skips `afterSign` entirely when it did not sign. Once a real Developer ID is
 * configured, electron-builder signs properly and this only verifies, so a
 * properly signed build is never downgraded to ad-hoc.
 */
const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

/** context.appOutDir is <dist>/mac[-arch]; the bundle sits directly inside it. */
function findAppBundle(appOutDir) {
  if (!appOutDir || !fs.existsSync(appOutDir)) return null
  const entry = fs.readdirSync(appOutDir).find((name) => name.endsWith('.app'))
  return entry ? path.join(appOutDir, entry) : null
}

/**
 * A build-specific designated requirement, e.g. a bare `cdhash H"..."`.
 *
 * Squirrel's ShipIt validates an incoming update against the *installed* app's
 * designated requirement, so a per-build cdhash means no new build can ever
 * replace the old one ("code failed to satisfy specified code requirement(s)").
 * Pinning the requirement to the bundle identifier makes it stable across
 * builds, so updates keep working. Written to a temp file because codesign's
 * --requirements takes a path.
 */
function designatedRequirement(appId) {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'perky-req-')), 'requirement.txt')
  fs.writeFileSync(file, `designated => identifier "${appId}"\n`)
  return file
}

/**
 * Verifies the bundle, re-signing ad-hoc only when it does not already verify,
 * and pins the designated requirement so future updates can replace it.
 * Throws if it still fails, so an app Squirrel would refuse can never ship.
 */
function sealIfNeeded(appPath, appId) {
  const verify = () =>
    execFileSync('codesign', ['--verify', '--deep', '--strict', appPath], { stdio: 'pipe' })

  try {
    verify()
    console.log(`ad-hoc-sign-mac: ${path.basename(appPath)} already has a valid signature`)
    return
  } catch {
    // Expected for unsigned CI builds: seal it below.
  }

  // Sign in two steps. `--deep` re-seals every nested helper/framework, but
  // passing --requirements together with --deep applies the requirement to the
  // nested code too and leaves the bundle unverifiable ("nested code is modified
  // or invalid"). Sealing first and applying the requirement to the outer bundle
  // afterwards keeps the nested seals intact and sets a stable DR.
  console.log(`ad-hoc-sign-mac: sealing ${path.basename(appPath)} ad-hoc`)
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], { stdio: 'inherit' })
  execFileSync(
    'codesign',
    ['--force', '--sign', '-', '--requirements', designatedRequirement(appId), appPath],
    { stdio: 'inherit' }
  )

  try {
    verify()
  } catch (error) {
    console.error('ad-hoc-sign-mac: signature still invalid after ad-hoc signing')
    console.error(String(error.stdout || error.message))
    throw new Error('ad-hoc signing failed')
  }

  // A cdhash-based requirement would silently make the next update fail, so
  // confirm the requirement is the stable one before shipping.
  const dr = execFileSync('codesign', ['-d', '-r-', appPath], { stdio: 'pipe', encoding: 'utf8' })
    .trim()
    .split('\n')
    .pop()
  console.log(`ad-hoc-sign-mac: signature valid (${dr})`)
  if (/cdhash/.test(dr)) {
    throw new Error(`ad-hoc signing left a build-specific requirement: ${dr}`)
  }
}

module.exports = async function afterPack(context) {
  const appPath = findAppBundle(context?.appOutDir)
  if (!appPath) {
    console.log('ad-hoc-sign-mac: no .app bundle found, skipping')
    return
  }
  // appId matches electron-builder's `appId`, which is also the bundle
  // identifier electron-builder stamps into Info.plist.
  sealIfNeeded(appPath, context?.packager?.appInfo?.id || 'com.perkyplanner.app')
}


