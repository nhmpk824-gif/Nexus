/**
 * Canvas 2D renderer for validated Portrait Puppet v4 packages.
 * Each transparent part owns an ArtMesh-like grid; authored keyform offsets
 * deform vertices while masks and parent transforms preserve occlusion.
 */

import type {
  PortraitPuppetV4Manifest,
  PortraitPuppetV4Point,
} from '../../../../shared/portraitPuppetV4Contract.js'
import {
  applyPortraitPuppetV4Matrix,
  resolvePortraitPuppetV4Parts,
  type PortraitPuppetV4Matrix,
  type PortraitPuppetV4ParameterValues,
  type PortraitPuppetV4ResolvedPart,
} from '../portraitPuppetV4Runtime.ts'
import {
  drawPortraitPuppetTriangle,
  resolvePortraitPuppetContainRect,
  type PortraitPuppetRect,
} from '../portraitPuppetRenderer.ts'

export type PortraitPuppetV4RenderAssets = {
  parts: Readonly<Record<string, HTMLImageElement>>
  masks: Readonly<Record<string, HTMLImageElement>>
  scratchCanvas?: HTMLCanvasElement
}

export type PortraitPuppetV4Mesh = {
  points: PortraitPuppetV4Point[]
  triangles: Array<readonly [number, number, number]>
}

function resolveScratchCanvas(
  context: CanvasRenderingContext2D,
  assets: PortraitPuppetV4RenderAssets,
  width: number,
  height: number,
) {
  const scratch = assets.scratchCanvas ?? context.canvas.ownerDocument.createElement('canvas')
  if (!assets.scratchCanvas) assets.scratchCanvas = scratch
  if (scratch.width !== width) scratch.width = width
  if (scratch.height !== height) scratch.height = height
  return scratch
}

function normalizedMatrixToCanvas(
  matrix: PortraitPuppetV4Matrix,
  target: PortraitPuppetRect,
  image: HTMLImageElement,
): PortraitPuppetV4Matrix {
  return [
    matrix[0] * target.width / image.naturalWidth,
    matrix[1] * target.height / image.naturalWidth,
    matrix[2] * target.width / image.naturalHeight,
    matrix[3] * target.height / image.naturalHeight,
    target.x + matrix[4] * target.width,
    target.y + matrix[5] * target.height,
  ]
}

function drawMaskImage(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  matrix: PortraitPuppetV4Matrix,
  target: PortraitPuppetRect,
) {
  const canvasMatrix = normalizedMatrixToCanvas(matrix, target, image)
  context.save()
  context.setTransform(...canvasMatrix)
  context.drawImage(image, 0, 0)
  context.restore()
}

function destinationPoints(
  resolved: PortraitPuppetV4ResolvedPart,
  mesh: PortraitPuppetV4Mesh,
  target: PortraitPuppetRect,
) {
  return mesh.points.map((point, index) => {
    const offset = resolved.vertexOffsets[index] ?? [0, 0]
    const transformed = applyPortraitPuppetV4Matrix(resolved.matrix, [
      point[0] + offset[0],
      point[1] + offset[1],
    ])
    return {
      x: target.x + transformed[0] * target.width,
      y: target.y + transformed[1] * target.height,
    }
  })
}

function drawPartMesh(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  resolved: PortraitPuppetV4ResolvedPart,
  target: PortraitPuppetRect,
) {
  const mesh = createPortraitPuppetV4Mesh(
    resolved.part.mesh.columns,
    resolved.part.mesh.rows,
  )
  const destination = destinationPoints(resolved, mesh, target)
  for (const triangle of mesh.triangles) {
    const source = triangle.map((index) => ({
      x: mesh.points[index][0] * image.naturalWidth,
      y: mesh.points[index][1] * image.naturalHeight,
    })) as [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }]
    const output = triangle.map((index) => destination[index]) as [
      { x: number; y: number },
      { x: number; y: number },
      { x: number; y: number },
    ]
    drawPortraitPuppetTriangle(context, image, source, output, 0.55)
  }
}

function drawResolvedPart(
  context: CanvasRenderingContext2D,
  assets: PortraitPuppetV4RenderAssets,
  resolved: PortraitPuppetV4ResolvedPart,
  resolvedById: ReadonlyMap<string, PortraitPuppetV4ResolvedPart>,
  manifest: PortraitPuppetV4Manifest,
  target: PortraitPuppetRect,
  canvasWidth: number,
  canvasHeight: number,
) {
  const image = assets.parts[resolved.part.id]
  if (!image || resolved.opacity <= 0.001) return
  const mask = resolved.part.maskId
    ? manifest.masks.find((entry) => entry.id === resolved.part.maskId)
    : undefined
  const maskImage = mask ? assets.masks[mask.id] : undefined

  if (!mask || !maskImage) {
    context.save()
    context.globalAlpha = resolved.opacity
    context.globalCompositeOperation = resolved.part.blendMode
    drawPartMesh(context, image, resolved, target)
    context.restore()
    return
  }

  const scratch = resolveScratchCanvas(context, assets, canvasWidth, canvasHeight)
  const scratchContext = scratch.getContext('2d')
  if (!scratchContext) return
  scratchContext.setTransform(1, 0, 0, 1, 0, 0)
  scratchContext.clearRect(0, 0, canvasWidth, canvasHeight)
  scratchContext.globalCompositeOperation = 'source-over'
  scratchContext.globalAlpha = 1
  drawPartMesh(scratchContext, image, resolved, target)
  scratchContext.globalCompositeOperation = mask.inverted ? 'destination-out' : 'destination-in'
  const maskMatrix = mask.parentId
    ? resolvedById.get(mask.parentId)?.matrix ?? resolved.matrix
    : resolved.matrix
  drawMaskImage(scratchContext, maskImage, maskMatrix, target)

  context.save()
  context.globalAlpha = resolved.opacity
  context.globalCompositeOperation = resolved.part.blendMode
  context.drawImage(scratch, 0, 0)
  context.restore()
}

/** Create a regular normalized grid with stable triangle winding. */
export function createPortraitPuppetV4Mesh(columns: number, rows: number): PortraitPuppetV4Mesh {
  const safeColumns = Math.max(1, Math.min(24, Math.round(columns)))
  const safeRows = Math.max(1, Math.min(32, Math.round(rows)))
  const points = []
  const triangles: Array<readonly [number, number, number]> = []
  for (let row = 0; row <= safeRows; row += 1) {
    for (let column = 0; column <= safeColumns; column += 1) {
      points.push([column / safeColumns, row / safeRows] as PortraitPuppetV4Point)
    }
  }
  for (let row = 0; row < safeRows; row += 1) {
    for (let column = 0; column < safeColumns; column += 1) {
      const topLeft = row * (safeColumns + 1) + column
      const topRight = topLeft + 1
      const bottomLeft = topLeft + safeColumns + 1
      const bottomRight = bottomLeft + 1
      triangles.push([topLeft, bottomLeft, topRight], [topRight, bottomLeft, bottomRight])
    }
  }
  return { points, triangles }
}

/** Render a complete transparent layered frame into the destination canvas. */
export function drawPortraitPuppetV4Frame(
  context: CanvasRenderingContext2D,
  assets: PortraitPuppetV4RenderAssets,
  manifest: PortraitPuppetV4Manifest,
  parameters: PortraitPuppetV4ParameterValues,
  canvasWidth: number,
  canvasHeight: number,
) {
  context.setTransform(1, 0, 0, 1, 0, 0)
  context.clearRect(0, 0, canvasWidth, canvasHeight)
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  const target = resolvePortraitPuppetContainRect(
    canvasWidth,
    canvasHeight,
    manifest.canvas.width,
    manifest.canvas.height,
  )
  const resolved = resolvePortraitPuppetV4Parts(manifest, parameters)
  const resolvedById = new Map(resolved.map((entry) => [entry.part.id, entry]))
  for (const part of resolved) {
    drawResolvedPart(
      context,
      assets,
      part,
      resolvedById,
      manifest,
      target,
      canvasWidth,
      canvasHeight,
    )
  }
}
