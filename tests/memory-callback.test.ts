import assert from 'node:assert/strict'
import { test } from 'node:test'

import { selectCallbackCandidates } from '../src/features/memory/reflectionGenerator.ts'
import type { MemoryItem } from '../src/types/memory.ts'

const DAY_MS = 86_400_000
const NOW = Date.parse('2026-04-24T10:00:00Z')

function memory(over: Partial<MemoryItem>): MemoryItem {
  return {
    id: over.id ?? 'm',
    content: over.content ?? 'something memorable',
    category: over.category ?? 'profile',
    source: 'chat',
    createdAt: over.createdAt ?? new Date(NOW - 4 * DAY_MS).toISOString(),
    importance: over.importance ?? 'normal',
    significance: over.significance ?? 0.5,
    ...over,
  }
}

test('selectCallbackCandidates picks high-significance memories aged 1.5–21 days', () => {
  const memories = [
    memory({ id: 'fresh', createdAt: new Date(NOW - 0.5 * DAY_MS).toISOString(), significance: 0.9 }),
    memory({ id: 'sweet', createdAt: new Date(NOW - 4 * DAY_MS).toISOString(), significance: 0.7 }),
    memory({ id: 'stale', createdAt: new Date(NOW - 30 * DAY_MS).toISOString(), significance: 0.9 }),
  ]
  const ids = selectCallbackCandidates(memories, new Set(), NOW)
  assert.deepEqual(ids, ['sweet'])
})

test('selectCallbackCandidates skips low-significance memories', () => {
  const memories = [
    memory({ id: 'meh', significance: 0.1 }),
    memory({ id: 'nope', significance: 0 }),
  ]
  assert.deepEqual(selectCallbackCandidates(memories, new Set(), NOW), [])
})

test('selectCallbackCandidates skips reflection-tier memories', () => {
  const memories = [
    memory({ id: 'r', importance: 'reflection', significance: 0.9 }),
    memory({ id: 'fact', importance: 'normal', significance: 0.6 }),
  ]
  const ids = selectCallbackCandidates(memories, new Set(), NOW)
  assert.deepEqual(ids, ['fact'])
})

test('selectCallbackCandidates excludes ids in excludeSet', () => {
  const memories = [
    memory({ id: 'a', significance: 0.6 }),
    memory({ id: 'b', significance: 0.8 }),
  ]
  const ids = selectCallbackCandidates(memories, new Set(['b']), NOW)
  assert.deepEqual(ids, ['a'])
})

test('selectCallbackCandidates skips recently-recalled (within cooldown)', () => {
  const memories = [
    memory({
      id: 'recent',
      significance: 0.9,
      lastRecalledAt: new Date(NOW - 3 * DAY_MS).toISOString(),
    }),
    memory({
      id: 'cool',
      significance: 0.6,
      lastRecalledAt: new Date(NOW - 14 * DAY_MS).toISOString(),
    }),
  ]
  const ids = selectCallbackCandidates(memories, new Set(), NOW)
  assert.ok(!ids.includes('recent'))
  assert.ok(ids.includes('cool'))
})

test('selectCallbackCandidates ranks never-recalled higher than recalled at equal sig', () => {
  const memories = [
    memory({
      id: 'old',
      significance: 0.6,
      lastRecalledAt: new Date(NOW - 30 * DAY_MS).toISOString(),
    }),
    memory({ id: 'new', significance: 0.6 }),
  ]
  const ids = selectCallbackCandidates(memories, new Set(), NOW, 1)
  assert.deepEqual(ids, ['new'])
})

test('selectCallbackCandidates honours maxCandidates cap', () => {
  const memories = Array.from({ length: 10 }, (_, i) =>
    memory({ id: `m${i}`, significance: 0.5 + i * 0.04 }),
  )
  const ids = selectCallbackCandidates(memories, new Set(), NOW, 3)
  assert.equal(ids.length, 3)
})
