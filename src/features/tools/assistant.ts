import type { WebSearchResultItem } from '../../types'
import type { BuiltInToolResult } from './toolTypes'
import { formatWeatherPeriodSummary } from './weatherText.ts'

const QUERY_FILLER_PATTERN = /(?:请|麻烦|帮我|给我|替我|我想|我想要|我要|我要的是|查一个|查一查|查找|查询|搜索|搜一个|搜一搜|找一个|找一找|看看|告诉我|一下|现在|目前|这个|那个)/giu

function normalizeWhitespace(text: string) {
  return String(text ?? '').replace(/\s+/g, ' ').trim()
}

function truncateText(text: string, maxLength: number) {
  if (text.length <= maxLength) {
    return text
  }

  return `${text.slice(0, maxLength - 1).trimEnd()}…`
}

function stripPunctuation(text: string) {
  return normalizeWhitespace(
    text.replace(/[[\s,，。！？!?'"“”‘’()（）【】<>\]]/gu, ' '),
  )
}

function extractQueryTokens(query: string) {
  const cleaned = stripPunctuation(query).replace(QUERY_FILLER_PATTERN, ' ')
  const seeds = cleaned
    .split(' ')
    .map((token) => token.trim())
    .filter(Boolean)

  const tokens = new Set<string>()

  for (const seed of seeds) {
    if (/^[a-z0-9._-]+$/iu.test(seed)) {
      if (seed.length >= 2) {
        tokens.add(seed.toLowerCase())
      }
      continue
    }

    const parts = seed
      .split(/[的之关于]/u)
      .map((part) => part.trim())
      .filter(Boolean)

    for (const part of parts.length ? parts : [seed]) {
      if (part.length >= 2) {
        tokens.add(part)
      }
    }
  }

  return [...tokens]
}

function normalizeSearchableText(text: string) {
  return stripPunctuation(text).toLowerCase()
}

function scoreWebSearchItem(item: WebSearchResultItem, tokens: string[], query: string) {
  const title = normalizeSearchableText(item.title)
  const snippet = normalizeSearchableText(item.contentPreview || item.snippet)
  const url = normalizeSearchableText(item.url)
  const compactQuery = normalizeSearchableText(query).replace(/\s+/g, '')

  let score = 0

  for (const token of tokens) {
    const normalizedToken = normalizeSearchableText(token)
    if (!normalizedToken) continue

    if (title.includes(normalizedToken)) score += 3
    if (snippet.includes(normalizedToken)) score += 1.5
    if (url.includes(normalizedToken)) score += 0.5
  }

  if (compactQuery && (title + snippet).replace(/\s+/g, '').includes(compactQuery)) {
    score += 4
  }

  return score
}

function cleanSnippetForSummary(text: string) {
  const cleaned = normalizeWhitespace(
    String(text ?? '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/(?:展开全部|阅读全文|更多内容|网页链接|查看原文|查看详情)/giu, ' ')
      .replace(/^[—–:：,.，。!?？！\s-]+/gu, '')
      .replace(/\s*[|｜丨]\s*/g, ' '),
  )

  return truncateText(cleaned, 72)
}

function pickBestSummarySnippet(item: WebSearchResultItem) {
  const preview = cleanSnippetForSummary(item.contentPreview ?? '')
  if (preview) {
    return preview
  }

  return cleanSnippetForSummary(item.snippet ?? '')
}

function buildWebSearchSummary(result: Extract<BuiltInToolResult, { kind: 'web_search' }>) {
  const structuredSummary = normalizeWhitespace(result.result.display?.summary ?? '')
  if (structuredSummary) {
    return structuredSummary
  }

  const tokens = extractQueryTokens(result.result.query)
  const ranked = result.result.items
    .map((item) => ({
      item,
      score: scoreWebSearchItem(item, tokens, result.result.query),
    }))
    .sort((left, right) => right.score - left.score)

  const confidence = result.result.matchConfidence ?? 'medium'
  const best = ranked[0]
  const relevant = ranked.filter((entry) => entry.score >= 2).slice(0, 3)

  if (!best || best.score < 2 || relevant.length === 0 || confidence === 'low') {
    const topTitle = result.result.items[0]?.title?.trim()
    return topTitle
      ? `这次网页搜索还没准确命中“${result.result.query}”。当前排在前面的结果是“${truncateText(topTitle, 28)}”，和你的问题还不够贴合。`
      : `这次网页搜索还没准确命中“${result.result.query}”，暂时没有拿到足够可靠的结果。`
  }

  const leadSnippet = pickBestSummarySnippet(relevant[0]?.item ?? best.item)
  if (leadSnippet) {
    if (confidence === 'medium') {
      return `我先整理了一下：目前最接近“${result.result.query}”的结果提到：${leadSnippet}，不过和你要找的内容可能还差一点。`
    }

    return `我先整理一下：这次搜索已经基本命中“${result.result.query}”，最相关的内容提到：${leadSnippet}`
  }

  const titles = relevant
    .map((entry) => `“${truncateText(entry.item.title.trim(), 24)}”`)
    .join('、')

  return confidence === 'medium'
    ? `我先整理了一下：目前最接近“${result.result.query}”的结果有 ${titles}，但还需要你确认是不是这个方向。`
    : `我先整理一下：这次搜索已经基本命中“${result.result.query}”，目前最相关的结果有 ${titles}。`
}

function buildWebSearchSpeechSummary(result: Extract<BuiltInToolResult, { kind: 'web_search' }>) {
  const query = normalizeWhitespace(result.result.query)
  const lyricsTitle = normalizeWhitespace(
    result.result.display?.mode === 'lyrics'
      ? result.result.display.title ?? ''
      : '',
  )

  if (lyricsTitle) {
    return `好的，主人。我查到了${truncateText(lyricsTitle, 28)}的歌词，这就为你展示。`
  }

  if (!query) {
    return '好的，主人。我已经把搜索结果整理好了，这就为你展示。'
  }

  return `好的，主人。我查到了“${truncateText(query, 28)}”的结果，这就为你展示。`
}

function buildWeatherSpeechSummary(result: Extract<BuiltInToolResult, { kind: 'weather' }>) {
  const pieces = [
    `${result.result.resolvedName}当前${result.result.currentSummary}`,
    result.result.todaySummary ? formatWeatherPeriodSummary('今天', result.result.todaySummary) : '',
    result.result.tomorrowSummary ? formatWeatherPeriodSummary('明天', result.result.tomorrowSummary) : '',
  ].filter(Boolean)

  const sentence = pieces.join('，').replace('，。', '。')
  return `好的，主人。${sentence}`
}

function buildOpenExternalSpeechSummary() {
  return '好的，主人。我已经把这个链接打开了。'
}

export function buildBuiltInToolAssistantSummary(result: BuiltInToolResult) {
  if (result.kind === 'weather') {
    const pieces = [
      `${result.result.resolvedName}当前${result.result.currentSummary}`,
      result.result.todaySummary ? formatWeatherPeriodSummary('今天', result.result.todaySummary) : '',
      result.result.tomorrowSummary ? formatWeatherPeriodSummary('明天', result.result.tomorrowSummary) : '',
    ].filter(Boolean)

    return `我先总结一下：${pieces.join('，')}。`
  }

  if (result.kind === 'open_external') {
    return `已经帮你打开这个链接了：${result.result.url}`
  }

  return buildWebSearchSummary(result)
}

export function buildBuiltInToolSpeechSummary(result: BuiltInToolResult) {
  if (result.kind === 'weather') {
    return buildWeatherSpeechSummary(result)
  }

  if (result.kind === 'open_external') {
    return buildOpenExternalSpeechSummary()
  }

  return buildWebSearchSpeechSummary(result)
}
