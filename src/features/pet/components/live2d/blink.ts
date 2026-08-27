// Live2D wrapper around the shared eyelid timeline. Interval spacing stays
// randomized here; v4 uses a hashed interval so tests stay deterministic.

import {
  BLINK_DOUBLE_CHANCE,
  RIGHT_BLINK_LAG_MS,
  blinkHash,
  createBlinkLane,
  stepBlinkLane,
  type BlinkLane,
} from '../../blink.ts'

export type BlinkState = BlinkLane

export function createBlinkState(lagMs = 0): BlinkState {
  const now = performance.now()
  return createBlinkLane(now, now + 1_500 + Math.random() * 2_400 + lagMs)
}

export function createBlinkPair() {
  const left = createBlinkState()
  return {
    left,
    right: createBlinkLane(left.phaseStartedAt, left.nextBlinkAt + RIGHT_BLINK_LAG_MS),
  }
}

export function updateBlink(blinkState: BlinkState, now: number) {
  return stepBlinkLane(
    blinkState,
    now,
    (nowMs) => nowMs + 2_400 + Math.random() * 3_600,
    {
      doubleChance: BLINK_DOUBLE_CHANCE,
      random: () => blinkHash(Math.floor(now / 250) * 7 + 40),
    },
  )
}
