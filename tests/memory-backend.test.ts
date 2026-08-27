import assert from 'node:assert/strict'
import { test } from 'node:test'

import { InMemoryMemoryBackend } from '../src/core/agent/tools/MemoryTool.ts'

test('InMemoryMemoryBackend returns clones from write read list and search', async () => {
  const backend = new InMemoryMemoryBackend({
    time: { now: () => 77, id: (prefix) => prefix },
  })
  const written = await backend.write({
    scope: 'conversation',
    ownerId: 'local-chat',
    key: 'note-1',
    value: 'buy milk',
    tags: ['errand'],
  })
  written.value = 'mutated'
  written.tags?.push('injected')

  const read = await backend.read('conversation', 'local-chat', 'note-1')
  assert.equal(read?.value, 'buy milk')
  assert.deepEqual(read?.tags, ['errand'])
  assert.equal(read?.createdAt, 77)
  read!.value = 'read mutation'

  const listed = await backend.list('conversation', 'local-chat')
  listed[0]!.value = 'list mutation'
  listed[0]!.tags?.push('listed')

  const hits = await backend.search('milk', { ownerId: 'local-chat' })
  hits[0]!.value = 'search mutation'

  const stored = await backend.read('conversation', 'local-chat', 'note-1')
  assert.equal(stored?.value, 'buy milk')
  assert.deepEqual(stored?.tags, ['errand'])
})
