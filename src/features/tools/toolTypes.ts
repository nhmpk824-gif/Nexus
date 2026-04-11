import type {
  ChatToolResult,
  ExternalLinkResponse,
  WeatherLookupResponse,
  WebSearchResponse,
} from '../../types'

export type BuiltInToolId = 'web_search' | 'weather' | 'open_external'

export type BuiltInToolResult =
  | {
      kind: 'web_search'
      systemMessage: string
      promptContext: string
      assistantSummary: string
      result: WebSearchResponse
    }
  | {
      kind: 'weather'
      systemMessage: string
      promptContext: string
      assistantSummary: string
      result: WeatherLookupResponse
    }
  | {
      kind: 'open_external'
      systemMessage: string
      promptContext: string
      assistantSummary: string
      result: ExternalLinkResponse
    }

export type MatchedBuiltInTool =
  | {
      id: 'web_search'
      query: string
      limit: number
      keywords?: string[]
      candidateQueries?: string[]
    }
  | {
      id: 'weather'
      location: string
    }
  | {
      id: 'open_external'
      url: string
    }

export type BuiltInToolPolicy = {
  enabled: boolean
  requiresConfirmation: boolean
}

export function toChatToolResult(result: BuiltInToolResult): ChatToolResult {
  if (result.kind === 'weather') {
    return {
      kind: 'weather',
      result: result.result,
    }
  }

  if (result.kind === 'open_external') {
    return {
      kind: 'open_external',
      result: result.result,
    }
  }

  return {
    kind: 'web_search',
    result: result.result,
  }
}
