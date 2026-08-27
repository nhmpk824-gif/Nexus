/**
 * First-class dense sprite-pet atlas for the wear/perform module.
 *
 * The live runtime still plays the Codex 8x9 contract in
 * `spriteAtlasContract.js`. This file is the target sheet: extra rows for
 * speaking, listening, mood. A legacy 8x9 sheet stays wearable, but it is
 * compatibility, not the product goal.
 */

import {
  SPRITE_PET_CELL_HEIGHT,
  SPRITE_PET_CELL_WIDTH,
  SPRITE_PET_COLUMNS,
  SPRITE_PET_ROW_CONTRACT,
} from './spriteAtlasContract.js'

/** @typedef {'legacy-8x9' | 'dense' | 'unknown'} SpritePetAtlasEdition */

export const SPRITE_PET_WEAR_COLUMNS = SPRITE_PET_COLUMNS
export const SPRITE_PET_WEAR_CELL_WIDTH = SPRITE_PET_CELL_WIDTH
export const SPRITE_PET_WEAR_CELL_HEIGHT = SPRITE_PET_CELL_HEIGHT

/**
 * Dense row layout, in row order. Cell size matches the Codex sheet so a
 * later importer can share the same packer and renderer.
 */
export const SPRITE_PET_DENSE_ROW_CONTRACT = Object.freeze([
  { state: 'idle', row: 0, frameCount: 6, durationsMs: Object.freeze([280, 110, 110, 140, 140, 320]) },
  { state: 'listening', row: 1, frameCount: 6, durationsMs: Object.freeze([180, 180, 180, 180, 180, 280]) },
  { state: 'speaking', row: 2, frameCount: 6, durationsMs: Object.freeze([120, 120, 120, 120, 120, 200]) },
  { state: 'thinking', row: 3, frameCount: 6, durationsMs: Object.freeze([160, 160, 160, 160, 160, 260]) },
  { state: 'happy', row: 4, frameCount: 5, durationsMs: Object.freeze([140, 140, 140, 140, 240]) },
  { state: 'shy', row: 5, frameCount: 5, durationsMs: Object.freeze([160, 160, 160, 160, 260]) },
  { state: 'sad', row: 6, frameCount: 6, durationsMs: Object.freeze([180, 180, 180, 180, 180, 280]) },
  { state: 'waiting', row: 7, frameCount: 6, durationsMs: Object.freeze([150, 150, 150, 150, 150, 260]) },
  { state: 'failed', row: 8, frameCount: 8, durationsMs: Object.freeze([140, 140, 140, 140, 140, 140, 140, 240]) },
  { state: 'waving', row: 9, frameCount: 4, durationsMs: Object.freeze([140, 140, 140, 280]) },
  { state: 'jumping', row: 10, frameCount: 5, durationsMs: Object.freeze([140, 140, 140, 140, 280]) },
  { state: 'review', row: 11, frameCount: 6, durationsMs: Object.freeze([150, 150, 150, 150, 150, 280]) },
  { state: 'running', row: 12, frameCount: 6, durationsMs: Object.freeze([120, 120, 120, 120, 120, 220]) },
  { state: 'running-right', row: 13, frameCount: 8, durationsMs: Object.freeze([120, 120, 120, 120, 120, 120, 120, 220]) },
  { state: 'running-left', row: 14, frameCount: 8, durationsMs: Object.freeze([120, 120, 120, 120, 120, 120, 120, 220]) },
])

export const SPRITE_PET_DENSE_ROWS = SPRITE_PET_DENSE_ROW_CONTRACT.length
export const SPRITE_PET_DENSE_ATLAS_WIDTH = SPRITE_PET_WEAR_COLUMNS * SPRITE_PET_WEAR_CELL_WIDTH
export const SPRITE_PET_DENSE_ATLAS_HEIGHT = SPRITE_PET_DENSE_ROWS * SPRITE_PET_WEAR_CELL_HEIGHT

const LEGACY_ATLAS_WIDTH = SPRITE_PET_COLUMNS * SPRITE_PET_CELL_WIDTH
const LEGACY_ATLAS_HEIGHT = SPRITE_PET_ROW_CONTRACT.length * SPRITE_PET_CELL_HEIGHT
const LEGACY_FALLBACK_BY_DESIRED = Object.freeze({
  idle: 'idle',
  listening: 'waiting',
  speaking: 'waving',
  thinking: 'review',
  happy: 'waving',
  shy: 'failed',
  sad: 'failed',
  waiting: 'waiting',
  failed: 'failed',
  waving: 'waving',
  jumping: 'jumping',
  review: 'review',
  running: 'running',
  'running-right': 'running-right',
  'running-left': 'running-left',
})

function matchesAtlasSize(width, height, targetWidth, targetHeight) {
  if (width === targetWidth && height === targetHeight) {
    return true
  }
  if (targetWidth <= 0 || targetHeight <= 0) {
    return false
  }
  const scaleX = width / targetWidth
  const scaleY = height / targetHeight
  if (scaleX < 0.5 || scaleY < 0.5) {
    return false
  }
  if (Math.abs(scaleX - scaleY) > 0.002) {
    return false
  }
  const snapped = Math.round(scaleX * 4) / 4
  return snapped >= 0.5 && Math.abs(scaleX - snapped) < 0.01
}

/**
 * Classify a bitmap as the dense sheet, a legacy 8x9 sheet, or not a sheet.
 *
 * @param {number} width
 * @param {number} height
 * @returns {SpritePetAtlasEdition}
 */
export function detectSpritePetAtlasEdition(width, height) {
  const safeWidth = Number(width)
  const safeHeight = Number(height)
  if (!Number.isFinite(safeWidth) || !Number.isFinite(safeHeight) || safeWidth <= 0 || safeHeight <= 0) {
    return 'unknown'
  }
  if (matchesAtlasSize(safeWidth, safeHeight, SPRITE_PET_DENSE_ATLAS_WIDTH, SPRITE_PET_DENSE_ATLAS_HEIGHT)) {
    return 'dense'
  }
  if (matchesAtlasSize(safeWidth, safeHeight, LEGACY_ATLAS_WIDTH, LEGACY_ATLAS_HEIGHT)) {
    return 'legacy-8x9'
  }
  return 'unknown'
}

/**
 * Map a desired performance state onto a row that actually exists on the
 * worn sheet. Dense sheets keep the desired name; 8x9 sheets fall back.
 *
 * @param {SpritePetAtlasEdition} edition
 * @param {string} desiredState
 * @returns {string}
 */
export function resolveSpritePetWearState(edition, desiredState) {
  const desired = String(desiredState ?? '').trim()
  if (edition === 'dense') {
    return SPRITE_PET_DENSE_ROW_CONTRACT.some((entry) => entry.state === desired)
      ? desired
      : 'idle'
  }
  if (edition === 'legacy-8x9') {
    return LEGACY_FALLBACK_BY_DESIRED[desired] ?? 'idle'
  }
  return 'idle'
}

/**
 * Look up the row contract entry for a playable state on an edition.
 *
 * @param {SpritePetAtlasEdition} edition
 * @param {string} playableState
 */
export function getSpritePetWearRow(edition, playableState) {
  const rows = edition === 'dense' ? SPRITE_PET_DENSE_ROW_CONTRACT : SPRITE_PET_ROW_CONTRACT
  return rows.find((entry) => entry.state === playableState) ?? rows[0]
}
