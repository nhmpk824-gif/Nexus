import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  PromptModeStreamFilter,
  buildPromptModeInstructions,
  extractPromptModeToolCalls,
} from '../src/features/chat/promptModeMcp.ts'

test('extractPromptModeToolCalls returns empty result when no markers present', () => {
  const result = extractPromptModeToolCalls('hello, just a normal reply.')
  assert.equal(result.toolCalls.length, 0)
  assert.equal(result.cleanedContent, 'hello, just a normal reply.')
})

test('extractPromptModeToolCalls extracts a single tool call and strips the marker', () => {
  const content = '我帮你查一下天气。<tool_call>{"name": "weather_lookup", "arguments": {"city": "上海"}}</tool_call>'
  const result = extractPromptModeToolCalls(content)
  assert.equal(result.toolCalls.length, 1)
  assert.equal(result.toolCalls[0].function.name, 'weather_lookup')
  assert.deepEqual(JSON.parse(result.toolCalls[0].function.arguments), { city: '上海' })
  assert.equal(result.cleanedContent, '我帮你查一下天气。')
})

test('extractPromptModeToolCalls handles multiple tool calls in one response', () => {
  const content = '同时查两个城市：<tool_call>{"name":"weather","arguments":{"city":"北京"}}</tool_call>和<tool_call>{"name":"weather","arguments":{"city":"上海"}}</tool_call>。'
  const result = extractPromptModeToolCalls(content)
  assert.equal(result.toolCalls.length, 2)
  assert.equal(result.toolCalls[0].function.name, 'weather')
  assert.deepEqual(JSON.parse(result.toolCalls[0].function.arguments), { city: '北京' })
  assert.deepEqual(JSON.parse(result.toolCalls[1].function.arguments), { city: '上海' })
  assert.equal(result.cleanedContent, '同时查两个城市：和。')
})

test('extractPromptModeToolCalls handles JSON strings containing braces and angle brackets', () => {
  const content = '<tool_call>{"name":"search","arguments":{"query":"how to write {} in JSON","tag":"<example>"}}</tool_call>'
  const result = extractPromptModeToolCalls(content)
  assert.equal(result.toolCalls.length, 1)
  const args = JSON.parse(result.toolCalls[0].function.arguments) as { query: string; tag: string }
  assert.equal(args.query, 'how to write {} in JSON')
  assert.equal(args.tag, '<example>')
})

test('extractPromptModeToolCalls accepts arguments encoded as a JSON string', () => {
  const content = '<tool_call>{"name":"echo","arguments":"{\\"x\\":1}"}</tool_call>'
  const result = extractPromptModeToolCalls(content)
  assert.equal(result.toolCalls.length, 1)
  assert.equal(result.toolCalls[0].function.arguments, '{"x":1}')
})

test('extractPromptModeToolCalls drops malformed markers but still strips them', () => {
  const content = 'before<tool_call>not valid json</tool_call>after'
  const result = extractPromptModeToolCalls(content)
  assert.equal(result.toolCalls.length, 0)
  assert.equal(result.cleanedContent, 'beforeafter')
})

test('extractPromptModeToolCalls leaves partial unfinished marker as-is', () => {
  const content = 'partial <tool_call>{"name":"x","argum'
  const result = extractPromptModeToolCalls(content)
  // Unfinished marker — left as plain text so the caller (final-pass cleanup)
  // does not silently lose data.
  assert.equal(result.toolCalls.length, 0)
  assert.equal(result.cleanedContent, content)
})

test('PromptModeStreamFilter strips a complete marker delivered in one delta', () => {
  const filter = new PromptModeStreamFilter()
  const out = filter.push('hello.<tool_call>{"name":"a","arguments":{}}</tool_call> done')
  assert.equal(out + filter.flush(), 'hello. done')
})

test('PromptModeStreamFilter strips a marker split across many deltas', () => {
  const filter = new PromptModeStreamFilter()
  const parts = [
    'I will look ',
    'this up.<to',
    'ol_call>{"na',
    'me":"search","arguments":{"q"',
    ':"hi"}}</tool',
    '_call> Done.',
  ]
  let visible = ''
  for (const part of parts) {
    visible += filter.push(part)
  }
  visible += filter.flush()
  assert.equal(visible, 'I will look this up. Done.')
})

test('PromptModeStreamFilter holds back tail bytes that may be a marker prefix', () => {
  const filter = new PromptModeStreamFilter()
  // First delta ends with "<tool" — must NOT emit it because the next delta
  // could complete it into "<tool_call>".
  const first = filter.push('hi <tool')
  assert.equal(first, 'hi ')
  // Second delta arrives without continuing the marker — both should now flow.
  const second = filter.push('bar baz')
  assert.equal(first + second, 'hi <toolbar baz')
  assert.equal(filter.flush(), '')
})

test('PromptModeStreamFilter flushes nothing when buffer is mid-marker at end of stream', () => {
  const filter = new PromptModeStreamFilter()
  filter.push('hello <tool_call>{"name":"x"')
  // Stream ends without ever closing — filter drops the open marker contents.
  assert.equal(filter.flush(), '')
})

test('buildPromptModeInstructions emits tool catalog with input schemas', () => {
  const text = buildPromptModeInstructions([
    {
      name: 'weather_lookup',
      description: '查询某地天气',
      serverId: 'plugin:weather',
      inputSchema: { type: 'object', properties: { city: { type: 'string' } }, required: ['city'] },
    },
  ])
  assert.match(text, /weather_lookup/)
  assert.match(text, /查询某地天气/)
  assert.match(text, /<tool_call>/)
  assert.match(text, /"required":\["city"\]/)
})

test('buildPromptModeInstructions returns empty string when no tools provided', () => {
  assert.equal(buildPromptModeInstructions([]), '')
})
