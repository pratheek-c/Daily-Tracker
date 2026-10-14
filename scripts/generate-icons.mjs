/**
 * Generates the PWA icon set.
 *
 * The artwork is authored once as an SVG document — the same crowned-cat mark
 * the app uses in its sidebar and empty states — and rasterised with `sharp`,
 * so the icons are rendered by a real SVG engine rather than hand-rolled maths.
 *
 * Run with `npm run icons`. Output goes to `public/icons/`.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const here = dirname(fileURLToPath(import.meta.url))
const publicDir = join(here, '..', 'public')
const iconsDir = join(publicDir, 'icons')
mkdirSync(iconsDir, { recursive: true })

const BLUSH = '#F8C8DC'
const LAVENDER = '#E8DDF8'
const WHITE = '#FFFFFF'
const INK = '#37313D'
const ROSE = '#F2A7C3'
const GOLD = '#F3D27A'

/**
 * The cat mark, drawn inside a 0-100 view box.
 *
 * `scale` shrinks the artwork around the centre so the maskable variant can
 * keep every important feature inside Android's circular safe zone.
 */
function catMark({ scale = 0.9 } = {}) {
  return `
    <g transform="translate(50 50) scale(${scale}) translate(-50 -50)">
      <!-- ears -->
      <path d="M24 54 L18 12 L54 40 Z" fill="${WHITE}" stroke="${ROSE}" stroke-width="2.4" stroke-linejoin="round" />
      <path d="M76 54 L82 12 L46 40 Z" fill="${WHITE}" stroke="${ROSE}" stroke-width="2.4" stroke-linejoin="round" />
      <path d="M28 47 L24 22 L49 39 Z" fill="${BLUSH}" />
      <path d="M72 47 L76 22 L51 39 Z" fill="${BLUSH}" />

      <!-- head -->
      <ellipse cx="50" cy="58" rx="30" ry="26" fill="${WHITE}" stroke="${ROSE}" stroke-width="2.4" />

      <!-- eyes -->
      <circle cx="39.5" cy="47.5" r="5" fill="${INK}" />
      <circle cx="60.5" cy="47.5" r="5" fill="${INK}" />
      <circle cx="41.4" cy="44.4" r="1.8" fill="${WHITE}" />
      <circle cx="62.4" cy="44.4" r="1.8" fill="${WHITE}" />

      <!-- cheeks -->
      <ellipse cx="28.6" cy="66.5" rx="5.6" ry="3.6" fill="${BLUSH}" />
      <ellipse cx="71.4" cy="66.5" rx="5.6" ry="3.6" fill="${BLUSH}" />

      <!-- nose and smile -->
      <path d="M46.8 63.5 L53.2 63.5 L50 68.5 Z" fill="${ROSE}" />
      <path d="M45 72 Q50 76 55 72" fill="none" stroke="${INK}" stroke-width="1.8" stroke-linecap="round" opacity="0.5" />

      <!-- crown, sitting on the forehead -->
      <path
        d="M38 33 L43.5 17 L50.5 32 L57.5 16 L62 33 Z"
        fill="${GOLD}"
        stroke="#DCB25A"
        stroke-width="1.4"
        stroke-linejoin="round"
      />
      <circle cx="50.5" cy="17.5" r="2" fill="${ROSE}" />
    </g>
  `
}

/** Full square icon: pastel gradient tile with rounded corners plus the mark. */
function tileSvg(size, { inset = 0.05 } = {}) {
  const radius = size * 0.22
  // Inset is expressed as a fraction of the design box, matching `catMark`.
  const scale = Math.max(0.1, 1 - inset * 2)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${BLUSH}" />
      <stop offset="100%" stop-color="${LAVENDER}" />
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="url(#bg)" />
  <svg x="0" y="0" width="${size}" height="${size}" viewBox="0 0 100 100">
    ${catMark({ scale })}
  </svg>
</svg>`
}

/** Full-bleed icon for maskable use: the platform supplies its own crop shape. */
function maskableSvg(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${BLUSH}" />
      <stop offset="100%" stop-color="${LAVENDER}" />
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${size}" height="${size}" fill="url(#bg)" />
  <svg x="0" y="0" width="${size}" height="${size}" viewBox="0 0 100 100">
    ${catMark({ scale: 0.68 })}
  </svg>
</svg>`
}

/* -------------------------------------------------------------------------- */
/* Write the assets                                                           */
/* -------------------------------------------------------------------------- */

const targets = [
  { file: 'icon-192.png', size: 192, svg: tileSvg(192, { inset: 0.05 }) },
  { file: 'icon-512.png', size: 512, svg: tileSvg(512, { inset: 0.05 }) },
  { file: 'icon-maskable-512.png', size: 512, svg: maskableSvg(512) },
  { file: 'apple-touch-icon.png', size: 180, svg: tileSvg(180, { inset: 0.05 }) },
  { file: 'favicon-32.png', size: 32, svg: tileSvg(32, { inset: 0.02 }) },
]

for (const target of targets) {
  const png = await sharp(Buffer.from(target.svg), { density: 384 })
    .resize(target.size, target.size)
    .png({ compressionLevel: 9 })
    .toBuffer()
  writeFileSync(join(iconsDir, target.file), png)
  console.log(`wrote public/icons/${target.file} (${target.size}px, ${png.length} bytes)`)
}

// The scalable master, used by the browser tab and by anyone who wants the
// artwork without a raster copy.
const masterSvg = tileSvg(512, { inset: 0.05 }).replace(
  'width="512" height="512"',
  'width="512" height="512" role="img"',
)
writeFileSync(join(publicDir, 'favicon.svg'), masterSvg)
console.log('wrote public/favicon.svg')
