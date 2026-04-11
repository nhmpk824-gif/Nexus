import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  extractBuiltInToolMatch,
  extractLikelyWeatherLocation,
  extractSearchQuery,
} from '../src/features/tools/extractors.ts'
import { matchBuiltInTool } from '../src/features/tools/registry.ts'

test('does not treat conversational fragments as weather follow-up locations', () => {
  assert.equal(extractLikelyWeatherLocation('么样'), '')
  assert.equal(extractLikelyWeatherLocation('早上'), '')
  assert.equal(extractLikelyWeatherLocation('今天做了啥'), '')
})

test('still extracts a city from short weather follow-ups', () => {
  assert.equal(extractLikelyWeatherLocation('那宁波呢'), '宁波')
})

test('shared extractor matches colloquial lyric requests as web search', () => {
  const matched = extractBuiltInToolMatch('你帮我找一下周传雄的黄昏的歌词')

  assert.deepEqual(matched, {
    id: 'web_search',
    query: '周传雄的黄昏 歌词',
    limit: 5,
  })
})

test('registry keeps the same built-in tool matching result', () => {
  const matched = matchBuiltInTool('你帮我找一下周传雄的黄昏的歌词')

  assert.deepEqual(matched, {
    id: 'web_search',
    query: '周传雄的黄昏 歌词',
    limit: 5,
  })
})

test('treats direct lyric topics as web search intent', () => {
  const matched = matchBuiltInTool('周传雄 黄昏 歌词')

  assert.deepEqual(matched, {
    id: 'web_search',
    query: '周传雄 黄昏 歌词',
    limit: 5,
  })
})

test('does not auto-search generic pronoun-only lyric follow-ups', () => {
  const matched = matchBuiltInTool('我要的是他的歌词')

  assert.equal(matched, null)
})

test('normalizes lyric topic follow-ups into cleaner search queries', () => {
  assert.equal(extractSearchQuery('我要的是黄昏的歌词'), '黄昏 歌词')
})

test('does not treat time words as weather locations', () => {
  const matched = matchBuiltInTool('今天天气怎么样')

  assert.equal(matched, null)
})
