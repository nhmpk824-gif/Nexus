/**
 * Canonical Cubism resource declarations shared by Electron and the renderer.
 * Counts describe authored model references; filesystem compatibility remains
 * a main-process concern. Import message keys also live here so IPC consumers
 * agree on the localization contract without copying string literals.
 */

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

/** Stable localized message keys returned by the Live2D import IPC result. */
export const LIVE2D_IMPORT_MESSAGE_KEYS = Object.freeze({
  blocked: 'settings.pet.compatibility_blocked',
  limited: 'settings.pet.compatibility_limited',
  ready: 'settings.pet.compatibility_ready',
})

/** Repair guidance keys returned when a Live2D import cannot be activated. */
export const LIVE2D_IMPORT_RECOMMENDATION_KEYS = Object.freeze({
  files: 'settings.pet.compatibility_blocked_rec',
  schema: 'settings.pet.compatibility_blocked_rec_schema',
  unsafe: 'settings.pet.compatibility_blocked_rec_unsafe',
})

/** Summarize authored Cubism resources for compatibility and runtime evidence. */
export function summarizeCubismDeclaredResources(modelFile) {
  const references = isObject(modelFile?.FileReferences) ? modelFile.FileReferences : {}
  const mocDeclared = typeof references.Moc === 'string' && Boolean(references.Moc.trim())
  const textureCount = Array.isArray(references.Textures) ? references.Textures.length : 0
  const expressionCount = Array.isArray(references.Expressions) ? references.Expressions.length : 0
  const motionCount = isObject(references.Motions)
    ? Object.values(references.Motions).reduce((count, group) => (
        count + (Array.isArray(group) ? group.length : 0)
      ), 0)
    : 0

  return {
    status: !mocDeclared || textureCount === 0
      ? 'blocked'
      : (motionCount === 0 || expressionCount === 0 ? 'limited' : 'ready'),
    mocDeclared,
    textureCount,
    motionCount,
    expressionCount,
  }
}

/** Build the stable key-based IPC message contract for a compatibility status. */
export function getLive2dImportMessageContract(status, errors = []) {
  const normalizedStatus = status === 'ready' || status === 'limited' ? status : 'blocked'
  const errorSet = new Set(Array.isArray(errors) ? errors : [])
  let recommendationKey
  if (normalizedStatus === 'blocked') {
    recommendationKey = errorSet.has('unsafe-resource-path')
      ? LIVE2D_IMPORT_RECOMMENDATION_KEYS.unsafe
      : errorSet.has('invalid-model-file') && errorSet.size === 1
        ? LIVE2D_IMPORT_RECOMMENDATION_KEYS.schema
        : LIVE2D_IMPORT_RECOMMENDATION_KEYS.files
  }

  return {
    messageKey: LIVE2D_IMPORT_MESSAGE_KEYS[normalizedStatus],
    ...(recommendationKey ? { recommendationKey } : {}),
  }
}
