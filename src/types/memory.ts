import type { ChatRole } from './chat'

export type MemoryCategory =
  | 'profile'
  | 'preference'
  | 'goal'
  | 'habit'
  | 'manual'
  | 'feedback'
  | 'project'
  | 'reference'

export type MemoryImportance = 'low' | 'normal' | 'high' | 'pinned'

export interface MemoryItem {
  id: string
  content: string
  category: MemoryCategory
  source: string
  createdAt: string
  lastUsedAt?: string
  importance?: MemoryImportance
}

export interface DailyMemoryEntry {
  id: string
  day: string
  role: Exclude<ChatRole, 'system'>
  content: string
  source: 'chat' | 'voice'
  createdAt: string
}

export type DailyMemoryStore = Record<string, DailyMemoryEntry[]>

export type MemorySearchMode = 'keyword' | 'hybrid' | 'vector'

export interface MemorySemanticMatch {
  id: string
  layer: 'long_term' | 'daily'
  content: string
  score: number
}

export interface MemoryRecallContext {
  longTerm: MemoryItem[]
  daily: DailyMemoryEntry[]
  semantic: MemorySemanticMatch[]
  searchModeUsed: MemorySearchMode
  vectorSearchAvailable: boolean
}
