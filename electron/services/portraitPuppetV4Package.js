/**
 * Main-process validation and copying for layered Portrait Puppet v4 assets.
 * Shared validation owns semantic rig truth; this module owns filesystem,
 * image-decoding, size, alpha, and same-canvas guarantees.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

import {
  PORTRAIT_PUPPET_V4_MASK_ROLES,
  PORTRAIT_PUPPET_V4_PART_ROLES,
  validatePortraitPuppetV4Manifest,
} from '../../shared/portraitPuppetV4Contract.js'
import {
  PET_IPC_ERROR_CODES,
  buildPetIpcError,
} from '../../shared/petErrorCodes.js'

const MAX_LAYER_COUNT = 96
const MAX_LAYER_BYTES = 20 * 1024 * 1024
const MAX_PACKAGE_ASSET_BYTES = 55 * 1024 * 1024

function invalidV4Package(details) {
  return buildPetIpcError(PET_IPC_ERROR_CODES.UNSUPPORTED_FILE, {
    cause: new Error(String(details ?? 'invalid portrait-puppet-v4 package')),
  })
}

function resolvePackageAsset(rootPath, relativePath) {
  const resolved = path.resolve(rootPath, relativePath)
  const relative = path.relative(rootPath, resolved)
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw invalidV4Package('asset path escapes the package root')
  }
  return resolved
}

async function inspectPngAsset(assetPath, canvas, label) {
  let stats
  let metadata
  try {
    stats = await fs.stat(assetPath)
    metadata = await sharp(assetPath).metadata()
  } catch (error) {
    throw invalidV4Package(`${label} cannot be decoded: ${error instanceof Error ? error.message : error}`)
  }
  if (!stats.isFile() || stats.size <= 0 || stats.size > MAX_LAYER_BYTES) {
    throw invalidV4Package(`${label} has an invalid file size`)
  }
  if (
    metadata.format !== 'png'
    || metadata.width !== canvas.width
    || metadata.height !== canvas.height
    || !metadata.hasAlpha
  ) {
    throw invalidV4Package(`${label} must be a same-canvas alpha PNG`)
  }
  const imageStats = await sharp(assetPath).ensureAlpha().stats()
  if ((imageStats.channels[3]?.max ?? 0) <= 0) {
    throw invalidV4Package(`${label} is fully transparent`)
  }
  return stats.size
}

async function readAlphaChannel(assetPath, canvas) {
  const { data, info } = await sharp(assetPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const alpha = new Uint8Array(canvas.width * canvas.height)
  for (let index = 0; index < alpha.length; index += 1) {
    alpha[index] = data[index * info.channels + 3]
  }
  return alpha
}

/**
 * Resolve a raw v4 manifest into safe absolute source paths.
 *
 * @param {unknown} value
 * @param {string} manifestPath
 */
export function resolvePortraitPuppetV4Package(value, manifestPath) {
  const result = validatePortraitPuppetV4Manifest(value)
  if (!result.valid) {
    throw invalidV4Package(result.errors.map((entry) => `${entry.code}:${entry.path}`).join(','))
  }
  if (result.manifest.parts.length + result.manifest.masks.length > MAX_LAYER_COUNT) {
    throw invalidV4Package('too many layered assets')
  }
  const rootPath = path.dirname(manifestPath)
  const sourcePortraitPath = resolvePackageAsset(rootPath, result.manifest.portraitPath)
  const sourcePartPaths = Object.fromEntries(result.manifest.parts.map((part) => [
    part.id,
    resolvePackageAsset(rootPath, part.path),
  ]))
  const sourceMaskPaths = Object.fromEntries(result.manifest.masks.map((mask) => [
    mask.id,
    resolvePackageAsset(rootPath, mask.path),
  ]))
  return {
    ...result.manifest,
    sourcePortraitPath,
    sourcePartPaths,
    sourceMaskPaths,
    validationWarnings: result.warnings,
  }
}

/** Compare the neutral preview silhouette with the union of all part alphas. */
export async function auditPortraitPuppetV4AssetAlignment(manifest) {
  const previewAlpha = await readAlphaChannel(manifest.sourcePortraitPath, manifest.canvas)
  const partAlphas = await Promise.all(manifest.parts.map((part) => (
    readAlphaChannel(manifest.sourcePartPaths[part.id], manifest.canvas)
  )))
  const unionAlpha = new Uint8Array(previewAlpha.length)
  for (const alpha of partAlphas) {
    for (let index = 0; index < alpha.length; index += 1) {
      if (alpha[index] > unionAlpha[index]) unionAlpha[index] = alpha[index]
    }
  }
  let previewForeground = 0
  let unionForeground = 0
  let missingPixels = 0
  let outsidePixels = 0
  for (let index = 0; index < previewAlpha.length; index += 1) {
    const previewVisible = previewAlpha[index] >= 16
    const partVisible = unionAlpha[index] >= 16
    if (previewVisible) previewForeground += 1
    if (partVisible) unionForeground += 1
    if (previewVisible && !partVisible) missingPixels += 1
    if (!previewVisible && partVisible) outsidePixels += 1
  }
  const missingRatio = missingPixels / Math.max(1, previewForeground)
  const outsideRatio = outsidePixels / Math.max(1, unionForeground)
  return {
    previewForeground,
    unionForeground,
    missingPixels,
    outsidePixels,
    missingRatio,
    outsideRatio,
    aligned: missingRatio <= 0.02 && outsideRatio <= 0.02,
  }
}

/** Verify every referenced v4 image before discovery or import. */
export async function validatePortraitPuppetV4Assets(manifest) {
  let totalBytes = await inspectPngAsset(
    manifest.sourcePortraitPath,
    manifest.canvas,
    'portraitPath',
  )
  for (const part of manifest.parts) {
    totalBytes += await inspectPngAsset(
      manifest.sourcePartPaths[part.id],
      manifest.canvas,
      `part:${part.id}`,
    )
  }
  for (const mask of manifest.masks) {
    totalBytes += await inspectPngAsset(
      manifest.sourceMaskPaths[mask.id],
      manifest.canvas,
      `mask:${mask.id}`,
    )
  }
  if (totalBytes > MAX_PACKAGE_ASSET_BYTES) {
    throw invalidV4Package('layered assets exceed the package byte budget')
  }
  const alignment = await auditPortraitPuppetV4AssetAlignment(manifest)
  if (
    manifest.qualityTier === 'complete'
    && (alignment.missingRatio > 0.08 || alignment.outsideRatio > 0.08)
  ) {
    throw invalidV4Package('layered assets do not align with the neutral preview')
  }
  return {
    totalBytes,
    assetCount: 1 + manifest.parts.length + manifest.masks.length,
    alignment,
  }
}

/**
 * Copy validated v4 parts and masks into canonical imported-package paths.
 * The caller copies portraitPath and writes pet.json atomically with its flow.
 */
export async function copyPortraitPuppetV4Assets(manifest, targetDirectory) {
  const partsDirectory = path.join(targetDirectory, 'parts')
  const masksDirectory = path.join(targetDirectory, 'masks')
  await fs.mkdir(partsDirectory, { recursive: true })
  if (manifest.masks.length) await fs.mkdir(masksDirectory, { recursive: true })

  const parts = []
  for (const part of manifest.parts) {
    const relativePath = `parts/${part.id}.png`
    await fs.copyFile(manifest.sourcePartPaths[part.id], path.join(targetDirectory, relativePath))
    parts.push({ ...part, path: relativePath })
  }
  const masks = []
  for (const mask of manifest.masks) {
    const relativePath = `masks/${mask.id}.png`
    await fs.copyFile(manifest.sourceMaskPaths[mask.id], path.join(targetDirectory, relativePath))
    masks.push({ ...mask, path: relativePath })
  }
  return { parts, masks }
}

const V4_PART_ROLE_SET = new Set(PORTRAIT_PUPPET_V4_PART_ROLES)
const V4_MASK_ROLE_SET = new Set(PORTRAIT_PUPPET_V4_MASK_ROLES)
const V4_PREVIEW_NAMES = new Set(['preview', 'portrait', 'idle'])

function pngRoleName(filePath) {
  return path.basename(filePath, path.extname(filePath)).toLowerCase()
}

async function listPngRoleNames(directoryPath) {
  try {
    const entries = await fs.readdir(directoryPath, { withFileTypes: true })
    return entries
      .filter((entry) => entry.isFile() && path.extname(entry.name).toLowerCase() === '.png')
      .map((entry) => pngRoleName(entry.name))
  } catch {
    return []
  }
}

/** True when a folder already has preview.png + parts/face-base.png. */
export async function isPortraitPuppetV4LayerRoot(directoryPath) {
  try {
    await fs.access(path.join(directoryPath, 'preview.png'))
  } catch {
    return false
  }
  const roles = await listPngRoleNames(path.join(directoryPath, 'parts'))
  return roles.includes('face-base') && roles.length >= 6
}

/**
 * Walk selected files/folders and return the canonical v4 layer root, if any.
 * Picking preview.png or a file inside parts/ is enough.
 */
export async function resolvePortraitPuppetV4LayerRoot(sourcePaths) {
  const incoming = (Array.isArray(sourcePaths) ? sourcePaths : [sourcePaths]).filter(Boolean)
  for (const raw of incoming) {
    const resolved = path.resolve(raw)
    let stats
    try {
      stats = await fs.stat(resolved)
    } catch {
      continue
    }
    const candidates = []
    if (stats.isDirectory()) {
      candidates.push(resolved)
      if (path.basename(resolved) === 'parts') candidates.push(path.dirname(resolved))
    } else {
      const parent = path.dirname(resolved)
      candidates.push(parent)
      if (path.basename(parent) === 'parts') candidates.push(path.dirname(parent))
    }
    for (const candidate of candidates) {
      if (await isPortraitPuppetV4LayerRoot(candidate)) return candidate
    }
  }
  return ''
}

/** Loose PNG dump: preview + at least six named v4 part files, including face-base. */
export function isFlatPortraitPuppetV4ImageSet(imagePaths) {
  const names = (Array.isArray(imagePaths) ? imagePaths : []).map(pngRoleName)
  const roleHits = names.filter((name) => V4_PART_ROLE_SET.has(name))
  return names.some((name) => V4_PREVIEW_NAMES.has(name))
    && roleHits.includes('face-base')
    && roleHits.length >= 6
}

async function copyCanonicalV4Tree(sourceDirectory, targetDirectory) {
  await fs.mkdir(targetDirectory, { recursive: true })
  await fs.copyFile(
    path.join(sourceDirectory, 'preview.png'),
    path.join(targetDirectory, 'preview.png'),
  )
  await fs.cp(path.join(sourceDirectory, 'parts'), path.join(targetDirectory, 'parts'), {
    recursive: true,
  })
  try {
    await fs.cp(path.join(sourceDirectory, 'masks'), path.join(targetDirectory, 'masks'), {
      recursive: true,
    })
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }
}

async function assembleFlatV4Tree(imagePaths, targetDirectory) {
  await fs.mkdir(path.join(targetDirectory, 'parts'), { recursive: true })
  const previewSource = imagePaths.find((entry) => V4_PREVIEW_NAMES.has(pngRoleName(entry)))
    || imagePaths[0]
  await fs.copyFile(previewSource, path.join(targetDirectory, 'preview.png'))
  for (const imagePath of imagePaths) {
    const role = pngRoleName(imagePath)
    if (V4_PREVIEW_NAMES.has(role)) continue
    if (V4_MASK_ROLE_SET.has(role) && !V4_PART_ROLE_SET.has(role)) {
      await fs.mkdir(path.join(targetDirectory, 'masks'), { recursive: true })
      await fs.copyFile(imagePath, path.join(targetDirectory, 'masks', `${role}.png`))
      continue
    }
    if (!V4_PART_ROLE_SET.has(role)) continue
    await fs.copyFile(imagePath, path.join(targetDirectory, 'parts', `${role}.png`))
  }
}

/**
 * Build a validated v4 package in targetDirectory from a layer folder or a
 * flat dump of named PNGs. v3 single-image packaging stays the fallback.
 */
export async function createPortraitPuppetV4PackageFromLayerSources({
  sourceDirectory = '',
  sourcePaths = [],
  targetDirectory,
  id = '',
  displayName = '',
  description = '',
}) {
  const canonicalRoot = sourceDirectory || await resolvePortraitPuppetV4LayerRoot(sourcePaths)
  if (canonicalRoot) {
    await copyCanonicalV4Tree(canonicalRoot, targetDirectory)
  } else if (isFlatPortraitPuppetV4ImageSet(sourcePaths)) {
    await assembleFlatV4Tree(sourcePaths, targetDirectory)
  } else {
    throw invalidV4Package('no layered portrait v4 sources')
  }

  const { scaffoldPortraitPuppetV4 } = await import('../../scripts/scaffold-portrait-puppet-v4.mjs')
  const result = await scaffoldPortraitPuppetV4({
    sourceDirectory: targetDirectory,
    id,
    displayName,
    description,
  })
  const portraitPath = path.join(targetDirectory, 'preview.png')
  return {
    manifest: result.manifest,
    manifestPath: result.manifestPath,
    portraitPath,
    spritePath: portraitPath,
    archivePath: result.archivePath,
    visualAuditPath: '',
    visualWarnings: [],
    sourceLayout: 'layered-v4',
    nativeAtlasPreserved: false,
    targetDirectory,
  }
}
