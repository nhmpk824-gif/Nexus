import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  planPortraitPuppetAccent,
  planPortraitPuppetAction,
  planPortraitPuppetGesture,
  planPortraitPuppetIdleAction,
  resolvePortraitPuppetActionEnvelope,
  resolvePortraitPuppetPerformanceElapsedMs,
} from '../src/features/pet/portraitPuppetActions.ts'
import { planPortraitPuppetPose } from '../src/features/pet/portraitPuppet.ts'
import { PUBLIC_GESTURE_NAMES } from '../src/features/pet/models.ts'

function waveCue(overrides: Partial<{
  durationMs: number
  gestureName: string
  accentStyle: 'search' | 'shy' | 'write'
}> = {}) {
  return {
    id: 'wave-cue',
    durationMs: overrides.durationMs ?? 1_200,
    stageDirection: '(挥手)',
    gestureName: overrides.gestureName ?? 'wave',
    accentStyle: overrides.accentStyle,
  }
}

test('portrait action envelope rises, holds, then falls like a Live2D clip', () => {
  assert.equal(resolvePortraitPuppetActionEnvelope(0, 1_200), 0)
  assert.equal(resolvePortraitPuppetActionEnvelope(1_200, 1_200), 0)
  assert.ok(resolvePortraitPuppetActionEnvelope(80, 1_200) > 0)
  assert.ok(resolvePortraitPuppetActionEnvelope(80, 1_200) < 1)
  assert.equal(resolvePortraitPuppetActionEnvelope(500, 1_200), 1)
  assert.ok(resolvePortraitPuppetActionEnvelope(1_050, 1_200) < 1)
})

test('portrait gestures start from elapsed zero instead of wall-clock phase', () => {
  const start = planPortraitPuppetGesture('nod', 0, 1)
  const peak = planPortraitPuppetGesture('nod', 180, 1)
  assert.ok(Math.abs(start.headTilt) < 0.01)
  assert.ok(peak.headTilt > 2)
  assert.ok(peak.headBob < 0)

  const waveStart = planPortraitPuppetGesture('wave', 0, 1)
  const waveSwing = planPortraitPuppetGesture('wave', 140, 1)
  assert.ok(Math.abs(waveStart.armSway) < 0.01)
  assert.ok(Math.abs(waveSwing.armSway) > 0.8)
})

test('every public Live2D gesture name moves a portrait channel', () => {
  for (const gestureName of PUBLIC_GESTURE_NAMES) {
    const action = planPortraitPuppetGesture(gestureName, 180, 1)
    const motion = Math.abs(action.headYaw)
      + Math.abs(action.headTilt)
      + Math.abs(action.headBob)
      + Math.abs(action.bodyLean)
      + Math.abs(action.armSway)
      + Math.abs(action.eyeX)
    assert.ok(motion > 0.2, `${gestureName} should move the portrait`)
    assert.equal(action.weight, 1)
  }
  assert.equal(planPortraitPuppetGesture('unknown', 180, 1).weight, 0)
  assert.equal(planPortraitPuppetGesture('wave', 180, 0).weight, 0)
})

test('portrait accents reuse the Live2D vocabulary on pose offsets', () => {
  const search = planPortraitPuppetAccent('search', 210, 1)
  const shy = planPortraitPuppetAccent('shy', 210, 1)
  const write = planPortraitPuppetAccent('write', 210, 1)
  assert.ok(Math.abs(search.eyeX) > 0.2)
  assert.ok(shy.headTilt > 3)
  assert.ok(shy.eyeDrop > 0)
  assert.ok(write.headTilt < 0)
  assert.ok(write.armSway > 0)
})

test('performance cue elapsed is measured from the canvas start clock', () => {
  assert.equal(resolvePortraitPuppetPerformanceElapsedMs(null, 10, 40), undefined)
  assert.equal(resolvePortraitPuppetPerformanceElapsedMs(waveCue(), 1_000, 1_380), 380)
  assert.equal(resolvePortraitPuppetPerformanceElapsedMs(waveCue(), 1_000, 900), 0)
})

test('wave and nod cues override idle sine instead of blending into it', () => {
  const idle = planPortraitPuppetPose({ mood: 'idle', nowMs: 1_000 })
  const wave = planPortraitPuppetPose({
    mood: 'idle',
    nowMs: 1_000,
    performanceElapsedMs: 180,
    performanceCue: waveCue(),
  })
  const nod = planPortraitPuppetPose({
    mood: 'idle',
    nowMs: 1_000,
    performanceElapsedMs: 180,
    performanceCue: waveCue({ gestureName: 'nod' }),
  })

  assert.ok(Math.abs(wave.armSway) > Math.abs(idle.armSway) + 0.35)
  assert.ok(nod.headTilt > idle.headTilt + 1.5)
  assert.ok(nod.headBob < idle.headBob)
})

test('reduced motion ignores performance gestures', () => {
  const still = planPortraitPuppetPose({
    mood: 'idle',
    nowMs: 1_000,
    prefersReducedMotion: true,
    performanceElapsedMs: 180,
    performanceCue: waveCue(),
  })
  assert.equal(still.armSway, 0)
  assert.equal(still.headBob, 0)
})

test('idle director inserts hashed look/nod beats outside performance cues', () => {
  const samples = Array.from({ length: 4_000 }, (_, index) => (
    planPortraitPuppetIdleAction(index * 90)
  ))
  const active = samples.filter((action) => action.weight > 0.4)
  assert.ok(active.length > 0, 'idle cycle should fire a beat')
  assert.ok(active.some((action) => Math.abs(action.headYaw) > 0.2))
  assert.ok(active.some((action) => Math.abs(action.headTilt) > 1))

  const speaking = planPortraitPuppetAction({
    nowMs: 4_000,
    allowIdleAction: false,
  })
  assert.equal(speaking.weight, 0)
})
