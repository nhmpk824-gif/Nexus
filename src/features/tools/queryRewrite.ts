import { normalizeIntentText, stripConversationPrefix } from '../intent/preprocess.ts'

type SearchQueryRewriteResult = {
  rawQuery: string
  normalizedQuery: string
  query: string
  rewrittenQuery: string
  topic: string
  displayQuery: string
  searchTopic: string
  keywords: string[]
  candidateQueries: string[]
  hasLyricsFacet: boolean
  isLyricsQuery: boolean
}

const SEARCH_FILLER_PATTERN = /(?:请问|麻烦|帮我|给我|替我|我想|我想要|我要|我需要|帮忙|搜索一下|搜一下|搜一搜|查一下|查一查|查找|查询|搜|查|看看|关于|有关)/giu
const SEARCH_LYRICS_PATTERN = /(?:歌词|歌詞|lyrics?|lyric)/iu
const SEARCH_META_PREFIX_PATTERN = /^(?:(?:你|你们)\s*)?(?:(?:能|能不能|可以|麻烦|请)\s*)?(?:(?:帮我|给我|替我|我想|我想要|我要|我要的是|我是想)\s*)?(?:(?:搜索一下|搜一下|搜索|搜|查一下|查一查|查询|查找|查|找一下|找一找|找)\s*)+/iu
const SEARCH_TOPIC_PREFIX_PATTERN = /^(?:(?:我|你|我们|咱们)\s*)?(?:(?:要(?:的|的是)?|想要(?:的|的是)?|想找(?:的|的是)?|想查(?:的|的是)?|想搜(?:的|的是)?|想问(?:的|的是)?|问(?:的|的是)?|说(?:的|的是)?)\s*)?(?:(?:是|(?:就)?是)\s*)*/iu
const SEARCH_STOP_WORDS = new Set([
  '一下',
  '一个',
  '这个',
  '那个',
  '现在',
  '最新',
  '最近',
  '今天',
  '明天',
  '请问',
  '麻烦',
  '帮我',
  '给我',
  '替我',
  '一下子',
  'search',
  'web',
  'bing',
  'google',
])
const WEATHER_RELATIVE_DAY_PATTERNS: Array<{ key: string; pattern: RegExp }> = [
  { key: 'tomorrow', pattern: /明天/u },
  { key: 'day_after_tomorrow', pattern: /后天/u },
  { key: 'today', pattern: /今天|现在|当前/u },
]

function normalizeWhitespace(text: string) {
  return normalizeIntentText(text)
}

function stripSearchDecorations(text: string) {
  return normalizeWhitespace(
    stripConversationPrefix(text)
      .replace(SEARCH_META_PREFIX_PATTERN, ' ')
      .replace(SEARCH_TOPIC_PREFIX_PATTERN, ' ')
      .replace(SEARCH_FILLER_PATTERN, ' ')
      .replace(/[《》"'`]/g, ' ')
      .replace(/[\u3002\uff0c\uff01\uff1f,.;:!?]/g, ' ')
      .replace(/\s+/g, ' '),
  )
}

function uniq<T>(values: T[]) {
  return [...new Set(values)]
}

function tokenizeForKeywords(text: string) {
  const normalized = stripSearchDecorations(text)
  if (!normalized) {
    return []
  }

  const tokens: string[] = []

  for (const piece of normalized.split(/\s+/)) {
    const token = piece.trim()
    if (!token) continue
    if (SEARCH_STOP_WORDS.has(token.toLowerCase())) continue

    if (/^[a-z0-9._-]+$/iu.test(token)) {
      if (token.length >= 2) {
        tokens.push(token.toLowerCase())
      }
      continue
    }

    if (/[\u3400-\u9fff]/u.test(token)) {
      const compact = token.replace(/\s+/g, '')
      if (compact.length >= 2) {
        tokens.push(compact)
      }
      if (compact.length >= 4) {
        tokens.push(compact.slice(0, Math.min(6, compact.length)))
      }
      continue
    }

    if (token.length >= 2) {
      tokens.push(token)
    }
  }

  return uniq(tokens).slice(0, 8)
}

function extractLyricsTopic(query: string) {
  return normalizeWhitespace(
    stripSearchDecorations(query)
      .replace(SEARCH_LYRICS_PATTERN, ' ')
      .replace(/(?:这首|那首)?歌$/iu, '')
      .replace(/[的地得]\s*$/u, '')
      .replace(/^(?:关于|有关)\s+/u, ''),
  )
}

function buildCandidateQueries(result: {
  rewrittenQuery: string
  searchTopic: string
  keywords: string[]
  isLyricsQuery: boolean
}) {
  const queries = new Set<string>()
  const topic = normalizeWhitespace(result.searchTopic)
  const rewrittenQuery = normalizeWhitespace(result.rewrittenQuery)

  if (rewrittenQuery) {
    queries.add(rewrittenQuery)
  }

  if (topic && topic !== rewrittenQuery) {
    queries.add(topic)
  }

  if (result.isLyricsQuery && topic) {
    queries.add(`"${topic}" 歌词`)
    queries.add(`${topic} 歌词`)
    queries.add(`${topic} lyrics`)
  }

  if (result.keywords.length >= 2) {
    queries.add(result.keywords.slice(0, 4).join(' '))
  }

  return [...queries].filter(Boolean).slice(0, 5)
}

export function extractSearchKeywords(text: string) {
  return tokenizeForKeywords(text)
}

export function rewriteSearchQuery(query: string): SearchQueryRewriteResult {
  const rawQuery = String(query ?? '')
  const normalizedQuery = normalizeWhitespace(rawQuery)
  const isLyricsQuery = SEARCH_LYRICS_PATTERN.test(normalizedQuery)
  const searchTopic = isLyricsQuery ? extractLyricsTopic(normalizedQuery) : stripSearchDecorations(normalizedQuery)
  const normalizedLyricsQuery = normalizeWhitespace(
    isLyricsQuery && searchTopic
      ? /(?:完整|全文)$/u.test(searchTopic)
        ? `${searchTopic}歌词`
        : `${searchTopic} 歌词`
      : '',
  )
  const rewrittenQuery = normalizeWhitespace(
    isLyricsQuery && searchTopic
      ? normalizedLyricsQuery
      : searchTopic || normalizedQuery,
  )
  const keywords = extractSearchKeywords(rewrittenQuery || normalizedQuery)
  const displayQuery = normalizeWhitespace(searchTopic || normalizedQuery || rewrittenQuery)

  return {
    rawQuery,
    normalizedQuery,
    query: rewrittenQuery || normalizedQuery,
    rewrittenQuery: rewrittenQuery || normalizedQuery,
    topic: searchTopic || rewrittenQuery || normalizedQuery,
    displayQuery: displayQuery || normalizedQuery || rewrittenQuery,
    searchTopic: searchTopic || rewrittenQuery || normalizedQuery,
    keywords,
    candidateQueries: buildCandidateQueries({
      rewrittenQuery: rewrittenQuery || normalizedQuery,
      searchTopic: searchTopic || rewrittenQuery || normalizedQuery,
      keywords,
      isLyricsQuery,
    }),
    hasLyricsFacet: isLyricsQuery,
    isLyricsQuery,
  }
}

export function extractWeatherRelativeDay(text: string) {
  const normalized = normalizeWhitespace(text)
  return WEATHER_RELATIVE_DAY_PATTERNS.find((entry) => entry.pattern.test(normalized))?.key ?? ''
}

export function resolveWeatherLocationFallback(
  location: string,
  defaultLocation: string | null | undefined,
) {
  const normalizedLocation = normalizeWhitespace(location)
  if (normalizedLocation) {
    return {
      location: normalizedLocation,
      usedFallback: false,
    }
  }

  const normalizedFallback = normalizeWhitespace(defaultLocation ?? '')
  return {
    location: normalizedFallback,
    usedFallback: Boolean(normalizedFallback),
  }
}
