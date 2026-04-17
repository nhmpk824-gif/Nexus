import assert from 'node:assert/strict'
import { test } from 'node:test'

import { extractSearchQuery } from '../src/features/tools/extractors.ts'
import { rewriteSearchQuery } from '../src/features/tools/queryRewrite.ts'

// Regression tests for the 2026-04-12 trust-downstream-providers policy:
// Tavily and other semantic search engines handle 的/了/过/interrogative
// tokens natively, so Nexus must hand the query through with only command
// framing stripped (leading 帮我搜一下…, bracket noise, trailing particles
// 吗/呢/？). An older keyword pipeline used to shred 什么/怎么/为什么 out
// of the middle of the query — these tests lock that behaviour out.

test('extractSearchQuery preserves leading interrogative words', () => {
  assert.equal(extractSearchQuery('什么是量子力学？'), '什么是量子力学')
  assert.equal(extractSearchQuery('如何做红烧肉'), '如何做红烧肉')
  assert.equal(extractSearchQuery('哪个 LLM 最擅长中文'), '哪个 LLM 最擅长中文')
})

test('extractSearchQuery preserves interrogatives after stripping command framing', () => {
  assert.equal(extractSearchQuery('帮我查一下怎么学 React'), '怎么学 React')
  assert.equal(
    extractSearchQuery('你能不能搜索一下为什么天空是蓝色的？'),
    '为什么天空是蓝色的',
  )
  assert.equal(
    extractSearchQuery('查查什么时候去北京合适'),
    '什么时候去北京合适',
  )
})

test('rewriteSearchQuery.query keeps interrogatives intact for downstream providers', () => {
  for (const raw of [
    '什么是量子力学？',
    '帮我查一下怎么学 React',
    '如何做红烧肉',
    '为什么天空是蓝色的',
  ]) {
    const { query, searchTopic } = rewriteSearchQuery(raw)
    for (const token of ['什么', '怎么', '如何', '为什么']) {
      if (raw.includes(token)) {
        assert.ok(
          query.includes(token),
          `rewriteSearchQuery dropped "${token}" from "${raw}" → query="${query}"`,
        )
        assert.ok(
          searchTopic.includes(token),
          `rewriteSearchQuery dropped "${token}" from searchTopic of "${raw}" → topic="${searchTopic}"`,
        )
      }
    }
  }
})

test('extractSearchQuery still rejects pure complaint framing (not a real query)', () => {
  // These should remain empty — they are meta-complaints about the search
  // function itself, not topics the user wants looked up.
  assert.equal(extractSearchQuery('你的搜索功能不太好'), '')
  assert.equal(extractSearchQuery('我们的搜索结果不准'), '')
})

test('rewriteSearchQuery cleans 那/诶/嗯 + 能…吗 framing that the local pattern list used to miss', () => {
  // Exact reproduction from project_nexus_open_issues_2026_04_12.md §1 —
  // previously produced `能 周传雄的 黄昏 的 吗 歌词` garbage.
  const { query, searchTopic, isLyricsQuery } = rewriteSearchQuery(
    '那你能帮我找一下周传雄的《黄昏》的歌词吗？',
  )
  assert.equal(isLyricsQuery, true)
  assert.equal(searchTopic, '周传雄的黄昏')
  assert.equal(query, '周传雄的黄昏 歌词')

  // Similar leading-filler particles should also be stripped.
  assert.equal(
    rewriteSearchQuery('诶帮我搜一下什么是量子力学').query,
    '什么是量子力学',
  )
  assert.equal(
    rewriteSearchQuery('嗯你能不能查一下哪个 LLM 最擅长中文').query,
    '哪个 LLM 最擅长中文',
  )
})
