import { parseAssistantPerformanceContent } from '../../features/pet/performance'
import type { ChatMessage } from '../../types'

export function formatReminderNextRunLabel(timestamp?: string) {
  const parsed = Date.parse(timestamp ?? '')
  if (Number.isNaN(parsed)) {
    return ''
  }

  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(parsed))
}

export function getSpeechOutputErrorMessage(error: unknown, fallback = '语音播报失败') {
  return error instanceof Error ? error.message : fallback
}

export function sanitizeLoadedMessages(messages: ChatMessage[]) {
  return messages.flatMap((message) => {
    if (message.role !== 'assistant') {
      return [message]
    }

    const cleanedContent = parseAssistantPerformanceContent(message.content).displayContent
    if (!cleanedContent) {
      return []
    }

    return [{
      ...message,
      content: cleanedContent,
    }]
  })
}
