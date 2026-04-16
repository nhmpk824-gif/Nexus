import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  buildAnswerDisplaySummary,
  resolveSearchEvidenceQuery,
  shouldFetchSearchPreviews,
} from '../electron/webSearchSignals.js'

test('structured facet can force preview fetching even when query text is generic', () => {
  assert.equal(shouldFetchSearchPreviews('小米 SU7', '最新', 'high'), true)
  assert.equal(shouldFetchSearchPreviews('小米 SU7', '', 'high'), false)
})

test('official and latest searches prefer subject as evidence query', () => {
  assert.equal(resolveSearchEvidenceQuery('小米 SU7 官网', '小米 SU7', '官网'), '小米 SU7')
  assert.equal(resolveSearchEvidenceQuery('小米 SU7 最新', '小米 SU7', '最新'), '小米 SU7')
  assert.equal(resolveSearchEvidenceQuery('周传雄 黄昏 歌词', '周传雄 黄昏', '歌词'), '周传雄 黄昏')
})

test('low-confidence answer summary stays cautious even with extracted body lines', () => {
  const summary = buildAnswerDisplaySummary({
    query: '小米 SU7 官网',
    topTitle: '小米 SU7 论坛讨论区',
    leadBody: '这里整理了几条接近小米 SU7 的页面内容，但不一定是官网。',
    matchConfidence: 'low',
  })

  assert.match(summary, /还不确定|最接近/u)
})
