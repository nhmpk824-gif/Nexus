#!/usr/bin/env node

/**
 * Convert a same-canvas AI layer directory into a validated v4 package.
 * The generated keyforms are intentionally conservative and reusable; an
 * artist or rigging model can replace them with character-specific offsets.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import sharp from 'sharp'

import {
  validatePortraitPuppetV4Manifest,
} from '../shared/portraitPuppetV4Contract.js'
import {
  resolvePortraitPuppetV4Package,
  validatePortraitPuppetV4Assets,
} from '../electron/services/portraitPuppetV4Package.js'
import { writeSpritePetZipArchive } from '../electron/services/spritePetPackage.js'

const PART_ORDER = [
  'back-hair',
  'leg-left',
  'leg-right',
  'foot-left',
  'foot-right',
  'torso',
  'neck',
  'arm-left',
  'arm-right',
  'hand-left',
  'hand-right',
  'cloth-left',
  'cloth-right',
  'face-base',
  'ear-left',
  'ear-right',
  'eye-white-left',
  'eye-white-right',
  'iris-left',
  'iris-right',
  'brow-left',
  'brow-right',
  'nose',
  'mouth-cavity',
  'teeth',
  'tongue',
  'mouth-closed',
  'eyelid-upper-left',
  'eyelid-upper-right',
  'eyelid-lower-left',
  'eyelid-lower-right',
  'eye-closed-left',
  'eye-closed-right',
  'side-hair-left',
  'side-hair-right',
  'front-bangs',
  'accessory',
]

const MASK_ROLES = ['face', 'eye-left', 'eye-right', 'mouth']
const HEAD_ROLES = new Set([
  'back-hair',
  'ear-left',
  'ear-right',
  'eye-white-left',
  'eye-white-right',
  'iris-left',
  'iris-right',
  'brow-left',
  'brow-right',
  'nose',
  'mouth-cavity',
  'teeth',
  'tongue',
  'mouth-closed',
  'eyelid-upper-left',
  'eyelid-upper-right',
  'eyelid-lower-left',
  'eyelid-lower-right',
  'eye-closed-left',
  'eye-closed-right',
  'side-hair-left',
  'side-hair-right',
  'front-bangs',
])
const HAIR_ROLES = new Set([
  'back-hair',
  'side-hair-left',
  'side-hair-right',
  'front-bangs',
])
const BODY_ROLES = new Set([
  'neck',
  'arm-left',
  'arm-right',
  'hand-left',
  'hand-right',
  'cloth-left',
  'cloth-right',
  'accessory',
])

function slug(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/gu, '-')
    .replace(/-+/gu, '-')
    .replace(/^-|-$/gu, '') || 'portrait-puppet-v4'
}

function keyforms(minValue, maxValue, build) {
  return [minValue, 0, maxValue].map((value) => ({ value, ...build(value) }))
}

const FACE_MESH_COLUMNS = 12
const FACE_MESH_ROWS = 14

function meshForRole(role) {
  if (role === 'face-base') return { columns: FACE_MESH_COLUMNS, rows: FACE_MESH_ROWS }
  if (HAIR_ROLES.has(role) || role.startsWith('cloth-')) return { columns: 5, rows: 7 }
  return { columns: 2, rows: 2 }
}

function faceTurnOffsets(value) {
  const columns = FACE_MESH_COLUMNS
  const rows = FACE_MESH_ROWS
  const offsets = []
  for (let row = 0; row <= rows; row += 1) {
    const y = row / rows
    const verticalWeight = Math.exp(-Math.pow((y - 0.25) / 0.24, 4))
    for (let column = 0; column <= columns; column += 1) {
      const x = column / columns
      const sphericalWeight = Math.max(0, 1 - Math.pow(x * 2 - 1, 2))
      offsets.push([
        value * (0.006 + sphericalWeight * 0.018) * verticalWeight,
        -Math.abs(value) * sphericalWeight * 0.0015 * verticalWeight,
      ])
    }
  }
  return offsets
}

function faceBindings() {
  return [
    {
      parameter: 'ParamAngleX',
      keyforms: keyforms(-1, 1, (value) => ({
        translate: [value * 0.004, 0],
        vertexOffsets: faceTurnOffsets(value),
      })),
    },
    {
      parameter: 'ParamAngleY',
      keyforms: keyforms(-1, 1, (value) => ({ translate: [0, value * 0.007] })),
    },
    {
      parameter: 'ParamAngleZ',
      keyforms: keyforms(-1, 1, (value) => ({ rotateDeg: value * 7 })),
    },
    {
      parameter: 'ParamCheek',
      keyforms: [
        { value: 0, scale: [1, 1], translate: [0, 0] },
        { value: 1, scale: [1.016, 1.01], translate: [0, 0.003] },
      ],
    },
  ]
}

function browBindings(role) {
  const side = role.endsWith('left') ? -1 : 1
  const yParameter = role.endsWith('left') ? 'ParamBrowLY' : 'ParamBrowRY'
  const angleParameter = role.endsWith('left') ? 'ParamBrowLAngle' : 'ParamBrowRAngle'
  return [
    {
      parameter: yParameter,
      keyforms: keyforms(-1, 1, (value) => ({ translate: [0, value * 0.012] })),
    },
    {
      parameter: role.endsWith('left') ? 'ParamBrowLX' : 'ParamBrowRX',
      keyforms: keyforms(-1, 1, (value) => ({ translate: [value * 0.008, 0] })),
    },
    {
      parameter: angleParameter,
      keyforms: keyforms(-1, 1, (value) => ({ rotateDeg: value * side * 10 })),
    },
    {
      parameter: role.endsWith('left') ? 'ParamBrowLForm' : 'ParamBrowRForm',
      keyforms: keyforms(-1, 1, (value) => ({
        translate: [side * value * 0.0015, 0],
        scale: [1 + Math.abs(value) * 0.05, 1],
      })),
    },
    {
      parameter: 'ParamBrowForm',
      keyforms: keyforms(-1, 1, (value) => ({
        translate: [side * value * 0.002, 0],
        scale: [1 + Math.abs(value) * 0.04, 1],
      })),
    },
  ]
}

function eyeTurnBindings(role) {
  const isLeft = role.endsWith('left')
  return [{
    parameter: 'ParamAngleX',
    keyforms: [
      { value: -1, translate: [isLeft ? -0.014 : -0.006, 0] },
      { value: 0, translate: [0, 0] },
      { value: 1, translate: [isLeft ? 0.006 : 0.014, 0] },
    ],
  }]
}

function irisBindings(role) {
  return [
    ...eyeTurnBindings(role),
    {
      parameter: 'ParamEyeBallX',
      keyforms: keyforms(-1, 1, (value) => ({ translate: [value * 0.012, 0] })),
    },
    {
      parameter: 'ParamEyeBallY',
      keyforms: keyforms(-1, 1, (value) => ({ translate: [0, value * 0.008] })),
    },
    {
      parameter: role.endsWith('left') ? 'ParamEyeLOpen' : 'ParamEyeROpen',
      keyforms: [
        { value: 0, opacity: 0 },
        { value: 0.15, opacity: 1 },
        { value: 1, opacity: 1 },
      ],
    },
    {
      parameter: role.endsWith('left') ? 'ParamEyeLForm' : 'ParamEyeRForm',
      keyforms: keyforms(-1, 1, (value) => ({
        scale: [1 + value * 0.06, 1 - value * 0.08],
      })),
    },
    {
      parameter: 'ParamEyeBallForm',
      keyforms: [
        { value: 0, scale: [1, 1] },
        { value: 1, scale: [0.86, 0.86] },
      ],
    },
  ]
}

function earBindings(role) {
  const side = role.endsWith('left') ? -1 : 1
  return [{
    parameter: 'ParamAngleX',
    keyforms: keyforms(-1, 1, (value) => ({
      translate: [value * side * 0.006, Math.abs(value) * 0.001],
      rotateDeg: value * side * 7,
    })),
  }]
}

function noseBindings() {
  return [
    {
      parameter: 'ParamAngleX',
      keyforms: keyforms(-1, 1, (value) => ({ translate: [value * 0.01, 0] })),
    },
    {
      parameter: 'ParamAngleY',
      keyforms: keyforms(-1, 1, (value) => ({ translate: [0, value * 0.006] })),
    },
  ]
}

function eyelidBindings(role) {
  const openParameter = role.endsWith('left') ? 'ParamEyeLOpen' : 'ParamEyeROpen'
  const smileParameter = role.endsWith('left') ? 'ParamEyeLSmile' : 'ParamEyeRSmile'
  if (role.startsWith('eye-closed-')) {
    return [{
      parameter: openParameter,
      keyforms: [
        { value: 0, opacity: 1 },
        { value: 0.2, opacity: 0 },
        { value: 1, opacity: 0 },
      ],
    }]
  }
  const isLower = role.startsWith('eyelid-lower-')
  const closeY = isLower ? -0.012 : 0.014
  const openBinding = {
    parameter: openParameter,
    keyforms: [
      { value: 0, translate: [0, closeY], scale: [1, 1.18], opacity: 1 },
      { value: 0.5, translate: [0, closeY * 0.36], scale: [1, 1.06], opacity: 1 },
      { value: 1, translate: [0, 0], scale: [1, 1], opacity: 1 },
    ],
  }
  if (isLower) {
    return [
      openBinding,
      {
        parameter: smileParameter,
        keyforms: [
          { value: 0, translate: [0, 0], scale: [1, 1] },
          { value: 1, translate: [0, -0.007], scale: [1.02, 1.22] },
        ],
      },
    ]
  }
  return [
    openBinding,
    {
      parameter: smileParameter,
      keyforms: [
        { value: 0, translate: [0, 0], scale: [1, 1] },
        { value: 1, translate: [0, 0.003], scale: [1, 0.92] },
      ],
    },
  ]
}

function mouthBindings(role) {
  const frown = {
    parameter: 'ParamMouthDown',
    keyforms: [
      { value: 0, translate: [0, 0], scale: [1, 1] },
      { value: 1, translate: [0, 0.004], scale: [0.96, 1.06] },
    ],
  }
  if (role === 'mouth-closed') {
    return [
      {
        parameter: 'ParamMouthOpenY',
        keyforms: [
          { value: 0, opacity: 1 },
          { value: 0.12, opacity: 0 },
          { value: 1, opacity: 0 },
        ],
      },
      frown,
    ]
  }
  const open = {
    parameter: 'ParamMouthOpenY',
    keyforms: [
      { value: 0, scale: [1, 0.12], opacity: 0 },
      { value: 0.15, scale: [1, 0.45], opacity: 1 },
      { value: 1, scale: [1.04, 1.45], opacity: 1 },
    ],
  }
  if (role === 'teeth' || role === 'tongue') {
    return [
      open,
      {
        parameter: 'ParamMouthNarrow',
        keyforms: [
          { value: 0, scale: [1, 1] },
          { value: 1, scale: [0.92, 1.04], translate: [0, 0.004] },
        ],
      },
    ]
  }
  return [
    open,
    {
      parameter: 'ParamMouthRound',
      keyforms: [
        { value: 0, scale: [1, 1] },
        { value: 1, scale: [1.05, 1.14] },
      ],
    },
    frown,
  ]
}

function bindingsForRole(role) {
  if (role === 'face-base') return faceBindings()
  if (role === 'brow-left' || role === 'brow-right') return browBindings(role)
  if (role === 'ear-left' || role === 'ear-right') return earBindings(role)
  if (role === 'nose') return noseBindings()
  if (role === 'iris-left' || role === 'iris-right') return irisBindings(role)
  if (role.startsWith('eyelid-') || role.startsWith('eye-closed-')) return eyelidBindings(role)
  if (role === 'eye-white-left' || role === 'eye-white-right') {
    const parameter = role.endsWith('left') ? 'ParamEyeLOpen' : 'ParamEyeROpen'
    return [
      ...eyeTurnBindings(role),
      {
        parameter,
        keyforms: [
          { value: 0, opacity: 0 },
          { value: 0.12, opacity: 1 },
          { value: 1, opacity: 1 },
        ],
      },
    ]
  }
  if (role === 'mouth-closed' || role === 'mouth-cavity' || role === 'teeth' || role === 'tongue') {
    return mouthBindings(role)
  }
  if (role === 'torso') {
    return [
      {
        parameter: 'ParamBreath',
        keyforms: keyforms(-1, 1, (value) => ({ scale: [1 + value * 0.006, 1 + value * 0.003] })),
      },
      {
        parameter: 'ParamBodyAngleY',
        keyforms: keyforms(-1, 1, (value) => ({
          translate: [0, value * 0.004],
          rotateDeg: value * 1.6,
        })),
      },
      {
        parameter: 'ParamBodyAngleZ',
        keyforms: keyforms(-1, 1, (value) => ({ rotateDeg: value * 2.8 })),
      },
    ]
  }
  if (role === 'arm-left' || role === 'arm-right') {
    const lead = role.endsWith('right') ? 1 : 0.28
    const side = role.endsWith('left') ? -1 : 1
    return [{
      parameter: 'ParamArmSway',
      keyforms: keyforms(-1.5, 1.5, (value) => ({
        translate: [value * side * 0.01 * lead, Math.abs(value) * 0.002 * lead],
        rotateDeg: value * side * 11 * lead,
      })),
    }]
  }
  if (HAIR_ROLES.has(role)) {
    const direction = role.endsWith('left') ? -1 : 1
    return [{
      parameter: 'ParamHairSway',
      keyforms: keyforms(-1.5, 1.5, (value) => ({
        translate: [value * 0.004, Math.abs(value) * 0.001],
        rotateDeg: value * (3.2 + direction * 0.5),
      })),
    }]
  }
  if (role.startsWith('cloth-')) {
    return [{
      parameter: 'ParamClothSway',
      keyforms: keyforms(-1.5, 1.5, (value) => ({
        translate: [value * 0.005, Math.abs(value) * 0.0015],
        rotateDeg: value * 2.7,
      })),
    }]
  }
  if (role === 'accessory') {
    return [{
      parameter: 'ParamAccessorySway',
      keyforms: keyforms(-1.5, 1.5, (value) => ({ rotateDeg: value * 7.5 })),
    }]
  }
  return []
}

function parentForRole(role, available) {
  if (role === 'torso' || role.startsWith('leg-') || role.startsWith('foot-')) return ''
  if (role === 'neck') return available.has('torso') ? 'torso' : ''
  if (role === 'face-base') return available.has('neck') ? 'neck' : ''
  if (HEAD_ROLES.has(role)) return available.has('face-base') ? 'face-base' : ''
  if (BODY_ROLES.has(role)) return available.has('torso') ? 'torso' : ''
  return ''
}

function pivotForRole(role) {
  if (role === 'torso') return [0.5, 0.82]
  if (role === 'arm-left') return [0.38, 0.36]
  if (role === 'arm-right') return [0.62, 0.36]
  if (role === 'face-base' || HEAD_ROLES.has(role)) return [0.5, 0.3]
  if (role.startsWith('cloth-')) return [0.5, 0.48]
  if (role === 'accessory') return [0.5, 0.38]
  return [0.5, 0.5]
}

function maskForRole(role, availableMasks) {
  if (role === 'iris-left' && availableMasks.has('eye-left')) return 'eye-left-mask'
  if (role === 'iris-right' && availableMasks.has('eye-right')) return 'eye-right-mask'
  if (['mouth-cavity', 'teeth', 'tongue'].includes(role) && availableMasks.has('mouth')) {
    return 'mouth-mask'
  }
  return ''
}

function defaultPhysics(hasAccessory) {
  return [
    {
      id: 'hair-follow',
      input: 'ParamAngleX',
      output: 'ParamHairSway',
      scale: 1.2,
      mass: 0.8,
      stiffness: 105,
      damping: 14,
      delayMs: 105,
      min: -1.5,
      max: 1.5,
    },
    {
      id: 'cloth-follow',
      input: 'ParamBodyAngleZ',
      output: 'ParamClothSway',
      scale: 1.35,
      mass: 1.15,
      stiffness: 72,
      damping: 12,
      delayMs: 180,
      min: -1.5,
      max: 1.5,
    },
    ...(hasAccessory ? [{
      id: 'accessory-follow',
      input: 'ParamBodyAngleZ',
      output: 'ParamAccessorySway',
      scale: 1.8,
      mass: 0.55,
      stiffness: 82,
      damping: 9,
      delayMs: 135,
      min: -1.5,
      max: 1.5,
    }] : []),
  ]
}

/** Build the reusable v4 rig manifest for one set of discovered layer roles. */
export function buildPortraitPuppetV4Manifest({
  id,
  displayName,
  description = '',
  width,
  height,
  partRoles,
  maskRoles,
  qualityTier = 'complete',
}) {
  const available = new Set(partRoles)
  const availableMasks = new Set(maskRoles)
  const parts = PART_ORDER
    .filter((role) => available.has(role))
    .map((role, index) => ({
      id: role,
      role,
      path: `parts/${role}.png`,
      parentId: parentForRole(role, available),
      pivot: pivotForRole(role),
      zIndex: index * 10,
      opacity: 1,
      blendMode: 'source-over',
      maskId: maskForRole(role, availableMasks),
      mesh: meshForRole(role),
      bindings: bindingsForRole(role),
    }))
  const masks = MASK_ROLES
    .filter((role) => availableMasks.has(role))
    .map((role) => ({
      id: `${role}-mask`,
      role,
      path: `masks/${role}.png`,
      parentId: available.has('face-base') ? 'face-base' : '',
      inverted: false,
    }))
  return {
    id: slug(id || displayName),
    displayName: String(displayName ?? '').trim() || 'Portrait Puppet v4',
    description: String(description ?? '').trim(),
    kind: 'portrait-puppet',
    formatVersion: 4,
    renderMode: 'layered-artmesh-v1',
    qualityTier,
    portraitPath: 'preview.png',
    canvas: { width, height },
    masks,
    parts,
    physics: defaultPhysics(available.has('accessory')),
  }
}

async function existingRoles(directoryPath, folderName, roles) {
  const found = []
  for (const role of roles) {
    try {
      const stats = await fs.stat(path.join(directoryPath, folderName, `${role}.png`))
      if (stats.isFile()) found.push(role)
    } catch {
      // Missing roles are reported together by the semantic validator.
    }
  }
  return found
}

async function atomicWriteManifest(manifestPath, manifest) {
  const temporaryPath = `${manifestPath}.tmp-${process.pid}`
  await fs.writeFile(temporaryPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  await fs.rename(temporaryPath, manifestPath)
}

/** Generate pet.json, validate every image, and write an importable ZIP. */
export async function scaffoldPortraitPuppetV4({
  sourceDirectory,
  id = '',
  displayName = '',
  description = '',
  qualityTier = 'complete',
}) {
  const rootPath = path.resolve(sourceDirectory)
  const previewPath = path.join(rootPath, 'preview.png')
  const metadata = await sharp(previewPath).metadata()
  if (!metadata.width || !metadata.height || metadata.format !== 'png' || !metadata.hasAlpha) {
    throw new Error('preview.png must be a transparent PNG with readable dimensions')
  }
  const partRoles = await existingRoles(rootPath, 'parts', PART_ORDER)
  const maskRoles = await existingRoles(rootPath, 'masks', MASK_ROLES)
  const manifest = buildPortraitPuppetV4Manifest({
    id: id || path.basename(rootPath),
    displayName: displayName || path.basename(rootPath),
    description,
    width: metadata.width,
    height: metadata.height,
    partRoles,
    maskRoles,
    qualityTier,
  })
  const semantic = validatePortraitPuppetV4Manifest(manifest)
  if (!semantic.valid) {
    throw new Error(semantic.errors.map((entry) => `${entry.code}:${entry.path}`).join('\n'))
  }
  const manifestPath = path.join(rootPath, 'pet.json')
  await atomicWriteManifest(manifestPath, semantic.manifest)
  const resolved = resolvePortraitPuppetV4Package(semantic.manifest, manifestPath)
  const audit = await validatePortraitPuppetV4Assets(resolved)
  const archivePath = path.join(rootPath, `${semantic.manifest.id}.nexus-portrait.zip`)
  await writeSpritePetZipArchive({
    archivePath,
    files: [
      { path: manifestPath, name: 'pet.json' },
      { path: previewPath, name: 'preview.png' },
      ...resolved.parts.map((part) => ({
        path: resolved.sourcePartPaths[part.id],
        name: part.path,
      })),
      ...resolved.masks.map((mask) => ({
        path: resolved.sourceMaskPaths[mask.id],
        name: mask.path,
      })),
    ],
  })
  return { manifest: semantic.manifest, manifestPath, archivePath, audit }
}

async function main() {
  const sourceDirectory = process.argv[2]
  if (!sourceDirectory) {
    throw new Error('Usage: npm run pet:scaffold-portrait-v4 -- /path/to/layer-directory')
  }
  const result = await scaffoldPortraitPuppetV4({ sourceDirectory })
  process.stdout.write(`${result.archivePath}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : error}\n`)
    process.exitCode = 1
  })
}
