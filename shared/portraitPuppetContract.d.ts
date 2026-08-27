export declare const PORTRAIT_PUPPET_KIND: 'portrait-puppet'
export declare const PORTRAIT_PUPPET_FORMAT_VERSION: 3
export declare const PORTRAIT_PUPPET_PROCEDURAL_RENDER_MODE: 'procedural-rig-v1'
export declare const PORTRAIT_PUPPET_IMAGE_NAME: 'portrait.png'
export declare const PORTRAIT_PUPPET_IMAGE_GENERATION_PROMPT: string
export type PortraitPuppetRigDefinition = {
  headX: number
  headY: number
  headRadiusX: number
  headRadiusY: number
  neckY: number
  eyeLeftX: number
  eyeRightX: number
  eyeY: number
  eyeRadiusX: number
  eyeRadiusY: number
  mouthX: number
  mouthY: number
  mouthRadiusX: number
  mouthRadiusY: number
  chestY: number
  waistY: number
  motionIntensity: number
}
export declare const DEFAULT_PORTRAIT_PUPPET_RIG: Readonly<PortraitPuppetRigDefinition>
export declare const PORTRAIT_PUPPET_LAYER_KEYS: readonly [
  'idle',
  'listening',
  'speaking',
  'thinking',
  'happy',
  'embarrassed',
  'sleepy',
  'surprised',
  'confused',
  'blink',
  'mouth',
  'head-left',
  'head-right',
]

export type PortraitPuppetLayerKey = (typeof PORTRAIT_PUPPET_LAYER_KEYS)[number]

export declare function isPortraitPuppetManifest(manifest: unknown): boolean
export declare function classifyPortraitLayerKey(fileName: string): PortraitPuppetLayerKey | null
export declare function normalizePortraitPuppetRig(value: unknown): Readonly<PortraitPuppetRigDefinition>
