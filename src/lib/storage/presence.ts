import type { AmbientPresenceState, PresenceHistoryItem } from '../../types'
import {
  AMBIENT_PRESENCE_STORAGE_KEY,
  LAST_PROACTIVE_PRESENCE_AT_STORAGE_KEY,
  PRESENCE_ACTIVITY_AT_STORAGE_KEY,
  PRESENCE_HISTORY_STORAGE_KEY,
  readJson,
  writeJson,
} from './core.ts'

export function loadAmbientPresence(): AmbientPresenceState | null {
  const stored = readJson<AmbientPresenceState | null>(AMBIENT_PRESENCE_STORAGE_KEY, null)
  if (!stored?.text || !stored.createdAt || !stored.expiresAt) {
    return null
  }

  if (Date.parse(stored.expiresAt) <= Date.now()) {
    return null
  }

  return stored
}

export function saveAmbientPresence(state: AmbientPresenceState | null) {
  if (!state) {
    window.localStorage.removeItem(AMBIENT_PRESENCE_STORAGE_KEY)
    return
  }

  writeJson(AMBIENT_PRESENCE_STORAGE_KEY, state)
}

export function loadPresenceActivityAt() {
  const stored = readJson<number>(PRESENCE_ACTIVITY_AT_STORAGE_KEY, Date.now())
  return Number.isFinite(stored) ? stored : Date.now()
}

export function savePresenceActivityAt(timestamp: number) {
  writeJson(PRESENCE_ACTIVITY_AT_STORAGE_KEY, timestamp)
}

export function loadLastProactivePresenceAt() {
  const stored = readJson<number>(LAST_PROACTIVE_PRESENCE_AT_STORAGE_KEY, 0)
  return Number.isFinite(stored) ? stored : 0
}

export function saveLastProactivePresenceAt(timestamp: number) {
  writeJson(LAST_PROACTIVE_PRESENCE_AT_STORAGE_KEY, timestamp)
}

export function loadPresenceHistory() {
  return readJson<PresenceHistoryItem[]>(PRESENCE_HISTORY_STORAGE_KEY, []).slice(0, 6)
}

export function savePresenceHistory(history: PresenceHistoryItem[]) {
  writeJson(PRESENCE_HISTORY_STORAGE_KEY, history.slice(0, 6))
}
