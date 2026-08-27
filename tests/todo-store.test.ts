import assert from 'node:assert/strict'
import { test } from 'node:test'

import { TodoStore } from '../src/core/agent/tools/TodoTool.ts'

test('TodoStore returns clones and scopes lists by conversation', () => {
  const store = new TodoStore({
    time: { now: () => 50, id: (prefix) => `${prefix}one` },
  })
  const added = store.add('chat-a', 'write tests')
  added.text = 'mutated'
  added.status = 'completed'

  const listed = store.list('chat-a')
  assert.equal(listed.length, 1)
  assert.equal(listed[0]?.text, 'write tests')
  assert.equal(listed[0]?.status, 'pending')
  listed[0]!.text = 'list mutation'
  assert.equal(store.list('chat-a')[0]?.text, 'write tests')

  assert.deepEqual(store.list('chat-b'), [])
})

test('TodoStore update and clear stay scoped', () => {
  let seq = 0
  const store = new TodoStore({
    time: { now: () => 1, id: () => `todo-${++seq}` },
  })
  const first = store.add('chat-a', 'one')
  store.add('chat-a', 'two')
  store.add('chat-b', 'other')

  const updated = store.update(first.id, { status: 'completed' })
  updated!.text = 'caller mutation'
  assert.equal(store.list('chat-a').find((item) => item.id === first.id)?.status, 'completed')
  assert.equal(store.list('chat-a').find((item) => item.id === first.id)?.text, 'one')

  assert.equal(store.clear('chat-a'), 2)
  assert.equal(store.list('chat-a').length, 0)
  assert.equal(store.list('chat-b').length, 1)
})
