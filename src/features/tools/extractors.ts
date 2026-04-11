import type { MatchedBuiltInTool } from './toolTypes'
import { rewriteSearchQuery } from './queryRewrite.ts'
import { normalizeIntentText } from '../intent/preprocess.ts'

const SEARCH_INTENT_PATTERN = new RegExp(
  String.raw`(?:搜索|搜一下|搜索一下|查询|查找|查一下|查一查|找一下|找一找|歌词|歌詞|资讯|新闻|search|google|bing|web|lyrics?|lyric)`,
  'iu',
)

const WEATHER_INTENT_PATTERN = new RegExp(
  String.raw`(?:天气|气温|温度|下雨|降雨|阴天|晴天|冷不冷|热不热|weather|forecast)`,
  'iu',
)

const OPEN_INTENT_PATTERN = new RegExp(
  String.raw`(?:打开|访问|进入|open|visit|go to)`,
  'iu',
)

const LEADING_POLITE_PATTERN = new RegExp(
  String.raw`^(?:(?:能|能不能|可以|麻烦|请)\s*)?(?:帮我|给我|我想|我想要|请)?\s*(?:查|看|找|搜|问|说|报)\s*`,
  'iu',
)

const SEARCH_VERB_PATTERN = new RegExp(
  String.raw`(?:搜索一下|搜一下|搜索|查一下|查一查|查询|查找|找一下|找一找|search|google|bing|web)`,
  'giu',
)

const SEARCH_META_PREFIX_PATTERN = new RegExp(
  String.raw`^(?:(?:你|你们)\s*)?(?:(?:能|能不能|可以|麻烦|请)\s*)?(?:(?:帮我|给我|替我|我想|我想要|我要|我要的是|我是想)\s*)?(?:(?:搜索一下|搜一下|搜索|搜|查一下|查一查|查询|查找|查|找一下|找一找|找)\s*)+`,
  'iu',
)

const WEATHER_VERB_PATTERN = new RegExp(
  String.raw`(?:查一下|查看|查询|找一下|找|看看|看一下|告诉我|帮我看|帮我查|帮我找|报一下|weather|forecast)`,
  'giu',
)

const WEATHER_FILLER_PATTERN = new RegExp(
  String.raw`(?:一下|目前|当前|最近|当地|这里|那边|我这边)`,
  'giu',
)

const WEATHER_TOPIC_PATTERN = new RegExp(
  String.raw`(?:天气(?:怎么样|如何|咋样|情况)?|气温|温度|冷不冷|热不热|会不会下雨|下不下雨|有没有雨|降不降雨)`,
  'iu',
)

const WEATHER_PRONOUN_PREFIX_PATTERN = new RegExp(
  String.raw`^(?:(?:给)?我|我们|你|你们|咱们|自己|这里|这边|这儿|那边|那儿)\s*`,
  'iu',
)

const WEATHER_TRAILING_PARTICLE_PATTERN = new RegExp(
  String.raw`[的地得呢吗啊呀吧嘛]+$`,
  'iu',
)

const WEATHER_PARTIAL_TOPIC_SUFFIX_PATTERN = new RegExp(
  String.raw`(?:的)?天(?:气)?$`,
  'iu',
)

const WEATHER_STT_COMMAND_PREFIX_PATTERN = new RegExp(
  String.raw`^(?:(?:你|你们|我|我们|咱们)\s*)?(?:在\s*)?(?:(?:一)?(?:查|看|找|搜|报|问)\s*)+`,
  'iu',
)

const WEATHER_LOCATION_TAIL_PATTERN = new RegExp(
  String.raw`([\u3400-\u9fff]{2,}(?:特别行政区|自治州|自治县|地区|省|市|区|县|镇|乡|州|盟|旗)?)$`,
  'u',
)

const WEATHER_LOCATION_INVALID_PATTERN = new RegExp(
  String.raw`(?:怎么|为什么|什么|啥|告诉|看到|看见|搜(?:索|到)?|查(?:到)?|结果|回答|回复|你|我|我们|你们|不是|已经|刚才|刚刚|天气)`,
  'iu',
)

const WEATHER_LOCATION_TIME_WORD_PATTERN = new RegExp(
  String.raw`^(?:今天|明天|后天|现在|目前|当前|当地|早上|上午|中午|下午|晚上|凌晨|傍晚|夜里)$`,
  'iu',
)

const WEATHER_LOCATION_FRAGMENT_PATTERN = new RegExp(
  String.raw`^(?:怎(?:么|样)?|咋样|怎样|如何|情况|什么(?:样)?|啥(?:样)?|么样)$`,
  'iu',
)

const WEATHER_LOCATION_QUERY_MARKER_PATTERN = new RegExp(
  String.raw`(?:天气|气温|温度|下雨|降雨|怎么|怎样|咋样|如何|情况|什么|啥|么样)`,
  'iu',
)

const WEATHER_META_PREFIX_PATTERN = new RegExp(
  String.raw`^(?:(?:那)?(?:你|我|我们|咱们)\s*)?(?:(?:想问(?:一下)?(?:的|的是)?|问(?:一下)?(?:的|的是)?|想知道|想了解|想看|想查|就是想问|帮忙|帮个忙|说一下|说说)\s*)+`,
  'iu',
)

const CHINESE_LOCATION_SUFFIX_PATTERN = new RegExp(
  String.raw`(?:特别行政区|自治州|自治县|地区|省|市|区|县|镇|乡|州|盟|旗)$`,
  'u',
)

const STT_NOISE_PATTERN = new RegExp(
  String.raw`^(?:能|嗯|嘛|那|这|诶|的|那个|这个|就是|就|好|对|嘿|然后|而且)\s*`,
  'iu',
)

const GENERIC_LYRICS_QUERY_PATTERN = new RegExp(
  String.raw`^(?:(?:我|你|我们|咱们)\s*)?(?:(?:要(?:的|的是)?|想要|想看|想找|问的|说的)\s*)?(?:(?:是|(?:就)?是)\s*)?(?:(?:他|她|它|这|那|这个|那个|这首歌|那首歌|这首|那首)\s*)?(?:的)?(?:歌词|歌詞)$`,
  'iu',
)

const SEARCH_TOPIC_PREFIX_PATTERN = new RegExp(
  String.raw`^(?:(?:我|你|我们|咱们)\s*)?(?:(?:要(?:的|的是)?|想要(?:的|的是)?|想找(?:的|的是)?|想查(?:的|的是)?|想搜(?:的|的是)?|想问(?:的|的是)?|问(?:的|的是)?|说(?:的|的是)?)\s*)?(?:(?:是|(?:就)?是)\s*)*`,
  'iu',
)

export function normalizeToolText(content: string) {
  return normalizeIntentText(content)
}

function cleanSttNoise(text: string) {
  return normalizeToolText(text.replace(STT_NOISE_PATTERN, ''))
}

function extractExplicitUrl(content: string) {
  const directUrlMatch = content.match(/https?:\/\/[^\s)]+/i)
  if (directUrlMatch) {
    return directUrlMatch[0]
  }

  const domainMatch = content.match(/\b(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s]*)?\b/i)
  if (domainMatch) {
    return domainMatch[0]
  }

  return ''
}

export function extractSearchQuery(content: string) {
  const cleaned = cleanSttNoise(
    normalizeToolText(
      content
        .replace(SEARCH_META_PREFIX_PATTERN, '')
        .replace(LEADING_POLITE_PATTERN, '')
        .replace(SEARCH_VERB_PATTERN, ' ')
        .replace(/[\uFF0C\u3002\uFF01\uFF1F,.;:!?]/g, ' '),
    ),
  )

  const normalized = normalizeToolText(cleaned.replace(SEARCH_TOPIC_PREFIX_PATTERN, ''))
  if (!normalized) {
    return normalized
  }

  return rewriteSearchQuery(normalized).rewrittenQuery
}

function cleanWeatherLocation(text: string) {
  return cleanSttNoise(
    normalizeToolText(
      text
        .replace(WEATHER_META_PREFIX_PATTERN, '')
        .replace(WEATHER_STT_COMMAND_PREFIX_PATTERN, '')
        .replace(WEATHER_FILLER_PATTERN, ' ')
        .replace(WEATHER_PRONOUN_PREFIX_PATTERN, '')
        .replace(/^(?:儿|是|在|去|到)\s*/u, '')
        .replace(WEATHER_TRAILING_PARTICLE_PATTERN, '')
        .replace(WEATHER_PARTIAL_TOPIC_SUFFIX_PATTERN, ''),
    ),
  )
}

function stripChineseLocationSuffix(text: string) {
  return String(text ?? '').replace(CHINESE_LOCATION_SUFFIX_PATTERN, '').trim()
}

function collectChineseLocationTailCandidates(text: string) {
  const compact = normalizeToolText(String(text ?? '')).replace(/\s+/g, '')
  const candidates: string[] = []

  const pushCandidate = (value: string) => {
    const normalized = cleanWeatherLocation(value)
    if (normalized && !candidates.includes(normalized)) {
      candidates.push(normalized)
    }
  }

  if (!/^[\u3400-\u9fff]+$/u.test(compact)) {
    return candidates
  }

  if (WEATHER_LOCATION_FRAGMENT_PATTERN.test(compact) || WEATHER_LOCATION_QUERY_MARKER_PATTERN.test(compact)) {
    return candidates
  }

  const stripped = stripChineseLocationSuffix(compact)
  if (stripped) {
    pushCandidate(stripped)
  }

  const base = stripped || compact
  for (let length = 2; length <= Math.min(5, base.length); length += 1) {
    pushCandidate(base.slice(-length))
  }

  return candidates
}

function collectWeatherLocationCandidates(text: string) {
  const raw = String(text ?? '').trim()
  const candidates: string[] = []

  const pushCandidate = (value: string) => {
    const normalized = cleanWeatherLocation(value)
    if (normalized && !candidates.includes(normalized)) {
      candidates.push(normalized)
    }

    const compact = cleanWeatherLocation(String(value ?? '').replace(/\s+/g, ''))
    if (compact && !candidates.includes(compact)) {
      candidates.push(compact)
    }

    const tail = normalized.match(WEATHER_LOCATION_TAIL_PATTERN)?.[1]?.trim() ?? ''
    if (tail && !candidates.includes(tail)) {
      candidates.push(tail)
    }

    for (const tailCandidate of collectChineseLocationTailCandidates(normalized)) {
      if (!candidates.includes(tailCandidate)) {
        candidates.push(tailCandidate)
      }
    }
  }

  if (!raw) {
    return candidates
  }

  pushCandidate(raw)

  const tokens = normalizeToolText(raw).split(' ').filter(Boolean)
  for (let index = 0; index < tokens.length; index += 1) {
    pushCandidate(tokens.slice(index).join(' '))
    pushCandidate(tokens.slice(index).join(''))
  }

  return candidates
}

function isLikelyWeatherLocation(text: string) {
  const normalized = normalizeToolText(String(text ?? ''))
  const compact = normalized.replace(/[\s,，。！？!?:：；;、]/g, '')
  if (!compact) {
    return false
  }

  if (compact.length > 20 || /\d/.test(compact)) {
    return false
  }

  if (WEATHER_LOCATION_TIME_WORD_PATTERN.test(compact)) {
    return false
  }

  if (WEATHER_LOCATION_FRAGMENT_PATTERN.test(compact)) {
    return false
  }

  if (WEATHER_LOCATION_INVALID_PATTERN.test(compact)) {
    return false
  }

  if (/[\u3400-\u9fff]/u.test(compact)) {
    return compact.length >= 2
  }

  if (/[a-z]/i.test(normalized)) {
    return /^[a-z][a-z\s.'-]{1,40}$/iu.test(normalized)
  }

  return false
}

function pickWeatherLocationCandidate(text: string) {
  return collectWeatherLocationCandidates(text).find((candidate) => isLikelyWeatherLocation(candidate)) ?? ''
}

export function extractLikelyWeatherLocation(text: string) {
  return pickWeatherLocationCandidate(normalizeToolText(String(text ?? '')))
}

export function extractWeatherLocation(content: string) {
  const normalized = normalizeToolText(
    content
      .replace(LEADING_POLITE_PATTERN, '')
      .replace(WEATHER_VERB_PATTERN, ' '),
  )

  const beforeWeatherMatch = normalized.match(
    /(.+?)(?:今天|明天|后天|现在)?(?:的)?(?:天气(?:怎么样|如何|咋样|情况)?|气温|温度|降雨|下雨|冷不冷|热不热|会不会下雨|下不下雨|有没有雨|降不降雨)/u,
  )
  if (beforeWeatherMatch?.[1]) {
    const location = pickWeatherLocationCandidate(beforeWeatherMatch[1])
    if (location) {
      return location
    }
  }

  const afterWeatherMatch = normalized.match(
    /(?:天气(?:怎么样|如何|咋样|情况)?|气温|温度)\s*(?:在|是|怎么样|如何|咋样)?\s*(.+)$/u,
  )
  if (afterWeatherMatch?.[1]) {
    const location = pickWeatherLocationCandidate(afterWeatherMatch[1])
    if (location) {
      return location
    }
  }

  const topicIndex = normalized.search(WEATHER_TOPIC_PATTERN)
  if (topicIndex > 0) {
    const location = pickWeatherLocationCandidate(normalized.slice(0, topicIndex))
    if (location) {
      return location
    }
  }

  return ''
}

function matchOpenExternalTool(content: string): MatchedBuiltInTool | null {
  if (!OPEN_INTENT_PATTERN.test(content)) {
    return null
  }

  const url = extractExplicitUrl(content)
  if (!url) {
    return null
  }

  return {
    id: 'open_external',
    url,
  }
}

function matchWeatherTool(content: string): MatchedBuiltInTool | null {
  if (!WEATHER_INTENT_PATTERN.test(content)) {
    return null
  }

  const location = extractWeatherLocation(content)
  if (!location) {
    return null
  }

  return {
    id: 'weather',
    location,
  }
}

function matchWebSearchTool(content: string, limit: number): MatchedBuiltInTool | null {
  if (!SEARCH_INTENT_PATTERN.test(content)) {
    return null
  }

  const query = extractSearchQuery(content)
  if (!query) {
    return null
  }

  const rewritten = rewriteSearchQuery(query)
  const normalizedQuery = rewritten.rewrittenQuery || query

  if (GENERIC_LYRICS_QUERY_PATTERN.test(normalizedQuery)) {
    return null
  }

  if (!normalizedQuery) {
    return null
  }

  if (GENERIC_LYRICS_QUERY_PATTERN.test(query)) {
    return null
  }

  return {
    id: 'web_search',
    query: normalizedQuery,
    limit,
  }
}

const MUSIC_PLAY_INTENT_PATTERN = new RegExp(
  String.raw`(?:播放|放一(?:首|下)|来一首|听一(?:下|首)|我想听|给我放|给我来|帮我放|play)`,
  'iu',
)

const MUSIC_PLAY_META_PREFIX_PATTERN = new RegExp(
  String.raw`^(?:(?:能|能不能|可以|麻烦|请)\s*)?(?:帮我|给我|我想|我要|我想要)?\s*(?:播放|放一(?:首|下)|来一首|听一(?:下|首)|听|放|play)\s*`,
  'iu',
)

const MUSIC_PLAY_SUFFIX_PATTERN = new RegExp(
  String.raw`\s*(?:这首歌|这首|那首歌|那首|的歌|吧|呗|嘛|啊|呀|吗|好吗|好不好|可以吗|行吗)$`,
  'iu',
)

export function extractMusicQuery(content: string): string {
  if (!MUSIC_PLAY_INTENT_PATTERN.test(content)) {
    return ''
  }

  let query = normalizeToolText(
    content
      .replace(MUSIC_PLAY_META_PREFIX_PATTERN, '')
      .replace(MUSIC_PLAY_SUFFIX_PATTERN, ''),
  )

  // 处理 "播放xxx的yyy" → "xxx yyy"
  query = query.replace(/\s*的\s*/, ' ').trim()

  if (!query || query.length > 60) {
    return ''
  }

  return query
}

export function extractBuiltInToolMatch(
  content: string,
  defaultWebSearchLimit = 5,
): MatchedBuiltInTool | null {
  const normalized = normalizeToolText(content)
  if (!normalized) {
    return null
  }

  return (
    matchOpenExternalTool(normalized)
    || matchWeatherTool(normalized)
    || matchWebSearchTool(normalized, defaultWebSearchLimit)
  )
}
