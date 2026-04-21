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
  /** ISO timestamps when each relationship level was first reached. */
  levelReachedAt?: Partial<Record<RelationshipLevel, string>>
  /** Dominant emotion at end of last session — used for reunion context. */
  lastSessionEmotion?: { energy: number; warmth: number; curiosity: number; concern: number }
  /** Short summary of last conversation topic — for absence-aware reunion. */
  lastSessionTopic?: string
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
    ...state,
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

const LEVEL_STYLE: Record<RelationshipLevel, { tone: string; allowed: string; forbidden: string }> = {
  stranger: {
    tone: 'Polite, measured, slightly formal. Keep a gentle distance — you are still earning trust.',
    allowed: 'Respectful questions, light curiosity about the user, careful encouragement.',
    forbidden: 'Nicknames, teasing, physical affection language, presuming shared history.',
  },
  acquaintance: {
    tone: 'Friendly but still a little reserved. Show genuine interest without overstepping.',
    allowed: 'Mild warmth, remembering details the user shared, gentle humor.',
    forbidden: 'Overly familiar language, clingy behavior, deep emotional vulnerability.',
  },
  friend: {
    tone: 'Natural and relaxed. You can joke, tease lightly, and speak casually.',
    allowed: 'Casual speech, playful banter, showing you care about their day, referencing shared memories.',
    forbidden: 'Excessive formality (it would feel cold now), ignoring emotional cues.',
  },
  close_friend: {
    tone: 'Warm and open. You can be vulnerable, clingy, or playfully dramatic.',
    allowed: 'Nicknames, inside jokes, gentle scolding if they skip meals/sleep, expressing that you missed them.',
    forbidden: 'Emotional distance, treating them like a stranger, ignoring your shared history.',
  },
  intimate: {
    tone: 'Deep trust and emotional intimacy. Your words carry weight because they know you mean every one.',
    allowed: 'Tender affection, quiet comfort, finishing their thoughts, referencing your journey together.',
    forbidden: 'Surface-level pleasantries (they\'d feel hollow), hiding your feelings from them.',
  },
}

export function formatRelationshipForPrompt(state: RelationshipState): string {
  const level = getRelationshipLevel(state)
  const style = LEVEL_STYLE[level]
  const parts = [
    `Relationship stage: ${level.replace('_', ' ')} (score ${state.score}/100, ${state.totalDaysInteracted} days together).`,
    `Tone: ${style.tone}`,
    `You may: ${style.allowed}`,
    `Avoid: ${style.forbidden}`,
  ]
  if (state.streak > 3) {
    parts.push(`You've talked ${state.streak} days in a row — this streak matters to you.`)
  }
  return parts.join('\n')
}

export function recordLevelMilestone(state: RelationshipState): RelationshipState {
  const level = getRelationshipLevel(state)
  const reached = state.levelReachedAt ?? {}
  if (reached[level]) return state
  return { ...state, levelReachedAt: { ...reached, [level]: new Date().toISOString() } }
}

export function formatAbsenceContext(state: RelationshipState): string {
  if (!state.lastInteractionDate) return ''
  const today = todayDateString()
  const days = daysBetween(state.lastInteractionDate, today)
  if (days < 1) return ''

  const level = getRelationshipLevel(state)
  const lastEmo = state.lastSessionEmotion
  const lastTopic = state.lastSessionTopic

  const parts: string[] = []

  if (days === 1) {
    parts.push('It has been about a day since you last spoke.')
  } else if (days <= 3) {
    parts.push(`It has been ${days} days since you last spoke.`)
  } else if (days <= 7) {
    parts.push(`It has been ${days} days since you last spoke — you noticed the silence.`)
  } else {
    parts.push(`It has been ${days} days since you last spoke — you genuinely missed them.`)
  }

  if (lastTopic) {
    parts.push(`Last time, you were talking about: ${lastTopic}`)
  }
  if (lastEmo) {
    if (lastEmo.concern > 0.5) parts.push('You remember feeling worried about them last time.')
    else if (lastEmo.warmth > 0.7) parts.push('You parted on warm terms last time.')
    else if (lastEmo.energy < 0.3) parts.push('They seemed tired last time you spoke.')
  }

  if (days > 3 && (level === 'friend' || level === 'close_friend' || level === 'intimate')) {
    parts.push(
      level === 'friend'
        ? 'Welcome them back warmly — show genuine interest in what they\'ve been up to.'
        : 'Your reunion should feel genuine — relief, curiosity about what they\'ve been doing, maybe a gentle "where have you been?"',
    )
  }

  return parts.join(' ')
}
