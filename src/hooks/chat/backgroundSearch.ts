import {
  buildBackgroundWebSearchFailureNotice,
  buildBackgroundWebSearchResultNotice,
} from '../../features/tools/backgroundSearch.ts'
import { maybeRunMatchedBuiltInTool } from '../../features/tools/router'
import { toChatToolResult } from '../../features/tools/toolTypes.ts'
import { createId } from '../../lib'
import type { AssistantRuntimeActivity, AppSettings } from '../../types'
import type { MatchedBuiltInTool } from '../../features/tools/toolTypes.ts'
import type { CompanionNoticePayload, UseChatContext } from './types'

export type BackgroundWebSearchOptions = {
  matchedTool: Extract<MatchedBuiltInTool, { id: 'web_search' }>
  settingsSnapshot: AppSettings
  originalContent: string
}

type BackgroundWebSearchDependencies = {
  ctx: Pick<UseChatContext, 'appendDebugConsoleEvent' | 'shouldAutoRestartVoice'>
  beginBackgroundSearchActivity: () => void
  endBackgroundSearchActivity: () => void
  enqueueDeferredCompanionNotice: (notice: CompanionNoticePayload) => void
  setAssistantActivity: (activity: AssistantRuntimeActivity) => void
}

export function createBackgroundWebSearchRunner(dependencies: BackgroundWebSearchDependencies) {
  return async function runBackgroundWebSearch(options: BackgroundWebSearchOptions) {
    dependencies.beginBackgroundSearchActivity()
    const taskId = createId('bg-search')
    const shouldResumeContinuousVoice = dependencies.ctx.shouldAutoRestartVoice()

    dependencies.ctx.appendDebugConsoleEvent({
      source: 'tool',
      title: 'Background search started',
      detail: `Query: ${options.matchedTool.query}\nOriginal input: ${options.originalContent}`,
      tone: 'info',
      relatedTaskId: taskId,
    })

    try {
      const result = await maybeRunMatchedBuiltInTool(options.matchedTool, options.settingsSnapshot)
      if (!result || result.kind !== 'web_search') {
        dependencies.enqueueDeferredCompanionNotice({
          ...buildBackgroundWebSearchFailureNotice(
            options.matchedTool.query,
            'The web search did not start successfully.',
          ),
          autoHideMs: 12_000,
          shouldResumeContinuousVoice,
        })
        dependencies.ctx.appendDebugConsoleEvent({
          source: 'tool',
          title: 'Background search did not start',
          detail: `Query: ${options.matchedTool.query}`,
          tone: 'warning',
          relatedTaskId: taskId,
        })
        return
      }

      dependencies.setAssistantActivity('summarizing')
      dependencies.enqueueDeferredCompanionNotice({
        ...buildBackgroundWebSearchResultNotice(result),
        autoHideMs: 16_000,
        toolResult: toChatToolResult(result),
        shouldResumeContinuousVoice,
      })
      dependencies.ctx.appendDebugConsoleEvent({
        source: 'tool',
        title: 'Background search completed',
        detail: `Query: ${result.result.query}\nResult count: ${result.result.items.length}`,
        tone: 'success',
        relatedTaskId: taskId,
      })
    } catch (searchError) {
      const errorMessage = searchError instanceof Error ? searchError.message : 'Background search failed'
      dependencies.enqueueDeferredCompanionNotice({
        ...buildBackgroundWebSearchFailureNotice(options.matchedTool.query, errorMessage),
        autoHideMs: 12_000,
        shouldResumeContinuousVoice,
      })
      dependencies.ctx.appendDebugConsoleEvent({
        source: 'tool',
        title: 'Background search failed',
        detail: `Query: ${options.matchedTool.query}\nError: ${errorMessage}`,
        tone: 'error',
        relatedTaskId: taskId,
      })
    } finally {
      dependencies.endBackgroundSearchActivity()
    }
  }
}
