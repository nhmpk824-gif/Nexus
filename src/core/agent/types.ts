import type { InboundMessage, OutboundMessage } from '../channels/types'

export type AgentMessageRole = 'system' | 'user' | 'assistant' | 'tool'

export type AgentMessage = {
  role: AgentMessageRole
  content: string
  toolCallId?: string
  toolName?: string
  timestamp: number
}

export type AgentTurnRequest = {
  conversationId: string
  inbound: InboundMessage
  history: AgentMessage[]
}

export type AgentTurnEvent =
  | { kind: 'token'; delta: string }
  | { kind: 'message'; message: AgentMessage }
  | { kind: 'tool_call_request'; toolCallId: string; toolName: string; arguments: unknown }
  | { kind: 'tool_call_result'; toolCallId: string; result: unknown }
  | { kind: 'outbound'; message: OutboundMessage }
  | { kind: 'done'; reason: 'completed' | 'aborted' | 'error'; error?: string }
