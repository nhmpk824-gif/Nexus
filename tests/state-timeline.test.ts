import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import {
  type EmotionSample,
  type RelationshipSample,
  shouldCaptureEmotionSample,
  shouldCaptureRelationshipSample,
} from '../src/features/autonomy/stateTimeline.ts'
import { createDefaultRelationshipState } from '../src/features/autonomy/relationshipTracker.ts'
import { createDefaultEmotionState } from '../src/features/autonomy/emotionModel.ts'

describe('shouldCaptureEmotionSample', () => {
  const nowMs = new Date('2026-04-24T12:00:00Z').getTime()

  test('captures when no prior sample exists', () => {
    assert.equal(
      shouldCaptureEmotionSample(createDefaultEmotionState(), undefined, nowMs),
      true,
    )
  })

  test('skips when every axis is under the 6% threshold', () => {
    const last: EmotionSample = {
      ts: new Date(nowMs - 60_000).toISOString(),
      energy: 0.5,
      warmth: 0.6,
      curiosity: 0.5,
      concern: 0.2,
    }
    const next = { energy: 0.52, warmth: 0.61, curiosity: 0.49, concern: 0.21 }
    assert.equal(shouldCaptureEmotionSample(next, last, nowMs), false)
  })

  test('captures when any axis crosses 6%', () => {
    const last: EmotionSample = {
      ts: new Date(nowMs - 60_000).toISOString(),
      energy: 0.5,
      warmth: 0.6,
      curiosity: 0.5,
      concern: 0.2,
    }
    const next = { energy: 0.58, warmth: 0.6, curiosity: 0.5, concern: 0.2 }
    assert.equal(shouldCaptureEmotionSample(next, last, nowMs), true)
  })

  test('captures on heartbeat even if nothing moved', () => {
    const sixHoursMs = 6 * 60 * 60 * 1000
    const last: EmotionSample = {
      ts: new Date(nowMs - sixHoursMs - 1_000).toISOString(),
      energy: 0.5,
      warmth: 0.6,
      curiosity: 0.5,
      concern: 0.2,
    }
    const next = { energy: 0.5, warmth: 0.6, curiosity: 0.5, concern: 0.2 }
    assert.equal(shouldCaptureEmotionSample(next, last, nowMs), true)
  })

  test('does not fire heartbeat below the 6h window', () => {
    const last: EmotionSample = {
      ts: new Date(nowMs - 60 * 60 * 1000).toISOString(),
      energy: 0.5,
      warmth: 0.6,
      curiosity: 0.5,
      concern: 0.2,
    }
    const next = { energy: 0.5, warmth: 0.6, curiosity: 0.5, concern: 0.2 }
    assert.equal(shouldCaptureEmotionSample(next, last, nowMs), false)
  })
})

describe('shouldCaptureRelationshipSample', () => {
  const defaultState = createDefaultRelationshipState()

  test('captures when no prior sample exists', () => {
    assert.equal(shouldCaptureRelationshipSample(defaultState, undefined), true)
  })

  test('captures on any score delta', () => {
    const last: RelationshipSample = {
      ts: '2026-04-23T00:00:00Z',
      score: 10,
      level: 'acquaintance',
      streak: 1,
      daysInteracted: 1,
    }
    const next = { ...defaultState, score: 11, streak: 1, totalDaysInteracted: 1 }
    assert.equal(shouldCaptureRelationshipSample(next, last), true)
  })

  test('captures on streak change even at same score', () => {
    const last: RelationshipSample = {
      ts: '2026-04-23T00:00:00Z',
      score: 10,
      level: 'acquaintance',
      streak: 1,
      daysInteracted: 1,
    }
    const next = { ...defaultState, score: 10, streak: 2, totalDaysInteracted: 2 }
    assert.equal(shouldCaptureRelationshipSample(next, last), true)
  })

  test('captures on level change at same score (boundary condition)', () => {
    // Level at score 9 = stranger, at score 10 = acquaintance. Last sample
    // recorded at acquaintance (score 10, level already derived).
    const last: RelationshipSample = {
      ts: '2026-04-23T00:00:00Z',
      score: 9,
      level: 'stranger',
      streak: 0,
      daysInteracted: 0,
    }
    // Next has score 10 — actual level is 'acquaintance' after getRelationshipLevel.
    // That differs from last.level even aside from the score delta.
    const next = { ...defaultState, score: 10, streak: 0, totalDaysInteracted: 0 }
    assert.equal(shouldCaptureRelationshipSample(next, last), true)
  })

  test('skips when score, streak, and level all match', () => {
    const last: RelationshipSample = {
      ts: '2026-04-23T00:00:00Z',
      score: 10,
      level: 'acquaintance',
      streak: 1,
      daysInteracted: 1,
    }
    const next = { ...defaultState, score: 10, streak: 1, totalDaysInteracted: 1 }
    assert.equal(shouldCaptureRelationshipSample(next, last), false)
  })
})
