import type { BuiltInToolResult } from './toolTypes'
import { shouldUseBuiltInToolAssistantSummary } from './assistant.ts'

type ResolveAssistantPresentationOptions = {
  builtInToolResult: BuiltInToolResult | null
  hasToolResultCard: boolean
  assistantDisplayContent: string
  assistantSpokenContent: string
  toolSpeechOutput: string
}

export type AssistantPresentationBundle = {
  bubbleContent: string
  chatContent: string
  speechContent: string
  statusContent: string
  useBuiltInToolSummary: boolean
}

export function resolveAssistantPresentation({
  builtInToolResult,
  hasToolResultCard,
  assistantDisplayContent,
  assistantSpokenContent,
  toolSpeechOutput,
}: ResolveAssistantPresentationOptions): AssistantPresentationBundle {
  const assistantReplyForStatus = assistantSpokenContent
    || assistantDisplayContent
    || '刚刚做了一个动作'
  const useBuiltInToolSummary = builtInToolResult
    ? shouldUseBuiltInToolAssistantSummary(assistantReplyForStatus, builtInToolResult)
    : false
  const chatContent = useBuiltInToolSummary && builtInToolResult
    ? builtInToolResult.assistantSummary
    : assistantDisplayContent
  const speechContent = useBuiltInToolSummary
    ? (
      toolSpeechOutput
      || (builtInToolResult ? builtInToolResult.assistantSummary : '')
      || assistantSpokenContent
      || chatContent
    )
    : (
      assistantSpokenContent
      || toolSpeechOutput
      || chatContent
    )
  const statusContent = speechContent || chatContent || assistantReplyForStatus
  const bubbleContent = hasToolResultCard ? assistantDisplayContent : chatContent

  return {
    bubbleContent,
    chatContent,
    speechContent,
    statusContent,
    useBuiltInToolSummary,
  }
}
