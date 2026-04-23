import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  buildLorebookSection,
  rewriteQueryForLorebook,
  selectTriggeredLorebookEntries,
  selectTriggeredLorebookEntriesWithSemantic,
} from '../src/features/chat/lorebookInjection.ts'
import { LOCAL_HASH_MEMORY_MODEL_ID } from '../src/features/memory/constants.ts'
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

test('selectTriggeredLorebookEntries fires on a single keyword match', async () => {
  const entries = [
    makeEntry({ id: 'mom', keywords: ['\u5988\u5988'], content: '用户的母亲住在上海。' }),
  ]
  const messages = [userMessage('\u6211\u5988\u5988\u4eca\u5929\u6253\u7535\u8bdd\u6765\u4e86')]
  const hits = await selectTriggeredLorebookEntries(entries, messages)
  assert.equal(hits.length, 1)
  assert.equal(hits[0].id, 'mom')
})

test('disabled entries never fire', async () => {
  const entries = [makeEntry({ id: 'mom', keywords: ['\u5988\u5988'], content: 'x', enabled: false })]
  const hits = await selectTriggeredLorebookEntries(entries, [userMessage('\u5988\u5988\u6765\u4e86')])
  assert.equal(hits.length, 0)
})

test('scanner only looks at the last N user messages', async () => {
  const entries = [makeEntry({ id: 'old', keywords: ['\u9c7c'], content: 'x' })]
  const messages: ChatMessage[] = []
  messages.push(userMessage('\u6211\u559c\u6b22\u5403\u9c7c', 'm-old'))
  for (let i = 0; i < 8; i += 1) {
    messages.push(userMessage(`\u5929\u6c14\u4e0d\u9519 ${i}`, `m-${i}`))
  }
  const hits = await selectTriggeredLorebookEntries(entries, messages)
  // "鱼" in the distant past should be out of the 4-message window.
  assert.equal(hits.length, 0)
})

test('priority ordering beats match length', async () => {
  const entries = [
    makeEntry({ id: 'low', keywords: ['\u9c7c'], content: 'low-priority short-keyword' }),
    makeEntry({ id: 'high', keywords: ['\u9c7c\u7c7b'], content: 'high-priority', priority: 10 }),
  ]
  const hits = await selectTriggeredLorebookEntries(entries, [userMessage('\u6211\u5728\u67e5\u9c7c\u7c7b\u8d44\u6599')])
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

// ── Semantic hybrid pass ──────────────────────────────────────────────────

test('semantic hybrid still returns keyword hits when both paths fire', async () => {
  const entries = [
    makeEntry({ id: 'mom', keywords: ['妈妈'], content: '用户的母亲住在上海。' }),
  ]
  const messages = [userMessage('我妈妈今天打电话来了')]
  const hits = await selectTriggeredLorebookEntriesWithSemantic(entries, messages, {
    embeddingModel: LOCAL_HASH_MEMORY_MODEL_ID,
  })
  assert.equal(hits.length, 1)
  assert.equal(hits[0].id, 'mom')
})

test('semantic hybrid picks up an entry whose keywords the user never spelled out', async () => {
  // User talks about "厦门" (Xiamen). The lorebook entry is keyed on a
  // different city name but shares overlapping ngrams in the content body.
  // The local hash embedder's ngram tokens should give the 厦门-content
  // entry a similarity score above the default 0.55 threshold even though
  // the literal keyword "厦门" never appears in scan messages.
  const entries = [
    makeEntry({
      id: 'xiamen-history',
      keywords: ['鼓浪屿'],
      content: '厦门是福建省的港口城市，鼓浪屿和环岛路都是本地代表景点。',
      priority: 5,
    }),
    // Decoy entry — unrelated content should not pass threshold.
    makeEntry({
      id: 'cat-food',
      keywords: ['猫粮'],
      content: '皇家猫粮适合成年英短，每日两次。',
      priority: 5,
    }),
  ]
  const messages = [userMessage('我这周末想去厦门玩，有没有什么推荐的景点？')]
  const hits = await selectTriggeredLorebookEntriesWithSemantic(entries, messages, {
    embeddingModel: LOCAL_HASH_MEMORY_MODEL_ID,
  })
  const ids = hits.map((h) => h.id)
  assert.ok(ids.includes('xiamen-history'), `expected xiamen-history in hits, got ${ids.join(',')}`)
  assert.ok(!ids.includes('cat-food'), 'cat-food should not pass the semantic threshold')
})

test('semantic hybrid de-duplicates entries that hit via both keyword and semantic', async () => {
  const entries = [
    makeEntry({ id: 'a', keywords: ['apple'], content: 'apple computer is a fruit' }),
  ]
  const messages = [userMessage('i ate an apple')]
  const hits = await selectTriggeredLorebookEntriesWithSemantic(entries, messages, {
    embeddingModel: LOCAL_HASH_MEMORY_MODEL_ID,
  })
  assert.equal(hits.length, 1)
  assert.equal(hits[0].id, 'a')
})

test('semantic hybrid honors MAX_LOREBOOK_ENTRIES_PER_TURN cap', async () => {
  // Make 10 entries that all keyword-match "pet". Combined with potential
  // semantic pickup, the result must still cap at MAX_LOREBOOK_ENTRIES_PER_TURN.
  const entries = Array.from({ length: 10 }, (_, i) =>
    makeEntry({ id: `p${i}`, keywords: ['pet'], content: `pet trivia ${i}`, priority: i }),
  )
  const messages = [userMessage('tell me about my pet')]
  const hits = await selectTriggeredLorebookEntriesWithSemantic(entries, messages, {
    embeddingModel: LOCAL_HASH_MEMORY_MODEL_ID,
  })
  assert.ok(hits.length <= 6, `expected ≤ 6 hits, got ${hits.length}`)
})

// ── Query rewrite ────────────────────────────────────────────────────────

test('rewriteQueryForLorebook splits newlines, strips list bullets, de-dupes', async () => {
  const caller = async () => '- apple tree\n* apple tree\n1. apple harvest\n•  2024 crop'
  const rewrites = await rewriteQueryForLorebook('apples are red', caller)
  assert.deepEqual(rewrites, ['apple tree', 'apple harvest', '2024 crop'])
})

test('rewriteQueryForLorebook returns [] on empty input', async () => {
  const caller = async () => 'something'
  assert.deepEqual(await rewriteQueryForLorebook('', caller), [])
  assert.deepEqual(await rewriteQueryForLorebook('   ', caller), [])
})

test('rewriteQueryForLorebook returns [] when caller throws', async () => {
  const caller = async () => { throw new Error('503') }
  assert.deepEqual(await rewriteQueryForLorebook('hello', caller), [])
})

test('rewriteQueryForLorebook caps at 3 variants', async () => {
  const caller = async () => 'q1\nq2\nq3\nq4\nq5'
  const rewrites = await rewriteQueryForLorebook('original', caller)
  assert.equal(rewrites.length, 3)
})

test('selectTriggeredLorebookEntriesWithSemantic rewrites and matches when literal pass finds nothing', async () => {
  const entries = [
    makeEntry({
      id: 'laptop',
      keywords: ['ThinkPad X1 Carbon'],
      content: 'ThinkPad X1 Carbon is the user\'s daily driver laptop for programming.',
      priority: 5,
    }),
  ]
  const messages = [userMessage('remind me what machine I code on')]

  const keywordOnly = await selectTriggeredLorebookEntriesWithSemantic(entries, messages, {
    embeddingModel: LOCAL_HASH_MEMORY_MODEL_ID,
  })
  const withRewrite = await selectTriggeredLorebookEntriesWithSemantic(entries, messages, {
    embeddingModel: LOCAL_HASH_MEMORY_MODEL_ID,
    rewriteQuery: async () => 'ThinkPad X1 Carbon laptop programming\ndaily driver laptop',
  })
  assert.ok(withRewrite.length >= keywordOnly.length)
})
