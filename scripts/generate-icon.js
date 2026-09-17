/**
 * Dependency-free PNG icon generator for Perky Planner.
 *
 * Draws a 512x512 RGBA icon entirely in software (no canvas / sharp needed):
 * an indigo gradient rounded square, a white calendar body with an indigo
 * header band, two binder rings and a week-dot grid. The output is written to
 * `build/icon.png` (used by electron-builder for AppImage/deb/rpm/ico/icns)
 * and `resources/icon.png` (used as the Linux window icon at runtime).
 */
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

const SIZE = 512
const px = new Uint8Array(SIZE * SIZE * 4) // RGBA, starts fully transparent

/** Source-over blend a pixel. */
function blend(x, y, r, g, b, a = 255) {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE || a <= 0) return
  const i = (y * SIZE + x) * 4
  const sa = a / 255
  const da = px[i + 3] / 255
  const oa = sa + da * (1 - sa)
  if (oa <= 0) return
  px[i] = Math.round((r * sa + px[i] * da * (1 - sa)) / oa)
  px[i + 1] = Math.round((g * sa + px[i + 1] * da * (1 - sa)) / oa)
  px[i + 2] = Math.round((b * sa + px[i + 2] * da * (1 - sa)) / oa)
  px[i + 3] = Math.round(oa * 255)
}

/** Signed-distance test for a rounded rectangle. */
function insideRoundedRect(x, y, x0, y0, x1, y1, r) {
  const cx = Math.max(x0 + r, Math.min(x, x1 - r))
  const cy = Math.max(y0 + r, Math.min(y, y1 - r))
  // Per-corner handling: clamp into the inner box, then measure distance.
  const dx = x < x0 + r ? x0 + r - x : x > x1 - r ? x - (x1 - r) : 0
  const dy = y < y0 + r ? y0 + r - y : y > y1 - r ? y - (y1 - r) : 0
  return dx * dx + dy * dy <= r * r && x >= x0 && x <= x1 && y >= y0 && y <= y1 && cx >= 0
}

function roundedRect(x0, y0, x1, y1, r, color, alpha = 255) {
  for (let y = Math.max(0, y0); y <= Math.min(SIZE - 1, y1); y++) {
    for (let x = Math.max(0, x0); x <= Math.min(SIZE - 1, x1); x++) {
      if (insideRoundedRect(x, y, x0, y0, x1, y1, r)) {
        blend(x, y, color[0], color[1], color[2], alpha)
      }
    }
  }
}

function circle(cx, cy, r, color, alpha = 255) {
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      const dx = x - cx
      const dy = y - cy
      if (dx * dx + dy * dy <= r * r) blend(x, y, color[0], color[1], color[2], alpha)
    }
  }
}

// --- Draw -----------------------------------------------------------------

// 1. Indigo gradient rounded-square background.
const BG_TOP = [124, 111, 247] // lighter indigo
const BG_BOTTOM = [67, 56, 202] // brand-800
const bgX0 = 16, bgY0 = 16, bgX1 = SIZE - 17, bgY1 = SIZE - 17, bgR = 104
for (let y = bgY0; y <= bgY1; y++) {
  const t = (y - bgY0) / (bgY1 - bgY0)
  const c = [
    Math.round(BG_TOP[0] + (BG_BOTTOM[0] - BG_TOP[0]) * t),
    Math.round(BG_TOP[1] + (BG_BOTTOM[1] - BG_TOP[1]) * t),
    Math.round(BG_TOP[2] + (BG_BOTTOM[2] - BG_TOP[2]) * t)
  ]
  for (let x = bgX0; x <= bgX1; x++) {
    if (insideRoundedRect(x, y, bgX0, bgY0, bgX1, bgY1, bgR)) blend(x, y, c[0], c[1], c[2])
  }
}

// 2. White calendar body.
const bodyX0 = 112, bodyY0 = 176, bodyX1 = 400, bodyY1 = 400
roundedRect(bodyX0, bodyY0, bodyX1, bodyY1, 28, [255, 255, 255])

// 3. Indigo header band (rounded on top only).
roundedRect(bodyX0, bodyY0, bodyX1, bodyY0 + 56, 28, [79, 70, 229])
// Square off the band's bottom corners by re-drawing its lower half as a rect.
for (let y = bodyY0 + 28; y <= bodyY0 + 56; y++) {
  for (let x = bodyX0; x <= bodyX1; x++) blend(x, y, 79, 70, 229)
}

// 4. Binder rings straddling the top edge.
circle(184, bodyY0, 17, [255, 255, 255])
circle(328, bodyY0, 17, [255, 255, 255])
circle(184, bodyY0, 7, [55, 48, 163]) // hole
circle(328, bodyY0, 7, [55, 48, 163])

// 5. Week-dot grid (first dot highlighted like "today").
const dotColor = [199, 210, 254] // brand-200
const accent = [79, 70, 229]
const cols = [152, 208, 264, 320, 376].slice(0, 4)
const rows = [280, 328, 372]
for (const ry of rows) {
  cols.forEach((cx, ci) => {
    const hi = ry === 280 && ci === 2
    roundedRect(cx - 13, ry - 13, cx + 13, ry + 13, 8, hi ? accent : dotColor)
  })
}

// --- Encode PNG -----------------------------------------------------------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const typeBuf = Buffer.from(type, 'ascii')
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])))
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(SIZE, 0)
ihdr.writeUInt32BE(SIZE, 4)
ihdr[8] = 8 // bit depth
ihdr[9] = 6 // colour type: RGBA
// compression / filter / interlace already zero

const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1))
for (let y = 0; y < SIZE; y++) {
  raw[y * (SIZE * 4 + 1)] = 0 // filter: none
  Buffer.from(px.buffer, y * SIZE * 4, SIZE * 4).copy(raw, y * (SIZE * 4 + 1) + 1)
}

const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0))
])

const buildPath = path.join(__dirname, '..', 'build', 'icon.png')
const resPath = path.join(__dirname, '..', 'resources', 'icon.png')
fs.mkdirSync(path.dirname(buildPath), { recursive: true })
fs.mkdirSync(path.dirname(resPath), { recursive: true })
fs.writeFileSync(buildPath, png)
fs.writeFileSync(resPath, png)
console.log(`wrote ${buildPath} and ${resPath} (${png.length} bytes)`)
