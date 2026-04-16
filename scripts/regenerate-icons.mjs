// 一次性脚本：从 scripts/icon-source/nexus-icon-2048.png 生成
// public/nexus-{256,512,1024}.png 以及多尺寸 public/nexus.ico
// （16/32/48/64/128/256）。
//
// 想换图标时，把新的高分辨率方形 PNG 覆盖到 scripts/icon-source/nexus-icon-2048.png
// 然后跑：node scripts/regenerate-icons.mjs

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const here = path.dirname(fileURLToPath(import.meta.url))
const publicDir = path.resolve(here, '..', 'public')
const source = path.resolve(here, 'icon-source', 'nexus-icon-2048.png')

const PNG_SIZES = [256, 512, 1024]
const ICO_SIZES = [16, 32, 48, 64, 128, 256]

async function main() {
  const sourceBuffer = await fs.readFile(source)
  console.log(`[icons] source: ${source} (${sourceBuffer.length} bytes)`)

  // ── 生成各尺寸 PNG ───────────────────────────────────────────────────────
  for (const size of PNG_SIZES) {
    const out = path.join(publicDir, `nexus-${size}.png`)
    await sharp(sourceBuffer)
      .resize(size, size, { fit: 'cover' })
      .png({ compressionLevel: 9 })
      .toFile(out)
    console.log(`[icons] wrote ${out}`)
  }

  // ── 生成多尺寸 .ico —— 把每个尺寸的 PNG 直接内嵌（Vista+ 支持）──────────
  const icoEntries = []
  for (const size of ICO_SIZES) {
    const png = await sharp(sourceBuffer)
      .resize(size, size, { fit: 'cover' })
      .png({ compressionLevel: 9 })
      .toBuffer()
    icoEntries.push({ size, png })
  }

  // ICO 文件格式：6 字节 header + N * 16 字节目录项 + 各 PNG 数据
  const headerSize = 6
  const dirEntrySize = 16
  const numImages = icoEntries.length

  let dataOffset = headerSize + numImages * dirEntrySize
  const directoryEntries = Buffer.alloc(numImages * dirEntrySize)
  for (let i = 0; i < numImages; i++) {
    const { size, png } = icoEntries[i]
    const entry = Buffer.alloc(dirEntrySize)
    // 256 在 ICO 里写成 0
    entry.writeUInt8(size === 256 ? 0 : size, 0) // width
    entry.writeUInt8(size === 256 ? 0 : size, 1) // height
    entry.writeUInt8(0, 2) // color palette
    entry.writeUInt8(0, 3) // reserved
    entry.writeUInt16LE(1, 4) // color planes
    entry.writeUInt16LE(32, 6) // bits per pixel
    entry.writeUInt32LE(png.length, 8) // image data size
    entry.writeUInt32LE(dataOffset, 12) // image data offset
    entry.copy(directoryEntries, i * dirEntrySize)
    dataOffset += png.length
  }

  const header = Buffer.alloc(headerSize)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // type = 1 (ICO)
  header.writeUInt16LE(numImages, 4)

  const icoBuffer = Buffer.concat([
    header,
    directoryEntries,
    ...icoEntries.map((e) => e.png),
  ])

  const icoPath = path.join(publicDir, 'nexus.ico')
  await fs.writeFile(icoPath, icoBuffer)
  console.log(`[icons] wrote ${icoPath} (${icoBuffer.length} bytes, ${numImages} sizes)`)
}

main().catch((err) => {
  console.error('[icons] failed:', err)
  process.exit(1)
})
