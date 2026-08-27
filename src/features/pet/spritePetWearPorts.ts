/**
 * Host ports for the wear module. The module decides and plans; the app
 * later supplies import/switch/claim. Nothing here talks to IPC or React.
 */

import type { SpritePetAtlasEdition } from '../../../shared/spritePetWearContract.js'

export type SpritePetWearMoment =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'happy'
  | 'shy'
  | 'sad'
  | 'stuck'
  | 'alert'
  | 'failed'

export type SpritePetWearRequest = {
  text?: string
  sourcePath?: string
  imageWidth?: number
  imageHeight?: number
}

export type SpritePetWearDecision = {
  shouldWear: boolean
  reason: 'intent' | 'atlas' | 'none'
  edition: SpritePetAtlasEdition
}

export type SpritePetWearImportResult = {
  petId: string
  displayName?: string
}

/**
 * What the desktop host must implement when this module is wired.
 * Until then, tests pass a fake.
 */
export type SpritePetWearHost = {
  importSheet(input: {
    sourcePath: string
    edition: SpritePetAtlasEdition
  }): Promise<SpritePetWearImportResult>
  switchAvatar(imported: SpritePetWearImportResult): Promise<void>
  claim(imported: SpritePetWearImportResult): Promise<void>
}

export type SpritePetWearBeat = {
  desiredState: string
  playableState: string
  durationMs: number
}
