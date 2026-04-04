import type { AppSettings } from '../../types'
import { extractLikelyWeatherLocation, extractMusicQuery, extractSearchQuery, normalizeToolText } from './extractors.ts'
import { matchBuiltInTool } from './registry.ts'
import { rewriteSearchQuery } from './queryRewrite.ts'
import type { MatchedBuiltInTool } from './toolTypes'

export type ToolPlannerIntent =
  | 'web_search'
  | 'weather'
  | 'open_external'
  | 'open_app'
  | 'music_control'
  | 'chat'

export type ToolPlannerContext = {
  lastIntent: ToolPlannerIntent
  lastSearchQuery: string
  lastSearchSubject: string
  turnsSinceIntent: number
}

export type ToolIntentPlan = {
  intent: ToolPlannerIntent
  matchedTool: MatchedBuiltInTool | null
  nextContext: ToolPlannerContext | null
  promptContext: string
  reason:
    | 'direct_match'
    | 'weather_default_location'
    | 'weather_follow_up'
    | 'weather_missing_location'
    | 'search_follow_up'
    | 'search_missing_query'
    | 'unsupported_open_app'
    | 'unsupported_music_control'
    | 'chat'
}

const MAX_FOLLOW_UP_TURNS = 1
const STANDALONE_GREETING_PATTERN = /^(?:早上|早上好|早安|上午好|中午好|下午好|晚上好|晚安|你好|您好|嗨|哈喽|在吗|你在吗|你在不在)$/u

const FOLLOW_UP_LEAD_PATTERN = /^(?:那|那边|那儿|这里|这边|这儿|这个|那个|它|他|她|再|那我|那就|然后)\s*/u
const FOLLOW_UP_TRAIL_PATTERN = /(?:呢|呀|啊|吗|怎么样|如何|咋样|是什么|是啥|呢呀|呢啊)?$/u

const SEARCH_SUBJECT_SUFFIX_PATTERN = /\s*(?:歌词|歌詞|完整歌词|完整版|全文|作者|作词|作曲|歌手|演唱者|专辑|发行时间|官网|官方网站|网址|链接|新闻|资料|百科|简介|介绍)\s*$/iu
const SEARCH_SUBJECT_PREFIX_PATTERN = /^(?:(?:关于|有关)\s*)/u

const SEARCH_FOLLOW_UP_GENERIC_LYRICS_PATTERN = /^(?:(?:我|你|我们|咱们)\s*)?(?:(?:要(?:的|的是)?|想要|想看|想找|想查|问的|说的)\s*)?(?:(?:是|就是)\s*)?(?:(?:他|她|它|这个|那个|这首歌|那首歌|这首|那首)\s*)?(?:的)?(?:歌词|歌詞)$/iu
const SEARCH_FOLLOW_UP_FACET_PATTERNS: Array<{ facet: string; pattern: RegExp }> = [
  { facet: '歌词', pattern: /(?:歌词|歌詞)/iu },
  { facet: '完整歌词', pattern: /(?:完整歌词|完整版|全文|后半段|下一段|后面|接着|继续)/iu },
  { facet: '作者', pattern: /(?:作者|作词|作曲)/iu },
  { facet: '歌手', pattern: /(?:歌手|演唱者|谁唱(?:的)?)/iu },
  { facet: '专辑', pattern: /(?:专辑|收录在哪张专辑)/iu },
  { facet: '发行时间', pattern: /(?:发行时间|什么时候发行|哪一年发行|哪年发行(?:的)?|哪年出的)/iu },
  { facet: '简介', pattern: /(?:简介|介绍|背景|讲了什么|什么意思|讲的什么|想表达什么|大意)/iu },
  { facet: '官网', pattern: /(?:官网|官方网站|网址|链接)/iu },
  { facet: '新闻', pattern: /(?:新闻|近况|最近怎么样|资料|百科)/iu },
]

const OPEN_APP_INTENT_PATTERN = /(?:打开|启动|运行)(?!.*(?:https?:\/\/|www\.|\.com|\.cn|官网|网页|网站))/iu
const MUSIC_CONTROL_INTENT_PATTERN = /(?:播放|暂停|继续播放|下一首|上一首|音乐|歌曲|歌单|听歌|随机播放|循环播放)/iu
const WEATHER_FALLBACK_INTENT_PATTERN = /(?:天气|气温|温度|下雨|降雨|阴天|晴天|weather|forecast)/iu
const SEARCH_INTENT_PATTERN = /(?:搜索|搜一下|搜索一下|查询|查找|查一下|查一查|找一下|找一找|歌词|歌詞|资讯|新闻|search|google|bing|web|lyrics?|lyric)/iu
const SEARCH_MISSING_QUERY_PATTERN = /^(?:歌词|歌詞|搜索|搜一下|搜索一下|查询|查找|查一下|查一查|找一下|找一找|新闻|资讯|lyrics?|lyric|search|google|bing|web)$/iu
const SEARCH_PRONOUN_ONLY_PATTERN = /^(?:(?:他|她|它|这个|那个|这首歌|那首歌|这首|那首)(?:的)?)?(?:歌词|歌詞)$/iu

function createEmptyPlannerContext(): ToolPlannerContext {
  return {
    lastIntent: 'chat',
    lastSearchQuery: '',
    lastSearchSubject: '',
    turnsSinceIntent: 0,
  }
}

function agePlannerContext(context: ToolPlannerContext | null) {
  if (!context) {
    return null
  }

  return {
    ...context,
    turnsSinceIntent: context.turnsSinceIntent + 1,
  }
}

function buildPlannerContextFromTool(
  tool: MatchedBuiltInTool,
): ToolPlannerContext {
  const base = createEmptyPlannerContext()

  if (tool.id === 'web_search') {
    const searchSubject = deriveSearchSubject(tool.query)
    return {
      ...base,
      lastIntent: 'web_search',
      lastSearchQuery: tool.query,
      lastSearchSubject: searchSubject,
    }
  }

  if (tool.id === 'weather') {
    return {
      ...base,
      lastIntent: 'weather',
    }
  }

  return {
    ...base,
    lastIntent: 'open_external',
  }
}

function buildUnsupportedPlannerContext(
  intent: Extract<ToolPlannerIntent, 'open_app' | 'music_control'>,
): ToolPlannerContext {
  return {
    ...createEmptyPlannerContext(),
    lastIntent: intent,
  }
}

function buildClarificationPlannerContext(
  intent: Extract<ToolPlannerIntent, 'weather' | 'web_search'>,
): ToolPlannerContext {
  return {
    ...createEmptyPlannerContext(),
    lastIntent: intent,
  }
}

function normalizeFollowUpText(content: string) {
  return normalizeToolText(
    String(content ?? '')
      .replace(FOLLOW_UP_LEAD_PATTERN, '')
      .replace(FOLLOW_UP_TRAIL_PATTERN, ''),
  )
}

function deriveSearchSubject(query: string) {
  const normalized = rewriteSearchQuery(
    normalizeToolText(
      String(query ?? '')
        .replace(SEARCH_SUBJECT_SUFFIX_PATTERN, '')
        .replace(SEARCH_SUBJECT_PREFIX_PATTERN, ''),
    ),
  ).searchTopic

  return normalized || normalizeToolText(query)
}

function isStandaloneGreetingTurn(content: string) {
  const normalized = normalizeToolText(
    String(content ?? '')
      .replace(/[\u3002\uff0c\uff01\uff1f,.!?]/gu, ''),
  )

  if (!normalized || normalized.length > 8) {
    return false
  }

  return STANDALONE_GREETING_PATTERN.test(normalized)
}

function extractSearchFollowUpFacet(content: string) {
  if (SEARCH_FOLLOW_UP_GENERIC_LYRICS_PATTERN.test(content)) {
    return '歌词'
  }

  return SEARCH_FOLLOW_UP_FACET_PATTERNS.find((entry) => entry.pattern.test(content))?.facet ?? ''
}

function canReuseFollowUpContext(context: ToolPlannerContext | null) {
  return Boolean(context && context.turnsSinceIntent <= MAX_FOLLOW_UP_TURNS)
}

function planWeatherFollowUp(
  content: string,
  context: ToolPlannerContext | null,
): ToolIntentPlan | null {
  if (!context || context.lastIntent !== 'weather' || !canReuseFollowUpContext(context)) {
    return null
  }

  const location = extractLikelyWeatherLocation(content)
  if (!location) {
    return null
  }

  const matchedTool: MatchedBuiltInTool = {
    id: 'weather',
    location,
  }

  return {
    intent: 'weather',
    matchedTool,
    nextContext: buildPlannerContextFromTool(matchedTool),
    promptContext: '',
    reason: 'weather_follow_up',
  }
}

function planSearchFollowUp(
  content: string,
  context: ToolPlannerContext | null,
): ToolIntentPlan | null {
  if (!context || context.lastIntent !== 'web_search' || !canReuseFollowUpContext(context)) {
    return null
  }

  const facet = extractSearchFollowUpFacet(content)
  const subject = context.lastSearchSubject || deriveSearchSubject(context.lastSearchQuery)
  if (!facet || !subject) {
    return null
  }
  const rewritten = rewriteSearchQuery(`${subject} ${facet}`)

  const matchedTool: MatchedBuiltInTool = {
    id: 'web_search',
    query: rewritten.rewrittenQuery,
    limit: 5,
  }

  return {
    intent: 'web_search',
    matchedTool,
    nextContext: buildPlannerContextFromTool(matchedTool),
    promptContext: '',
    reason: 'search_follow_up',
  }
}

function shouldClarifyWeatherLocation(
  content: string,
  settings?: Partial<AppSettings> | null,
) {
  if (!WEATHER_FALLBACK_INTENT_PATTERN.test(content)) {
    return false
  }

  if (extractLikelyWeatherLocation(content)) {
    return false
  }

  return !normalizeToolText(settings?.toolWeatherDefaultLocation ?? '')
}

function shouldClarifySearchQuery(content: string) {
  if (!SEARCH_INTENT_PATTERN.test(content)) {
    return false
  }

  const query = normalizeToolText(extractSearchQuery(content))
  if (!query) {
    return true
  }

  const compact = query.replace(/\s+/g, '')
  if (!compact) {
    return true
  }

  return SEARCH_MISSING_QUERY_PATTERN.test(query) || SEARCH_PRONOUN_ONLY_PATTERN.test(compact)
}

function buildUnsupportedIntentPrompt(intent: ToolPlannerIntent, content: string) {
  if (intent === 'open_app') {
    return `意图规划结果：这句更像是在请求打开本地软件（用户原话：${content}）。当前内置自动执行还不支持打开软件；不要假装已经打开，请直接说明限制，必要时追问具体软件名。`
  }

  if (intent === 'music_control') {
    return `意图规划结果：这句更像是在请求音乐播放或控制（用户原话：${content}）。当前内置自动执行还不支持音乐控制；不要假装已经播放或切歌，请直接说明限制，必要时追问播放器或歌曲。`
  }

  return ''
}

function planUnsupportedIntent(content: string): ToolIntentPlan | null {
  if (OPEN_APP_INTENT_PATTERN.test(content)) {
    return {
      intent: 'open_app',
      matchedTool: null,
      nextContext: buildUnsupportedPlannerContext('open_app'),
      promptContext: buildUnsupportedIntentPrompt('open_app', content),
      reason: 'unsupported_open_app',
    }
  }

  if (MUSIC_CONTROL_INTENT_PATTERN.test(content)) {
    const musicQuery = extractMusicQuery(content)
    if (musicQuery) {
      const searchQuery = `${musicQuery} 在线听`
      return {
        intent: 'web_search',
        matchedTool: {
          id: 'web_search',
          query: searchQuery,
          limit: 5,
          keywords: [musicQuery],
        },
        nextContext: buildPlannerContextFromTool({ id: 'web_search', query: searchQuery, limit: 5 }),
        promptContext: `意图规划结果：用户想听音乐「${musicQuery}」，已自动搜索乐源。请从搜索结果中找到可播放的音乐链接（优先网易云音乐、QQ音乐、酷狗等平台），直接告诉用户歌曲信息和播放链接。如果没有找到合适的结果，请告知用户。`,
        reason: 'direct_match',
      }
    }

    return {
      intent: 'music_control',
      matchedTool: null,
      nextContext: buildUnsupportedPlannerContext('music_control'),
      promptContext: buildUnsupportedIntentPrompt('music_control', content),
      reason: 'unsupported_music_control',
    }
  }

  return null
}

export function planToolIntent(
  content: string,
  context: ToolPlannerContext | null = null,
  settings?: Partial<AppSettings> | null,
): ToolIntentPlan {
  const normalized = normalizeToolText(content)
  if (!normalized) {
    return {
      intent: 'chat',
      matchedTool: null,
      nextContext: agePlannerContext(context),
      promptContext: '',
      reason: 'chat',
    }
  }

  const directMatch = matchBuiltInTool(normalized)
  if (directMatch) {
    return {
      intent: directMatch.id,
      matchedTool: directMatch,
      nextContext: buildPlannerContextFromTool(directMatch),
      promptContext: '',
      reason: 'direct_match',
    }
  }

  const fallbackWeatherLocation = normalizeToolText(settings?.toolWeatherDefaultLocation ?? '')
  if (fallbackWeatherLocation && WEATHER_FALLBACK_INTENT_PATTERN.test(normalized)) {
    const matchedTool: MatchedBuiltInTool = {
      id: 'weather',
      location: fallbackWeatherLocation,
    }

    return {
      intent: 'weather',
      matchedTool,
      nextContext: buildPlannerContextFromTool(matchedTool),
      promptContext: '',
      reason: 'weather_default_location',
    }
  }

  if (isStandaloneGreetingTurn(normalized)) {
    return {
      intent: 'chat',
      matchedTool: null,
      nextContext: createEmptyPlannerContext(),
      promptContext: '最新一句更像是在打招呼或简单寒暄，不是在继续上一轮未完成的天气、搜索或链接任务。请只回应这句本身，不要顺着上一轮的话题继续执行。',
      reason: 'chat',
    }
  }

  const normalizedFollowUp = normalizeFollowUpText(normalized)
  const weatherFollowUp = planWeatherFollowUp(normalizedFollowUp || normalized, context)
  if (weatherFollowUp) {
    return weatherFollowUp
  }

  const searchFollowUp = planSearchFollowUp(normalizedFollowUp || normalized, context)
  if (searchFollowUp) {
    return searchFollowUp
  }

  if (shouldClarifyWeatherLocation(normalized, settings)) {
    return {
      intent: 'chat',
      matchedTool: null,
      nextContext: buildClarificationPlannerContext('weather'),
      promptContext: '意图规划结果：这句更像是在问天气，但地点没有说清。不要直接编造天气结果，请只追问城市或地区，等用户补充地点后再查。',
      reason: 'weather_missing_location',
    }
  }

  if (shouldClarifySearchQuery(normalized)) {
    return {
      intent: 'chat',
      matchedTool: null,
      nextContext: buildClarificationPlannerContext('web_search'),
      promptContext: '意图规划结果：这句更像是在请求搜索，但搜索主题还不完整。不要假装已经查到了结果，请先追问具体歌名、人物、地点或主题。',
      reason: 'search_missing_query',
    }
  }

  const unsupportedIntent = planUnsupportedIntent(normalized)
  if (unsupportedIntent) {
    return unsupportedIntent
  }

  return {
    intent: 'chat',
    matchedTool: null,
    nextContext: agePlannerContext(context),
    promptContext: '',
    reason: 'chat',
  }
}
