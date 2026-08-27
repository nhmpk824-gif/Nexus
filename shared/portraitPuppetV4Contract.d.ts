export declare const PORTRAIT_PUPPET_V4_FORMAT_VERSION: 4
export declare const PORTRAIT_PUPPET_V4_RENDER_MODE: 'layered-artmesh-v1'
export declare const PORTRAIT_PUPPET_V4_IMAGE_GENERATION_PROMPT: string
export declare const PORTRAIT_PUPPET_V4_PARAMETER_IDS: readonly string[]
export declare const PORTRAIT_PUPPET_V4_PART_ROLES: readonly string[]
export declare const PORTRAIT_PUPPET_V4_MASK_ROLES: readonly string[]

export type PortraitPuppetV4Point = [number, number]

export type PortraitPuppetV4Parameter = {
  id: string
  min: number
  max: number
  defaultValue: number
}

export type PortraitPuppetV4Keyform = {
  value: number
  translate: PortraitPuppetV4Point
  rotateDeg: number
  scale: PortraitPuppetV4Point
  opacity: number
  vertexOffsets?: PortraitPuppetV4Point[]
}

export type PortraitPuppetV4Binding = {
  parameter: string
  keyforms: PortraitPuppetV4Keyform[]
}

export type PortraitPuppetV4Part = {
  id: string
  role: string
  path: string
  parentId: string
  pivot: PortraitPuppetV4Point
  zIndex: number
  opacity: number
  blendMode: GlobalCompositeOperation
  maskId: string
  mesh: { columns: number; rows: number }
  bindings: PortraitPuppetV4Binding[]
}

export type PortraitPuppetV4Mask = {
  id: string
  role: string
  path: string
  parentId: string
  inverted: boolean
}

export type PortraitPuppetV4PhysicsGroup = {
  id: string
  input: string
  output: string
  scale: number
  mass: number
  stiffness: number
  damping: number
  delayMs: number
  min: number
  max: number
}

export type PortraitPuppetV4Manifest = {
  id: string
  displayName: string
  description: string
  kind: 'portrait-puppet'
  formatVersion: 4
  renderMode: 'layered-artmesh-v1'
  qualityTier: 'standard' | 'complete'
  portraitPath: string
  canvas: { width: number; height: number }
  parameters: PortraitPuppetV4Parameter[]
  masks: PortraitPuppetV4Mask[]
  parts: PortraitPuppetV4Part[]
  physics: PortraitPuppetV4PhysicsGroup[]
}

export type PortraitPuppetV4Issue = {
  code: string
  path: string
  message: string
}

export type PortraitPuppetV4ValidationResult = {
  valid: boolean
  errors: PortraitPuppetV4Issue[]
  warnings: PortraitPuppetV4Issue[]
  manifest: PortraitPuppetV4Manifest
}

export declare function normalizePortraitPuppetV4Manifest(value: unknown): PortraitPuppetV4Manifest
export declare function validatePortraitPuppetV4Manifest(value: unknown): PortraitPuppetV4ValidationResult
export declare function isPortraitPuppetV4Manifest(value: unknown): boolean
