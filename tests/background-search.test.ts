import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  buildBackgroundWebSearchFailureNotice,
  buildBackgroundWebSearchResultNotice,
  buildBackgroundWebSearchStartNotice,
} from '../src/features/tools/backgroundSearch.ts'

test('buildBackgroundWebSearchStartNotice returns an immediate acknowledgement', () => {
  const notice = buildBackgroundWebSearchStartNotice('深圳有什么好吃的')

  assert.match(notice.chatContent, /先去搜索/u)
  assert.match(notice.speechContent, /等下把答案告诉你/u)
})

test('buildBackgroundWebSearchResultNotice reads extracted正文 for generic search answers', () => {
  const notice = buildBackgroundWebSearchResultNotice({
    kind: 'web_search',
    systemMessage: '',
    promptContext: '',
    assistantSummary: '我先整理一下：深圳有不少值得吃的馆子。',
    result: {
      query: '深圳有什么好吃的',
      message: '',
      display: {
        mode: 'answer',
        title: '深圳美食推荐',
        summary: '我已经自动打开前几条候选页，并提取出最相关的正文内容。',
        bodyLines: [
          '福田可以先试试潮汕牛肉火锅和生腌。',
          '南头古城一带适合逛小店和地方风味。',
        ],
      },
      items: [],
    },
  })

  assert.match(notice.chatContent, /整理后的内容在下面/u)
  assert.match(notice.speechContent, /主人，我已经搜索到了你要的答案/u)
  assert.match(notice.speechContent, /潮汕牛肉火锅/u)
})

test('buildBackgroundWebSearchResultNotice avoids reading full lyrics aloud', () => {
  const notice = buildBackgroundWebSearchResultNotice({
    kind: 'web_search',
    systemMessage: '',
    promptContext: '',
    assistantSummary: '',
    result: {
      query: '周传雄黄昏歌词',
      message: '',
      display: {
        mode: 'lyrics',
        title: '周传雄《黄昏》',
        summary: '已找到歌词片段。',
        bodyLines: ['过完整个夏天', '忧伤并没有好一些'],
      },
      items: [],
    },
  })

  assert.match(notice.chatContent, /内容已经整理在下面/u)
  assert.doesNotMatch(notice.speechContent, /过完整个夏天/u)
  assert.match(notice.speechContent, /内容已经展示在气泡里/u)
})

test('buildBackgroundWebSearchFailureNotice includes the failure reason', () => {
  const notice = buildBackgroundWebSearchFailureNotice('深圳天气', '服务连接失败')

  assert.match(notice.chatContent, /服务连接失败/u)
  assert.match(notice.speechContent, /搜索出了点问题/u)
})
