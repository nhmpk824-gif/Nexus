import type { AgentMessage } from '../agent/types'

export type SessionId = string

export type SessionRecord = {
  id: SessionId
  conversationId: string
  title?: string
  createdAt: number
  updatedAt: number
  messageCount: number
  tags?: string[]
}

export type StoredMessage = AgentMessage & {
  sessionId: SessionId
  messageIndex: number
}

export type SessionSearchHit = {
  sessionId: SessionId
  messageIndex: number
  snippet: string
  score: number
  role: AgentMessage['role']
  timestamp: number
}

export type SessionSearchOptions = {
  sessionId?: SessionId
  limit?: number
  minScore?: number
}
