/**
 * Cross-process contract for layered Portrait Puppet v4 packages.
 * The validator treats generated rig data as untrusted input and returns
 * stable issue codes; filesystem and image-content checks stay in Electron.
 */

export const PORTRAIT_PUPPET_V4_FORMAT_VERSION = 4
export const PORTRAIT_PUPPET_V4_RENDER_MODE = 'layered-artmesh-v1'

export const PORTRAIT_PUPPET_V4_IMAGE_GENERATION_PROMPT = `Create a production-quality layered 2D character asset pack for Nexus Portrait Puppet v4, not a flat illustration, placeholder, test fixture, character sheet, or rough cartoon.

First output preview.png for art approval. It must be a polished full-body anime-style character portrait: front-facing orthographic camera, neutral relaxed standing pose, head upright, both eyes open, mouth closed, arms and hands separated from the torso, both legs and feet visible on the same ground line, 10–15% clear margin, transparent alpha background, 1024×1536 canvas, crisp anti-aliased edges, refined hair strands, detailed eyes and fabric folds, consistent anatomy, identity, linework, palette, materials, and lighting. No scenery, floor shadow, text, watermark, effects, props crossing the face or body, cropped hair, cropped feet, blurred alpha, white fringe, clip-art blocks, crude geometry, or low-detail chibi placeholder art.

Only after preview approval, use preview.png as the locked identity, pose, camera, scale, and pixel-registration reference. Export these separate same-canvas transparent PNG files, with exactly one named part visible in each file and every other pixel transparent:
parts/back-hair.png
parts/face-base.png
parts/brow-left.png
parts/brow-right.png
parts/eye-white-left.png
parts/eye-white-right.png
parts/iris-left.png
parts/iris-right.png
parts/eyelid-upper-left.png
parts/eyelid-upper-right.png
parts/eye-closed-left.png
parts/eye-closed-right.png
parts/mouth-closed.png
parts/mouth-cavity.png
parts/front-bangs.png
parts/side-hair-left.png
parts/side-hair-right.png
parts/neck.png
parts/torso.png
parts/arm-left.png
parts/arm-right.png
parts/cloth-left.png
parts/cloth-right.png
parts/accessory.png
masks/face.png
masks/eye-left.png
masks/eye-right.png
masks/mouth.png

Hard requirements: every PNG must remain 1024×1536 with identical character placement; do not redesign or repose the character between layers; preserve soft alpha edges without background contamination; repaint the complete forehead, scalp, face sides, eye whites, irises, closed-eye lines, mouth interior, neck, cloth connections, and every hidden region that can become visible during head turn, blinking, speech, hair sway, or cloth sway; do not merely crop the flattened preview. Recombining the neutral layers must match preview.png pixel-for-pixel except for intentionally hidden overdraw. If only one image can be produced per request, keep the same reference image, seed, canvas, pose, and placement for every pass.`

export const PORTRAIT_PUPPET_V4_PARAMETER_IDS = Object.freeze([
  'ParamAngleX',
  'ParamAngleY',
  'ParamAngleZ',
  'ParamEyeBallX',
  'ParamEyeBallY',
  'ParamEyeBallForm',
  'ParamEyeLOpen',
  'ParamEyeROpen',
  'ParamEyeLSmile',
  'ParamEyeRSmile',
  'ParamEyeLForm',
  'ParamEyeRForm',
  'ParamMouthOpenY',
  'ParamMouthForm',
  'ParamMouthRound',
  'ParamMouthNarrow',
  'ParamMouthDown',
  'ParamBrowLY',
  'ParamBrowRY',
  'ParamBrowLX',
  'ParamBrowRX',
  'ParamBrowLAngle',
  'ParamBrowRAngle',
  'ParamBrowLForm',
  'ParamBrowRForm',
  'ParamBrowForm',
  'ParamCheek',
  'ParamBodyAngleX',
  'ParamBodyAngleY',
  'ParamBodyAngleZ',
  'ParamBreath',
  'ParamArmSway',
  'ParamHairSway',
  'ParamClothSway',
  'ParamAccessorySway',
])

export const PORTRAIT_PUPPET_V4_PART_ROLES = Object.freeze([
  'back-hair',
  'face-base',
  'ear-left',
  'ear-right',
  'brow-left',
  'brow-right',
  'eye-white-left',
  'eye-white-right',
  'iris-left',
  'iris-right',
  'eyelid-upper-left',
  'eyelid-upper-right',
  'eyelid-lower-left',
  'eyelid-lower-right',
  'eye-closed-left',
  'eye-closed-right',
  'nose',
  'mouth-closed',
  'mouth-cavity',
  'teeth',
  'tongue',
  'front-bangs',
  'side-hair-left',
  'side-hair-right',
  'neck',
  'torso',
  'arm-left',
  'arm-right',
  'hand-left',
  'hand-right',
  'cloth-left',
  'cloth-right',
  'accessory',
  'leg-left',
  'leg-right',
  'foot-left',
  'foot-right',
  'custom',
])

export const PORTRAIT_PUPPET_V4_MASK_ROLES = Object.freeze([
  'face',
  'eye-left',
  'eye-right',
  'mouth',
  'custom',
])

const DEFAULT_PARAMETERS = Object.freeze([
  { id: 'ParamAngleX', min: -1, max: 1, defaultValue: 0 },
  { id: 'ParamAngleY', min: -1, max: 1, defaultValue: 0 },
  { id: 'ParamAngleZ', min: -1, max: 1, defaultValue: 0 },
  { id: 'ParamEyeBallX', min: -1, max: 1, defaultValue: 0 },
  { id: 'ParamEyeBallY', min: -1, max: 1, defaultValue: 0 },
  { id: 'ParamEyeBallForm', min: 0, max: 1, defaultValue: 0 },
  { id: 'ParamEyeLOpen', min: 0, max: 1, defaultValue: 1 },
  { id: 'ParamEyeROpen', min: 0, max: 1, defaultValue: 1 },
  { id: 'ParamEyeLSmile', min: 0, max: 1, defaultValue: 0 },
  { id: 'ParamEyeRSmile', min: 0, max: 1, defaultValue: 0 },
  { id: 'ParamEyeLForm', min: -1, max: 1, defaultValue: 0 },
  { id: 'ParamEyeRForm', min: -1, max: 1, defaultValue: 0 },
  { id: 'ParamMouthOpenY', min: 0, max: 1, defaultValue: 0 },
  { id: 'ParamMouthForm', min: -1, max: 1, defaultValue: 0 },
  { id: 'ParamMouthRound', min: 0, max: 1, defaultValue: 0 },
  { id: 'ParamMouthNarrow', min: 0, max: 1, defaultValue: 0 },
  { id: 'ParamMouthDown', min: 0, max: 1, defaultValue: 0 },
  { id: 'ParamBrowLY', min: -1, max: 1, defaultValue: 0 },
  { id: 'ParamBrowRY', min: -1, max: 1, defaultValue: 0 },
  { id: 'ParamBrowLX', min: -1, max: 1, defaultValue: 0 },
  { id: 'ParamBrowRX', min: -1, max: 1, defaultValue: 0 },
  { id: 'ParamBrowLAngle', min: -1, max: 1, defaultValue: 0 },
  { id: 'ParamBrowRAngle', min: -1, max: 1, defaultValue: 0 },
  { id: 'ParamBrowLForm', min: -1, max: 1, defaultValue: 0 },
  { id: 'ParamBrowRForm', min: -1, max: 1, defaultValue: 0 },
  { id: 'ParamBrowForm', min: -1, max: 1, defaultValue: 0 },
  { id: 'ParamCheek', min: 0, max: 1, defaultValue: 0 },
  { id: 'ParamBodyAngleX', min: -1, max: 1, defaultValue: 0 },
  { id: 'ParamBodyAngleY', min: -1, max: 1, defaultValue: 0 },
  { id: 'ParamBodyAngleZ', min: -1, max: 1, defaultValue: 0 },
  { id: 'ParamBreath', min: -1, max: 1, defaultValue: 0 },
  { id: 'ParamArmSway', min: -1.5, max: 1.5, defaultValue: 0 },
  { id: 'ParamHairSway', min: -1.5, max: 1.5, defaultValue: 0 },
  { id: 'ParamClothSway', min: -1.5, max: 1.5, defaultValue: 0 },
  { id: 'ParamAccessorySway', min: -1.5, max: 1.5, defaultValue: 0 },
])

const CORE_ROLE_GROUPS = Object.freeze([
  ['face-base'],
  ['eye-white-left'],
  ['eye-white-right'],
  ['iris-left'],
  ['iris-right'],
  ['eyelid-upper-left', 'eye-closed-left'],
  ['eyelid-upper-right', 'eye-closed-right'],
  ['mouth-closed'],
  ['mouth-cavity'],
  ['neck'],
  ['torso'],
])

const COMPLETE_ROLE_GROUPS = Object.freeze([
  ['back-hair', 'front-bangs', 'side-hair-left', 'side-hair-right'],
  ['arm-left'],
  ['arm-right'],
  ['cloth-left', 'cloth-right'],
])

const COMPLETE_MASK_ROLES = Object.freeze(['face', 'eye-left', 'eye-right', 'mouth'])
const SAFE_ID_PATTERN = /^[a-z][a-z0-9-]{0,63}$/u
const SAFE_PARAMETER_ID_PATTERN = /^[A-Za-z][A-Za-z0-9-]{0,63}$/u

function finiteNumber(value, fallback, min, max) {
  const candidate = Number(value)
  return Number.isFinite(candidate)
    ? Math.min(max, Math.max(min, candidate))
    : fallback
}

function safeId(value, fallback = '') {
  const candidate = String(value ?? '').trim().toLowerCase()
  return SAFE_ID_PATTERN.test(candidate) ? candidate : fallback
}

function safeParameterId(value, fallback = '') {
  const candidate = String(value ?? '').trim()
  return SAFE_PARAMETER_ID_PATTERN.test(candidate) ? candidate : fallback
}

function safeRelativeAssetPath(value) {
  const candidate = String(value ?? '').trim().replaceAll('\\', '/')
  if (
    !candidate
    || candidate.startsWith('/')
    || candidate.includes('://')
    || candidate.split('/').some((segment) => !segment || segment === '.' || segment === '..')
  ) {
    return ''
  }
  return candidate
}

function readPoint(value, fallback) {
  if (!Array.isArray(value) || value.length !== 2) return fallback
  return [
    finiteNumber(value[0], fallback[0], -4, 4),
    finiteNumber(value[1], fallback[1], -4, 4),
  ]
}

function readScale(value) {
  if (!Array.isArray(value) || value.length !== 2) return [1, 1]
  return [
    finiteNumber(value[0], 1, 0.05, 8),
    finiteNumber(value[1], 1, 0.05, 8),
  ]
}

function meshForRole(role, value) {
  const isFace = role === 'face-base'
  const isFlexible = role.includes('hair') || role.includes('cloth') || role === 'accessory'
  const columns = Math.round(finiteNumber(value?.columns, isFace ? 10 : isFlexible ? 5 : 2, 1, 24))
  const rows = Math.round(finiteNumber(value?.rows, isFace ? 12 : isFlexible ? 7 : 2, 1, 32))
  return { columns, rows }
}

function readVertexOffsets(value, expectedCount) {
  if (!Array.isArray(value)) return undefined
  if (value.length !== expectedCount) return value.map((entry) => readPoint(entry, [0, 0]))
  return value.map((entry) => readPoint(entry, [0, 0]))
}

function readKeyform(value, expectedVertexCount) {
  const source = value && typeof value === 'object' ? value : {}
  const vertexOffsets = readVertexOffsets(source.vertexOffsets, expectedVertexCount)
  return {
    value: finiteNumber(source.value, 0, -100, 100),
    translate: readPoint(source.translate, [0, 0]),
    rotateDeg: finiteNumber(source.rotateDeg, 0, -180, 180),
    scale: readScale(source.scale),
    opacity: finiteNumber(source.opacity, 1, 0, 1),
    ...(vertexOffsets ? { vertexOffsets } : {}),
  }
}

function readBindings(value, mesh) {
  if (!Array.isArray(value)) return []
  const expectedVertexCount = (mesh.columns + 1) * (mesh.rows + 1)
  return value.map((entry) => {
    const source = entry && typeof entry === 'object' ? entry : {}
    return {
      parameter: safeParameterId(source.parameter, String(source.parameter ?? '').trim()),
      keyforms: Array.isArray(source.keyforms)
        ? source.keyforms
          .map((keyform) => readKeyform(keyform, expectedVertexCount))
          .sort((left, right) => left.value - right.value)
        : [],
    }
  })
}

function readPart(value, index) {
  const source = value && typeof value === 'object' ? value : {}
  const roleCandidate = String(source.role ?? '').trim()
  const role = PORTRAIT_PUPPET_V4_PART_ROLES.includes(roleCandidate) ? roleCandidate : 'custom'
  const mesh = meshForRole(role, source.mesh)
  return {
    id: safeId(source.id, `part-${index + 1}`),
    role,
    path: safeRelativeAssetPath(source.path),
    parentId: safeId(source.parentId),
    pivot: readPoint(source.pivot, [0.5, 0.5]).map((entry) => finiteNumber(entry, 0.5, 0, 1)),
    zIndex: Math.round(finiteNumber(source.zIndex, index, -10_000, 10_000)),
    opacity: finiteNumber(source.opacity, 1, 0, 1),
    blendMode: ['source-over', 'multiply', 'screen', 'lighter'].includes(source.blendMode)
      ? source.blendMode
      : 'source-over',
    maskId: safeId(source.maskId),
    mesh,
    bindings: readBindings(source.bindings, mesh),
  }
}

function readMask(value, index) {
  const source = value && typeof value === 'object' ? value : {}
  const roleCandidate = String(source.role ?? '').trim()
  return {
    id: safeId(source.id, `mask-${index + 1}`),
    role: PORTRAIT_PUPPET_V4_MASK_ROLES.includes(roleCandidate) ? roleCandidate : 'custom',
    path: safeRelativeAssetPath(source.path),
    parentId: safeId(source.parentId),
    inverted: Boolean(source.inverted),
  }
}

function readParameter(value, fallback) {
  const source = value && typeof value === 'object' ? value : {}
  const min = finiteNumber(source.min, fallback.min, -100, 100)
  const max = finiteNumber(source.max, fallback.max, min + 0.0001, 100)
  return {
    id: safeParameterId(source.id, fallback.id),
    min,
    max,
    defaultValue: finiteNumber(source.defaultValue, fallback.defaultValue, min, max),
  }
}

function readParameters(value) {
  const overrides = new Map(
    (Array.isArray(value) ? value : [])
      .filter((entry) => entry && typeof entry === 'object')
      .map((entry) => [String(entry.id ?? '').trim(), entry]),
  )
  const defaults = DEFAULT_PARAMETERS.map((parameter) => readParameter(
    overrides.get(parameter.id),
    parameter,
  ))
  const known = new Set(defaults.map((parameter) => parameter.id))
  const custom = []
  for (const entry of overrides.values()) {
    const id = safeParameterId(entry.id)
    if (!id || known.has(id)) continue
    const parameter = readParameter(entry, { id, min: -1, max: 1, defaultValue: 0 })
    custom.push(parameter)
    known.add(id)
  }
  return [...defaults, ...custom]
}

function readPhysics(value) {
  if (!Array.isArray(value)) return []
  return value.map((entry, index) => {
    const source = entry && typeof entry === 'object' ? entry : {}
    return {
      id: safeId(source.id, `physics-${index + 1}`),
      input: safeParameterId(source.input, String(source.input ?? '').trim()),
      output: safeParameterId(source.output, String(source.output ?? '').trim()),
      scale: finiteNumber(source.scale, 1, -8, 8),
      mass: finiteNumber(source.mass, 1, 0.05, 20),
      stiffness: finiteNumber(source.stiffness, 110, 1, 1_000),
      damping: finiteNumber(source.damping, 16, 0.1, 100),
      delayMs: finiteNumber(source.delayMs, 100, 0, 1_000),
      min: finiteNumber(source.min, -1.5, -8, 8),
      max: finiteNumber(source.max, 1.5, -8, 8),
    }
  }).map((entry) => entry.min <= entry.max ? entry : { ...entry, min: entry.max, max: entry.min })
}

function findParentCycle(parts) {
  const parentById = new Map()
  for (const part of parts) {
    if (!parentById.has(part.id)) parentById.set(part.id, part.parentId)
  }
  for (const part of parts) {
    const seen = new Set()
    let cursor = part.id
    while (cursor) {
      if (seen.has(cursor)) return [...seen, cursor]
      seen.add(cursor)
      cursor = parentById.get(cursor) ?? ''
    }
  }
  return []
}

function issue(code, path, message) {
  return { code, path, message }
}

/**
 * Normalize a possible v4 manifest without trusting its numeric ranges.
 * Call validatePortraitPuppetV4Manifest before using its asset references.
 *
 * @param {unknown} value
 */
export function normalizePortraitPuppetV4Manifest(value) {
  const source = value && typeof value === 'object' ? value : {}
  const width = Math.round(finiteNumber(source.canvas?.width, 1024, 64, 8_192))
  const height = Math.round(finiteNumber(source.canvas?.height, 1536, 64, 8_192))
  return {
    id: safeId(source.id, 'portrait-puppet-v4'),
    displayName: String(source.displayName ?? '').trim() || 'Portrait Puppet v4',
    description: String(source.description ?? '').trim(),
    kind: 'portrait-puppet',
    formatVersion: PORTRAIT_PUPPET_V4_FORMAT_VERSION,
    renderMode: PORTRAIT_PUPPET_V4_RENDER_MODE,
    qualityTier: source.qualityTier === 'standard' ? 'standard' : 'complete',
    portraitPath: safeRelativeAssetPath(source.portraitPath || source.previewPath || 'preview.png'),
    canvas: { width, height },
    parameters: readParameters(source.parameters),
    masks: (Array.isArray(source.masks) ? source.masks : []).map(readMask),
    parts: (Array.isArray(source.parts) ? source.parts : []).map(readPart),
    physics: readPhysics(source.physics),
  }
}

/**
 * Validate semantic completeness and graph safety for a layered manifest.
 * The returned normalized manifest is deterministic even when issues exist.
 *
 * @param {unknown} value
 */
export function validatePortraitPuppetV4Manifest(value) {
  const manifest = normalizePortraitPuppetV4Manifest(value)
  const errors = []
  const warnings = []
  const source = value && typeof value === 'object' ? value : {}

  if (String(source.kind ?? '').trim() !== 'portrait-puppet') {
    errors.push(issue('invalid-kind', 'kind', 'kind must be portrait-puppet'))
  }
  if (Number(source.formatVersion) !== PORTRAIT_PUPPET_V4_FORMAT_VERSION) {
    errors.push(issue('invalid-format-version', 'formatVersion', 'formatVersion must be 4'))
  }
  if (source.renderMode !== PORTRAIT_PUPPET_V4_RENDER_MODE) {
    errors.push(issue('invalid-render-mode', 'renderMode', `renderMode must be ${PORTRAIT_PUPPET_V4_RENDER_MODE}`))
  }
  if (!manifest.portraitPath) {
    errors.push(issue('unsafe-asset-path', 'portraitPath', 'portraitPath must stay inside the package'))
  }
  if (!Array.isArray(source.parts) || source.parts.length === 0) {
    errors.push(issue('missing-parts', 'parts', 'parts must contain layered assets'))
  }

  const partIds = new Set()
  const roleSet = new Set()
  manifest.parts.forEach((part, index) => {
    const sourcePart = Array.isArray(source.parts) ? source.parts[index] : null
    const pathPrefix = `parts[${index}]`
    if (!SAFE_ID_PATTERN.test(String(sourcePart?.id ?? '').trim())) {
      errors.push(issue('invalid-part-id', `${pathPrefix}.id`, 'part id must be a lowercase stable id'))
    }
    if (partIds.has(part.id)) {
      errors.push(issue('duplicate-part-id', `${pathPrefix}.id`, `duplicate part id: ${part.id}`))
    }
    partIds.add(part.id)
    roleSet.add(part.role)
    if (!part.path) {
      errors.push(issue('unsafe-asset-path', `${pathPrefix}.path`, 'part path must stay inside the package'))
    }
    for (let bindingIndex = 0; bindingIndex < part.bindings.length; bindingIndex += 1) {
      const binding = part.bindings[bindingIndex]
      const bindingPath = `${pathPrefix}.bindings[${bindingIndex}]`
      const parameterDefinition = manifest.parameters.find((parameter) => (
        parameter.id === binding.parameter
      ))
      if (!parameterDefinition) {
        errors.push(issue('unknown-parameter', `${bindingPath}.parameter`, `unknown parameter: ${binding.parameter}`))
      }
      if (binding.keyforms.length < 2) {
        errors.push(issue('insufficient-keyforms', `${bindingPath}.keyforms`, 'a binding requires at least two keyforms'))
      }
      const values = new Set()
      binding.keyforms.forEach((keyform, keyformIndex) => {
        if (values.has(keyform.value)) {
          errors.push(issue('duplicate-keyform-value', `${bindingPath}.keyforms[${keyformIndex}].value`, 'keyform values must be unique'))
        }
        values.add(keyform.value)
        if (
          parameterDefinition
          && (keyform.value < parameterDefinition.min || keyform.value > parameterDefinition.max)
        ) {
          errors.push(issue('keyform-out-of-range', `${bindingPath}.keyforms[${keyformIndex}].value`, 'keyform value is outside the parameter range'))
        }
        if (
          keyform.vertexOffsets
          && keyform.vertexOffsets.length !== (part.mesh.columns + 1) * (part.mesh.rows + 1)
        ) {
          errors.push(issue('invalid-vertex-offset-count', `${bindingPath}.keyforms[${keyformIndex}].vertexOffsets`, 'vertex offset count must match the part mesh'))
        }
      })
    }
  })

  manifest.parts.forEach((part, index) => {
    if (part.parentId && !partIds.has(part.parentId)) {
      errors.push(issue('unknown-parent', `parts[${index}].parentId`, `unknown parent: ${part.parentId}`))
    }
  })
  const cycle = findParentCycle(manifest.parts)
  if (cycle.length) {
    errors.push(issue('parent-cycle', 'parts', `part parent cycle: ${cycle.join(' -> ')}`))
  }

  const maskIds = new Set()
  const maskRoles = new Set()
  manifest.masks.forEach((mask, index) => {
    if (maskIds.has(mask.id)) {
      errors.push(issue('duplicate-mask-id', `masks[${index}].id`, `duplicate mask id: ${mask.id}`))
    }
    maskIds.add(mask.id)
    maskRoles.add(mask.role)
    if (!mask.path) {
      errors.push(issue('unsafe-asset-path', `masks[${index}].path`, 'mask path must stay inside the package'))
    }
    if (mask.parentId && !partIds.has(mask.parentId)) {
      errors.push(issue('unknown-mask-parent', `masks[${index}].parentId`, `unknown mask parent: ${mask.parentId}`))
    }
  })
  manifest.parts.forEach((part, index) => {
    if (part.maskId && !maskIds.has(part.maskId)) {
      errors.push(issue('unknown-mask', `parts[${index}].maskId`, `unknown mask: ${part.maskId}`))
    }
  })

  for (const group of CORE_ROLE_GROUPS) {
    if (!group.some((role) => roleSet.has(role))) {
      errors.push(issue('missing-core-role', 'parts', `missing required part role: ${group.join(' or ')}`))
    }
  }
  if (manifest.qualityTier === 'complete') {
    for (const group of COMPLETE_ROLE_GROUPS) {
      if (!group.some((role) => roleSet.has(role))) {
        errors.push(issue('missing-complete-role', 'parts', `complete rigs require: ${group.join(' or ')}`))
      }
    }
    for (const role of COMPLETE_MASK_ROLES) {
      if (!maskRoles.has(role)) {
        errors.push(issue('missing-complete-mask', 'masks', `complete rigs require mask role: ${role}`))
      }
    }

    const partsByRole = new Map()
    for (const part of manifest.parts) {
      const entries = partsByRole.get(part.role) ?? []
      entries.push(part)
      partsByRole.set(part.role, entries)
    }
    const bindingRequirements = [
      { roles: ['face-base'], parameter: 'ParamAngleX', vertexDeformation: true },
      { roles: ['face-base'], parameter: 'ParamAngleY' },
      { roles: ['face-base'], parameter: 'ParamAngleZ' },
      { roles: ['iris-left'], parameter: 'ParamEyeBallX' },
      { roles: ['iris-left'], parameter: 'ParamEyeBallY' },
      { roles: ['iris-right'], parameter: 'ParamEyeBallX' },
      { roles: ['iris-right'], parameter: 'ParamEyeBallY' },
      { roles: ['eyelid-upper-left', 'eye-closed-left'], parameter: 'ParamEyeLOpen' },
      { roles: ['eyelid-upper-right', 'eye-closed-right'], parameter: 'ParamEyeROpen' },
      { roles: ['mouth-closed'], parameter: 'ParamMouthOpenY' },
      { roles: ['mouth-cavity'], parameter: 'ParamMouthOpenY' },
      { roles: ['torso'], parameter: 'ParamBreath' },
      { roles: ['torso'], parameter: 'ParamBodyAngleZ' },
      {
        roles: ['back-hair', 'front-bangs', 'side-hair-left', 'side-hair-right'],
        parameter: 'ParamHairSway',
      },
      { roles: ['cloth-left', 'cloth-right'], parameter: 'ParamClothSway' },
    ]
    for (const requirement of bindingRequirements) {
      const candidates = requirement.roles.flatMap((role) => partsByRole.get(role) ?? [])
      const bindings = candidates.flatMap((part) => (
        part.bindings.filter((binding) => binding.parameter === requirement.parameter)
      ))
      if (!bindings.length) {
        errors.push(issue(
          'missing-parameter-binding',
          'parts',
          `${requirement.parameter} must drive ${requirement.roles.join(' or ')}`,
        ))
      } else if (
        requirement.vertexDeformation
        && !bindings.some((binding) => binding.keyforms.some((keyform) => (
          Array.isArray(keyform.vertexOffsets) && keyform.vertexOffsets.some((offset) => (
            Math.abs(offset[0]) > 0.000_001 || Math.abs(offset[1]) > 0.000_001
          ))
        )))
      ) {
        errors.push(issue(
          'missing-turn-deformation',
          'parts',
          `${requirement.parameter} requires authored face vertex offsets`,
        ))
      }
    }

    const maskIdByRole = new Map(manifest.masks.map((mask) => [mask.role, mask.id]))
    const maskAssignments = [
      { roles: ['iris-left'], maskRole: 'eye-left' },
      { roles: ['iris-right'], maskRole: 'eye-right' },
      { roles: ['mouth-cavity'], maskRole: 'mouth' },
    ]
    for (const assignment of maskAssignments) {
      const expectedMaskId = maskIdByRole.get(assignment.maskRole)
      const candidates = assignment.roles.flatMap((role) => partsByRole.get(role) ?? [])
      if (!expectedMaskId || !candidates.some((part) => part.maskId === expectedMaskId)) {
        errors.push(issue(
          'missing-mask-assignment',
          'parts',
          `${assignment.roles.join(' or ')} must use the ${assignment.maskRole} mask`,
        ))
      }
    }

    const physicsOutputs = new Set(manifest.physics.map((group) => group.output))
    for (const output of ['ParamHairSway', 'ParamClothSway']) {
      if (!physicsOutputs.has(output)) {
        errors.push(issue(
          'missing-complete-physics',
          'physics',
          `complete rigs require a physics group for ${output}`,
        ))
      }
    }
    if (roleSet.has('accessory') && !physicsOutputs.has('ParamAccessorySway')) {
      errors.push(issue(
        'missing-complete-physics',
        'physics',
        'complete rigs with accessories require ParamAccessorySway physics',
      ))
    }
  }

  const parameterIds = new Set(manifest.parameters.map((parameter) => parameter.id))
  const physicsIds = new Set()
  manifest.physics.forEach((group, index) => {
    if (physicsIds.has(group.id)) {
      errors.push(issue('duplicate-physics-id', `physics[${index}].id`, `duplicate physics id: ${group.id}`))
    }
    physicsIds.add(group.id)
    if (!parameterIds.has(group.input)) {
      errors.push(issue('unknown-physics-input', `physics[${index}].input`, `unknown physics input: ${group.input}`))
    }
    if (!parameterIds.has(group.output)) {
      errors.push(issue('unknown-physics-output', `physics[${index}].output`, `unknown physics output: ${group.output}`))
    }
  })

  for (const role of ['brow-left', 'brow-right', 'front-bangs', 'side-hair-left', 'side-hair-right']) {
    if (!roleSet.has(role)) {
      warnings.push(issue('missing-recommended-role', 'parts', `recommended part role is absent: ${role}`))
    }
  }
  if (!manifest.physics.length) {
    warnings.push(issue('missing-physics', 'physics', 'the rig has no secondary-motion physics groups'))
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    manifest,
  }
}

/** @param {unknown} value */
export function isPortraitPuppetV4Manifest(value) {
  return Boolean(
    value
    && typeof value === 'object'
    && value.kind === 'portrait-puppet'
    && Number(value.formatVersion) === PORTRAIT_PUPPET_V4_FORMAT_VERSION
    && value.renderMode === PORTRAIT_PUPPET_V4_RENDER_MODE,
  )
}
