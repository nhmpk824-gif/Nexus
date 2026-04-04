import { buildBackgroundWebSearchStartNotice } from '../../features/tools/backgroundSearch.ts'
import { resolveBuiltInToolPolicy } from '../../features/tools/permissions.ts'
import type { ToolIntentPlan } from '../../features/tools/planner.ts'
import { isBuiltInToolAvailable } from '../../features/tools/registry.ts'
import type { MatchedBuiltInTool } from '../../features/tools/toolTypes.ts'
import { shorten } from '../../lib/common'
import type { AppSettings } from '../../types'
import type { CompanionNoticePayload, UseChatContext } from './types'
import type { BackgroundWebSearchOptions } from './backgroundSearch'

export type ToolIntentHandlerOptions = {
  toolIntentPlan: ToolIntentPlan
  currentSettings: AppSettings
  content: string
  fromVoice: boolean
  traceLabel: string
  shouldResumeContinuousVoice: boolean
}

type ToolIntentHandlerDependencies = {
  ctx: Pick<
    UseChatContext,
    | 'appendDebugConsoleEvent'
    | 'appendVoiceTrace'
    | 'suppressVoiceReplyRef'
    | 'updateVoicePipeline'
  >
  pushCompanionNotice: (notice: CompanionNoticePayload) => Promise<void>
  runBackgroundWebSearch: (options: BackgroundWebSearchOptions) => Promise<void>
  flushDeferredCompanionNotices: () => Promise<void>
}

export function createToolIntentHandler(dependencies: ToolIntentHandlerDependencies) {
  return async function handleToolIntent(options: ToolIntentHandlerOptions) {
    const { toolIntentPlan, currentSettings, content, fromVoice, traceLabel, shouldResumeContinuousVoice } = options

    if (
      toolIntentPlan.reason === 'weather_missing_location'
      || toolIntentPlan.reason === 'search_missing_query'
    ) {
      const isWeatherClarification = toolIntentPlan.reason === 'weather_missing_location'
      const clarificationMessage = isWeatherClarification
        ? '我知道你是在问天气，但这句话里还没有明确地点。你可以直接补一个城市或地区，比如“深圳天气”或“北京明天会下雨吗”。'
        : '我知道你想搜索，但搜索主题还不够明确。你可以直接补歌名、人物、地点或主题，比如“周传雄黄昏歌词”或“深圳有什么好吃的”。'
      const clarificationSpeech = fromVoice && dependencies.ctx.suppressVoiceReplyRef.current
        ? ''
        : (
            isWeatherClarification
              ? '好的，主人。我知道你是在问天气，不过地点还没有说清。你可以直接补一个城市或地区。'
              : '好的，主人。我知道你想搜索，不过搜索主题还不够明确。你可以直接补歌名、人物、地点或主题。'
          )
      const detail = isWeatherClarification ? '等待补充天气地点' : '等待补充搜索主题'

      dependencies.ctx.appendDebugConsoleEvent({
        source: 'tool',
        title: detail,
        detail: content,
        tone: 'info',
      })

      await dependencies.pushCompanionNotice({
        chatContent: clarificationMessage,
        bubbleContent: clarificationMessage,
        speechContent: clarificationSpeech,
        autoHideMs: 12_000,
        shouldResumeContinuousVoice,
      })

      if (fromVoice) {
        dependencies.ctx.updateVoicePipeline('reply_received', detail, content)
        dependencies.ctx.appendVoiceTrace(detail, `#${traceLabel} ${shorten(content, 40)}`, 'info')
      }

      return true
    }

    const backgroundSearchPolicy = toolIntentPlan.matchedTool?.id === 'web_search'
      ? resolveBuiltInToolPolicy('web_search', currentSettings)
      : null

    if (
      toolIntentPlan.matchedTool?.id === 'web_search'
      && backgroundSearchPolicy?.enabled
      && isBuiltInToolAvailable('web_search')
    ) {
      const matchedSearchTool: Extract<MatchedBuiltInTool, { id: 'web_search' }> = {
        ...toolIntentPlan.matchedTool,
      }
      const startNotice = buildBackgroundWebSearchStartNotice(matchedSearchTool.query)
      const shouldResumeNoticeVoice = fromVoice && shouldResumeContinuousVoice

      void dependencies.runBackgroundWebSearch({
        matchedTool: matchedSearchTool,
        settingsSnapshot: { ...currentSettings },
        originalContent: content,
      })

      await dependencies.pushCompanionNotice({
        ...startNotice,
        autoHideMs: 9_000,
        shouldResumeContinuousVoice: shouldResumeNoticeVoice,
      })

      if (fromVoice) {
        dependencies.ctx.updateVoicePipeline('reply_received', '搜索任务已转入后台，结果整理好后我会继续告诉你。', content)
        dependencies.ctx.appendVoiceTrace('后台搜索已开始', `#${traceLabel} ${shorten(matchedSearchTool.query, 40)}`, 'success')
      }

      void dependencies.flushDeferredCompanionNotices()
      return true
    }

    return false
  }
}
