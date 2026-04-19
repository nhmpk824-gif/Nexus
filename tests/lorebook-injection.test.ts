import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  buildLorebookSection,
  selectTriggeredLorebookEntries,
} from '../src/features/chat/lorebookInjection.ts'
import type { ChatMessage } from '../src/types/chat.ts'
import type { LorebookEntry } from '../src/types/lorebooks.ts'

function makeEntry(over: Partial<LorebookEntry>): LorebookEntry {
  return {
    id: over.id ?? 'e',
    label: over.label ?? '',
    keywords: over.keywords ?? [],
    content: over.content ?? '',
    enabled: over.enabled ?? true,
    priority: over.priority ?? 0,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  }
}

function userMessage(content: string, id = 'm'): ChatMessage {
  return {
    id,
    role: 'user',
    content,
    createdAt: '2026-01-01T00:00:00Z',
  }
}

test('selectTriggeredLorebookEntries fires on a single keyword match', () => {
  const entries = [
    makeEntry({ id: 'mom', keywords: ['\u5988\u5988'], content: '用户的母亲住在上海。' }),
  ]
  const messages = [userMessage('\u6211\u5988\u5988\u4eca\u5929\u6253\u7535\u8bdd\u6765\u4e86')]
  const hits = selectTriggeredLorebookEntries(entries, messages)
  assert.equal(hits.length, 1)
  assert.equal(hits[0].id, 'mom')
})

test('disabled entries never fire', () => {
  const entries = [makeEntry({ id: 'mom', keywords: ['\u5988\u5988'], content: 'x', enabled: false })]
  const hits = selectTriggeredLorebookEntries(entries, [userMessage('\u5988\u5988\u6765\u4e86')])
  assert.equal(hits.length, 0)
})

test('scanner only looks at the last N user messages', () => {
  const entries = [makeEntry({ id: 'old', keywords: ['\u9c7c'], content: 'x' })]
  const messages: ChatMessage[] = []
  messages.push(userMessage('\u6211\u559c\u6b22\u5403\u9c7c', 'm-old'))
  for (let i = 0; i < 8; i += 1) {
    messages.push(userMessage(`\u5929\u6c14\u4e0d\u9519 ${i}`, `m-${i}`))
  }
  const hits = selectTriggeredLorebookEntries(entries, messages)
  // "鱼" in the distant past should be out of the 4-message window.
  assert.equal(hits.length, 0)
})

test('priority ordering beats match length', () => {
  const entries = [
    makeEntry({ id: 'low', keywords: ['\u9c7c'], content: 'low-priority short-keyword' }),
    makeEntry({ id: 'high', keywords: ['\u9c7c\u7c7b'], content: 'high-priority', priority: 10 }),
  ]
  const hits = selectTriggeredLorebookEntries(entries, [userMessage('\u6211\u5728\u67e5\u9c7c\u7c7b\u8d44\u6599')])
  assert.equal(hits.length, 2)
  assert.equal(hits[0].id, 'high')
})

test('buildLorebookSection returns empty string when nothing fires', () => {
  assert.equal(buildLorebookSection([]), '')
})

test('buildLorebookSection emits a numbered block with labels when present', () => {
  const section = buildLorebookSection([
    makeEntry({ id: 'a', label: '妈妈', content: '张老师' }),
    makeEntry({ id: 'b', content: '无标题' }),
  ])
  assert.match(section, /Lorebook/)
  assert.match(section, /\u3010\u5988\u5988\u3011/)
  assert.match(section, /2\. \u65e0\u6807\u9898/)
})

test('buildLorebookSection truncates oversize content with ellipsis', () => {
  const huge = 'x'.repeat(800)
  const section = buildLorebookSection([makeEntry({ id: 'big', content: huge })])
  // MAX_LOREBOOK_CONTENT_CHARS is 500 — allow the ellipsis suffix.
  assert.ok(section.includes('x'.repeat(500) + '\u2026'))
})
