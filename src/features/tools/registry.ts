import type { AppSettings, ExternalLinkResponse, WeatherLookupResponse, WebSearchResponse } from '../../types'
import { buildBuiltInToolAssistantSummary } from './assistant.ts'
import { extractBuiltInToolMatch } from './extractors.ts'
import { resolveWeatherLocationFallback, rewriteSearchQuery } from './queryRewrite.ts'
import type { BuiltInToolPolicy, BuiltInToolResult, MatchedBuiltInTool } from './toolTypes'

const DEFAULT_WEB_SEARCH_LIMIT = 5

export { extractLikelyWeatherLocation, extractSearchQuery, normalizeToolText } from './extractors.ts'

function formatWebSearchSystemMessage(result: WebSearchResponse) {
  return `已调用网页搜索：${result.query}`
}

function formatWebSearchDisplayContext(result: WebSearchResponse) {
  const sections: string[] = []

  if (result.display?.summary) {
    sections.push(`结构化摘要：${result.display.summary}`)
  }

  if (result.display?.bodyLines?.length) {
    sections.push(
      [
        '结构化正文：',
        ...result.display.bodyLines.slice(0, 6).map((line, index) => `${index + 1}. ${line}`),
      ].join('\n'),
    )
  }

  if (result.display?.panels?.length) {
    sections.push(
      [
        '结构化卡片：',
        ...result.display.panels.slice(0, 3).map((panel, index) => (
          `${index + 1}. 标题：${panel.title}\n来源：${panel.host}\n摘要：${panel.body}`
        )),
      ].join('\n\n'),
    )
  }

  return sections.join('\n\n')
}

function formatWebSearchPromptContext(result: WebSearchResponse) {
  const assistantSummary = buildBuiltInToolAssistantSummary({
    kind: 'web_search',
    systemMessage: '',
    promptContext: '',
    assistantSummary: '',
    result,
  })

  const itemLines = result.items.map((item, index) => (
    `${index + 1}. 标题：${item.title}\n链接：${item.url}\n摘要：${item.snippet}${item.publishedAt ? `\n发布时间：${item.publishedAt}` : ''}`
  ))

  const displayContext = formatWebSearchDisplayContext(result)

  return [
    `网页搜索结果（查询：${result.query}）：`,
    `建议先给用户的总结：${assistantSummary}`,
    '请先直接总结这些结果是否回答了用户问题；如果结果明显跑偏，也要明确说这次搜索结果不准，不要再说“我这就去查”。',
    displayContext,
    itemLines.join('\n\n'),
  ]
    .filter(Boolean)
    .join('\n')
}

function formatWeatherSystemMessage(result: WeatherLookupResponse) {
  return `已调用天气工具：${result.resolvedName}`
}

function formatWeatherPromptContext(result: WeatherLookupResponse) {
  return [
    `天气工具结果（地点：${result.resolvedName}）：`,
    `当前：${result.currentSummary}`,
    result.todaySummary ? `今天：${result.todaySummary}` : '',
    result.tomorrowSummary ? `明天：${result.tomorrowSummary}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

function formatOpenLinkSystemMessage(result: ExternalLinkResponse) {
  return `已调用打开链接工具：${result.url}`
}

function formatOpenLinkPromptContext(result: ExternalLinkResponse) {
  return `打开链接工具结果：已在系统浏览器中打开 ${result.url}`
}

export function isBuiltInToolAvailable(tool: MatchedBuiltInTool['id']) {
  if (tool === 'open_external') {
    return Boolean(window.desktopPet?.openExternalLink)
  }

  if (tool === 'weather') {
    return Boolean(window.desktopPet?.getWeather)
  }

  return Boolean(window.desktopPet?.searchWeb)
}

export function matchBuiltInTool(content: string): MatchedBuiltInTool | null {
  return extractBuiltInToolMatch(content, DEFAULT_WEB_SEARCH_LIMIT)
}

export async function executeBuiltInTool(
  tool: MatchedBuiltInTool,
  policy: BuiltInToolPolicy,
  settings?: Partial<AppSettings> | null,
): Promise<BuiltInToolResult> {
  if (tool.id === 'open_external') {
    if (!window.desktopPet?.openExternalLink) {
      throw new Error('当前环境暂不支持打开外部链接。')
    }

    const result = await window.desktopPet.openExternalLink({
      url: tool.url,
      policy,
    })
    const assistantSummary = buildBuiltInToolAssistantSummary({
      kind: 'open_external',
      systemMessage: '',
      promptContext: '',
      assistantSummary: '',
      result,
    })

    return {
      kind: 'open_external',
      systemMessage: formatOpenLinkSystemMessage(result),
      promptContext: `${formatOpenLinkPromptContext(result)}\n建议先给用户的总结：${assistantSummary}`,
      assistantSummary,
      result,
    }
  }

  if (tool.id === 'weather') {
    if (!window.desktopPet?.getWeather) {
      throw new Error('当前环境暂不支持天气查询。')
    }

    const weatherLocation = resolveWeatherLocationFallback(
      tool.location,
      settings?.toolWeatherDefaultLocation,
    )
    const result = await window.desktopPet.getWeather({
      location: weatherLocation.location,
      fallbackLocation: settings?.toolWeatherDefaultLocation,
      policy,
    })
    const assistantSummary = buildBuiltInToolAssistantSummary({
      kind: 'weather',
      systemMessage: '',
      promptContext: '',
      assistantSummary: '',
      result,
    })

    return {
      kind: 'weather',
      systemMessage: formatWeatherSystemMessage(result),
      promptContext: `${formatWeatherPromptContext(result)}\n建议先给用户的总结：${assistantSummary}`,
      assistantSummary,
      result,
    }
  }

  if (!window.desktopPet?.searchWeb) {
    throw new Error('当前环境暂不支持网页搜索。')
  }

  const rewrittenQuery = rewriteSearchQuery(tool.query)
  const result = await window.desktopPet.searchWeb({
    query: rewrittenQuery.rewrittenQuery,
    limit: tool.limit,
    providerId: settings?.toolWebSearchProviderId,
    baseUrl: settings?.toolWebSearchApiBaseUrl,
    apiKey: settings?.toolWebSearchApiKey,
    displayQuery: rewrittenQuery.displayQuery,
    keywords: tool.keywords?.length ? tool.keywords : rewrittenQuery.keywords,
    candidateQueries: tool.candidateQueries?.length
      ? tool.candidateQueries
      : rewrittenQuery.candidateQueries,
    fallbackToBing: settings?.toolWebSearchFallbackToBing,
    policy,
  })
  const assistantSummary = buildBuiltInToolAssistantSummary({
    kind: 'web_search',
    systemMessage: '',
    promptContext: '',
    assistantSummary: '',
    result,
  })

  return {
    kind: 'web_search',
    systemMessage: formatWebSearchSystemMessage(result),
    promptContext: formatWebSearchPromptContext(result),
    assistantSummary,
    result,
  }
}
