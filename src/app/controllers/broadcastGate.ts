// Cross-instance dedupe gate for proactive autonomy broadcasts.
// Module-level so it survives React StrictMode remounts (useRef does not).
// Each category has its own min-interval; firing twice within the window is
// silently dropped. The chat-side text dedupe (useChat:recentCompanionNotices)
// remains as a second safety net.

export type BroadcastCategory =
  | 'speak'
  | 'brief'
  | 'suggest'
  | 'monologue'
  | 'open_goal_followup'
  | 'scheduled'

const BROADCAST_MIN_INTERVAL_MS: Record<BroadcastCategory, number> = {
  speak: 60_000,
  brief: 4 * 60 * 60_000,
  suggest: 5 * 60_000,
  monologue: 90_000,
  open_goal_followup: 30 * 60_000,
  scheduled: 30_000,
}

const broadcastLastFiredAt = new Map<BroadcastCategory, number>()

export function canBroadcast(category: BroadcastCategory): boolean {
  const last = broadcastLastFiredAt.get(category) ?? 0
  return Date.now() - last >= BROADCAST_MIN_INTERVAL_MS[category]
}

export function markBroadcast(category: BroadcastCategory): void {
  broadcastLastFiredAt.set(category, Date.now())
}
