/**
 * Relationship affinity tracking.
 *
 * Maintains a score (0–100) that reflects the depth of the
 * user–companion relationship over time.
 *
 * - Each day with at least one interaction: +1 (streak bonus up to +3)
 * - After 3 consecutive days of absence: -2 per absent day
 * - Score influences proactive speech warmth and frequency.
 */

export interface RelationshipState {
  score: number
  /** ISO date string (YYYY-MM-DD) of the last interaction day. */
  lastInteractionDate: string
  /** Current consecutive-day interaction streak. */
  streak: number
  /** Total number of distinct days with at least one interaction. */
  totalDaysInteracted: number
}

export function createDefaultRelationshipState(): RelationshipState {
  return {
    score: 10,
    lastInteractionDate: '',
    streak: 0,
    totalDaysInteracted: 0,
  }
}

const MAX_SCORE = 100
const MIN_SCORE = 0
const DAILY_INTERACTION_BONUS = 1
const MAX_STREAK_BONUS = 3
const ABSENCE_THRESHOLD_DAYS = 3
const ABSENCE_PENALTY_PER_DAY = 2

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10)
}

function daysBetween(dateA: string, dateB: string): number {
  const a = Date.parse(dateA)
  const b = Date.parse(dateB)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0
  return Math.floor(Math.abs(b - a) / 86_400_000)
}

function clampScore(value: number): number {
  return Math.max(MIN_SCORE, Math.min(MAX_SCORE, value))
}

/**
 * Call when the user interacts (sends a message, voice input, etc.).
 * Grants daily bonus at most once per calendar day.
 */
export function markDailyInteraction(state: RelationshipState): RelationshipState {
  const today = todayDateString()
  if (state.lastInteractionDate === today) return state

  const daysSinceLast = state.lastInteractionDate
    ? daysBetween(state.lastInteractionDate, today)
    : 0

  const isConsecutive = daysSinceLast === 1
  const newStreak = isConsecutive ? state.streak + 1 : 1
  const streakBonus = Math.min(newStreak - 1, MAX_STREAK_BONUS)

  return {
    score: clampScore(state.score + DAILY_INTERACTION_BONUS + streakBonus),
    lastInteractionDate: today,
    streak: newStreak,
    totalDaysInteracted: state.totalDaysInteracted + 1,
  }
}

/**
 * Call once per day (e.g. on first tick after midnight) to apply absence penalties.
 * If user hasn't interacted for more than ABSENCE_THRESHOLD_DAYS, score decays.
 */
export function applyAbsenceDecay(state: RelationshipState): RelationshipState {
  if (!state.lastInteractionDate) return state

  const today = todayDateString()
  const daysSinceLast = daysBetween(state.lastInteractionDate, today)

  if (daysSinceLast <= ABSENCE_THRESHOLD_DAYS) return state

  const penaltyDays = daysSinceLast - ABSENCE_THRESHOLD_DAYS
  const penalty = penaltyDays * ABSENCE_PENALTY_PER_DAY

  return {
    ...state,
    score: clampScore(state.score - penalty),
    streak: 0,
  }
}

// ── Relationship level ─────────────────────────────────────────────────────

export type RelationshipLevel = 'stranger' | 'acquaintance' | 'friend' | 'close_friend' | 'intimate'

export function getRelationshipLevel(state: RelationshipState): RelationshipLevel {
  if (state.score >= 80) return 'intimate'
  if (state.score >= 55) return 'close_friend'
  if (state.score >= 30) return 'friend'
  if (state.score >= 10) return 'acquaintance'
  return 'stranger'
}

// ── Prompt context ─────────────────────────────────────────────────────────

const LEVEL_DESCRIPTIONS: Record<RelationshipLevel, string> = {
  stranger: 'You just met recently. Stay polite and at an appropriate distance, building trust gradually.',
  acquaintance: 'You have had some interactions already. You may show mild warmth and care.',
  friend: 'You are already friends, so you can converse more naturally and casually.',
  close_friend: 'You are close friends. You can show genuine concern and be occasionally playful or clingy.',
  intimate: 'Your bond runs deep. You can express deep reliance and intimacy.',
}

export function formatRelationshipForPrompt(state: RelationshipState): string {
  const level = getRelationshipLevel(state)
  const desc = LEVEL_DESCRIPTIONS[level]
  if (state.streak > 3) {
    return `${desc} (You have interacted for ${state.streak} consecutive days — feel free to acknowledge this streak.)`
  }
  return desc
}
