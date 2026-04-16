import type { DailyMemoryStore, MemoryItem } from '../../types'
import {
  DAILY_MEMORY_STORAGE_KEY,
  LEGACY_MEMORY_STORAGE_KEY,
  MEMORY_STORAGE_KEY,
  readJson,
  writeJson,
  writeJsonDebounced,
} from './core.ts'

export function loadMemories(): MemoryItem[] {
  const next = readJson<MemoryItem[]>(MEMORY_STORAGE_KEY, [])
  if (next.length) {
    return next
  }

  const legacy = readJson<MemoryItem[]>(LEGACY_MEMORY_STORAGE_KEY, [])
  if (legacy.length) {
    writeJson(MEMORY_STORAGE_KEY, legacy)
  }

  return legacy
}

export function saveMemories(memories: MemoryItem[]) {
  writeJsonDebounced(MEMORY_STORAGE_KEY, memories)
}

export function loadDailyMemories(): DailyMemoryStore {
  return readJson<DailyMemoryStore>(DAILY_MEMORY_STORAGE_KEY, {})
}

export function saveDailyMemories(memories: DailyMemoryStore) {
  writeJsonDebounced(DAILY_MEMORY_STORAGE_KEY, memories)
}
