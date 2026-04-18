/**
 * setup-vendor.mjs
 * Copies Live2D vendor files from node_modules and downloads Cubism Core.
 * Run automatically via postinstall, or manually: node scripts/setup-vendor.mjs
 */

import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { createWriteStream } from 'node:fs'
import { get } from 'node:https'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const vendorDir = join(root, 'public', 'vendor')

if (!existsSync(vendorDir)) {
  mkdirSync(vendorDir, { recursive: true })
}

// Copy from node_modules
const copies = [
  {
    src: join(root, 'node_modules', 'pixi.js', 'dist', 'browser', 'pixi.min.js'),
    dest: join(vendorDir, 'pixi.min.js'),
    label: 'pixi.min.js',
  },
  {
    src: join(root, 'node_modules', 'pixi-live2d-display', 'dist', 'cubism4.min.js'),
    dest: join(vendorDir, 'pixi-live2d-display.cubism4.min.js'),
    label: 'pixi-live2d-display.cubism4.min.js',
  },
]

for (const { src, dest, label } of copies) {
  if (existsSync(dest)) {
    console.log(`[vendor] ✓ ${label} (already exists)`)
    continue
  }
  if (!existsSync(src)) {
    console.warn(`[vendor] ✗ ${label} — source not found: ${src}`)
    continue
  }
  copyFileSync(src, dest)
  console.log(`[vendor] ✓ ${label} (copied from node_modules)`)
}

// Download Cubism Core from official CDN
const cubismDest = join(vendorDir, 'live2dcubismcore.min.js')
const cubismUrl = 'https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js'

if (existsSync(cubismDest)) {
  console.log('[vendor] ✓ live2dcubismcore.min.js (already exists)')
} else {
  console.log('[vendor] Downloading live2dcubismcore.min.js ...')
  await new Promise((resolve, reject) => {
    const file = createWriteStream(cubismDest)
    get(cubismUrl, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`))
        return
      }
      res.pipe(file)
      file.on('finish', () => file.close(resolve))
    }).on('error', reject)
  })
  console.log('[vendor] ✓ live2dcubismcore.min.js (downloaded)')
}
