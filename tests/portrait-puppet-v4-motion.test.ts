import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  createPortraitPuppetV4MotionState,
  planPortraitPuppetV4Motion,
} from '../src/features/pet/portraitPuppetV4Motion.ts'

test('v4 motion smooths gaze more slowly while thinking than while idle', () => {
  const idle = createPortraitPuppetV4MotionState()
  const thinking = createPortraitPuppetV4MotionState()
  planPortraitPuppetV4Motion({ mood: 'idle', gazeX: 1, nowMs: 1_000 }, idle)
  planPortraitPuppetV4Motion({ mood: 'thinking', gazeX: 1, isBusy: true, nowMs: 1_000 }, thinking)

  assert.ok(idle.gazeX > thinking.gazeX)
  assert.ok(idle.gazeX < 1)
})

test('v4 speech splits open, round, and narrow like Live2D mouth channels', () => {
  const early = planPortraitPuppetV4Motion({
    mood: 'idle',
    isSpeaking: true,
    speechLevel: 1,
    nowMs: 800,
  }, createPortraitPuppetV4MotionState())
  const later = planPortraitPuppetV4Motion({
    mood: 'idle',
    isSpeaking: true,
    speechLevel: 1,
    nowMs: 1_050,
  }, createPortraitPuppetV4MotionState())

  assert.ok((early.mouthOpen ?? 0) > 0)
  assert.ok((early.mouthRound ?? 0) > 0)
  assert.ok((early.mouthRound ?? 0) < (early.mouthOpen ?? 0))
  assert.ok((early.mouthNarrow ?? 0) > 0)
  assert.ok((early.mouthNarrow ?? 0) < (early.mouthOpen ?? 0))
  assert.notEqual(early.mouthRound, later.mouthRound)
  assert.notEqual(early.mouthNarrow, later.mouthNarrow)
})

test('v4 motion attacks speech faster than it releases', () => {
  const state = createPortraitPuppetV4MotionState()
  const opening = planPortraitPuppetV4Motion({
    mood: 'idle',
    isSpeaking: true,
    speechLevel: 1,
    nowMs: 800,
  }, state)
  const peak = state.speech
  const closing = planPortraitPuppetV4Motion({
    mood: 'idle',
    isSpeaking: false,
    speechLevel: 0,
    nowMs: 816,
  }, state)

  assert.ok((opening.mouthOpen ?? 0) > 0)
  assert.ok(peak - (closing.mouthOpen ?? 0) < peak * 0.5)
})

test('v4 motion uses a closing/opening blink with a lagged right lid', () => {
  const state = createPortraitPuppetV4MotionState()
  let motion = planPortraitPuppetV4Motion({ mood: 'idle', nowMs: 0 }, state)
  for (let nowMs = 8; nowMs < 12_000; nowMs += 8) {
    motion = planPortraitPuppetV4Motion({ mood: 'idle', nowMs }, state)
    if ((motion.blinkLeft ?? 0) > 0.2) break
  }
  assert.ok((motion.blinkLeft ?? 0) > (motion.blinkRight ?? 0))
})

test('v4 motion lowers sleepy lids and knits thinking brows', () => {
  const sleepy = planPortraitPuppetV4Motion(
    { mood: 'sleepy', nowMs: 400 },
    createPortraitPuppetV4MotionState(),
  )
  const thinking = planPortraitPuppetV4Motion(
    { mood: 'thinking', isBusy: true, nowMs: 400 },
    createPortraitPuppetV4MotionState(),
  )
  const happy = planPortraitPuppetV4Motion(
    { mood: 'happy', nowMs: 400 },
    createPortraitPuppetV4MotionState(),
  )

  assert.ok((sleepy.blinkLeft ?? 0) >= 0.27)
  assert.ok((thinking.browForm ?? 0) < -0.1)
  assert.ok((happy.cheek ?? 0) >= 0.1)
  assert.ok((happy.eyeSmileLeft ?? 0) > 0.4)
  assert.ok((sleepy.browLeftY ?? 0) < 0)
})

test('v4 motion splits Live2D brow height and follows gaze with body pitch', () => {
  const confused = planPortraitPuppetV4Motion(
    { mood: 'confused', nowMs: 400 },
    createPortraitPuppetV4MotionState(),
  )
  const surprised = planPortraitPuppetV4Motion(
    { mood: 'surprised', nowMs: 400 },
    createPortraitPuppetV4MotionState(),
  )
  const lookingUp = planPortraitPuppetV4Motion(
    { mood: 'idle', gazeY: 1, nowMs: 400 },
    createPortraitPuppetV4MotionState(),
  )
  const lookingDown = planPortraitPuppetV4Motion(
    { mood: 'idle', gazeY: -1, nowMs: 400 },
    createPortraitPuppetV4MotionState(),
  )

  assert.ok((confused.browLeftY ?? 0) > 0)
  assert.ok((confused.browRightY ?? 0) < 0)
  assert.ok((confused.browLeftAngle ?? 0) > 0)
  assert.ok((confused.browRightAngle ?? 0) < 0)
  assert.ok((surprised.browLeftY ?? 0) > 0.2)
  assert.ok((surprised.eyeFormLeft ?? 0) > 0.15)
  assert.ok((lookingUp.bodyPitch ?? 0) > (lookingDown.bodyPitch ?? 0))
})

test('v4 motion maps a live touch zone onto the Live2D touch-head slot', () => {
  const motion = planPortraitPuppetV4Motion({
    mood: 'idle',
    nowMs: 400,
    touchZone: 'head',
  }, createPortraitPuppetV4MotionState())
  assert.ok((motion.eyeSmileLeft ?? 0) > 0.4)
  assert.ok((motion.cheek ?? 0) > 0.08)
})

test('v4 idle saccades hop gaze off-center then hold', () => {
  const state = createPortraitPuppetV4MotionState()
  planPortraitPuppetV4Motion({ mood: 'idle', nowMs: 0 }, state)
  const firstHop = state.saccade.nextAt
  let hopped = planPortraitPuppetV4Motion({ mood: 'idle', nowMs: firstHop }, state)
  const firstX = hopped.eyeX ?? 0
  hopped = planPortraitPuppetV4Motion({ mood: 'idle', nowMs: firstHop + 40 }, state)
  assert.equal(hopped.eyeX, firstX)
  assert.ok(Math.abs(firstX) > 0.02)
})

test('v4 motion maps Live2D touch slots onto smile and cheek', () => {
  const touchHead = planPortraitPuppetV4Motion({
    mood: 'idle',
    nowMs: 400,
    performanceCue: {
      id: 'touch-head',
      durationMs: 1_200,
      stageDirection: '(摸头)',
      expressionSlot: 'touchHead',
    },
    performanceElapsedMs: 200,
  }, createPortraitPuppetV4MotionState())

  assert.ok((touchHead.eyeSmileLeft ?? 0) > 0.4)
  assert.ok((touchHead.cheek ?? 0) > 0.08)
  assert.ok((touchHead.headTilt ?? 0) > 0.1)
})

test('v4 motion drops idle wobble when reduced motion is preferred', () => {
  const lively = planPortraitPuppetV4Motion(
    { mood: 'idle', nowMs: 3_250, prefersReducedMotion: false },
    createPortraitPuppetV4MotionState(),
  )
  const quiet = planPortraitPuppetV4Motion(
    { mood: 'idle', nowMs: 3_250, prefersReducedMotion: true },
    createPortraitPuppetV4MotionState(),
  )

  assert.equal(quiet.headTilt, 0)
  assert.equal(quiet.armSway, 0)
  assert.notEqual(lively.headTilt, 0)

  const stillWave = planPortraitPuppetV4Motion({
    mood: 'idle',
    nowMs: 500,
    prefersReducedMotion: true,
    performanceCue: {
      id: 'wave',
      durationMs: 1_200,
      stageDirection: '(挥手)',
      gestureName: 'wave',
    },
    performanceElapsedMs: 140,
  }, createPortraitPuppetV4MotionState())
  assert.equal(stillWave.armSway, 0)
})

test('v4 motion plays Live2D wave and nod on arm and head channels', () => {
  const wave = planPortraitPuppetV4Motion({
    mood: 'idle',
    nowMs: 500,
    performanceCue: {
      id: 'wave',
      durationMs: 1_200,
      stageDirection: '(挥手)',
      gestureName: 'wave',
    },
    performanceElapsedMs: 140,
  }, createPortraitPuppetV4MotionState())
  const nod = planPortraitPuppetV4Motion({
    mood: 'idle',
    nowMs: 500,
    performanceCue: {
      id: 'nod',
      durationMs: 1_200,
      stageDirection: '(点头)',
      gestureName: 'nod',
    },
    performanceElapsedMs: 180,
  }, createPortraitPuppetV4MotionState())
  const idle = planPortraitPuppetV4Motion(
    { mood: 'idle', nowMs: 500 },
    createPortraitPuppetV4MotionState(),
  )

  assert.ok(Math.abs(wave.armSway ?? 0) > Math.abs(idle.armSway ?? 0) + 0.35)
  assert.ok((nod.headTilt ?? 0) > (idle.headTilt ?? 0) + 0.15)
})

test('v4 motion applies Live2D shy accent as a lowered gaze and extra lid drop', () => {
  const shy = planPortraitPuppetV4Motion({
    mood: 'idle',
    nowMs: 400,
    performanceCue: {
      id: 'shy',
      durationMs: 1_200,
      stageDirection: '(害羞)',
      accentStyle: 'shy',
    },
    performanceElapsedMs: 210,
  }, createPortraitPuppetV4MotionState())
  const idle = planPortraitPuppetV4Motion(
    { mood: 'idle', nowMs: 400 },
    createPortraitPuppetV4MotionState(),
  )

  assert.ok((shy.headTilt ?? 0) > (idle.headTilt ?? 0))
  assert.ok((shy.eyeY ?? 0) > 0)
  assert.ok((shy.blinkLeft ?? 0) > (idle.blinkLeft ?? 0))
})
