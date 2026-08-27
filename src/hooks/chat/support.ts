import { parseAssistantPerformanceContent } from '../../features/pet/performance.ts'
import { t } from '../../i18n/runtime.ts'
import { humanizeIfSpeechIpcError } from '../../lib/humanizeError.ts'
import type { ChatMessage } from '../../types/index.ts'

export function formatReminderNextRunLabel(timestamp: string | undefined, locale: string) {
  const parsed = Date.parse(timestamp ?? '')
  if (Number.isNaN(parsed)) {
    return ''
  }

  return new Intl.DateTimeFormat(locale, {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(parsed))
}

export function getSpeechOutputErrorMessage(error: unknown, fallback?: string) {
  const coded = humanizeIfSpeechIpcError(error, 'tts')
  if (coded) return coded
  if (error instanceof Error) return error.message
  return fallback ?? t('voice.tts.playback_failed_fallback')
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
