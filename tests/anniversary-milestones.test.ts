import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  detectAnniversaryMilestones,
  markMilestoneFired,
} from '../src/features/autonomy/milestones.ts'
import {
  createDefaultRelationshipState,
  type RelationshipState,
} from '../src/features/autonomy/relationshipTracker.ts'

function state(over: Partial<RelationshipState>): RelationshipState {
  return { ...createDefaultRelationshipState(), ...over }
}

test('detectAnniversaryMilestones: under 30 days returns nothing', () => {
  const result = detectAnniversaryMilestones(state({ totalDaysInteracted: 12 }), 'en-US')
  assert.equal(result, null)
})

test('detectAnniversaryMilestones: crossing 30 days fires days-30 once', () => {
  const s = state({ totalDaysInteracted: 30 })
  const trigger = detectAnniversaryMilestones(s, 'en-US')
  assert.ok(trigger)
  assert.equal(trigger!.key, 'days-30')
  assert.match(trigger!.promptHint, /30 days/i)
})

test('detectAnniversaryMilestones: crossing 100 fires days-100 when 30 already fired', () => {
  const s = state({ totalDaysInteracted: 100, firedMilestoneKeys: ['days-30'] })
  const trigger = detectAnniversaryMilestones(s, 'en-US')
  assert.ok(trigger)
  assert.equal(trigger!.key, 'days-100')
})

test('detectAnniversaryMilestones: crossing 365 fires days-365', () => {
  const s = state({
    totalDaysInteracted: 365,
    firedMilestoneKeys: ['days-30', 'days-100'],
  })
  const trigger = detectAnniversaryMilestones(s, 'en-US')
  assert.ok(trigger)
  assert.equal(trigger!.key, 'days-365')
})

test('detectAnniversaryMilestones: returns null when all crossed milestones already fired', () => {
  const s = state({
    totalDaysInteracted: 400,
    firedMilestoneKeys: ['days-30', 'days-100', 'days-365'],
  })
  assert.equal(detectAnniversaryMilestones(s, 'en-US'), null)
})

test('detectAnniversaryMilestones: returns the SMALLEST unfired milestone first', () => {
  // User has been around 200 days but never had any milestone fire yet —
  // the natural progression is to fire days-30 first, not jump to days-100.
  const s = state({ totalDaysInteracted: 200, firedMilestoneKeys: [] })
  const trigger = detectAnniversaryMilestones(s, 'en-US')
  assert.ok(trigger)
  assert.equal(trigger!.key, 'days-30')
})

test('detectAnniversaryMilestones: locale fallback to en-US for unknown locale', () => {
  const s = state({ totalDaysInteracted: 30 })
  const trigger = detectAnniversaryMilestones(s, 'fr-FR')
  assert.ok(trigger)
  assert.match(trigger!.promptHint, /30 days/i)
})

test('detectAnniversaryMilestones: zh-CN copy is in zh', () => {
  const trigger = detectAnniversaryMilestones(
    state({ totalDaysInteracted: 100, firedMilestoneKeys: ['days-30'] }),
    'zh-CN',
  )
  assert.ok(trigger)
  assert.match(trigger!.promptHint, /100 天/)
})

test('markMilestoneFired: appends key, identity-stable when already present', () => {
  const initial = state({ firedMilestoneKeys: ['days-30'] })
  const next = markMilestoneFired(initial, 'days-100')
  assert.deepEqual(next.firedMilestoneKeys, ['days-30', 'days-100'])

  const same = markMilestoneFired(next, 'days-100')
  assert.equal(same, next, 'second mark should return same reference')
})

test('markMilestoneFired: handles undefined firedMilestoneKeys', () => {
  const initial = state({})
  const next = markMilestoneFired(initial, 'days-30')
  assert.deepEqual(next.firedMilestoneKeys, ['days-30'])
})
