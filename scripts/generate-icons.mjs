#!/usr/bin/env node
// Genera los iconos de la PWA (PNG) sin dependencias externas, usando el
// codificador mínimo de PNG de node:zlib. Diseño: "V" de VeloLayer sobre
// degradado azul noche con un punto naranja (sol).
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PUBLIC_DIR = join(__dirname, '..', 'public')

// ---------- Codificador PNG mínimo (RGBA, sin compresión de filtros) ----------

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

/** pixels: Uint8Array RGBA (width*height*4) */
function encodePng(width, height, pixels) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0 // filtro: none
    Buffer.from(pixels.buffer, y * stride, stride).copy(raw, y * (stride + 1) + 1)
  }

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ---------- Dibujo ----------

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax
  const dy = by - ay
  const lenSq = dx * dx + dy * dy
  let t = lenSq === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  const cx = ax + t * dx
  const cy = ay + t * dy
  return Math.hypot(px - cx, py - cy)
}

function hex(c) {
  return [
    parseInt(c.slice(1, 3), 16),
    parseInt(c.slice(3, 5), 16),
    parseInt(c.slice(5, 7), 16),
  ]
}

const BG_TOP = hex('#0b1220')
const BG_BOTTOM = hex('#16213a')
const CYAN = hex('#38bdf8')
const ORANGE = hex('#f59e0b')

/**
 * @param {number} size lado del icono
 * @param {number} safe fracción del lienzo ocupada por el diseño (maskable: 0.62)
 */
function renderIcon(size, safe) {
  const px = new Uint8Array(size * size * 4)
  const c = size / 2
  const s = size * safe

  // Diseño normalizado a 512 y escalado.
  const k = size / 512
  const vLeftTop = [150 * k, 140 * k]
  const vBottom = [256 * k, 350 * k]
  const vRightTop = [362 * k, 140 * k]
  const thickness = 44 * k
  const dot = { x: 372 * k, y: 132 * k, r: 30 * k }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Fondo con degradado vertical.
      const f = y / (size - 1)
      let r = Math.round(BG_TOP[0] + (BG_BOTTOM[0] - BG_TOP[0]) * f)
      let g = Math.round(BG_TOP[1] + (BG_BOTTOM[1] - BG_TOP[1]) * f)
      let b = Math.round(BG_TOP[2] + (BG_BOTTOM[2] - BG_TOP[2]) * f)

      // Escala el diseño al área segura y lo centra.
      const dx = c + (x - c) * (s / size)
      const dy = c + (y - c) * (s / size)

      const d1 = distToSegment(dx, dy, vLeftTop[0], vLeftTop[1], vBottom[0], vBottom[1])
      const d2 = distToSegment(dx, dy, vBottom[0], vBottom[1], vRightTop[0], vRightTop[1])
      const inV = d1 <= thickness / 2 || d2 <= thickness / 2
      const inDot = Math.hypot(dx - dot.x, dy - dot.y) <= dot.r

      if (inV) {
        r = CYAN[0]
        g = CYAN[1]
        b = CYAN[2]
      } else if (inDot) {
        r = ORANGE[0]
        g = ORANGE[1]
        b = ORANGE[2]
      }

      const i = (y * size + x) * 4
      px[i] = r
      px[i + 1] = g
      px[i + 2] = b
      px[i + 3] = 255
    }
  }
  return encodePng(size, size, px)
}

const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0b1220"/>
      <stop offset="1" stop-color="#16213a"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="96" fill="url(#bg)"/>
  <path d="M150 140 L256 350 L362 140" fill="none" stroke="#38bdf8" stroke-width="44" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="372" cy="132" r="30" fill="#f59e0b"/>
</svg>
`

mkdirSync(PUBLIC_DIR, { recursive: true })

const outputs = [
  ['icon-192.png', renderIcon(192, 0.92)],
  ['icon-512.png', renderIcon(512, 0.92)],
  ['icon-maskable-512.png', renderIcon(512, 0.62)],
  ['apple-touch-icon.png', renderIcon(180, 0.86)],
]

for (const [name, buf] of outputs) {
  writeFileSync(join(PUBLIC_DIR, name), buf)
  console.log(`✔ ${name} (${buf.length} bytes)`)
}

writeFileSync(join(PUBLIC_DIR, 'favicon.svg'), FAVICON_SVG, 'utf8')
console.log('✔ favicon.svg')
