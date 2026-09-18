/**
 * Copies the 512px PNG produced by `npm run icons` into `resources/icon.png`,
 * which `src/main/index.ts` uses as the Linux runtime window/taskbar icon.
 *
 * Chained into the `icons` npm script so a single command refreshes every
 * icon artifact in the repo from `build/icon-source.png`.
 */
const fs = require('fs')
const path = require('path')

const src = path.join(__dirname, '..', 'build', 'icons', 'png', '512x512.png')
const dest = path.join(__dirname, '..', 'resources', 'icon.png')

fs.mkdirSync(path.dirname(dest), { recursive: true })
fs.copyFileSync(src, dest)
console.log(`copied ${src} -> ${dest}`)
