import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  BLINK_CLOSE_MS,
  BLINK_DOUBLE_GAP_MS,
  BLINK_HOLD_MS,
  BLINK_OPEN_MS,
  createBlinkLane,
  stepBlinkLane,
} from '../src/features/pet/blink.ts'
import { updateBlink } from '../src/features/pet/components/live2d/blink.ts'

function nextAt(nowMs: number) {
  return nowMs + 3_000
}

test('blink state machine closes, holds shut, then reopens', () => {
  const lane = createBlinkLane(0, 100)

  assert.equal(stepBlinkLane(lane, 99, nextAt), 1)
  assert.equal(lane.phase, 'idle')

  assert.equal(stepBlinkLane(lane, 100, nextAt), 1)
  assert.equal(lane.phase, 'closing')

  assert.equal(stepBlinkLane(lane, 100 + BLINK_CLOSE_MS, nextAt), 0)
  assert.equal(lane.phase, 'holding')

  assert.equal(stepBlinkLane(lane, 100 + BLINK_CLOSE_MS + BLINK_HOLD_MS - 1, nextAt), 0)
  assert.equal(lane.phase, 'holding')

  const opening = stepBlinkLane(lane, 100 + BLINK_CLOSE_MS + BLINK_HOLD_MS, nextAt)
  assert.equal(opening, 0)
  assert.equal(lane.phase, 'opening')

  const midOpen = stepBlinkLane(
    lane,
    100 + BLINK_CLOSE_MS + BLINK_HOLD_MS + BLINK_OPEN_MS / 2,
    nextAt,
  )
  assert.ok(midOpen > 0.4)
  assert.ok(midOpen < 0.6)

  const opened = stepBlinkLane(
    lane,
    100 + BLINK_CLOSE_MS + BLINK_HOLD_MS + BLINK_OPEN_MS,
    nextAt,
  )
  assert.equal(opened, 1)
  assert.equal(lane.phase, 'idle')
  assert.equal(lane.nextBlinkAt, 100 + BLINK_CLOSE_MS + BLINK_HOLD_MS + BLINK_OPEN_MS + 3_000)
})

test('Live2D blink wrapper shares the closed-hold timeline', () => {
  const blink = createBlinkLane(0, 50)
  updateBlink(blink, 50)
  updateBlink(blink, 50 + BLINK_CLOSE_MS)
  assert.equal(blink.phase, 'holding')
  assert.equal(updateBlink(blink, 50 + BLINK_CLOSE_MS + 8), 0)
})

test('blink state machine can chain a second blink after the first reopens', () => {
  const lane = createBlinkLane(0, 10)
  const closeAt = 10 + BLINK_CLOSE_MS
  const openAt = closeAt + BLINK_HOLD_MS + BLINK_OPEN_MS
  stepBlinkLane(lane, 10, nextAt, { doubleChance: 1, random: () => 0 })
  stepBlinkLane(lane, closeAt, nextAt, { doubleChance: 1, random: () => 0 })
  stepBlinkLane(lane, closeAt + BLINK_HOLD_MS, nextAt, { doubleChance: 1, random: () => 0 })
  stepBlinkLane(lane, openAt, nextAt, { doubleChance: 1, random: () => 0 })
  assert.equal(lane.phase, 'idle')
  assert.equal(lane.chainRemaining, 1)
  assert.equal(lane.nextBlinkAt, openAt + BLINK_DOUBLE_GAP_MS)

  const second = stepBlinkLane(lane, openAt + BLINK_DOUBLE_GAP_MS, nextAt)
  assert.equal(lane.phase, 'closing')
  assert.equal(second, 1)
})
