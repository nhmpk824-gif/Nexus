import assert from 'node:assert/strict'
import { test } from 'node:test'

import { SkillRegistry } from '../src/core/skills/SkillRegistry.ts'

test('SkillRegistry returns defensive snapshots from register get list and match', () => {
  const registry = new SkillRegistry({
    time: { now: () => 100, id: (prefix) => `${prefix}fixed` },
  })
  const created = registry.register({
    name: 'Search assist',
    description: 'Hint search',
    trigger: { keywords: ['search', '查一下'] },
    body: 'Use /search',
    status: 'active',
  })
  created.body = 'mutated'
  created.trigger.keywords?.push('injected')

  const listed = registry.list('active')
  listed[0]!.body = 'list mutation'
  listed[0]!.trigger.keywords?.push('listed')

  const stored = registry.get('skill-fixed')
  assert.equal(stored?.id, 'skill-fixed')
  assert.equal(stored?.body, 'Use /search')
  assert.deepEqual(stored?.trigger.keywords, ['search', '查一下'])
  assert.equal(stored?.createdAt, 100)

  const hits = registry.match({
    text: '请 search 一下',
    historyLength: 0,
    hasToolCalls: false,
  })
  assert.equal(hits.length, 1)
  hits[0]!.skill.body = 'match mutation'
  assert.equal(registry.get('skill-fixed')?.body, 'Use /search')
})

test('SkillRegistry match ignores inactive skills and scores keyword hits', () => {
  const registry = new SkillRegistry()
  registry.register({
    id: 'draft-skill',
    name: 'Draft',
    description: 'unused',
    trigger: { keywords: ['hello'] },
    body: 'draft body',
    status: 'draft',
  })
  registry.register({
    id: 'active-skill',
    name: 'Active',
    description: 'used',
    trigger: { keywords: ['hello', 'there'] },
    body: 'active body',
    status: 'active',
  })

  const hits = registry.match({
    text: 'Hello there friend',
    historyLength: 0,
    hasToolCalls: false,
  })
  assert.equal(hits.length, 1)
  assert.equal(hits[0]?.skill.id, 'active-skill')
  assert.ok(hits[0]!.score >= 4)
})
