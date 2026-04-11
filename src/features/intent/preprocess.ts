const LEADING_CONVERSATION_PATTERN = /^(?:(?:那个|这个|就是|然后|请|麻烦|帮我|给我|替我|我想|我想要|我要|我需要|你|你帮我|你给我|请你|先|再)\s*)+/iu
const TRAILING_SOFTENER_PATTERN = /(?:好吗|可以吗|行吗|吧|呀|啊|呢|哈|啦|嘛)\s*$/u

export function normalizeIntentText(text: string) {
  return String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function stripConversationPrefix(text: string) {
  return normalizeIntentText(
    normalizeIntentText(text)
      .replace(LEADING_CONVERSATION_PATTERN, '')
      .replace(TRAILING_SOFTENER_PATTERN, ''),
  )
}

export function collapsePunctuationToSpace(text: string) {
  return normalizeIntentText(
    String(text ?? '').replace(/[\u3002\uff0c\uff01\uff1f,.;:!?/\\()[\]{}<>《》"'`“”‘’]+/gu, ' '),
  )
}

export function normalizeLookupText(text: string) {
  return collapsePunctuationToSpace(stripConversationPrefix(text))
    .toLowerCase()
    .replace(/\s+/g, '')
}
