export type Live2dCompatibilityStatus = 'ready' | 'limited' | 'blocked'

export type Live2dImportMessageKey =
  | 'settings.pet.compatibility_blocked'
  | 'settings.pet.compatibility_limited'
  | 'settings.pet.compatibility_ready'

export type Live2dImportRecommendationKey =
  | 'settings.pet.compatibility_blocked_rec'
  | 'settings.pet.compatibility_blocked_rec_schema'
  | 'settings.pet.compatibility_blocked_rec_unsafe'

export interface CubismDeclaredResourceSummary {
  status: Live2dCompatibilityStatus
  mocDeclared: boolean
  textureCount: number
  motionCount: number
  expressionCount: number
}

export interface Live2dImportMessageContract {
  messageKey: Live2dImportMessageKey
  recommendationKey?: Live2dImportRecommendationKey
}

export declare const LIVE2D_IMPORT_MESSAGE_KEYS: Readonly<{
  blocked: 'settings.pet.compatibility_blocked'
  limited: 'settings.pet.compatibility_limited'
  ready: 'settings.pet.compatibility_ready'
}>

export declare const LIVE2D_IMPORT_RECOMMENDATION_KEYS: Readonly<{
  files: 'settings.pet.compatibility_blocked_rec'
  schema: 'settings.pet.compatibility_blocked_rec_schema'
  unsafe: 'settings.pet.compatibility_blocked_rec_unsafe'
}>

export declare function summarizeCubismDeclaredResources(
  modelFile?: unknown,
): CubismDeclaredResourceSummary

export declare function getLive2dImportMessageContract(
  status: Live2dCompatibilityStatus | string,
  errors?: readonly string[],
): Live2dImportMessageContract
