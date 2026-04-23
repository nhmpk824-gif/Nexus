/**
 * Time-series capture for emotion + relationship state.
 *
 * The autonomy store keeps the *current* emotion and relationship state
 * only — there's no way to answer "how has she felt this week?" without
 * a history. This module samples each state on meaningful changes and
 * persists the last N samples per series to localStorage.
 *
 * Design notes:
 *
 *  - **Dedup on small changes.** Every tick can nudge emotion by 1-2 %.
 *    Without a threshold the history fills with near-duplicates that
 *    tell no story. A sample is recorded only when any of the 4 axes
 *    (or the relationship score) has moved by at least CHANGE_THRESHOLD
 *    vs. the most recent sample.
 *
 *  - **Heartbeat.** Even without any change, we still drop a sample
 *    every HEARTBEAT_MS so the chart shows that a quiet day *was* quiet
 *    rather than going blank.
 *
 *  - **Capacity.** 200 emotion samples covers ~weeks of active use at
 *    the dedup rate; 100 relationship samples is more than enough
 *    (score moves once per day at most).
 */

import {
  AUTONOMY_EMOTION_HISTORY_STORAGE_KEY,
  AUTONOMY_RELATIONSHIP_HISTORY_STORAGE_KEY,
  readJson,
  writeJsonDebounced,
} from '../../lib/storage/core.ts'
import type { EmotionState } from './emotionModel'
import type { RelationshipLevel, RelationshipState } from './relationshipTracker'
import { getRelationshipLevel } from './relationshipTracker.ts'

const EMOTION_CAPACITY = 200
const RELATIONSHIP_CAPACITY = 100
const EMOTION_CHANGE_THRESHOLD = 0.06 // any axis moving by ≥6% triggers a sample
const EMOTION_HEARTBEAT_MS = 6 * 60 * 60 * 1000 // 6h idle heartbeat
const RELATIONSHIP_SCORE_THRESHOLD = 1 // integer score; any tick-level delta

export interface EmotionSample {
  ts: string
  energy: number
  warmth: number
  curiosity: number
  concern: number
}

export interface RelationshipSample {
  ts: string
  score: number
  level: RelationshipLevel
  streak: number
  daysInteracted: number
}

// ── In-memory caches to avoid re-reading localStorage on every tick ──────

let emotionHistoryCache: EmotionSample[] | null = null
let relationshipHistoryCache: RelationshipSample[] | null = null

function loadEmotionHistoryInternal(): EmotionSample[] {
  if (!emotionHistoryCache) {
    emotionHistoryCache = readJson<EmotionSample[]>(
      AUTONOMY_EMOTION_HISTORY_STORAGE_KEY,
      [],
    )
  }
  return emotionHistoryCache
}

function loadRelationshipHistoryInternal(): RelationshipSample[] {
  if (!relationshipHistoryCache) {
    relationshipHistoryCache = readJson<RelationshipSample[]>(
      AUTONOMY_RELATIONSHIP_HISTORY_STORAGE_KEY,
      [],
    )
  }
  return relationshipHistoryCache
}

// ── Sampling decisions (pure) ────────────────────────────────────────────

export function shouldCaptureEmotionSample(
  next: EmotionState,
  last: EmotionSample | undefined,
  nowMs: number,
): boolean {
  if (!last) return true

  const lastAt = Date.parse(last.ts)
  if (Number.isFinite(lastAt) && nowMs - lastAt >= EMOTION_HEARTBEAT_MS) {
    return true
  }

  const dEnergy = Math.abs(next.energy - last.energy)
  const dWarmth = Math.abs(next.warmth - last.warmth)
  const dCuriosity = Math.abs(next.curiosity - last.curiosity)
  const dConcern = Math.abs(next.concern - last.concern)
  return (
    dEnergy >= EMOTION_CHANGE_THRESHOLD
    || dWarmth >= EMOTION_CHANGE_THRESHOLD
    || dCuriosity >= EMOTION_CHANGE_THRESHOLD
    || dConcern >= EMOTION_CHANGE_THRESHOLD
  )
}

export function shouldCaptureRelationshipSample(
  next: RelationshipState,
  last: RelationshipSample | undefined,
): boolean {
  if (!last) return true
  const delta = Math.abs(next.score - last.score)
  if (delta >= RELATIONSHIP_SCORE_THRESHOLD) return true
  if (next.streak !== last.streak) return true
  if (getRelationshipLevel(next) !== last.level) return true
  return false
}

// ── Capture (public) ──────────────────────────────────────────────────────

export function captureEmotionSample(
  state: EmotionState,
  now: Date = new Date(),
): EmotionSample | null {
  const history = loadEmotionHistoryInternal()
  const last = history.length > 0 ? history[history.length - 1] : undefined
  if (!shouldCaptureEmotionSample(state, last, now.getTime())) {
    return null
  }

  const sample: EmotionSample = {
    ts: now.toISOString(),
    energy: state.energy,
    warmth: state.warmth,
    curiosity: state.curiosity,
    concern: state.concern,
  }
  history.push(sample)
  if (history.length > EMOTION_CAPACITY) {
    history.splice(0, history.length - EMOTION_CAPACITY)
  }
  writeJsonDebounced(AUTONOMY_EMOTION_HISTORY_STORAGE_KEY, history)
  return sample
}

export function captureRelationshipSample(
  state: RelationshipState,
  now: Date = new Date(),
): RelationshipSample | null {
  const history = loadRelationshipHistoryInternal()
  const last = history.length > 0 ? history[history.length - 1] : undefined
  if (!shouldCaptureRelationshipSample(state, last)) {
    return null
  }

  const sample: RelationshipSample = {
    ts: now.toISOString(),
    score: state.score,
    level: getRelationshipLevel(state),
    streak: state.streak,
    daysInteracted: state.totalDaysInteracted,
  }
  history.push(sample)
  if (history.length > RELATIONSHIP_CAPACITY) {
    history.splice(0, history.length - RELATIONSHIP_CAPACITY)
  }
  writeJsonDebounced(AUTONOMY_RELATIONSHIP_HISTORY_STORAGE_KEY, history)
  return sample
}

// ── Read (public) ─────────────────────────────────────────────────────────

export function loadEmotionHistory(): EmotionSample[] {
  return loadEmotionHistoryInternal().slice()
}

export function loadRelationshipHistory(): RelationshipSample[] {
  return loadRelationshipHistoryInternal().slice()
}

// ── Test helpers ──────────────────────────────────────────────────────────

/** Reset module-scoped caches. Exported for tests; do not use in product code. */
export function __resetStateTimelineCaches(): void {
  emotionHistoryCache = null
  relationshipHistoryCache = null
}
