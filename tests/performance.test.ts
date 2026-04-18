import assert from 'node:assert/strict'
import { test } from 'node:test'

import { extractExpressionOverrides, parseAssistantPerformanceContent } from '../src/features/pet/performance.ts'

test('removes recognized task and silent stage directions from spoken content', () => {
  const parsed = parseAssistantPerformanceContent(
    '（开心地整理资料）已经生成《StackChan组装要点.txt》放在桌面啦～（操作音效）',
  )

  assert.equal(parsed.displayContent, '已经生成《StackChan组装要点.txt》放在桌面啦～')
  assert.equal(parsed.spokenContent, '已经生成《StackChan组装要点.txt》放在桌面啦～')
  assert.deepEqual(parsed.stageDirections, ['开心地整理资料', '操作音效'])
  assert.equal(parsed.cues.length, 1)
  assert.equal(parsed.cues[0]?.accentStyle, 'organize')
  assert.equal(parsed.cues[0]?.expressionSlot, 'happy')
  assert.equal(parsed.cues[0]?.motionSlot, 'touchBody')
})

test('keeps multiple recognized performance cues in reply order', () => {
  const parsed = parseAssistantPerformanceContent('（查找资料）（轻轻点头）我找到了。')

  assert.equal(parsed.displayContent, '我找到了。')
  assert.equal(parsed.spokenContent, '我找到了。')
  assert.equal(parsed.cues.length, 2)
  assert.equal(parsed.cues[0]?.accentStyle, 'search')
  assert.equal(parsed.cues[0]?.expressionSlot, 'thinking')
  assert.equal(parsed.cues[1]?.accentStyle, 'confirm')
  assert.equal(parsed.cues[1]?.expressionSlot, 'happy')
  assert.deepEqual(
    parsed.cues.map((cue) => cue.stageDirection),
    ['查找资料', '轻轻点头'],
  )
})

test('treats writing and delivery as distinct sequential task cues', () => {
  const parsed = parseAssistantPerformanceContent('（记录重点）（发到桌面）已经放好了。')

  assert.equal(parsed.cues.length, 2)
  assert.equal(parsed.cues[0]?.accentStyle, 'write')
  assert.equal(parsed.cues[0]?.motionSlot, 'touchBody')
  assert.equal(parsed.cues[1]?.accentStyle, 'deliver')
  assert.equal(parsed.cues[1]?.motionSlot, 'touchBody')
})

test('preserves unknown bracket text in spoken content', () => {
  const parsed = parseAssistantPerformanceContent('（突然蹦出一只企鹅）你好呀')

  assert.equal(parsed.displayContent, '（突然蹦出一只企鹅）你好呀')
  assert.equal(parsed.spokenContent, '（突然蹦出一只企鹅）你好呀')
  assert.equal(parsed.cues.length, 0)
  assert.equal(parsed.cue, null)
  assert.deepEqual(parsed.stageDirections, [])
})

test('allows silent-only stage directions without forcing spoken fallback text', () => {
  const parsed = parseAssistantPerformanceContent('（操作音效）')

  assert.equal(parsed.displayContent, '')
  assert.equal(parsed.spokenContent, '')
  assert.equal(parsed.cue, null)
  assert.deepEqual(parsed.stageDirections, ['操作音效'])
})

test('extractExpressionOverrides strips [expr:name] tags and emits matching cues', () => {
  const result = extractExpressionOverrides('我来了[expr:happy]！发现了点东西[expr:surprised]。')

  assert.equal(result.content, '我来了！发现了点东西。')
  assert.equal(result.cues.length, 2)
  assert.equal(result.cues[0]?.expressionSlot, 'happy')
  assert.equal(result.cues[1]?.expressionSlot, 'surprised')
})

test('extractExpressionOverrides drops unknown slot names but still strips the tag', () => {
  const result = extractExpressionOverrides('等一下[expr:bogus]好了。')

  assert.equal(result.content, '等一下好了。')
  assert.equal(result.cues.length, 0)
})

test('extractExpressionOverrides is a no-op when no tags are present', () => {
  const result = extractExpressionOverrides('普通的一句话。')

  assert.equal(result.content, '普通的一句话。')
  assert.equal(result.cues.length, 0)
})
