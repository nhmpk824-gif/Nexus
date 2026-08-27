import assert from 'node:assert/strict'
import { test } from 'node:test'

import { compactMessagesForRequest, getModelTokenBudget } from '../src/features/chat/contextCompaction.ts'

test('getModelTokenBudget keeps a conservative slice of the advertised window', () => {
  assert.equal(getModelTokenBudget('gpt-5.6-sol'), 500_000)
  assert.equal(getModelTokenBudget('claude-sonnet-5'), 500_000)
  assert.equal(getModelTokenBudget('claude-fable-5'), 500_000)
  assert.equal(getModelTokenBudget('gemini-3.7-flash'), 500_000)
  assert.equal(getModelTokenBudget('grok-4.6'), 250_000)
  assert.equal(getModelTokenBudget('kimi-k3'), 500_000)
  assert.equal(getModelTokenBudget('qwen3.7-plus'), 200_000)
  assert.equal(getModelTokenBudget('qwen3.8-max'), 500_000)
  assert.equal(getModelTokenBudget('glm-5.2'), 500_000)
  assert.equal(getModelTokenBudget('deepseek-v4-flash'), 500_000)
  assert.equal(getModelTokenBudget('kimi-k2.6'), 200_000)
  assert.equal(getModelTokenBudget('MiniMax-M3'), 500_000)
})

test('compaction still summarizes when a few huge turns blow the token budget', () => {
  const huge = 'alpha '.repeat(8_000)
  const messages = Array.from({ length: 8 }, (_, index) => ({
    id: String(index + 1),
    role: (index % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
    content: huge,
    createdAt: `2026-08-20T00:00:0${index}.000Z`,
  }))
  const compacted = compactMessagesForRequest(messages, 20, 200)
  assert.equal(compacted.compacted, true)
  assert.ok(compacted.olderMessagesText)
  assert.match(compacted.olderMessagesText ?? '', /earlier conversation omitted|User:/)
})

test('getModelTokenBudget keeps short-context and unknown models tiny', () => {
  assert.equal(getModelTokenBudget('gpt-4o'), 60_000)
  assert.equal(getModelTokenBudget('gpt-3.5-turbo'), 12_000)
  assert.equal(getModelTokenBudget('llama-3.1-70b'), 6_000)
  assert.equal(getModelTokenBudget('unknown-model'), 8_000)
})
