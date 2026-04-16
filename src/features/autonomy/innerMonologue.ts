/**
 * Inner monologue — lightweight periodic LLM calls that produce "thoughts".
 *
 * Every N autonomy ticks (when the companion is awake and the user isn't
 * deep-focused), a small prompt is sent to the LLM with the companion's
 * current context: time, mood, desktop activity, recent conversation
 * snippets, and a few relevant memories. The LLM returns a short internal
 * thought plus a 0-100 urgency score indicating how much it wants to speak.
 *
 * When urgency exceeds a configurable threshold the thought is surfaced
 * as proactive speech; otherwise it's silently logged for debug visibility.
 */

import type {
  AppSettings,
  AutonomyTickState,
  ChatMessage,
  FocusState,
  MemoryItem,
} from '../../types'

// ── Types ──────────────────────────────────────────────────────────────────────

export type MonologueContext = {
  tickState: AutonomyTickState
  focusState: FocusState
  currentHour: number
  activeWindowTitle: string | null
  recentMessages: ChatMessage[]
  memories: MemoryItem[]
  settings: AppSettings
}

export type MonologueResult = {
  thought: string
  urgency: number
  /** Optional speech text — may differ from the raw thought. */
  speech: string | null
}

// ── System prompt ──────────────────────────────────────────────────────────────

function buildMonologueSystemPrompt(settings: AppSettings): string {
  return `You are ${settings.companionName}, a desktop AI companion. Right now you are having an inner monologue — quietly observing and thinking.

Rules:
- Think in the first person, brief and natural (1-2 sentences)
- Produce a genuine inner thought grounded in the current situation
- Rate how much you want to speak up (urgency 0-100)
  - 0-30: quiet observation, no need to speak
  - 31-60: mildly want to speak, but not urgent
  - 61-80: you want to say something
  - 81-100: you really want to speak (important matter, interesting finding, or concern for the user)
- If urgency > 50, provide a natural conversational opener (the speech field)
- The speech field should sound like something a friend would say offhand, not a standard AI-assistant reply

Output strict JSON with no markdown code block:
{"thought":"inner thought","urgency":number,"speech":"what you want to say, or null"}`
}

// ── Prompt builder ─────────────────────────────────────────────────────────────

export function buildMonologuePrompt(ctx: MonologueContext): {
  system: string
  user: string
} {
  const parts: string[] = []

  // Time context
  const hour = ctx.currentHour
  const timeLabel = hour < 6 ? 'late night' : hour < 9 ? 'early morning' : hour < 12 ? 'morning'
    : hour < 14 ? 'midday' : hour < 18 ? 'afternoon' : hour < 22 ? 'evening' : 'late night'
  parts.push(`Time: ${timeLabel} ${hour}:${String(new Date().getMinutes()).padStart(2, '0')}`)

  // Phase / idle
  parts.push(`State: ${ctx.tickState.phase}, consecutive idle ticks: ${ctx.tickState.consecutiveIdleTicks}`)

  // Desktop activity
  if (ctx.activeWindowTitle) {
    parts.push(`User is using: ${ctx.activeWindowTitle}`)
  } else if (ctx.focusState !== 'active') {
    parts.push(`User status: ${ctx.focusState}`)
  }

  // Recent conversation (last 3 messages, brief)
  const recent = ctx.recentMessages.slice(-3)
  if (recent.length > 0) {
    const lines = recent.map((m) => {
      const tag = m.role === 'user' ? 'User' : ctx.settings.companionName
      const text = m.content.length > 80 ? m.content.slice(0, 80) + '…' : m.content
      return `${tag}: ${text}`
    })
    parts.push(`Recent conversation:\n${lines.join('\n')}`)
  } else {
    parts.push('No recent conversation')
  }

  // A few relevant memories (pick up to 3)
  const relevantMemos = pickContextMemories(ctx.memories, 3)
  if (relevantMemos.length > 0) {
    parts.push(`Relevant memories:\n${relevantMemos.map((m) => `- ${m.content}`).join('\n')}`)
  }

  return {
    system: buildMonologueSystemPrompt(ctx.settings),
    user: parts.join('\n'),
  }
}

// ── Response parser ────────────────────────────────────────────────────────────

export function parseMonologueResponse(content: string): MonologueResult | null {
  try {
    let cleaned = content.trim()
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')
    }

    const parsed = JSON.parse(cleaned)
    if (typeof parsed.thought !== 'string' || typeof parsed.urgency !== 'number') {
      return null
    }

    return {
      thought: parsed.thought,
      urgency: Math.max(0, Math.min(100, Math.round(parsed.urgency))),
      speech: typeof parsed.speech === 'string' && parsed.speech.length > 0
        ? parsed.speech
        : null,
    }
  } catch {
    return null
  }
}

// ── Tick eligibility ───────────────────────────────────────────────────────────

/**
 * Determines whether a monologue tick should fire this cycle.
 * Returns false during sleep, dreaming, quiet hours, deep focus, or
 * if not enough ticks have elapsed since the last monologue.
 */
export function shouldRunMonologue(
  tickState: AutonomyTickState,
  ticksSinceLastMonologue: number,
  monologueIntervalTicks: number,
): boolean {
  // Don't think while sleeping or dreaming
  if (tickState.phase === 'sleeping' || tickState.phase === 'dreaming') return false

  // Respect interval
  return ticksSinceLastMonologue >= monologueIntervalTicks
}

/**
 * Compute an adaptive monologue interval that scales with current activity.
 *
 * The base interval comes from settings (autonomyMonologueIntervalTicks).
 * We multiply it by an "activity factor" so that:
 *   - When the user is actively typing / focused / has talked recently, the
 *     companion thinks less often (multiplier > 1) — don't be intrusive.
 *   - When the user is idle, away, or hasn't said anything in a long time,
 *     the companion thinks more often (multiplier < 1) — fill the silence.
 *
 * The returned value is clamped to [base * 0.4, base * 2.5] so adaptation
 * never collapses to 0 or runs away.
 */
export function computeAdaptiveMonologueInterval(
  baseIntervalTicks: number,
  signals: {
    tickState: AutonomyTickState
    focusState: FocusState
    minutesSinceLastUserMessage: number | null
  },
): number {
  let multiplier = 1

  // Active foreground window → user is engaged, stretch interval.
  if (signals.focusState === 'active') multiplier *= 1.5
  // Locked screen → user not present, shrink so monologue fills the gap.
  else if (signals.focusState === 'locked') multiplier *= 0.6
  else if (signals.focusState === 'away') multiplier *= 0.7
  else if (signals.focusState === 'idle') multiplier *= 0.85

  // Drowsy phase = quiet, fewer thoughts.
  if (signals.tickState.phase === 'drowsy') multiplier *= 1.4

  // Long silence from the user → think more often (be present).
  const minutesSilent = signals.minutesSinceLastUserMessage
  if (minutesSilent !== null) {
    if (minutesSilent < 1) multiplier *= 1.6      // user just spoke, give them air
    else if (minutesSilent > 15) multiplier *= 0.75
    else if (minutesSilent > 45) multiplier *= 0.55
  }

  // Very high consecutive idle ticks → user is gone, monologue can speed up.
  if (signals.tickState.consecutiveIdleTicks > 30) multiplier *= 0.8

  const minInterval = Math.max(1, Math.round(baseIntervalTicks * 0.4))
  const maxInterval = Math.max(minInterval + 1, Math.round(baseIntervalTicks * 2.5))
  const adapted = Math.round(baseIntervalTicks * multiplier)
  return Math.min(maxInterval, Math.max(minInterval, adapted))
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function pickContextMemories(memories: MemoryItem[], count: number): MemoryItem[] {
  if (memories.length <= count) return memories

  // Prefer high-importance + recently used
  const scored = memories.map((m) => {
    let score = 0
    if (m.importance === 'pinned') score += 10
    else if (m.importance === 'high') score += 5
    if (m.lastUsedAt) {
      const age = Date.now() - new Date(m.lastUsedAt).getTime()
      if (age < 3_600_000) score += 3 // used within last hour
    }
    // Add slight randomness to avoid always picking the same ones
    score += Math.random() * 2
    return { memory: m, score }
  })

  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, count).map((s) => s.memory)
}
