import assert from 'node:assert/strict'
import { test } from 'node:test'

import { resolveSpeechVisemes } from '../src/features/pet/speechVisemes.ts'

test('speech visemes stay closed below the Live2D mouth dead zone', () => {
  assert.deepEqual(resolveSpeechVisemes(0.01, 800), { open: 0, round: 0, narrow: 0 })
})

test('speech visemes phase-offset round and narrow while the jaw stays open', () => {
  const early = resolveSpeechVisemes(1, 800)
  const later = resolveSpeechVisemes(1, 1_050)

  assert.equal(early.open, 1)
  assert.equal(later.open, 1)
  assert.ok(early.round > 0)
  assert.ok(early.narrow > 0)
  assert.ok(early.round < early.open)
  assert.ok(early.narrow < early.open)
  assert.notEqual(early.round, later.round)
  assert.notEqual(early.narrow, later.narrow)
})

test('reduced motion keeps a static Live2D A/O/I mix', () => {
  const first = resolveSpeechVisemes(1, 800, true)
  const second = resolveSpeechVisemes(1, 1_050, true)
  assert.deepEqual(first, { open: 1, round: 0.25, narrow: 0.08 })
  assert.deepEqual(second, first)
})
