export type WebSearchProviderId =
  | 'bing'
  | 'duckduckgo'
  | 'brave'
  | 'tavily'
  | 'exa'
  | 'firecrawl'
  | 'gemini'
  | 'perplexity'

export interface WebSearchRequest {
  query: string
  limit?: number
  providerId?: WebSearchProviderId
  baseUrl?: string
  apiKey?: string
  displayQuery?: string
  keywords?: string[]
  candidateQueries?: string[]
  fallbackToBing?: boolean
  policy?: {
    enabled?: boolean
    requiresConfirmation?: boolean
  }
}

export interface WebSearchResultItem {
  title: string
  url: string
  snippet: string
  publishedAt?: string
  contentPreview?: string
}

export type WebSearchDisplayMode = 'lyrics' | 'answer' | 'search_list'

export interface WebSearchDisplaySource {
  title: string
  url: string
  host?: string
  publishedAt?: string
}

export interface WebSearchDisplayPanel {
  title: string
  body: string
  url: string
  host: string
  publishedAt?: string
}

export interface WebSearchDisplay {
  mode: WebSearchDisplayMode
  title?: string
  summary?: string
  bodyLines?: string[]
  panels?: WebSearchDisplayPanel[]
  sources?: WebSearchDisplaySource[]
}

export interface WebSearchResponse {
  query: string
  items: WebSearchResultItem[]
  providerId?: WebSearchProviderId
  providerLabel?: string
  extractedKeywords?: string[]
  rewrittenQueries?: string[]
  executedQuery?: string
  display?: WebSearchDisplay
  message: string
}

export interface WeatherLookupRequest {
  location: string
  fallbackLocation?: string
  policy?: {
    enabled?: boolean
    requiresConfirmation?: boolean
  }
}

export interface WeatherLookupResponse {
  location: string
  resolvedName: string
  timezone?: string
  currentSummary: string
  todaySummary?: string
  tomorrowSummary?: string
  usedFallbackLocation?: boolean
  message: string
}

export interface ExternalLinkRequest {
  url: string
  policy?: {
    enabled?: boolean
    requiresConfirmation?: boolean
  }
}

export interface ExternalLinkResponse {
  ok: boolean
  url: string
  message: string
}
