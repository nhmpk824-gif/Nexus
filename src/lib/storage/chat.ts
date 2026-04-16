import type { ChatMessage } from '../../types'
import { CHAT_STORAGE_KEY, readJson, writeJsonDebounced } from './core.ts'

const MAX_PERSISTED_CHAT_MESSAGES = 500

export function loadChatMessages(): ChatMessage[] {
  return readJson<ChatMessage[]>(CHAT_STORAGE_KEY, [])
}

export function saveChatMessages(messages: ChatMessage[]) {
  const capped = messages.length > MAX_PERSISTED_CHAT_MESSAGES
    ? messages.slice(-MAX_PERSISTED_CHAT_MESSAGES)
    : messages
  // Strip inline image data URLs before persisting — base64 images can be
  // multi-MB each and would blow past the localStorage quota in a few turns.
  // Images stay in memory for the current session and vanish on reload.
  const stripped = capped.map((message) => {
    if (!message.images?.length) return message
    const copy: ChatMessage = { ...message }
    delete copy.images
    return copy
  })
  writeJsonDebounced(CHAT_STORAGE_KEY, stripped)
}
