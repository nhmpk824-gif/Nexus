import type { PetMood, PetTouchZone } from '../../types/index.ts'
import type { PetExpressionSlot, PetPerformanceCue } from './types.ts'
import { SPRITE_PET_ROW_CONTRACT } from '../../../shared/spriteAtlasContract.js'
import {
  SPRITE_PET_DENSE_ROW_CONTRACT,
  SPRITE_PET_DENSE_ROWS,
  type SpritePetAtlasEdition,
  resolveSpritePetWearState,
  getSpritePetWearRow,
} from '../../../shared/spritePetWearContract.js'

/** @deprecated Import from `./types` — re-exported for backward compatibility. */
export type { SpritePetAtlasDefinition } from './types.ts'

// Atlas geometry is single-sourced in shared/spriteAtlasContract.js and
// re-exported here so existing renderer imports keep working.
export {
  SPRITE_PET_ATLAS_HEIGHT,
  SPRITE_PET_ATLAS_WIDTH,
  SPRITE_PET_CELL_HEIGHT,
  SPRITE_PET_CELL_WIDTH,
  SPRITE_PET_COLUMNS,
  SPRITE_PET_ROWS,
} from '../../../shared/spriteAtlasContract.js'
export const SPRITE_PET_ACTIVE_LOOP_COUNT = 3
const SPRITE_PET_SLOW_IDLE_DURATION_MULTIPLIER = 2

export const SPRITE_PET_ANIMATION_STATES = SPRITE_PET_ROW_CONTRACT.map((entry) => entry.state)
export const SPRITE_PET_WEAR_STATES = SPRITE_PET_DENSE_ROW_CONTRACT.map((entry) => entry.state)

export type SpritePetAnimationState =
  | (typeof SPRITE_PET_ANIMATION_STATES)[number]
  | (typeof SPRITE_PET_WEAR_STATES)[number]

export type SpritePetFrame = {
  row: number
  column: number
  durationMs: number
}

export type SpritePetAnimationCursor = {
  state: SpritePetAnimationState
  frameIndex: number
  loopsRemaining: number
  requestKey: string
  idleDurationMultiplier?: number
}

export type SpritePetAdvanceOptions = {
  loopRequestedState?: boolean
}

export type SpritePetAnimationDefinition = {
  row: number
  columns: number[]
  durationsMs: number[]
}

// Derived from the shared row contract so frame timings have one source.
export const SPRITE_PET_ANIMATIONS: Record<SpritePetAnimationState, SpritePetAnimationDefinition> = Object.fromEntries(
  SPRITE_PET_ROW_CONTRACT.map((entry) => [
    entry.state,
    {
      row: entry.row,
      columns: Array.from({ length: entry.frameCount }, (_, column) => column),
      durationsMs: [...entry.durationsMs],
    },
  ]),
) as Record<SpritePetAnimationState, SpritePetAnimationDefinition>

export function editionFromAtlasRows(rows?: number): SpritePetAtlasEdition {
  return rows === SPRITE_PET_DENSE_ROWS ? 'dense' : 'legacy-8x9'
}

export function getSpritePetFrame(
  state: SpritePetAnimationState,
  frameIndex: number,
  edition: SpritePetAtlasEdition = 'legacy-8x9',
): SpritePetFrame {
  const playable = resolveSpritePetWearState(edition, state)
  const row = getSpritePetWearRow(edition, playable)
  const safeIndex = row.frameCount
    ? Math.abs(frameIndex) % row.frameCount
    : 0

  return {
    row: row.row,
    column: safeIndex,
    durationMs: row.durationsMs[safeIndex] ?? row.durationsMs.at(-1) ?? 120,
  }
}

function getSpritePetFrameCount(state: SpritePetAnimationState, edition: SpritePetAtlasEdition = 'legacy-8x9'): number {
  const playable = resolveSpritePetWearState(edition, state)
  return getSpritePetWearRow(edition, playable).frameCount
}

export function advanceSpritePetAnimationCursor(
  current: SpritePetAnimationCursor,
  requestedState: SpritePetAnimationState,
  requestKey: string,
  options: SpritePetAdvanceOptions & { edition?: SpritePetAtlasEdition } = {},
): SpritePetAnimationCursor {
  const frameCount = getSpritePetFrameCount(current.state, options.edition ?? 'legacy-8x9')
  const nextFrameIndex = current.frameIndex + 1

  if (nextFrameIndex < frameCount) {
    return {
      ...current,
      frameIndex: nextFrameIndex,
    }
  }

  if (current.state === 'idle') {
    return {
      ...current,
      frameIndex: 0,
    }
  }

  if (options.loopRequestedState && current.state === requestedState && current.requestKey === requestKey) {
    return {
      ...current,
      frameIndex: 0,
      loopsRemaining: SPRITE_PET_ACTIVE_LOOP_COUNT,
    }
  }

  const nextLoopsRemaining = current.loopsRemaining - 1
  if (nextLoopsRemaining > 0) {
    return {
      ...current,
      frameIndex: 0,
      loopsRemaining: nextLoopsRemaining,
    }
  }

  return {
    state: 'idle',
    frameIndex: 0,
    loopsRemaining: 0,
    requestKey: current.requestKey,
    idleDurationMultiplier: SPRITE_PET_SLOW_IDLE_DURATION_MULTIPLIER,
  }
}

export function isSpritePetAnimationState(value: unknown): value is SpritePetAnimationState {
  if (typeof value !== 'string') {
    return false
  }
  const normalized = value.trim()
  return SPRITE_PET_ANIMATION_STATES.includes(normalized as (typeof SPRITE_PET_ANIMATION_STATES)[number])
    || SPRITE_PET_WEAR_STATES.includes(normalized as (typeof SPRITE_PET_WEAR_STATES)[number])
}

function mapExpressionSlotToState(slot?: PetExpressionSlot): SpritePetAnimationState | null {
  switch (slot) {
    case 'thinking':
      return 'thinking'
    case 'happy':
      return 'happy'
    case 'sleepy':
      return 'waiting'
    case 'surprised':
      return 'jumping'
    case 'confused':
      return 'failed'
    case 'embarrassed':
      return 'shy'
    case 'listening':
      return 'listening'
    case 'speaking':
      return 'speaking'
    case 'touchHead':
    case 'touchFace':
    case 'touchBody':
      return 'jumping'
    default:
      return null
  }
}

function mapPetMoodToSpriteState(mood: PetMood): SpritePetAnimationState {
  switch (mood) {
    case 'thinking':
    case 'curious':
      return 'thinking'
    case 'happy':
    case 'excited':
    case 'proud':
    case 'playful':
      return 'happy'
    case 'sleepy':
      return 'waiting'
    case 'surprised':
      return 'jumping'
    case 'confused':
      return 'failed'
    case 'worried':
      return 'sad'
    case 'embarrassed':
    case 'affectionate':
      return 'shy'
    default:
      return 'idle'
  }
}

export function mapPetInputsToSpriteState(input: {
  mood: PetMood
  touchZone?: PetTouchZone | null
  isListening?: boolean
  isSpeaking?: boolean
  isBusy?: boolean
  performanceCue?: PetPerformanceCue | null
}): SpritePetAnimationState {
  if (input.performanceCue?.gestureName === 'wave') {
    return 'waving'
  }

  if (input.performanceCue?.gestureName) {
    return 'jumping'
  }

  const cueState = mapExpressionSlotToState(input.performanceCue?.expressionSlot)
  if (cueState) {
    return cueState
  }

  if (input.isSpeaking) {
    return 'speaking'
  }

  if (input.isListening) {
    return 'listening'
  }

  if (input.isBusy) {
    return 'thinking'
  }

  if (input.touchZone) {
    return 'jumping'
  }

  return mapPetMoodToSpriteState(input.mood)
}
