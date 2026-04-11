/**
 * Idle animation sequence for the desktop pet.
 * Drives periodic fidget/blink/shift animations when the pet is idle.
 */

import type { PetPerformanceCue, PetPerformancePlan } from './performance'
import { createId } from '../../lib/storage'

// ── Sequence definition ──

export type IdleAction = 'rest' | 'blink' | 'fidget' | 'shift' | 'stretch'

/**
 * Cycle through this sequence. Each tick ≈ 3 seconds.
 * Total loop = 15 ticks ≈ 45 seconds.
 */
const IDLE_SEQUENCE: IdleAction[] = [
  'rest',    // 0
  'rest',    // 3s
  'rest',    // 6s
  'blink',   // 9s — quick blink
  'rest',    // 12s
  'rest',    // 15s
  'fidget',  // 18s — small motion
  'rest',    // 21s
  'rest',    // 24s
  'rest',    // 27s
  'blink',   // 30s
  'rest',    // 33s
  'shift',   // 36s — slight head turn
  'rest',    // 39s
  'stretch', // 42s — small stretch
]

export const IDLE_TICK_MS = 3_000

/**
 * Map idle actions to performance cues.
 */
function actionToCue(action: IdleAction): PetPerformancePlan | null {
  switch (action) {
    case 'blink':
      return {
        expressionSlot: 'idle',
        durationMs: 600,
        stageDirection: '(眨眼)',
      }
    case 'fidget':
      return {
        expressionSlot: 'idle',
        motionSlot: 'happy',
        durationMs: 1000,
        stageDirection: '(小动作)',
      }
    case 'shift':
      return {
        expressionSlot: 'idle',
        motionSlot: 'thinking',
        durationMs: 1200,
        stageDirection: '(转头)',
      }
    case 'stretch':
      return {
        expressionSlot: 'idle',
        motionSlot: 'sleepy',
        durationMs: 1400,
        stageDirection: '(伸懒腰)',
      }
    case 'rest':
    default:
      return null
  }
}

// ── Controller ──

export type IdleSequenceController = {
  start: () => void
  stop: () => void
  isRunning: () => boolean
}

export function createIdleSequenceController(
  onCue: (cue: PetPerformanceCue) => void,
): IdleSequenceController {
  let tickIndex = 0
  let timerId: number | null = null
  let running = false

  function tick() {
    const action = IDLE_SEQUENCE[tickIndex % IDLE_SEQUENCE.length]
    tickIndex += 1

    const plan = actionToCue(action)
    if (plan) {
      onCue({
        ...plan,
        id: createId('idle'),
      })
    }
  }

  return {
    start() {
      if (running) return
      running = true
      tickIndex = 0
      timerId = window.setInterval(tick, IDLE_TICK_MS)
    },
    stop() {
      if (!running) return
      running = false
      if (timerId !== null) {
        window.clearInterval(timerId)
        timerId = null
      }
    },
    isRunning() {
      return running
    },
  }
}
