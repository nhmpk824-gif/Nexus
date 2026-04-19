import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  normalizeWebSearchProviderId,
  runWebSearchWithProviders,
} from '../electron/webSearchRuntime.js'

function createJsonResponse(payload: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return JSON.stringify(payload)
    },
  }
}

test('normalizeWebSearchProviderId supports all configured providers', () => {
  assert.equal(normalizeWebSearchProviderId('duckduckgo'), 'duckduckgo')
  assert.equal(normalizeWebSearchProviderId('exa'), 'exa')
  assert.equal(normalizeWebSearchProviderId('firecrawl'), 'firecrawl')
  assert.equal(normalizeWebSearchProviderId('gemini'), 'gemini')
  assert.equal(normalizeWebSearchProviderId('perplexity'), 'perplexity')
  assert.equal(normalizeWebSearchProviderId('unknown'), 'duckduckgo')
  assert.equal(normalizeWebSearchProviderId('bing'), 'bing')
})

test('DuckDuckGo search parses HTML results and decodes redirect URLs', async () => {
  const html = `
    <html>
      <body>
        <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fnexus">Nexus Search</a>
        <a class="result__snippet">Nexus search result summary.</a>
      </body>
    </html>
  `

  const result = await runWebSearchWithProviders({
    query: 'nexus search',
    providerId: 'duckduckgo',
    limit: 5,
    fallbackToBing: false,
  }, {
    timeoutMs: 1_000,
    async performNetworkRequest() {
      return {
        ok: true,
        status: 200,
        async text() {
          return html
        },
      }
    },
    async readJsonSafe() {
      return {}
    },
    async extractResponseErrorMessage(_response: unknown, fallback: string) {
      return fallback
    },
    buildCandidateSearchQueries(query: string) {
      return [query]
    },
    async fetchBingRssItems() {
      return []
    },
    scoreSearchResultItem() {
      return 10
    },
  })

  assert.equal(result.providerId, 'duckduckgo')
  assert.equal(result.items[0]?.url, 'https://example.com/nexus')
  assert.match(result.items[0]?.snippet ?? '', /Nexus search result summary/i)
})

test('Exa search sends the expected API headers and returns rich previews', async () => {
  const seenRequests: Array<{ url: string; headers: Record<string, string>; body: string }> = []
  const response = createJsonResponse({
    results: [
      {
        title: 'Nexus Exa',
        url: 'https://example.com/exa',
        highlights: ['Structured preview from Exa.'],
        summary: 'A short Exa summary.',
        text: 'Longer Exa body text.',
        publishedDate: '2026-03-29',
      },
    ],
  })

  const result = await runWebSearchWithProviders({
    query: 'nexus exa',
    providerId: 'exa',
    apiKey: 'exa-key',
    limit: 5,
    fallbackToBing: false,
  }, {
    timeoutMs: 1_000,
    async performNetworkRequest(url: string, init: { headers: Record<string, string>; body: string }) {
      seenRequests.push({ url, headers: init.headers, body: init.body })
      return response
    },
    async readJsonSafe() {
      return JSON.parse(await response.text())
    },
    async extractResponseErrorMessage(_response: unknown, fallback: string) {
      return fallback
    },
    buildCandidateSearchQueries(query: string) {
      return [query]
    },
    async fetchBingRssItems() {
      return []
    },
    scoreSearchResultItem() {
      return 10
    },
  })

  assert.equal(seenRequests[0]?.url, 'https://api.exa.ai/search')
  assert.equal(seenRequests[0]?.headers['x-api-key'], 'exa-key')
  assert.match(result.items[0]?.contentPreview ?? '', /Structured preview from Exa/i)
})

test('Firecrawl search requests scraped markdown and keeps it as contentPreview', async () => {
  const seenRequests: Array<{ url: string; headers: Record<string, string>; body: string }> = []
  const response = createJsonResponse({
    success: true,
    data: [
      {
        title: 'Nexus Firecrawl',
        url: 'https://example.com/firecrawl',
        description: 'Firecrawl short summary.',
        markdown: '# Heading\n\nFirecrawl markdown body.',
        publishedDate: '2026-03-29',
      },
    ],
  })

  const result = await runWebSearchWithProviders({
    query: 'nexus firecrawl',
    providerId: 'firecrawl',
    apiKey: 'fc-key',
    limit: 5,
    fallbackToBing: false,
  }, {
    timeoutMs: 1_000,
    async performNetworkRequest(url: string, init: { headers: Record<string, string>; body: string }) {
      seenRequests.push({ url, headers: init.headers, body: init.body })
      return response
    },
    async readJsonSafe() {
      return JSON.parse(await response.text())
    },
    async extractResponseErrorMessage(_response: unknown, fallback: string) {
      return fallback
    },
    buildCandidateSearchQueries(query: string) {
      return [query]
    },
    async fetchBingRssItems() {
      return []
    },
    scoreSearchResultItem() {
      return 10
    },
  })

  assert.equal(seenRequests[0]?.url, 'https://api.firecrawl.dev/v2/search')
  assert.equal(seenRequests[0]?.headers.Authorization, 'Bearer fc-key')
  assert.match(seenRequests[0]?.body ?? '', /"formats":\["markdown"\]/)
  assert.match(result.items[0]?.contentPreview ?? '', /Firecrawl markdown body/i)
})

test('Gemini grounded search returns answer-backed citation items', async () => {
  const seenRequests: Array<{ url: string; headers: Record<string, string>; body: string }> = []
  const response = createJsonResponse({
    candidates: [
      {
        content: {
          parts: [
            {
              text: 'Gemini says Nexus search grounding can summarize the web first.',
            },
          ],
        },
        groundingMetadata: {
          groundingChunks: [
            {
              web: {
                uri: 'https://example.com/gemini-source',
                title: 'Gemini Source',
              },
            },
          ],
        },
      },
    ],
  })

  const result = await runWebSearchWithProviders({
    query: 'nexus gemini grounding',
    providerId: 'gemini',
    apiKey: 'gemini-key',
    limit: 5,
    fallbackToBing: false,
  }, {
    timeoutMs: 1_000,
    async performNetworkRequest(url: string, init: { headers: Record<string, string>; body: string }) {
      seenRequests.push({ url, headers: init.headers, body: init.body })
      return response
    },
    async readJsonSafe() {
      return JSON.parse(await response.text())
    },
    async extractResponseErrorMessage(_response: unknown, fallback: string) {
      return fallback
    },
    buildCandidateSearchQueries(query: string) {
      return [query]
    },
    async fetchBingRssItems() {
      return []
    },
    scoreSearchResultItem() {
      return 10
    },
  })

  assert.equal(seenRequests[0]?.url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent')
  assert.equal(seenRequests[0]?.headers['x-goog-api-key'], 'gemini-key')
  assert.equal(result.providerId, 'gemini')
  assert.match(result.answer ?? '', /summarize the web first/i)
  assert.equal(result.items[0]?.url, 'https://example.com/gemini-source')
})

test('Perplexity uses the OpenRouter-compatible chat path when the API key matches routing rules', async () => {
  const seenRequests: Array<{ url: string; headers: Record<string, string>; body: string }> = []
  const response = createJsonResponse({
    choices: [
      {
        message: {
          content: 'Perplexity answered the search and cited a source.',
          annotations: [
            {
              type: 'url_citation',
              url_citation: {
                url: 'https://example.com/perplexity-source',
              },
            },
          ],
        },
      },
    ],
  })

  const result = await runWebSearchWithProviders({
    query: 'nexus perplexity routing',
    providerId: 'perplexity',
    apiKey: 'sk-or-v1-test',
    limit: 5,
    fallbackToBing: false,
  }, {
    timeoutMs: 1_000,
    async performNetworkRequest(url: string, init: { headers: Record<string, string>; body: string }) {
      seenRequests.push({ url, headers: init.headers, body: init.body })
      return response
    },
    async readJsonSafe() {
      return JSON.parse(await response.text())
    },
    async extractResponseErrorMessage(_response: unknown, fallback: string) {
      return fallback
    },
    buildCandidateSearchQueries(query: string) {
      return [query]
    },
    async fetchBingRssItems() {
      return []
    },
    scoreSearchResultItem() {
      return 10
    },
  })

  assert.equal(seenRequests[0]?.url, 'https://openrouter.ai/api/v1/chat/completions')
  assert.equal(seenRequests[0]?.headers.Authorization, 'Bearer sk-or-v1-test')
  assert.equal(result.providerId, 'perplexity')
  assert.match(result.answer ?? '', /cited a source/i)
  assert.equal(result.items[0]?.url, 'https://example.com/perplexity-source')
})

test('Perplexity latest facet forwards recency filter on chat-completions transport', async () => {
  const seenRequests: Array<{ url: string; headers: Record<string, string>; body: string }> = []
  const response = createJsonResponse({
    choices: [
      {
        message: {
          content: 'Latest answer with citation.',
          annotations: [
            {
              type: 'url_citation',
              url_citation: {
                url: 'https://example.com/latest-source',
              },
            },
          ],
        },
      },
    ],
  })

  await runWebSearchWithProviders({
    query: '小米 SU7 最新',
    providerId: 'perplexity',
    apiKey: 'sk-or-v1-test',
    limit: 5,
    facet: '最新',
    fallbackToBing: false,
  }, {
    timeoutMs: 1_000,
    async performNetworkRequest(url: string, init: { headers: Record<string, string>; body: string }) {
      seenRequests.push({ url, headers: init.headers, body: init.body })
      return response
    },
    async readJsonSafe() {
      return JSON.parse(await response.text())
    },
    async extractResponseErrorMessage(_response: unknown, fallback: string) {
      return fallback
    },
    buildCandidateSearchQueries(query: string) {
      return [query]
    },
    async fetchBingRssItems() {
      return []
    },
    scoreSearchResultItem() {
      return 10
    },
  })

  assert.match(seenRequests[0]?.body ?? '', /"search_recency_filter":"month"/)
})

test('Brave latest facet forwards freshness parameter', async () => {
  const seenRequests: Array<string> = []
  const response = createJsonResponse({
    web: {
      results: [
        {
          title: '小米 SU7 最新消息',
          url: 'https://example.com/news',
          description: '本周最新动态。',
          age: '1 day ago',
        },
      ],
    },
  })

  await runWebSearchWithProviders({
    query: '小米 SU7 最新',
    providerId: 'brave',
    apiKey: 'brave-key',
    limit: 5,
    facet: '最新',
    fallbackToBing: false,
  }, {
    timeoutMs: 1_000,
    async performNetworkRequest(url: string) {
      seenRequests.push(url)
      return response
    },
    async readJsonSafe() {
      return JSON.parse(await response.text())
    },
    async extractResponseErrorMessage(_response: unknown, fallback: string) {
      return fallback
    },
    buildCandidateSearchQueries(query: string) {
      return [query]
    },
    async fetchBingRssItems() {
      return []
    },
    scoreSearchResultItem() {
      return 10
    },
  })

  assert.match(seenRequests[0] ?? '', /freshness=pm/)
})

test('Bing candidate query search keeps the most relevant official-style result', async () => {
  const result = await runWebSearchWithProviders({
    query: '小米 SU7 官网',
    providerId: 'bing',
    limit: 3,
    fallbackToBing: false,
  }, {
    timeoutMs: 1_000,
    async performNetworkRequest() {
      throw new Error('unexpected network request')
    },
    async readJsonSafe() {
      return {}
    },
    async extractResponseErrorMessage(_response: unknown, fallback: string) {
      return fallback
    },
    buildCandidateSearchQueries() {
      return ['小米 SU7 官网', 'Xiaomi SU7 official site']
    },
    async fetchBingRssItems(candidateQuery: string) {
      if (candidateQuery.includes('official')) {
        return [
          {
            title: 'Xiaomi SU7 Official Site',
            url: 'https://www.mi.com/su7',
            snippet: 'Official introduction and specs for Xiaomi SU7.',
          },
        ]
      }

      return [
        {
          title: '小米 SU7 论坛',
          url: 'https://example.com/forum',
          snippet: '车友讨论区和提车分享。',
        },
      ]
    },
    scoreSearchResultItem(item: { title: string; url: string; snippet: string }, query: string) {
      if (/official|官网/i.test(`${item.title} ${item.snippet} ${item.url}`) && /官网|official/i.test(query)) {
        return 18
      }
      return /论坛/i.test(item.title) ? 2 : 1
    },
  })

  assert.equal(result.providerId, 'bing')
  assert.equal(result.items[0]?.url, 'https://www.mi.com/su7')
  assert.deepEqual(result.rewrittenQueries, ['小米 SU7 官网', 'Xiaomi SU7 official site'])
})

test('official queries can use secondary recall to recover a stronger result from another provider', async () => {
  const seenRequests: Array<string> = []
  const exaResponse = createJsonResponse({
    results: [
      {
        title: '小米 SU7 论坛',
        url: 'https://example.com/forum',
        summary: '车友讨论区和提车分享。',
      },
    ],
  })

  const result = await runWebSearchWithProviders({
    query: '小米 SU7 官网',
    providerId: 'exa',
    apiKey: 'exa-key',
    limit: 5,
    facet: '官网',
    candidateQueries: ['小米 SU7 官网'],
    fallbackToBing: true,
  }, {
    timeoutMs: 1_000,
    async performNetworkRequest(url: string) {
      seenRequests.push(url)
      return exaResponse
    },
    async readJsonSafe() {
      return JSON.parse(await exaResponse.text())
    },
    async extractResponseErrorMessage(_response: unknown, fallback: string) {
      return fallback
    },
    buildCandidateSearchQueries(query: string) {
      return [query]
    },
    async fetchBingRssItems() {
      return [
        {
          title: 'Xiaomi SU7 Official Site',
          url: 'https://www.mi.com/su7',
          snippet: 'Official introduction and specs for Xiaomi SU7.',
        },
      ]
    },
    scoreSearchResultItem(item: { title: string; url: string; snippet: string }) {
      if (/official|官网|mi\.com/i.test(`${item.title} ${item.snippet} ${item.url}`)) {
        return 18
      }
      if (/论坛/i.test(item.title)) {
        return 2
      }
      return 1
    },
  })

  assert.equal(result.items[0]?.url, 'https://www.mi.com/su7')
  assert.equal(result.providerId, 'exa')
  assert.ok(result.rewrittenQueries.includes('小米 SU7 官网'))
  assert.ok(seenRequests.some((url) => /api\.exa\.ai/i.test(url)))
})

test('high-confidence general queries do not trigger secondary recall', async () => {
  let bingFetchCount = 0

  const result = await runWebSearchWithProviders({
    query: 'nexus search runtime',
    providerId: 'duckduckgo',
    limit: 5,
    fallbackToBing: false,
  }, {
    timeoutMs: 1_000,
    async performNetworkRequest() {
      return {
        ok: true,
        status: 200,
        async text() {
          return `
            <html>
              <body>
                <a class="result__a" href="https://example.com/nexus-runtime">Nexus Search Runtime</a>
                <a class="result__snippet">Nexus search runtime internals.</a>
              </body>
            </html>
          `
        },
      }
    },
    async readJsonSafe() {
      return {}
    },
    async extractResponseErrorMessage(_response: unknown, fallback: string) {
      return fallback
    },
    buildCandidateSearchQueries(query: string) {
      return [query]
    },
    async fetchBingRssItems() {
      bingFetchCount += 1
      return [
        {
          title: 'Unexpected Bing Result',
          url: 'https://example.com/unexpected',
          snippet: 'Should not be used.',
        },
      ]
    },
    scoreSearchResultItem() {
      return 16
    },
  })

  assert.equal(result.items[0]?.url, 'https://example.com/nexus-runtime')
  assert.equal(bingFetchCount, 0)
})

test('latest queries keep fresh news ahead of old archive-like pages', async () => {
  const result = await runWebSearchWithProviders({
    query: '小米 SU7 最新消息',
    providerId: 'bing',
    limit: 3,
    facet: '最新',
    fallbackToBing: false,
  }, {
    timeoutMs: 1_000,
    async performNetworkRequest() {
      throw new Error('unexpected network request')
    },
    async readJsonSafe() {
      return {}
    },
    async extractResponseErrorMessage(_response: unknown, fallback: string) {
      return fallback
    },
    buildCandidateSearchQueries() {
      return ['小米 SU7 最新消息']
    },
    async fetchBingRssItems() {
      return [
        {
          title: '小米 SU7 历史回顾',
          url: 'https://example.com/archive',
          snippet: '旧闻与历史回顾。',
          publishedAt: '2024-01-05',
        },
        {
          title: '小米 SU7 最新发布消息',
          url: 'https://news.example.com/su7-latest',
          snippet: '今日最新动态与发布信息。',
          publishedAt: '2026-04-10',
        },
      ]
    },
    scoreSearchResultItem(item: { title: string; url: string; snippet: string; publishedAt?: string }, query: string) {
      if (/最新|今日/.test(`${item.title} ${item.snippet}`) && /最新/.test(query)) {
        return 16
      }
      if (/历史|archive/.test(`${item.title} ${item.url}`)) {
        return 4
      }
      return 8
    },
  })

  assert.equal(result.items[0]?.url, 'https://news.example.com/su7-latest')
})
