import {
  normalizePortraitPuppetRig,
  type PortraitPuppetRigDefinition,
} from '../../../shared/portraitPuppetContract.js'
import {
  deformPortraitPuppetPoint,
  resolvePortraitPuppetRigidHeadFollow,
  resolvePortraitPuppetRigidTurn,
  type PortraitPuppetPoint,
  type PortraitPuppetPose,
} from './portraitPuppet.ts'

export type PortraitPuppetMesh = {
  points: PortraitPuppetPoint[]
  triangles: Array<readonly [number, number, number]>
}

export type PortraitPuppetRenderAssets = {
  base: HTMLImageElement
  blink?: HTMLImageElement | null
  mouth?: HTMLImageElement | null
  headLeft?: HTMLImageElement | null
  headRight?: HTMLImageElement | null
  layerMode?: 'legacy-full-frame' | 'rig-v2-overlay' | 'procedural-v3'
  proceduralPalette?: PortraitPuppetProceduralPalette
}

export type PortraitPuppetRgb = { r: number; g: number; b: number }

export type PortraitPuppetProceduralPalette = {
  skin: PortraitPuppetRgb
  line: PortraitPuppetRgb
  mouth: PortraitPuppetRgb
  tongue: PortraitPuppetRgb
}

export type PortraitPuppetRect = {
  x: number
  y: number
  width: number
  height: number
}

export function resolvePortraitPuppetTurnBlend(headYaw: number) {
  const turnAmount = Math.abs(headYaw)
  // Authored key poses differ in facial perspective. Keep the blend window
  // narrow so the transition reads as a turn instead of two translucent faces.
  const normalized = Math.max(0, Math.min(1, (turnAmount - 0.18) / 0.06))
  return {
    direction: headYaw < 0 ? 'left' as const : 'right' as const,
    weight: normalized * normalized * (3 - 2 * normalized),
  }
}

/** Keep procedural-v3 source pixels shape-stable before face compositing. */
export function resolvePortraitPuppetProceduralGeometryPose(
  pose: PortraitPuppetPose,
): PortraitPuppetPose {
  return {
    ...pose,
    blink: 0,
    mouth: 0,
    headYaw: 0,
    headTilt: 0,
    headBob: 0,
    eyeX: 0,
    eyeY: 0,
  }
}

const portraitImageCache = new Map<string, Promise<HTMLImageElement>>()

const DEFAULT_PROCEDURAL_PALETTE: PortraitPuppetProceduralPalette = {
  skin: { r: 246, g: 205, b: 181 },
  line: { r: 69, g: 35, b: 58 },
  mouth: { r: 91, g: 35, b: 55 },
  tongue: { r: 224, g: 119, b: 128 },
}

function averagePortraitColors(colors: PortraitPuppetRgb[], fallback: PortraitPuppetRgb) {
  if (!colors.length) return fallback
  const total = colors.reduce((sum, color) => ({
    r: sum.r + color.r,
    g: sum.g + color.g,
    b: sum.b + color.b,
  }), { r: 0, g: 0, b: 0 })
  return {
    r: Math.round(total.r / colors.length),
    g: Math.round(total.g / colors.length),
    b: Math.round(total.b / colors.length),
  }
}

/** Sample face colors locally; this performs no network or model inference. */
export function createPortraitPuppetProceduralPalette(
  image: HTMLImageElement,
  rigInput?: Partial<PortraitPuppetRigDefinition>,
): PortraitPuppetProceduralPalette {
  if (typeof document === 'undefined') return DEFAULT_PROCEDURAL_PALETTE
  const rig = normalizePortraitPuppetRig(rigInput)
  const width = Math.min(512, Math.max(1, image.naturalWidth))
  const height = Math.max(1, Math.round(width * image.naturalHeight / image.naturalWidth))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return DEFAULT_PROCEDURAL_PALETTE

  try {
    context.drawImage(image, 0, 0, width, height)
    const pixels = context.getImageData(0, 0, width, height).data
    const sampleRect = (left: number, top: number, right: number, bottom: number) => {
      const colors: Array<PortraitPuppetRgb & { luminance: number }> = []
      const x0 = Math.max(0, Math.floor(left * width))
      const x1 = Math.min(width, Math.ceil(right * width))
      const y0 = Math.max(0, Math.floor(top * height))
      const y1 = Math.min(height, Math.ceil(bottom * height))
      for (let y = y0; y < y1; y += 1) {
        for (let x = x0; x < x1; x += 1) {
          const index = (y * width + x) * 4
          if (pixels[index + 3] < 210) continue
          const r = pixels[index]
          const g = pixels[index + 1]
          const b = pixels[index + 2]
          colors.push({ r, g, b, luminance: r * 0.299 + g * 0.587 + b * 0.114 })
        }
      }
      return colors
    }

    const cheekTop = rig.eyeY + rig.eyeRadiusY * 0.32
    const cheekBottom = Math.min(rig.neckY - 0.008, rig.mouthY + rig.mouthRadiusY * 1.9)
    const faceColors = [
      ...sampleRect(
        rig.eyeLeftX + rig.eyeRadiusX * 0.42,
        cheekTop,
        rig.eyeRightX - rig.eyeRadiusX * 0.42,
        cheekBottom,
      ),
      ...sampleRect(
        rig.eyeLeftX - rig.eyeRadiusX * 0.55,
        cheekTop,
        rig.eyeLeftX + rig.eyeRadiusX * 0.28,
        cheekBottom,
      ),
      ...sampleRect(
        rig.eyeRightX - rig.eyeRadiusX * 0.28,
        cheekTop,
        rig.eyeRightX + rig.eyeRadiusX * 0.55,
        cheekBottom,
      ),
    ]
    const skinCandidates = faceColors.filter((color) => (
      color.luminance >= 135
      && color.luminance <= 248
      && color.r - color.g >= 8
      && color.g - color.b >= 4
      && color.r - color.b >= 24
    )).sort((left, right) => left.luminance - right.luminance)
    const skinSource = skinCandidates.length ? skinCandidates : faceColors
    const skinSliceStart = Math.floor(skinSource.length * 0.28)
    const skinSliceEnd = Math.max(skinSliceStart + 1, Math.floor(skinSource.length * 0.72))
    const skin = averagePortraitColors(
      skinSource.slice(skinSliceStart, skinSliceEnd),
      DEFAULT_PROCEDURAL_PALETTE.skin,
    )

    const eyeColors = [
      ...sampleRect(
        rig.eyeLeftX - rig.eyeRadiusX,
        rig.eyeY - rig.eyeRadiusY,
        rig.eyeLeftX + rig.eyeRadiusX,
        rig.eyeY + rig.eyeRadiusY,
      ),
      ...sampleRect(
        rig.eyeRightX - rig.eyeRadiusX,
        rig.eyeY - rig.eyeRadiusY,
        rig.eyeRightX + rig.eyeRadiusX,
        rig.eyeY + rig.eyeRadiusY,
      ),
    ].sort((left, right) => left.luminance - right.luminance)
    const line = averagePortraitColors(
      eyeColors.slice(0, Math.max(1, Math.floor(eyeColors.length * 0.12))),
      DEFAULT_PROCEDURAL_PALETTE.line,
    )
    const mouth = {
      r: Math.max(35, Math.round(line.r * 0.9 + 32)),
      g: Math.max(18, Math.round(line.g * 0.62)),
      b: Math.max(28, Math.round(line.b * 0.72 + 14)),
    }
    const tongue = {
      r: Math.min(255, Math.round(skin.r * 0.72 + 72)),
      g: Math.min(230, Math.round(skin.g * 0.42 + 34)),
      b: Math.min(230, Math.round(skin.b * 0.48 + 45)),
    }
    return { skin, line, mouth, tongue }
  } catch {
    return DEFAULT_PROCEDURAL_PALETTE
  }
}

/** Load and decode one renderer image before it is published to the frame loop. */
export async function loadPortraitPuppetImage(source: string): Promise<HTMLImageElement> {
  const cached = portraitImageCache.get(source)
  if (cached) return cached

  const loading = (async () => {
    const image = new Image()
    image.decoding = 'async'
    image.crossOrigin = 'anonymous'
    image.src = source
    if (typeof image.decode === 'function') {
      await image.decode()
    } else {
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve()
        image.onerror = () => reject(new Error(`Portrait image failed to load: ${source}`))
      })
    }
    return image
  })()
  portraitImageCache.set(source, loading)
  void loading.catch(() => portraitImageCache.delete(source))
  return loading
}

/** Build a face-aware grid while keeping the topology fixed between frames. */
export function createPortraitPuppetMesh(
  rigInput?: Partial<PortraitPuppetRigDefinition>,
): PortraitPuppetMesh {
  const rig = normalizePortraitPuppetRig(rigInput)
  const columns = [...new Set([
    0,
    0.06,
    0.14,
    0.23,
    Math.max(0, rig.headX - rig.headRadiusX),
    Math.max(0, rig.eyeLeftX - rig.eyeRadiusX),
    rig.eyeLeftX,
    Math.min(1, rig.eyeLeftX + rig.eyeRadiusX),
    rig.headX,
    Math.max(0, rig.eyeRightX - rig.eyeRadiusX),
    rig.eyeRightX,
    Math.min(1, rig.eyeRightX + rig.eyeRadiusX),
    Math.min(1, rig.headX + rig.headRadiusX),
    0.77,
    0.86,
    0.94,
    1,
  ].map((value) => Number(value.toFixed(5))))].sort((left, right) => left - right)
  const rows = [...new Set([
    0,
    0.055,
    Math.max(0, rig.headY - rig.headRadiusY * 0.55),
    Math.max(0, rig.eyeY - 0.075),
    Math.max(0, rig.eyeY - rig.eyeRadiusY),
    rig.eyeY,
    Math.min(1, rig.eyeY + rig.eyeRadiusY),
    rig.mouthY,
    Math.min(1, rig.mouthY + rig.mouthRadiusY * 1.8),
    Math.max(0, rig.neckY - 0.035),
    Math.min(1, rig.neckY + 0.055),
    rig.chestY,
    Math.min(1, (rig.chestY + rig.waistY) / 2),
    rig.waistY,
    Math.min(0.9, rig.waistY + 0.08),
    Math.min(0.86, rig.waistY + 0.14),
    Math.min(0.9, rig.waistY + 0.22),
    0.82,
    0.92,
    1,
  ])].sort((left, right) => left - right)
  const points = rows.flatMap((y) => columns.map((x) => ({ x, y })))
  const triangles: Array<readonly [number, number, number]> = []

  for (let row = 0; row < rows.length - 1; row += 1) {
    for (let column = 0; column < columns.length - 1; column += 1) {
      const topLeft = row * columns.length + column
      const topRight = topLeft + 1
      const bottomLeft = topLeft + columns.length
      const bottomRight = bottomLeft + 1
      triangles.push([topLeft, bottomLeft, topRight], [topRight, bottomLeft, bottomRight])
    }
  }

  return { points, triangles }
}

/** Fit the source image inside the canvas while keeping its feet bottom-aligned. */
export function resolvePortraitPuppetContainRect(
  canvasWidth: number,
  canvasHeight: number,
  imageWidth: number,
  imageHeight: number,
): PortraitPuppetRect {
  const scale = Math.min(canvasWidth / imageWidth, canvasHeight / imageHeight)
  const width = imageWidth * scale
  const height = imageHeight * scale
  return {
    x: (canvasWidth - width) / 2,
    y: canvasHeight - height,
    width,
    height,
  }
}

/** Draw one affine-mapped source triangle with a small expanded clip seam. */
export function drawPortraitPuppetTriangle(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  source: readonly [PortraitPuppetPoint, PortraitPuppetPoint, PortraitPuppetPoint],
  destination: readonly [PortraitPuppetPoint, PortraitPuppetPoint, PortraitPuppetPoint],
  overlapPx = 0.7,
): void {
  const [sourceA, sourceB, sourceC] = source
  const [destinationA, destinationB, destinationC] = destination
  const denominator = sourceA.x * (sourceB.y - sourceC.y)
    + sourceB.x * (sourceC.y - sourceA.y)
    + sourceC.x * (sourceA.y - sourceB.y)
  if (Math.abs(denominator) < 0.000001) return

  const centerX = (destinationA.x + destinationB.x + destinationC.x) / 3
  const centerY = (destinationA.y + destinationB.y + destinationC.y) / 3
  const expanded = destination.map((point) => {
    const deltaX = point.x - centerX
    const deltaY = point.y - centerY
    const length = Math.hypot(deltaX, deltaY) || 1
    return {
      x: point.x + deltaX / length * overlapPx,
      y: point.y + deltaY / length * overlapPx,
    }
  })

  const a = (
    destinationA.x * (sourceB.y - sourceC.y)
    + destinationB.x * (sourceC.y - sourceA.y)
    + destinationC.x * (sourceA.y - sourceB.y)
  ) / denominator
  const c = (
    destinationA.x * (sourceC.x - sourceB.x)
    + destinationB.x * (sourceA.x - sourceC.x)
    + destinationC.x * (sourceB.x - sourceA.x)
  ) / denominator
  const e = (
    destinationA.x * (sourceB.x * sourceC.y - sourceC.x * sourceB.y)
    + destinationB.x * (sourceC.x * sourceA.y - sourceA.x * sourceC.y)
    + destinationC.x * (sourceA.x * sourceB.y - sourceB.x * sourceA.y)
  ) / denominator
  const b = (
    destinationA.y * (sourceB.y - sourceC.y)
    + destinationB.y * (sourceC.y - sourceA.y)
    + destinationC.y * (sourceA.y - sourceB.y)
  ) / denominator
  const d = (
    destinationA.y * (sourceC.x - sourceB.x)
    + destinationB.y * (sourceA.x - sourceC.x)
    + destinationC.y * (sourceB.x - sourceA.x)
  ) / denominator
  const f = (
    destinationA.y * (sourceB.x * sourceC.y - sourceC.x * sourceB.y)
    + destinationB.y * (sourceC.x * sourceA.y - sourceA.x * sourceC.y)
    + destinationC.y * (sourceA.x * sourceB.y - sourceB.x * sourceA.y)
  ) / denominator

  context.save()
  context.beginPath()
  context.moveTo(expanded[0].x, expanded[0].y)
  context.lineTo(expanded[1].x, expanded[1].y)
  context.lineTo(expanded[2].x, expanded[2].y)
  context.closePath()
  context.clip()
  context.transform(a, b, c, d, e, f)
  context.drawImage(image, 0, 0)
  context.restore()
}

/** Render one image through the deformed mesh. */
export function drawPortraitPuppetImageMesh(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  mesh: PortraitPuppetMesh,
  pose: PortraitPuppetPose,
  target: PortraitPuppetRect,
  rigInput?: Partial<PortraitPuppetRigDefinition>,
  opacity = 1,
): void {
  const aspectRatio = target.width / target.height
  const destinationPoints = mesh.points.map((point) => {
    const deformed = deformPortraitPuppetPoint(point, pose, rigInput, aspectRatio)
    return {
      x: target.x + deformed.x * target.width,
      y: target.y + deformed.y * target.height,
    }
  })
  context.save()
  context.globalAlpha = opacity

  for (const triangle of mesh.triangles) {
    const source = triangle.map((index) => ({
      x: mesh.points[index].x * image.naturalWidth,
      y: mesh.points[index].y * image.naturalHeight,
    })) as [PortraitPuppetPoint, PortraitPuppetPoint, PortraitPuppetPoint]
    const destination = triangle.map((index) => destinationPoints[index]) as [
      PortraitPuppetPoint,
      PortraitPuppetPoint,
      PortraitPuppetPoint,
    ]
    drawPortraitPuppetTriangle(context, image, source, destination)
  }

  context.restore()
}

function portraitColor(color: PortraitPuppetRgb, alpha = 1) {
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`
}

function mapPortraitPoint(
  point: PortraitPuppetPoint,
  pose: PortraitPuppetPose,
  target: PortraitPuppetRect,
  rigInput?: Partial<PortraitPuppetRigDefinition>,
) {
  const deformed = deformPortraitPuppetPoint(
    point,
    pose,
    rigInput,
    target.width / target.height,
  )
  return {
    x: target.x + deformed.x * target.width,
    y: target.y + deformed.y * target.height,
  }
}

function resolvePortraitFeatureBasis(
  centerX: number,
  centerY: number,
  radiusX: number,
  radiusY: number,
  pose: PortraitPuppetPose,
  target: PortraitPuppetRect,
  rigInput?: Partial<PortraitPuppetRigDefinition>,
) {
  const center = mapPortraitPoint({ x: centerX, y: centerY }, pose, target, rigInput)
  const left = mapPortraitPoint({ x: centerX - radiusX, y: centerY }, pose, target, rigInput)
  const right = mapPortraitPoint({ x: centerX + radiusX, y: centerY }, pose, target, rigInput)
  const top = mapPortraitPoint({ x: centerX, y: centerY - radiusY }, pose, target, rigInput)
  const bottom = mapPortraitPoint({ x: centerX, y: centerY + radiusY }, pose, target, rigInput)
  return {
    center,
    angle: Math.atan2(right.y - left.y, right.x - left.x),
    radiusX: Math.max(1, Math.hypot(right.x - left.x, right.y - left.y) / 2),
    radiusY: Math.max(1, Math.hypot(bottom.x - top.x, bottom.y - top.y) / 2),
  }
}

let rigidHeadFollowCanvas: HTMLCanvasElement | null = null
let rigidFaceTurnCanvas: HTMLCanvasElement | null = null

function getRigidHeadFollowCanvas(width: number, height: number) {
  if (typeof document === 'undefined') return null
  rigidHeadFollowCanvas ??= document.createElement('canvas')
  if (rigidHeadFollowCanvas.width !== width) rigidHeadFollowCanvas.width = width
  if (rigidHeadFollowCanvas.height !== height) rigidHeadFollowCanvas.height = height
  return rigidHeadFollowCanvas
}

function getRigidFaceTurnCanvas(width: number, height: number) {
  if (typeof document === 'undefined') return null
  rigidFaceTurnCanvas ??= document.createElement('canvas')
  if (rigidFaceTurnCanvas.width !== width) rigidFaceTurnCanvas.width = width
  if (rigidFaceTurnCanvas.height !== height) rigidFaceTurnCanvas.height = height
  return rigidFaceTurnCanvas
}

function resolveRigidPortraitBasePose(pose: PortraitPuppetPose): PortraitPuppetPose {
  return {
    ...pose,
    blink: 0,
    mouth: 0,
    headYaw: 0,
    headTilt: 0,
    headBob: 0,
    eyeX: 0,
    eyeY: 0,
    hairSway: 0,
    secondarySway: 0,
  }
}

function applyRigidHeadFollowToFeatureBasis(
  basis: ReturnType<typeof resolvePortraitFeatureBasis>,
  pose: PortraitPuppetPose,
  target: PortraitPuppetRect,
  rig: Readonly<PortraitPuppetRigDefinition>,
) {
  const basePose = resolveRigidPortraitBasePose(pose)
  const headBasis = resolvePortraitFeatureBasis(
    rig.headX,
    rig.headY,
    rig.headRadiusX,
    rig.headRadiusY,
    basePose,
    target,
    rig,
  )
  const follow = resolvePortraitPuppetRigidHeadFollow(
    pose.headYaw,
    pose.headTilt,
    pose.headBob,
  )
  const baseCos = Math.cos(headBasis.angle)
  const baseSin = Math.sin(headBasis.angle)
  const offsetX = follow.headOffsetX * target.width
  const offsetY = follow.headOffsetY * target.height
  const pivot = {
    x: headBasis.center.x + offsetX * baseCos - offsetY * baseSin,
    y: headBasis.center.y + offsetX * baseSin + offsetY * baseCos,
  }
  const deltaX = basis.center.x - headBasis.center.x
  const deltaY = basis.center.y - headBasis.center.y
  const turnCos = Math.cos(follow.rotationRadians)
  const turnSin = Math.sin(follow.rotationRadians)
  return {
    ...basis,
    center: {
      x: pivot.x + deltaX * turnCos - deltaY * turnSin,
      y: pivot.y + deltaX * turnSin + deltaY * turnCos,
    },
    angle: basis.angle + follow.rotationRadians,
  }
}

function applyRigidTurnToFeatureBasis(
  basis: ReturnType<typeof resolvePortraitFeatureBasis>,
  pose: PortraitPuppetPose,
  target: PortraitPuppetRect,
  rig: Readonly<PortraitPuppetRigDefinition>,
) {
  const followedBasis = applyRigidHeadFollowToFeatureBasis(basis, pose, target, rig)
  const turn = resolvePortraitPuppetRigidTurn(pose.headYaw)
  const localOffsetX = turn.faceOffsetX * target.width
  const localOffsetY = turn.faceOffsetY * target.height
  const cos = Math.cos(followedBasis.angle)
  const sin = Math.sin(followedBasis.angle)
  return {
    ...followedBasis,
    center: {
      x: followedBasis.center.x + localOffsetX * cos - localOffsetY * sin,
      y: followedBasis.center.y + localOffsetX * sin + localOffsetY * cos,
    },
  }
}

/**
 * Move the inferred head and hair silhouette as one feathered rigid patch.
 * The patch only translates and rotates; it never scales, shears, or bends a
 * portrait. All crop bounds come from the normalized local rig, not pixels or
 * colors from one particular character.
 */
function drawPortraitProceduralRigidHeadFollow(
  context: CanvasRenderingContext2D,
  sourceImage: HTMLImageElement,
  pose: PortraitPuppetPose,
  target: PortraitPuppetRect,
  rig: Readonly<PortraitPuppetRigDefinition>,
) {
  const follow = resolvePortraitPuppetRigidHeadFollow(
    pose.headYaw,
    pose.headTilt,
    pose.headBob,
  )
  if (
    Math.abs(follow.headOffsetX) < 0.0001
    && Math.abs(follow.headOffsetY) < 0.0001
    && Math.abs(follow.rotationRadians) < 0.0001
  ) return

  const patchRadiusX = rig.headRadiusX * 1.03
  const patchRadiusY = rig.headRadiusY * 1.06
  const basePose = resolveRigidPortraitBasePose(pose)
  const basis = resolvePortraitFeatureBasis(
    rig.headX,
    rig.headY,
    patchRadiusX,
    patchRadiusY,
    basePose,
    target,
    rig,
  )
  const padding = 4
  const patchWidth = Math.max(2, Math.ceil((basis.radiusX + padding) * 2))
  const patchHeight = Math.max(2, Math.ceil((basis.radiusY + padding) * 2))
  const patchCanvas = getRigidHeadFollowCanvas(patchWidth, patchHeight)
  const patchContext = patchCanvas?.getContext('2d')
  if (!patchCanvas || !patchContext) return

  const centerX = patchWidth / 2
  const centerY = patchHeight / 2
  const sourceLeft = Math.max(0, rig.headX - patchRadiusX)
  const sourceTop = Math.max(0, rig.headY - patchRadiusY)
  const sourceRight = Math.min(1, rig.headX + patchRadiusX)
  const sourceBottom = Math.min(1, rig.headY + patchRadiusY)
  const sourceWidth = (sourceRight - sourceLeft) * sourceImage.naturalWidth
  const sourceHeight = (sourceBottom - sourceTop) * sourceImage.naturalHeight
  const destinationX = centerX + (sourceLeft - rig.headX) / patchRadiusX * basis.radiusX
  const destinationY = centerY + (sourceTop - rig.headY) / patchRadiusY * basis.radiusY
  const destinationWidth = (sourceRight - sourceLeft) / patchRadiusX * basis.radiusX
  const destinationHeight = (sourceBottom - sourceTop) / patchRadiusY * basis.radiusY

  patchContext.setTransform(1, 0, 0, 1, 0, 0)
  patchContext.globalAlpha = 1
  patchContext.globalCompositeOperation = 'source-over'
  patchContext.clearRect(0, 0, patchWidth, patchHeight)
  patchContext.imageSmoothingEnabled = true
  patchContext.imageSmoothingQuality = 'high'
  patchContext.drawImage(
    sourceImage,
    sourceLeft * sourceImage.naturalWidth,
    sourceTop * sourceImage.naturalHeight,
    sourceWidth,
    sourceHeight,
    destinationX,
    destinationY,
    destinationWidth,
    destinationHeight,
  )

  patchContext.globalCompositeOperation = 'destination-in'
  patchContext.save()
  patchContext.translate(centerX, centerY)
  patchContext.scale(1, basis.radiusY / Math.max(1, basis.radiusX))
  const feather = patchContext.createRadialGradient(
    0,
    0,
    basis.radiusX * 0.82,
    0,
    0,
    basis.radiusX,
  )
  feather.addColorStop(0, 'rgba(255, 255, 255, 1)')
  feather.addColorStop(1, 'rgba(255, 255, 255, 0)')
  patchContext.fillStyle = feather
  patchContext.fillRect(
    -basis.radiusX,
    -basis.radiusX,
    basis.radiusX * 2,
    basis.radiusX * 2,
  )
  patchContext.restore()
  patchContext.globalCompositeOperation = 'source-over'

  const baseCos = Math.cos(basis.angle)
  const baseSin = Math.sin(basis.angle)
  const offsetX = follow.headOffsetX * target.width
  const offsetY = follow.headOffsetY * target.height
  context.save()
  context.translate(
    basis.center.x + offsetX * baseCos - offsetY * baseSin,
    basis.center.y + offsetX * baseSin + offsetY * baseCos,
  )
  context.rotate(basis.angle + follow.rotationRadians)
  context.drawImage(patchCanvas, -centerX, -centerY)
  context.restore()
}

/**
 * Move the inner face as one feathered rigid patch.
 *
 * The source rectangle, both eyes and the mouth all share one translation;
 * there is no per-triangle squash, shear, or far-eye resize. The surrounding
 * head/hair patch follows separately as another rigid transform.
 */
function drawPortraitProceduralRigidTurnFace(
  context: CanvasRenderingContext2D,
  sourceImage: HTMLImageElement,
  pose: PortraitPuppetPose,
  target: PortraitPuppetRect,
  rig: Readonly<PortraitPuppetRigDefinition>,
) {
  const turn = resolvePortraitPuppetRigidTurn(pose.headYaw)
  if (Math.abs(pose.headYaw) < 0.015 || turn.faceOffsetX === 0) return

  const centerY = (rig.eyeY + rig.mouthY) / 2
  const patchRadiusX = rig.headRadiusX * 0.57
  const patchRadiusY = rig.headRadiusY * 0.53
  const basePose = resolveRigidPortraitBasePose(pose)
  const basis = resolvePortraitFeatureBasis(
    rig.headX,
    centerY,
    patchRadiusX,
    patchRadiusY,
    basePose,
    target,
    rig,
  )
  const turnedBasis = applyRigidTurnToFeatureBasis(basis, pose, target, rig)
  const padding = 3
  const patchWidth = Math.max(2, Math.ceil((basis.radiusX + padding) * 2))
  const patchHeight = Math.max(2, Math.ceil((basis.radiusY + padding) * 2))
  const patchCanvas = getRigidFaceTurnCanvas(patchWidth, patchHeight)
  const patchContext = patchCanvas?.getContext('2d')
  if (!patchCanvas || !patchContext) return

  const centerX = patchWidth / 2
  const centerYPx = patchHeight / 2
  const sourceRadiusX = patchRadiusX * 1.2
  const sourceRadiusY = patchRadiusY * 1.2
  const sourceX = Math.max(0, (rig.headX - sourceRadiusX) * sourceImage.naturalWidth)
  const sourceY = Math.max(0, (centerY - sourceRadiusY) * sourceImage.naturalHeight)
  const sourceWidth = Math.min(
    sourceImage.naturalWidth - sourceX,
    sourceRadiusX * 2 * sourceImage.naturalWidth,
  )
  const sourceHeight = Math.min(
    sourceImage.naturalHeight - sourceY,
    sourceRadiusY * 2 * sourceImage.naturalHeight,
  )

  patchContext.setTransform(1, 0, 0, 1, 0, 0)
  patchContext.globalAlpha = 1
  patchContext.globalCompositeOperation = 'source-over'
  patchContext.clearRect(0, 0, patchWidth, patchHeight)
  patchContext.imageSmoothingEnabled = true
  patchContext.imageSmoothingQuality = 'high'
  patchContext.drawImage(
    sourceImage,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    centerX - basis.radiusX * 1.2,
    centerYPx - basis.radiusY * 1.2,
    basis.radiusX * 2.4,
    basis.radiusY * 2.4,
  )

  // Feather only the boundary. The eye/mouth core remains fully opaque, so
  // shifted features never double-expose against the unchanged base portrait.
  patchContext.globalCompositeOperation = 'destination-in'
  patchContext.save()
  patchContext.translate(centerX, centerYPx)
  patchContext.scale(1, basis.radiusY / Math.max(1, basis.radiusX))
  const feather = patchContext.createRadialGradient(
    0,
    0,
    basis.radiusX * 0.76,
    0,
    0,
    basis.radiusX,
  )
  feather.addColorStop(0, 'rgba(255, 255, 255, 1)')
  feather.addColorStop(1, 'rgba(255, 255, 255, 0)')
  patchContext.fillStyle = feather
  patchContext.fillRect(
    -basis.radiusX,
    -basis.radiusX,
    basis.radiusX * 2,
    basis.radiusX * 2,
  )
  patchContext.restore()
  patchContext.globalCompositeOperation = 'source-over'

  context.save()
  context.translate(turnedBasis.center.x, turnedBasis.center.y)
  context.rotate(turnedBasis.angle)
  context.drawImage(patchCanvas, -centerX, -centerYPx)
  context.restore()
}

function drawPortraitProceduralEyelid(
  context: CanvasRenderingContext2D,
  sourceImage: HTMLImageElement,
  centerX: number,
  pose: PortraitPuppetPose,
  target: PortraitPuppetRect,
  rig: Readonly<PortraitPuppetRigDefinition>,
  palette: PortraitPuppetProceduralPalette,
) {
  const amount = Math.max(0, Math.min(1, pose.blink))
  if (amount <= 0.001) return
  const basis = resolvePortraitFeatureBasis(
    centerX,
    rig.eyeY,
    rig.eyeRadiusX,
    rig.eyeRadiusY,
    resolveRigidPortraitBasePose(pose),
    target,
    rig,
  )
  const turnedBasis = applyRigidTurnToFeatureBasis(basis, pose, target, rig)
  const radiusX = turnedBasis.radiusX * 1.08
  const radiusY = turnedBasis.radiusY * 1.18
  // Keep the eye recognisably half-open through the middle of the blink. The
  // upper lid accelerates only near closure, matching a real blink instead of
  // turning 50% input into an already closed eye.
  const closure = Math.pow(amount, 1.58)
  const coverBottom = -radiusY * 1.18 + radiusY * 2.36 * closure

  context.save()
  context.translate(turnedBasis.center.x, turnedBasis.center.y)
  context.rotate(turnedBasis.angle)
  context.beginPath()
  context.ellipse(0, 0, radiusX, radiusY * 1.08, 0, 0, Math.PI * 2)
  context.clip()
  context.save()
  context.beginPath()
  context.moveTo(-radiusX * 1.05, -radiusY * 1.22)
  context.lineTo(radiusX * 1.05, -radiusY * 1.22)
  context.lineTo(radiusX, coverBottom)
  context.quadraticCurveTo(0, coverBottom + radiusY * 0.16, -radiusX, coverBottom)
  context.closePath()
  context.clip()
  // Reuse cheek pixels from the portrait as the lid texture. This retains the
  // source lighting and skin grain and avoids a flat sampled-colour sticker.
  const sourceX = Math.max(0, (centerX - rig.eyeRadiusX * 0.92) * sourceImage.naturalWidth)
  const sourceY = Math.max(0, (rig.eyeY + rig.eyeRadiusY * 1.28) * sourceImage.naturalHeight)
  const sourceWidth = Math.min(
    sourceImage.naturalWidth - sourceX,
    rig.eyeRadiusX * 1.84 * sourceImage.naturalWidth,
  )
  const sourceHeight = Math.min(
    sourceImage.naturalHeight - sourceY,
    Math.max(1, rig.eyeRadiusY * 0.72 * sourceImage.naturalHeight),
  )
  context.fillStyle = portraitColor(palette.skin)
  context.fillRect(-radiusX, -radiusY * 1.2, radiusX * 2, radiusY * 2.4)
  if (sourceWidth > 0 && sourceHeight > 0) {
    context.globalAlpha = 0.86
    context.drawImage(
      sourceImage,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      -radiusX,
      -radiusY * 1.2,
      radiusX * 2,
      radiusY * 2.4,
    )
    context.globalAlpha = 1
  }
  context.restore()

  const lashAmount = Math.max(0, Math.min(1, (closure - 0.66) / 0.25))
  if (lashAmount > 0) {
    const lashY = -radiusY * 0.42 + radiusY * 0.5 * closure
    context.globalAlpha = lashAmount
    context.beginPath()
    context.moveTo(-radiusX * 0.84, lashY)
    context.quadraticCurveTo(0, lashY + radiusY * 0.48, radiusX * 0.84, lashY)
    context.strokeStyle = portraitColor(palette.line)
    context.lineWidth = Math.max(0.8, radiusX * 0.052)
    context.lineCap = 'round'
    context.stroke()
  }
  context.restore()
}

function drawPortraitProceduralMouth(
  context: CanvasRenderingContext2D,
  sourceImage: HTMLImageElement,
  pose: PortraitPuppetPose,
  target: PortraitPuppetRect,
  rig: Readonly<PortraitPuppetRigDefinition>,
  palette: PortraitPuppetProceduralPalette,
) {
  const amount = Math.max(0, Math.min(1, pose.mouth))
  if (amount <= 0.018) return
  const basis = resolvePortraitFeatureBasis(
    rig.mouthX,
    rig.mouthY,
    rig.mouthRadiusX,
    rig.mouthRadiusY,
    resolveRigidPortraitBasePose(pose),
    target,
    rig,
  )
  const turnedBasis = applyRigidTurnToFeatureBasis(basis, pose, target, rig)
  const reveal = Math.max(0, Math.min(1, (amount - 0.018) / 0.12))
  const mouthWidth = turnedBasis.radiusX * (0.32 + amount * 0.1)
  const mouthHeight = turnedBasis.radiusY * (0.1 + amount * 0.5)

  context.save()
  context.translate(turnedBasis.center.x, turnedBasis.center.y)
  context.rotate(turnedBasis.angle)
  context.globalAlpha = reveal
  context.beginPath()
  context.ellipse(0, 0, turnedBasis.radiusX * 0.58, turnedBasis.radiusY * 0.82, 0, 0, Math.PI * 2)
  context.clip()
  context.fillStyle = portraitColor(palette.skin)
  context.fillRect(
    -turnedBasis.radiusX,
    -turnedBasis.radiusY,
    turnedBasis.radiusX * 2,
    turnedBasis.radiusY * 2,
  )
  const sourceX = Math.max(0, (rig.mouthX - rig.mouthRadiusX * 0.58) * sourceImage.naturalWidth)
  const sourceY = Math.max(0, (rig.mouthY + rig.mouthRadiusY * 1.1) * sourceImage.naturalHeight)
  const sourceWidth = Math.min(
    sourceImage.naturalWidth - sourceX,
    rig.mouthRadiusX * 1.16 * sourceImage.naturalWidth,
  )
  const sourceHeight = Math.min(
    sourceImage.naturalHeight - sourceY,
    Math.max(1, rig.mouthRadiusY * 0.5 * sourceImage.naturalHeight),
  )
  if (sourceWidth > 0 && sourceHeight > 0) {
    context.globalAlpha = 0.82 * reveal
    context.drawImage(
      sourceImage,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      -turnedBasis.radiusX * 0.58,
      -turnedBasis.radiusY * 0.82,
      turnedBasis.radiusX * 1.16,
      turnedBasis.radiusY * 1.64,
    )
    context.globalAlpha = reveal
  }
  context.restore()

  context.save()
  context.translate(turnedBasis.center.x, turnedBasis.center.y)
  context.rotate(turnedBasis.angle)
  context.globalAlpha = reveal
  if (amount < 0.22) {
    context.beginPath()
    context.moveTo(-mouthWidth, 0)
    context.quadraticCurveTo(0, mouthHeight * 0.45, mouthWidth, 0)
    context.strokeStyle = portraitColor(palette.mouth)
    context.lineWidth = Math.max(0.8, mouthHeight * 0.42)
    context.lineCap = 'round'
    context.stroke()
    context.restore()
    return
  }
  context.beginPath()
  context.ellipse(0, mouthHeight * 0.06, mouthWidth, mouthHeight, 0, 0, Math.PI * 2)
  context.fillStyle = portraitColor(palette.mouth)
  context.fill()
  if (amount > 0.72) {
    context.beginPath()
    context.ellipse(
      0,
      mouthHeight * 0.58,
      mouthWidth * 0.54,
      mouthHeight * 0.25,
      0,
      0,
      Math.PI,
    )
    context.fillStyle = portraitColor(palette.tongue)
    context.fill()
  }
  context.restore()
}

function drawPortraitProceduralTurnShade(
  context: CanvasRenderingContext2D,
  pose: PortraitPuppetPose,
  target: PortraitPuppetRect,
  rig: Readonly<PortraitPuppetRigDefinition>,
  palette: PortraitPuppetProceduralPalette,
) {
  const amount = Math.min(1, Math.abs(pose.headYaw))
  if (amount < 0.04) return
  const basis = resolvePortraitFeatureBasis(
    rig.headX,
    (rig.eyeY + rig.mouthY) / 2,
    rig.headRadiusX * 0.49,
    rig.headRadiusY * 0.62,
    resolveRigidPortraitBasePose(pose),
    target,
    rig,
  )
  const turnedBasis = applyRigidTurnToFeatureBasis(basis, pose, target, rig)
  context.save()
  context.translate(turnedBasis.center.x, turnedBasis.center.y)
  context.rotate(turnedBasis.angle)
  context.beginPath()
  context.ellipse(0, 0, turnedBasis.radiusX, turnedBasis.radiusY, 0, 0, Math.PI * 2)
  context.clip()
  const gradient = context.createLinearGradient(-turnedBasis.radiusX, 0, turnedBasis.radiusX, 0)
  const shadow = portraitColor(palette.line, 0.075 * amount)
  if (pose.headYaw < 0) {
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)')
    gradient.addColorStop(0.58, 'rgba(0, 0, 0, 0)')
    gradient.addColorStop(1, shadow)
  } else {
    gradient.addColorStop(0, shadow)
    gradient.addColorStop(0.42, 'rgba(0, 0, 0, 0)')
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
  }
  context.fillStyle = gradient
  context.fillRect(
    -turnedBasis.radiusX,
    -turnedBasis.radiusY,
    turnedBasis.radiusX * 2,
    turnedBasis.radiusY * 2,
  )
  context.restore()
}

/** Draw local eyelid/mouth geometry generated entirely from the source image. */
export function drawPortraitPuppetProceduralFace(
  context: CanvasRenderingContext2D,
  sourceImage: HTMLImageElement,
  pose: PortraitPuppetPose,
  target: PortraitPuppetRect,
  rigInput: Partial<PortraitPuppetRigDefinition> | undefined,
  palette: PortraitPuppetProceduralPalette,
) {
  const rig = normalizePortraitPuppetRig(rigInput)
  drawPortraitProceduralRigidHeadFollow(context, sourceImage, pose, target, rig)
  drawPortraitProceduralRigidTurnFace(context, sourceImage, pose, target, rig)
  drawPortraitProceduralTurnShade(context, pose, target, rig, palette)
  drawPortraitProceduralEyelid(context, sourceImage, rig.eyeLeftX, pose, target, rig, palette)
  drawPortraitProceduralEyelid(context, sourceImage, rig.eyeRightX, pose, target, rig, palette)
  drawPortraitProceduralMouth(context, sourceImage, pose, target, rig, palette)
}

/** Draw a complete portrait frame with v1 replacement or v2 keyed overlays. */
export function drawPortraitPuppetFrame(
  context: CanvasRenderingContext2D,
  assets: PortraitPuppetRenderAssets,
  mesh: PortraitPuppetMesh,
  pose: PortraitPuppetPose,
  canvasWidth: number,
  canvasHeight: number,
  rigInput?: Partial<PortraitPuppetRigDefinition>,
): void {
  context.setTransform(1, 0, 0, 1, 0, 0)
  context.clearRect(0, 0, canvasWidth, canvasHeight)
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  const target = resolvePortraitPuppetContainRect(
    canvasWidth,
    canvasHeight,
    assets.base.naturalWidth,
    assets.base.naturalHeight,
  )

  if (assets.layerMode === 'procedural-v3') {
    const geometryPose = resolvePortraitPuppetProceduralGeometryPose(pose)
    drawPortraitPuppetImageMesh(context, assets.base, mesh, geometryPose, target, rigInput)
    drawPortraitPuppetProceduralFace(
      context,
      assets.base,
      {
        ...geometryPose,
        blink: pose.blink,
        mouth: pose.mouth,
        headYaw: pose.headYaw,
        headTilt: pose.headTilt,
        headBob: pose.headBob,
      },
      target,
      rigInput,
      assets.proceduralPalette ?? DEFAULT_PROCEDURAL_PALETTE,
    )
    return
  }

  if (assets.layerMode !== 'rig-v2-overlay') {
    const mouthWeight = assets.mouth ? pose.mouth : 0
    const blinkWeight = assets.blink ? pose.blink * (1 - mouthWeight) : 0
    const baseWeight = Math.max(0, 1 - mouthWeight - blinkWeight)
    drawPortraitPuppetImageMesh(context, assets.base, mesh, pose, target, rigInput, baseWeight)
    if (assets.blink && blinkWeight > 0.001) {
      drawPortraitPuppetImageMesh(context, assets.blink, mesh, pose, target, rigInput, blinkWeight)
    }
    if (assets.mouth && mouthWeight > 0.001) {
      drawPortraitPuppetImageMesh(context, assets.mouth, mesh, pose, target, rigInput, mouthWeight)
    }
    return
  }

  const geometryPose: PortraitPuppetPose = {
    ...pose,
    blink: 0,
    mouth: 0,
    headYaw: 0,
  }
  const turnBlend = resolvePortraitPuppetTurnBlend(pose.headYaw)
  const turnAsset = turnBlend.direction === 'left' ? assets.headLeft : assets.headRight
  const turnWeight = turnAsset
    ? turnBlend.weight
    : 0
  drawPortraitPuppetImageMesh(
    context,
    assets.base,
    mesh,
    geometryPose,
    target,
    rigInput,
    1 - turnWeight,
  )
  if (turnAsset && turnWeight > 0.001) {
    drawPortraitPuppetImageMesh(context, turnAsset, mesh, geometryPose, target, rigInput, turnWeight)
  }
  if (assets.blink && pose.blink > 0.001) {
    drawPortraitPuppetImageMesh(context, assets.blink, mesh, geometryPose, target, rigInput, pose.blink)
  }
  if (assets.mouth && pose.mouth > 0.001) {
    drawPortraitPuppetImageMesh(context, assets.mouth, mesh, geometryPose, target, rigInput, pose.mouth)
  }
}
