import assert from 'node:assert/strict'
import { test } from 'node:test'

import { planToolIntent } from '../src/features/tools/planner.ts'

test('direct weather requests are classified as weather tool intent', () => {
  const plan = planToolIntent('帮我看看深圳天气')

  assert.equal(plan.intent, 'weather')
  assert.deepEqual(plan.matchedTool, {
    id: 'weather',
    location: '深圳',
  })
  assert.equal(plan.reason, 'direct_match')
})

test('weather follow-up reuses prior weather context', () => {
  const initialPlan = planToolIntent('帮我看看深圳天气')
  const followUpPlan = planToolIntent('那宁波呢', initialPlan.nextContext)

  assert.equal(followUpPlan.intent, 'weather')
  assert.deepEqual(followUpPlan.matchedTool, {
    id: 'weather',
    location: '宁波',
  })
  assert.equal(followUpPlan.reason, 'weather_follow_up')
})

test('standalone greetings do not inherit the previous tool intent', () => {
  const initialPlan = planToolIntent('甯垜鐪嬬湅娣卞湷澶╂皵')
  const greetingPlan = planToolIntent('早上', initialPlan.nextContext)

  assert.equal(greetingPlan.intent, 'chat')
  assert.equal(greetingPlan.matchedTool, null)
  assert.equal(greetingPlan.reason, 'chat')
  assert.match(greetingPlan.promptContext, /打招呼|寒暄/u)
})

test('weather requests without a city ask for clarification instead of guessing', () => {
  const plan = planToolIntent('今天天气怎么样')

  assert.equal(plan.intent, 'chat')
  assert.equal(plan.matchedTool, null)
  assert.equal(plan.reason, 'weather_missing_location')
  assert.match(plan.promptContext, /地点|城市|地区/u)
  assert.equal(plan.nextContext?.lastIntent, 'weather')
})

test('weather requests without a city can use the configured default location', () => {
  const plan = planToolIntent('今天天气怎么样', null, {
    toolWeatherDefaultLocation: '深圳',
  })

  assert.equal(plan.intent, 'weather')
  assert.deepEqual(plan.matchedTool, {
    id: 'weather',
    location: '深圳',
  })
  assert.equal(plan.reason, 'weather_default_location')
})

test('search follow-up reuses prior search subject', () => {
  const initialPlan = planToolIntent('帮我找一下周传雄的黄昏的歌词')
  const followUpPlan = planToolIntent('那作者呢', initialPlan.nextContext)

  assert.equal(initialPlan.intent, 'web_search')
  assert.deepEqual(initialPlan.matchedTool, {
    id: 'web_search',
    query: '周传雄的黄昏 歌词',
    limit: 5,
  })

  assert.equal(followUpPlan.intent, 'web_search')
  assert.deepEqual(followUpPlan.matchedTool, {
    id: 'web_search',
    query: '周传雄的黄昏 作者',
    limit: 5,
  })
  assert.equal(followUpPlan.reason, 'search_follow_up')
})

test('search requests without a clear topic ask for clarification', () => {
  const plan = planToolIntent('帮我搜一下')

  assert.equal(plan.intent, 'chat')
  assert.equal(plan.matchedTool, null)
  assert.equal(plan.reason, 'search_missing_query')
  assert.match(plan.promptContext, /搜索|歌名|主题/u)
  assert.equal(plan.nextContext?.lastIntent, 'web_search')
})

test('generic pronoun lyric follow-up can recover from prior search context', () => {
  const initialPlan = planToolIntent('周传雄的黄昏歌词')
  const followUpPlan = planToolIntent('我要的是他的歌词', initialPlan.nextContext)

  assert.equal(followUpPlan.intent, 'web_search')
  assert.deepEqual(followUpPlan.matchedTool, {
    id: 'web_search',
    query: '周传雄的黄昏 歌词',
    limit: 5,
  })
})

test('lyric follow-ups can request fuller content from the previous search topic', () => {
  const initialPlan = planToolIntent('周传雄的黄昏歌词')
  const followUpPlan = planToolIntent('那后面呢', initialPlan.nextContext)

  assert.equal(followUpPlan.intent, 'web_search')
  assert.deepEqual(followUpPlan.matchedTool, {
    id: 'web_search',
    query: '周传雄的黄昏 完整歌词',
    limit: 5,
  })
})

test('search follow-ups can switch to release-time facets', () => {
  const initialPlan = planToolIntent('周传雄的黄昏歌词')
  const followUpPlan = planToolIntent('哪年发行的', initialPlan.nextContext)

  assert.equal(followUpPlan.intent, 'web_search')
  assert.deepEqual(followUpPlan.matchedTool, {
    id: 'web_search',
    query: '周传雄的黄昏 发行时间',
    limit: 5,
  })
})

test('open-app requests are classified even before desktop execution is implemented', () => {
  const plan = planToolIntent('打开微信')

  assert.equal(plan.intent, 'open_app')
  assert.equal(plan.matchedTool, null)
  assert.equal(plan.reason, 'unsupported_open_app')
  assert.match(plan.promptContext, /打开本地软件/u)
})

test('music requests with specific songs are routed to web search', () => {
  const plan = planToolIntent('给我播放周传雄的黄昏')

  assert.equal(plan.intent, 'web_search')
  assert.equal(plan.matchedTool?.id, 'web_search')
  assert.equal(plan.reason, 'direct_match')
})

test('generic music-control requests are classified as unsupported', () => {
  const plan = planToolIntent('暂停音乐')

  assert.equal(plan.intent, 'music_control')
  assert.equal(plan.matchedTool, null)
  assert.equal(plan.reason, 'unsupported_music_control')
})
