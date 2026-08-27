import type { SpritePetRowContractEntry } from './spriteAtlasContract.js'

export type SpritePetAtlasEdition = 'legacy-8x9' | 'dense' | 'unknown'

export type SpritePetDenseState =
  | 'idle'
  | 'listening'
  | 'speaking'
  | 'thinking'
  | 'happy'
  | 'shy'
  | 'sad'
  | 'waiting'
  | 'failed'
  | 'waving'
  | 'jumping'
  | 'review'
  | 'running'
  | 'running-right'
  | 'running-left'

export declare const SPRITE_PET_WEAR_COLUMNS: number
export declare const SPRITE_PET_WEAR_CELL_WIDTH: number
export declare const SPRITE_PET_WEAR_CELL_HEIGHT: number
export declare const SPRITE_PET_DENSE_ROWS: number
export declare const SPRITE_PET_DENSE_ATLAS_WIDTH: number
export declare const SPRITE_PET_DENSE_ATLAS_HEIGHT: number

export interface SpritePetDenseRowContractEntry {
  readonly state: SpritePetDenseState
  readonly row: number
  readonly frameCount: number
  readonly durationsMs: readonly number[]
}

export declare const SPRITE_PET_DENSE_ROW_CONTRACT: readonly SpritePetDenseRowContractEntry[]

export declare function detectSpritePetAtlasEdition(
  width: number,
  height: number,
): SpritePetAtlasEdition

export declare function resolveSpritePetWearState(
  edition: SpritePetAtlasEdition,
  desiredState: string,
): string

export declare function getSpritePetWearRow(
  edition: SpritePetAtlasEdition,
  playableState: string,
): SpritePetDenseRowContractEntry | SpritePetRowContractEntry
