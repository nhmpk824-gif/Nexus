/**
 * Build a portrait-puppet package from one picture or a named set.
 * A single picture is enough: Nexus creates motion locally with its
 * deterministic procedural rig. Extra pictures are optional expressions.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import {
  DEFAULT_PORTRAIT_PUPPET_RIG,
  PORTRAIT_PUPPET_FORMAT_VERSION,
  PORTRAIT_PUPPET_IMAGE_NAME,
  PORTRAIT_PUPPET_KIND,
  PORTRAIT_PUPPET_PROCEDURAL_RENDER_MODE,
  classifyPortraitLayerKey,
  normalizePortraitPuppetRig,
} from '../../shared/portraitPuppetContract.js'
import {
  formatSpritePetDisplayName,
  isPathInsideRoot,
  readSpritePetPackage,
  writeSpritePetZipArchive,
} from './spritePetPackage.js'

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp'])

function slugifyPortraitId(value) {
  const normalized = String(value ?? '')
    .trim()
    .replace(/[\\/]+/g, '-')
    .replace(/\.[^.]+$/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()

  return normalized || 'portrait-pet'
}

async function writeNormalizedPortrait(sourcePath, targetPath) {
  await sharp(sourcePath)
    .rotate()
    .ensureAlpha()
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 8 })
    .resize({
      width: 768,
      height: 1024,
      fit: 'inside',
      withoutEnlargement: false,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9 })
    .toFile(targetPath)
}

function clampPortraitRigValue(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

/**
 * Infer a conservative rig from ordinary portrait pixels. This is deliberately
 * classical image analysis: alpha bounds + skin-colour row profiles. It never
 * calls an ML model, network service, or image generator.
 */
export async function inferPortraitPuppetRigFromImage(imagePath) {
  try {
    const { data, info } = await sharp(imagePath)
      .ensureAlpha()
      .resize({ width: 192, fit: 'inside', withoutEnlargement: false })
      .raw()
      .toBuffer({ resolveWithObject: true })
    const { width, height } = info
    if (!width || !height || info.channels < 4) return DEFAULT_PORTRAIT_PUPPET_RIG

    const skinRows = Array.from({ length: height }, () => ({ count: 0, sumX: 0 }))
    const alphaPoints = []
    for (let y = 0; y < Math.floor(height * 0.56); y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = (y * width + x) * info.channels
        const r = data[index]
        const g = data[index + 1]
        const b = data[index + 2]
        const a = data[index + 3]
        if (a >= 48) alphaPoints.push({ x, y })
        if (
          a >= 176
          && x >= width * 0.16
          && x <= width * 0.84
          && r >= 76
          && r >= g * 0.94
          && g >= b * 0.86
          && r - b >= 12
          && (r + g + b) / 3 >= 70
        ) {
          skinRows[y].count += 1
          skinRows[y].sumX += x
        }
      }
    }
    if (!alphaPoints.length) return DEFAULT_PORTRAIT_PUPPET_RIG

    const smoothed = skinRows.map((_, index) => {
      let count = 0
      for (let offset = -2; offset <= 2; offset += 1) {
        count += skinRows[index + offset]?.count ?? 0
      }
      return count / 5
    })
    // A face row is broad; isolated warm accessories (stars, earrings) are not.
    const minimumPeak = width * 0.16
    let peakY = -1
    for (let y = Math.floor(height * 0.07); y < Math.floor(height * 0.5); y += 1) {
      const value = smoothed[y]
      if (value < minimumPeak) continue
      const peakWindowEnd = Math.min(height, y + Math.max(5, Math.round(height * 0.065)))
      peakY = y
      for (let candidate = y + 1; candidate < peakWindowEnd; candidate += 1) {
        if (smoothed[candidate] > smoothed[peakY]) peakY = candidate
      }
      break
    }
    if (peakY < 0) return DEFAULT_PORTRAIT_PUPPET_RIG

    const peakCount = Math.max(1, smoothed[peakY])
    let faceTopY = peakY
    for (let y = peakY; y >= Math.floor(height * 0.035); y -= 1) {
      if (smoothed[y] < Math.max(width * 0.018, peakCount * 0.13)) {
        faceTopY = Math.min(peakY - 1, y + 2)
        break
      }
    }
    let faceBottomY = Math.min(height - 1, peakY + Math.round(height * 0.12))
    const minimumFaceSpan = Math.max(5, Math.round(height * 0.032))
    for (let y = peakY + minimumFaceSpan; y < Math.floor(height * 0.55); y += 1) {
      const current = smoothed[y]
      const future = Math.max(...smoothed.slice(y + 2, Math.min(height, y + Math.max(4, Math.round(height * 0.035)))))
      if (current < peakCount * 0.38 && future > current * 1.45) {
        faceBottomY = y
        break
      }
      if (current < Math.max(width * 0.012, peakCount * 0.11)) {
        faceBottomY = y
        break
      }
    }
    const faceSpan = (faceBottomY - faceTopY) / height
    if (faceSpan < 0.045 || faceSpan > 0.31) return DEFAULT_PORTRAIT_PUPPET_RIG

    let faceCount = 0
    let faceSumX = 0
    for (let y = faceTopY; y <= faceBottomY; y += 1) {
      faceCount += skinRows[y].count
      faceSumX += skinRows[y].sumX
    }
    const faceX = faceCount > 0 ? faceSumX / faceCount / width : 0.5
    const headAlpha = alphaPoints.filter((point) => point.y <= faceBottomY + faceSpan * height * 0.22)
    const headMinX = Math.min(...headAlpha.map((point) => point.x)) / width
    const headMaxX = Math.max(...headAlpha.map((point) => point.x)) / width
    const headTop = Math.min(...headAlpha.map((point) => point.y)) / height
    const neckY = clampPortraitRigValue(faceBottomY / height + faceSpan * 0.14, 0.2, 0.7)
    const headRadiusX = clampPortraitRigValue((headMaxX - headMinX) * 0.47, 0.22, 0.48)
    const headRadiusY = clampPortraitRigValue((neckY - headTop) * 0.5, 0.1, 0.3)
    const headX = clampPortraitRigValue(faceX, 0.35, 0.65)
    const headY = clampPortraitRigValue(headTop + headRadiusY, 0.08, neckY - 0.045)
    const eyeSpacing = clampPortraitRigValue(headRadiusX * 0.28, 0.055, 0.135)
    const remainingBody = Math.max(0.2, 1 - neckY)

    return normalizePortraitPuppetRig({
      ...DEFAULT_PORTRAIT_PUPPET_RIG,
      headX,
      headY,
      headRadiusX,
      headRadiusY,
      neckY,
      eyeLeftX: headX - eyeSpacing,
      eyeRightX: headX + eyeSpacing,
      eyeY: faceTopY / height + faceSpan * 0.41,
      eyeRadiusX: clampPortraitRigValue(headRadiusX * 0.195, 0.035, 0.105),
      eyeRadiusY: clampPortraitRigValue(faceSpan * 0.22, 0.014, 0.052),
      mouthX: headX,
      mouthY: faceTopY / height + faceSpan * 0.73,
      mouthRadiusX: clampPortraitRigValue(headRadiusX * 0.14, 0.026, 0.075),
      mouthRadiusY: clampPortraitRigValue(faceSpan * 0.14, 0.009, 0.036),
      chestY: neckY + remainingBody * 0.1,
      waistY: neckY + remainingBody * 0.27,
    })
  } catch {
    return DEFAULT_PORTRAIT_PUPPET_RIG
  }
}

/** Expand folders into image files; keep file paths as-is. */
export async function expandPortraitImageSources(sourcePaths) {
  const images = []
  for (const raw of sourcePaths) {
    const resolved = path.resolve(raw)
    const stats = await fs.stat(resolved)
    if (stats.isDirectory()) {
      const entries = await fs.readdir(resolved, { withFileTypes: true })
      for (const entry of entries) {
        if (!entry.isFile()) continue
        if (!IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue
        images.push(path.join(resolved, entry.name))
      }
      continue
    }
    if (IMAGE_EXTENSIONS.has(path.extname(resolved).toLowerCase())) {
      images.push(resolved)
    }
  }
  return images
}

/**
 * Write pet.json + portrait.png and any classified expression/part layers.
 *
 * @param {{
 *   sourcePaths: string[]
 *   targetDirectory: string
 *   id?: string
 *   displayName?: string
 *   description?: string
 *   rig?: object
 * }} options
 */
export async function createPortraitPuppetPackageFromImages({
  sourcePaths,
  targetDirectory,
  id = '',
  displayName = '',
  description = '',
  rig,
}) {
  const images = await expandPortraitImageSources(sourcePaths)
  if (!images.length) {
    throw new Error('没有可用的立绘或表情图。')
  }

  const classified = []
  const unused = []
  const seen = new Set()
  for (const imagePath of images) {
    const key = classifyPortraitLayerKey(path.basename(imagePath))
    if (key && !seen.has(key)) {
      seen.add(key)
      classified.push({ key, imagePath })
    } else {
      unused.push(imagePath)
    }
  }

  const baseImage = classified.find((entry) => entry.key === 'idle')?.imagePath
    || unused[0]
    || classified[0]?.imagePath
  const packageId = slugifyPortraitId(id || path.basename(baseImage, path.extname(baseImage)))
  const packageDisplayName = String(displayName || formatSpritePetDisplayName(packageId)).trim()
  const packageDescription = String(
    description
      || (classified.length > 1
        ? 'A portrait companion with authored expression layers.'
        : 'A locally animated portrait companion with blink, speech, breathing, turn, hair, and cloth motion.'),
  ).trim()

  await fs.mkdir(targetDirectory, { recursive: true })
  const portraitPath = path.join(targetDirectory, PORTRAIT_PUPPET_IMAGE_NAME)
  const layersDirectory = path.join(targetDirectory, 'layers')
  const manifestPath = path.join(targetDirectory, 'pet.json')
  const archivePath = path.join(targetDirectory, `${packageId}.nexus-portrait.zip`)

  await writeNormalizedPortrait(baseImage, portraitPath)
  const resolvedRig = normalizePortraitPuppetRig(
    rig ?? await inferPortraitPuppetRigFromImage(portraitPath),
  )

  const layers = {}
  const archiveFiles = [
    { path: manifestPath, name: 'pet.json' },
    { path: portraitPath, name: PORTRAIT_PUPPET_IMAGE_NAME },
  ]

  for (const entry of classified) {
    if (entry.key === 'idle' && entry.imagePath === baseImage) {
      continue
    }
    await fs.mkdir(layersDirectory, { recursive: true })
    const layerName = `${entry.key}.png`
    const layerPath = path.join(layersDirectory, layerName)
    await writeNormalizedPortrait(entry.imagePath, layerPath)
    layers[entry.key] = `layers/${layerName}`
    archiveFiles.push({ path: layerPath, name: `layers/${layerName}` })
  }

  await fs.writeFile(
    manifestPath,
    `${JSON.stringify({
      id: packageId,
      displayName: packageDisplayName,
      description: packageDescription,
      kind: PORTRAIT_PUPPET_KIND,
      formatVersion: PORTRAIT_PUPPET_FORMAT_VERSION,
      renderMode: PORTRAIT_PUPPET_PROCEDURAL_RENDER_MODE,
      portraitPath: PORTRAIT_PUPPET_IMAGE_NAME,
      rig: resolvedRig,
      ...(Object.keys(layers).length ? { layers } : {}),
    }, null, 2)}\n`,
    'utf8',
  )

  const manifest = await readSpritePetPackage(manifestPath)
  await writeSpritePetZipArchive({
    archivePath,
    files: archiveFiles,
  })

  return {
    manifest,
    manifestPath,
    portraitPath,
    spritePath: portraitPath,
    archivePath,
    visualAuditPath: '',
    visualWarnings: [],
    sourceLayout: 'single',
    nativeAtlasPreserved: false,
    targetDirectory,
  }
}

/** Write a one-image portrait-puppet package. */
export async function createPortraitPuppetPackageFromImage(options) {
  return createPortraitPuppetPackageFromImages({
    ...options,
    sourcePaths: [options.sourcePath],
  })
}

/** Copy authored layers into an imported package, keeping paths inside the root. */
export async function copyPortraitPuppetLayers(manifest, targetDirectory) {
  const sourceLayers = manifest.sourceLayerPaths ?? {}
  const layers = {}
  const layerKeys = Object.keys(sourceLayers)
  if (!layerKeys.length) {
    return layers
  }

  const layersDirectory = path.join(targetDirectory, 'layers')
  await fs.mkdir(layersDirectory, { recursive: true })
  for (const [key, sourcePath] of Object.entries(sourceLayers)) {
    if (!sourcePath || !isPathInsideRoot(path.dirname(manifest.sourcePortraitPath), sourcePath)) {
      continue
    }
    const layerName = `${key}${path.extname(sourcePath).toLowerCase() || '.png'}`
    const targetPath = path.join(layersDirectory, layerName)
    await fs.copyFile(sourcePath, targetPath)
    layers[key] = `layers/${layerName}`
  }
  return layers
}
