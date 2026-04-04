import type { BuiltInToolResult } from './toolTypes'

function normalizeWhitespace(text: string) {
  return String(text ?? '').replace(/\s+/g, ' ').trim()
}

function truncateText(text: string, maxLength: number) {
  if (text.length <= maxLength) {
    return text
  }

  return `${text.slice(0, maxLength - 1).trimEnd()}…`
}

function stripSearchLeadIn(text: string) {
  return normalizeWhitespace(
    String(text ?? '')
      .replace(/^(?:我先整理一下[:：，,]?|我先总结一下[:：，,]?|最相关的结果提到[:：，,]?)/u, '')
      .replace(/^(?:好的[，,]主人[。！!]?)/u, '')
      .trim(),
  )
}

function buildBackgroundSearchAnswerText(result: Extract<BuiltInToolResult, { kind: 'web_search' }>) {
  if (result.result.display?.mode === 'lyrics') {
    return ''
  }

  const bodyLines = result.result.display?.bodyLines
    ?.map((line) => normalizeWhitespace(line))
    .filter(Boolean)
    .slice(0, 3) ?? []

  if (bodyLines.length) {
    return bodyLines.join('；')
  }

  const displaySummary = stripSearchLeadIn(result.result.display?.summary ?? '')
  if (displaySummary) {
    return displaySummary
  }

  const assistantSummary = stripSearchLeadIn(result.assistantSummary)
  if (assistantSummary) {
    return assistantSummary
  }

  const preview = normalizeWhitespace(
    result.result.items[0]?.contentPreview
      || result.result.items[0]?.snippet
      || '',
  )

  return truncateText(preview, 90)
}

export function buildBackgroundWebSearchStartNotice(query: string) {
  const normalizedQuery = normalizeWhitespace(query)
  const readableQuery = normalizedQuery ? `“${truncateText(normalizedQuery, 28)}”` : '这条搜索'

  return {
    chatContent: `好的，主人。我先去搜索${readableQuery}，等下把整理好的答案带回来。`,
    bubbleContent: `我先去搜索${readableQuery}，整理好后再告诉你。`,
    speechContent: '好的，主人。我去搜索一下，等下把答案告诉你。',
  }
}

export function buildBackgroundWebSearchResultNotice(
  result: Extract<BuiltInToolResult, { kind: 'web_search' }>,
) {
  const readableQuery = normalizeWhitespace(result.result.query)
  const title = readableQuery ? `“${truncateText(readableQuery, 28)}”` : '这条搜索'
  const answerText = buildBackgroundSearchAnswerText(result)

  if (result.result.display?.mode === 'lyrics') {
    return {
      chatContent: `主人，我已经把${title}搜索好了，内容已经整理在下面。`,
      bubbleContent: `我已经把${title}搜索好了。`,
      speechContent: '主人，我已经把这次搜索结果整理好了，内容已经展示在气泡里。',
    }
  }

  return {
    chatContent: `主人，我已经把${title}搜索好了，整理后的内容在下面。`,
    bubbleContent: `我已经把${title}搜索好了。`,
    speechContent: answerText
      ? `主人，我已经搜索到了你要的答案：${answerText}`
      : '主人，我已经把这次搜索结果整理好了，你可以看看气泡里的内容。',
  }
}

export function buildBackgroundWebSearchFailureNotice(query: string, errorMessage: string) {
  const normalizedQuery = normalizeWhitespace(query)
  const readableQuery = normalizedQuery ? `“${truncateText(normalizedQuery, 28)}”` : '这条搜索'
  const detail = normalizeWhitespace(errorMessage) || '这次没有成功拿到可用结果。'

  return {
    chatContent: `主人，这次搜索${readableQuery}时出了点问题：${detail}`,
    bubbleContent: `这次搜索${readableQuery}没成功，我稍后可以再试一次。`,
    speechContent: `主人，这次搜索出了点问题：${truncateText(detail, 48)}`,
  }
}
