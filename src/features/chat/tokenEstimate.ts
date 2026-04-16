import type { ChatMessage } from '../../types'

export function estimateTokensFromText(text: string): number {
  if (!text) return 0
  let chars = 0
  let cjk = 0
  for (const ch of text) {
    if (/\p{Script=Han}|[\u3000-\u303f\uff00-\uffef]/u.test(ch)) {
      cjk += 1
    } else {
      chars += 1
    }
  }
  return Math.ceil(chars / 4) + Math.ceil(cjk / 1.5)
}

export function estimateTokensFromMessages(messages: Array<{ content: unknown }>): number {
  let total = 0
  for (const message of messages) {
    if (typeof message.content === 'string') {
      total += estimateTokensFromText(message.content)
    } else if (Array.isArray(message.content)) {
      for (const part of message.content) {
        if (typeof part === 'string') {
          total += estimateTokensFromText(part)
        } else if (part && typeof part === 'object' && 'text' in part && typeof (part as { text: unknown }).text === 'string') {
          total += estimateTokensFromText((part as { text: string }).text)
        }
      }
    }
  }
  return total
}

export function estimateChatMessagesTokens(messages: ChatMessage[]): number {
  return estimateTokensFromMessages(messages.map((m) => ({ content: m.content })))
}
