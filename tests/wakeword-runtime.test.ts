import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  createInitialWakewordRuntimeState,
  getWakewordRetryDelayMs,
  shouldIgnoreWakewordTrigger,
} from '../src/features/hearing/wakewordRuntime.ts'

test('wakeword runtime starts from a disabled idle snapshot', () => {
  const state = createInitialWakewordRuntimeState()

  assert.equal(state.phase, 'disabled')
  assert.equal(state.enabled, false)
  assert.equal(state.active, false)
  assert.equal(state.retryCount, 0)
  assert.equal(state.wakeWord, '')
})

test('wakeword retry delay grows exponentially and caps at the configured max', () => {
  assert.equal(getWakewordRetryDelayMs(0, 500, 4_000), 500)
  assert.equal(getWakewordRetryDelayMs(1, 500, 4_000), 1_000)
  assert.equal(getWakewordRetryDelayMs(2, 500, 4_000), 2_000)
  assert.equal(getWakewordRetryDelayMs(5, 500, 4_000), 4_000)
})

test('wakeword trigger dedupe ignores hits that arrive inside the cooldown window', () => {
  assert.equal(shouldIgnoreWakewordTrigger({
    lastTriggeredAtMs: 1_000,
    nowMs: 1_600,
    cooldownMs: 800,
  }), true)

  assert.equal(shouldIgnoreWakewordTrigger({
    lastTriggeredAtMs: 1_000,
    nowMs: 1_900,
    cooldownMs: 800,
  }), false)
})
