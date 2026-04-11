import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  buildLyricsLookupCandidates,
  extractLyricsPreviewLines,
  tryLookupLyricsSearch,
} from '../electron/lyricsSearch.js'

function createJsonResponse(payload: unknown) {
  return {
    ok: true,
    json: async () => payload,
  }
}

test('buildLyricsLookupCandidates recovers artist and track from compact chinese query', () => {
  const candidates = buildLyricsLookupCandidates([
    '帮我搜索一下周传雄黄昏的歌词',
    '周传雄黄昏 歌词',
  ])

  assert.ok(
    candidates.some((candidate) => candidate.artist === '周传雄' && candidate.track === '黄昏'),
  )
})

test('extractLyricsPreviewLines strips timestamps and metadata', () => {
  const lines = extractLyricsPreviewLines([
    '[00:01.00]过完整个夏天',
    '[00:05.20]忧伤并没有好一些',
    '作词：陈信荣',
  ].join('\n'))

  assert.deepEqual(lines, [
    '过完整个夏天',
    '忧伤并没有好一些',
  ])
})

test('tryLookupLyricsSearch returns structured lyrics payload when lrclib matches', async () => {
  const calls: string[] = []
  const result = await tryLookupLyricsSearch({
    query: '周传雄黄昏 歌词',
    displayQuery: '周传雄黄昏',
    candidateQueries: [],
    limit: 5,
  }, {
    timeoutMs: 1_000,
    performNetworkRequest: async (url: string) => {
      calls.push(url)
      return createJsonResponse([
        {
          artistName: '周传雄',
          trackName: '黄昏',
          plainLyrics: '过完整个夏天\n忧伤并没有好一些\n开车行驶在公路无际无边',
        },
      ])
    },
    readJsonSafe: async (response: { json: () => Promise<unknown> }) => response.json(),
  })

  assert.ok(calls.some((url) => url.includes('artist_name=%E5%91%A8%E4%BC%A0%E9%9B%84')))
  assert.equal(result?.providerLabel, 'LRCLIB 歌词库')
  assert.equal(result?.display?.mode, 'lyrics')
  assert.equal(result?.display?.title, '周传雄《黄昏》')
  assert.deepEqual(result?.display?.bodyLines?.slice(0, 2), [
    '过完整个夏天',
    '忧伤并没有好一些',
  ])
})
