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
const path = require('node:path')

/** context.appOutDir is <dist>/mac[-arch]; the bundle sits directly inside it. */
function findAppBundle(appOutDir) {
  if (!appOutDir || !fs.existsSync(appOutDir)) return null
  const entry = fs.readdirSync(appOutDir).find((name) => name.endsWith('.app'))
  return entry ? path.join(appOutDir, entry) : null
}

/**
 * Verifies the bundle, re-signing ad-hoc only when it does not already verify.
 * Throws if it still fails, so an app Squirrel would refuse can never ship.
 */
function sealIfNeeded(appPath) {
  const verify = () =>
    execFileSync('codesign', ['--verify', '--deep', '--strict', appPath], { stdio: 'pipe' })

  try {
    verify()
    console.log(`ad-hoc-sign-mac: ${path.basename(appPath)} already has a valid signature`)
    return
  } catch {
    // Expected for unsigned CI builds: seal it below.
  }

  console.log(`ad-hoc-sign-mac: sealing ${path.basename(appPath)} ad-hoc`)
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], { stdio: 'inherit' })

  try {
    verify()
  } catch (error) {
    console.error('ad-hoc-sign-mac: signature still invalid after ad-hoc signing')
    console.error(String(error.stdout || error.message))
    throw new Error('ad-hoc signing failed')
  }
  console.log('ad-hoc-sign-mac: signature valid')
}

module.exports = async function afterPack(context) {
  const appPath = findAppBundle(context?.appOutDir)
  if (!appPath) {
    console.log('ad-hoc-sign-mac: no .app bundle found, skipping')
    return
  }
  sealIfNeeded(appPath)
}


