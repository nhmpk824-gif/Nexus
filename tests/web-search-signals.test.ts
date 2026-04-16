import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  buildAnswerDisplaySummary,
  buildSearchPlanSignals,
  computeFacetSatisfactionScore,
  dedupeSearchItems,
  resolveSearchEvidenceQuery,
  shouldFetchSearchPreviews,
} from '../electron/webSearchSignals.js'

test('buildSearchPlanSignals separates strict, soft and phrase terms for official queries', () => {
  const signals = buildSearchPlanSignals({
    query: '小米 SU7 官网',
    subject: '小米 SU7',
    facet: '官网',
    keywords: ['小米 SU7'],
  })

  assert.equal(signals.matchProfile, 'official')
  assert.deepEqual(signals.strictTerms, ['小米', 'su7'])
  assert.ok(signals.softTerms.includes('官网'))
  assert.ok(signals.phraseTerms.includes('小米 SU7'))
})

test('shouldFetchSearchPreviews can be triggered by structured facet even when query text is plain', () => {
  assert.equal(shouldFetchSearchPreviews({
    query: '小米 SU7',
    facet: '最新',
    matchConfidence: 'high',
  }), true)

  assert.equal(shouldFetchSearchPreviews({
    query: '小米 SU7',
    facet: '',
    matchConfidence: 'high',
  }), false)
})

test('resolveSearchEvidenceQuery prefers subject for structured official or latest searches', () => {
  assert.equal(resolveSearchEvidenceQuery('小米 SU7 官网', '小米 SU7', '官网'), '小米 SU7')
  assert.equal(resolveSearchEvidenceQuery('小米 SU7', '小米 SU7', '最新'), '小米 SU7')
  assert.equal(resolveSearchEvidenceQuery('小米 SU7 参数配置', '小米 SU7', ''), '小米 SU7 参数配置')
})

test('dedupeSearchItems collapses duplicate urls across providers', () => {
  const deduped = dedupeSearchItems([
    {
      title: 'Xiaomi SU7 Official Site',
      url: 'https://www.mi.com/su7?from=search',
      snippet: 'Official page.',
    },
    {
      title: 'Xiaomi SU7 Official Site',
      url: 'https://www.mi.com/su7',
      snippet: 'Official page duplicate.',
    },
  ])

  assert.equal(deduped.length, 1)
})

test('dedupeSearchItems can drop near-duplicate same-host pages with almost identical titles', () => {
  const deduped = dedupeSearchItems([
    {
      title: 'Xiaomi SU7 Official Site',
      url: 'https://news.example.com/xiaomi-su7',
      snippet: 'Official introduction and specs.',
    },
    {
      title: 'Xiaomi SU7 Official Site - News Example',
      url: 'https://news.example.com/xiaomi-su7-overview',
      snippet: 'Official introduction and specs with duplicate metadata.',
    },
    {
      title: 'Different Result',
      url: 'https://other.example.com/su7',
      snippet: 'Another source.',
    },
  ])

  assert.equal(deduped.length, 2)
})

test('facet satisfaction scores boost pages that actually satisfy official intent', () => {
  const signals = buildSearchPlanSignals({
    query: '小米 SU7 官网',
    subject: '小米 SU7',
    facet: '官网',
  })

  assert.equal(computeFacetSatisfactionScore({
    title: 'Xiaomi SU7 Official Site',
    url: 'https://www.mi.com/su7',
    snippet: 'Official introduction and specs.',
  }, signals), 1)

  assert.equal(computeFacetSatisfactionScore({
    title: '小米 SU7 论坛',
    url: 'https://club.example.com/su7',
    snippet: '车友讨论。',
  }, signals), 0)
})

test('latest facet satisfaction prefers fresh news style results over archive pages', () => {
  const signals = buildSearchPlanSignals({
    query: '小米 SU7 最新消息',
    subject: '小米 SU7',
    facet: '最新',
  })

  assert.equal(computeFacetSatisfactionScore({
    title: '小米 SU7 最新发布消息',
    url: 'https://news.example.com/su7-latest',
    snippet: '今日最新动态与发布信息。',
    publishedAt: '2026-04-10',
  }, signals), 1)

  assert.equal(computeFacetSatisfactionScore({
    title: '小米 SU7 历史回顾',
    url: 'https://archive.example.com/su7',
    snippet: '旧闻与历史回顾。',
    publishedAt: '2024-01-05',
  }, signals), 0)
})

test('low-confidence answer summaries stay cautious instead of pretending the search is accurate', () => {
  const summary = buildAnswerDisplaySummary({
    query: '小米 SU7 官网',
    topTitle: '小米 SU7 论坛讨论区',
    leadBody: '这里整理了几条接近小米 SU7 的页面内容，但不一定是官网。',
    matchConfidence: 'low',
  })

  assert.match(summary, /还不确定|最接近/u)
})
