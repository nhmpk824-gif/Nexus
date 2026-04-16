import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  AutoRestartDecisionReasons,
  NO_SPEECH_RESTART_MAX_DELAY_MS,
  NO_SPEECH_RESTART_MIN_DELAY_MS,
  NO_SPEECH_RESTART_STEP_MS,
  RESTART_BUS_EFFECT_DELAY_MS,
  RESTART_DEFAULT_INITIAL_DELAY_MS,
  RESTART_RETRY_BACKOFF_DELAY_MS,
  RESTART_RETRY_LIMIT,
  RestartGuardBlockers,
  canInterruptSpeech,
  evaluateRestartGuards,
  getNoSpeechRestartDelay,
  getRestartDelay,
  shouldAutoRestart,
  shouldKeepContinuousSession,
} from '../src/features/voice/autoRestartPolicy.ts'
import type { AppSettings, VoiceState } from '../src/types/index.ts'

// Minimal settings stub — only the keys the policy module reads matter; the
// rest of AppSettings is irrelevant, so we cast through a pick.
type PolicySettings = Pick<
  AppSettings,
  | 'continuousVoiceModeEnabled'
  | 'voiceTriggerMode'
  | 'voiceInterruptionEnabled'
  | 'wakewordAlwaysOn'
>

function makeSettings(overrides: Partial<PolicySettings> = {}): PolicySettings {
  return {
    continuousVoiceModeEnabled: true,
    voiceTriggerMode: 'voice_activity',
    voiceInterruptionEnabled: true,
    wakewordAlwaysOn: false,
    ...overrides,
  }
}

// ── shouldAutoRestart ──────────────────────────────────────────────────────

test('shouldAutoRestart allows restart when active + continuous mode + not wake-word', () => {
  const decision = shouldAutoRestart({
    continuousActive: true,
    settings: makeSettings(),
  })
  assert.equal(decision.allowed, true)
  assert.equal(decision.reason, AutoRestartDecisionReasons.OK)
})

test('shouldAutoRestart blocks when session is inactive (checked first)', () => {
  const decision = shouldAutoRestart({
    continuousActive: false,
    // Disable continuous + wake_word to prove session_inactive wins over both.
    settings: makeSettings({ continuousVoiceModeEnabled: false, voiceTriggerMode: 'wake_word' }),
  })
  assert.equal(decision.allowed, false)
  assert.equal(decision.reason, AutoRestartDecisionReasons.SESSION_INACTIVE)
})

test('shouldAutoRestart blocks when continuous mode is disabled', () => {
  const decision = shouldAutoRestart({
    continuousActive: true,
    settings: makeSettings({ continuousVoiceModeEnabled: false }),
  })
  assert.equal(decision.allowed, false)
  assert.equal(decision.reason, AutoRestartDecisionReasons.CONTINUOUS_DISABLED)
})

test('shouldAutoRestart blocks in wake-word trigger mode', () => {
  const decision = shouldAutoRestart({
    continuousActive: true,
    settings: makeSettings({ voiceTriggerMode: 'wake_word' }),
  })
  assert.equal(decision.allowed, false)
  assert.equal(decision.reason, AutoRestartDecisionReasons.WAKE_WORD_MODE)
})

test('shouldAutoRestart blocks when wakewordAlwaysOn is set (KWS owns the mic)', () => {
  // Mutual exclusion: when always-on KWS is armed, continuous STT must not
  // auto-restart or the voiceState flip-flop tears down the KWS listener on
  // every cycle. KWS becomes the single wake path.
  const decision = shouldAutoRestart({
    continuousActive: true,
    settings: makeSettings({ wakewordAlwaysOn: true }),
  })
  assert.equal(decision.allowed, false)
  assert.equal(decision.reason, AutoRestartDecisionReasons.WAKEWORD_ALWAYS_ON)
})

// ── shouldKeepContinuousSession ────────────────────────────────────────────

test('shouldKeepContinuousSession is true when continuous + not wake-word', () => {
  assert.equal(shouldKeepContinuousSession({ settings: makeSettings() }), true)
})

test('shouldKeepContinuousSession is false when continuous disabled', () => {
  assert.equal(
    shouldKeepContinuousSession({ settings: makeSettings({ continuousVoiceModeEnabled: false }) }),
    false,
  )
})

test('shouldKeepContinuousSession is false in wake-word mode', () => {
  assert.equal(
    shouldKeepContinuousSession({ settings: makeSettings({ voiceTriggerMode: 'wake_word' }) }),
    false,
  )
})

test('shouldKeepContinuousSession is false when wakewordAlwaysOn is set', () => {
  assert.equal(
    shouldKeepContinuousSession({ settings: makeSettings({ wakewordAlwaysOn: true }) }),
    false,
  )
})

// ── canInterruptSpeech ─────────────────────────────────────────────────────

test('canInterruptSpeech mirrors the voiceInterruptionEnabled flag', () => {
  assert.equal(canInterruptSpeech(makeSettings({ voiceInterruptionEnabled: true })), true)
  assert.equal(canInterruptSpeech(makeSettings({ voiceInterruptionEnabled: false })), false)
})

// ── evaluateRestartGuards ──────────────────────────────────────────────────

function makeGuardInput(overrides: Partial<{
  hasActiveRecognition: boolean
  hasActiveVadSession: boolean
  chatBusy: boolean
  voiceState: VoiceState
}> = {}) {
  return {
    hasActiveRecognition: false,
    hasActiveVadSession: false,
    chatBusy: false,
    voiceState: 'idle' as VoiceState,
    ...overrides,
  }
}

test('evaluateRestartGuards returns ok when every gate is clear', () => {
  assert.deepEqual(evaluateRestartGuards(makeGuardInput()), { ok: true })
})

test('evaluateRestartGuards reports active recognition first (short-circuit order)', () => {
  // All blockers on at once — the check order (recognition → vad → busy →
  // processing → speaking) is load-bearing because continuousVoice.ts relied
  // on it for bit-for-bit retry behavior.
  const decision = evaluateRestartGuards(
    makeGuardInput({
      hasActiveRecognition: true,
      hasActiveVadSession: true,
      chatBusy: true,
      voiceState: 'speaking',
    }),
  )
  assert.deepEqual(decision, { ok: false, blocker: RestartGuardBlockers.ACTIVE_RECOGNITION })
})

test('evaluateRestartGuards reports active VAD session when recognition is clear', () => {
  const decision = evaluateRestartGuards(
    makeGuardInput({
      hasActiveVadSession: true,
      chatBusy: true,
      voiceState: 'processing',
    }),
  )
  assert.deepEqual(decision, { ok: false, blocker: RestartGuardBlockers.ACTIVE_VAD_SESSION })
})

test('evaluateRestartGuards reports chat busy next', () => {
  const decision = evaluateRestartGuards(
    makeGuardInput({ chatBusy: true, voiceState: 'processing' }),
  )
  assert.deepEqual(decision, { ok: false, blocker: RestartGuardBlockers.CHAT_BUSY })
})

test('evaluateRestartGuards reports voice processing state', () => {
  assert.deepEqual(
    evaluateRestartGuards(makeGuardInput({ voiceState: 'processing' })),
    { ok: false, blocker: RestartGuardBlockers.VOICE_PROCESSING },
  )
})

test('evaluateRestartGuards reports voice speaking state', () => {
  assert.deepEqual(
    evaluateRestartGuards(makeGuardInput({ voiceState: 'speaking' })),
    { ok: false, blocker: RestartGuardBlockers.VOICE_SPEAKING },
  )
})

test('evaluateRestartGuards treats listening voiceState as non-blocking', () => {
  // Only 'processing' and 'speaking' are meant to block — the scheduler relies
  // on 'listening' passing through (for example, when a wakeword run finishes
  // but the tail of the previous recognition is still winding down).
  assert.deepEqual(
    evaluateRestartGuards(makeGuardInput({ voiceState: 'listening' })),
    { ok: true },
  )
})

// ── Retry limit ────────────────────────────────────────────────────────────

test('RESTART_RETRY_LIMIT matches legacy MAX_RESTART_RETRIES (8)', () => {
  // This is the scheduler's give-up threshold. Changing it affects UX under
  // sustained busy/speaking conditions — the test pins the contract.
  assert.equal(RESTART_RETRY_LIMIT, 8)
})

// ── getNoSpeechRestartDelay ────────────────────────────────────────────────

test('getNoSpeechRestartDelay starts at the minimum for retry 0', () => {
  assert.equal(getNoSpeechRestartDelay(0), NO_SPEECH_RESTART_MIN_DELAY_MS)
})

test('getNoSpeechRestartDelay grows linearly by the step size', () => {
  assert.equal(
    getNoSpeechRestartDelay(1),
    NO_SPEECH_RESTART_MIN_DELAY_MS + NO_SPEECH_RESTART_STEP_MS,
  )
  assert.equal(
    getNoSpeechRestartDelay(3),
    NO_SPEECH_RESTART_MIN_DELAY_MS + 3 * NO_SPEECH_RESTART_STEP_MS,
  )
})

test('getNoSpeechRestartDelay clamps at the max regardless of retry count', () => {
  // Far past the ceiling: min=420, step=220, max=1680 → clamp kicks in around
  // retry 6. Retry 100 should still land exactly at max.
  assert.equal(getNoSpeechRestartDelay(100), NO_SPEECH_RESTART_MAX_DELAY_MS)
})

test('getNoSpeechRestartDelay matches legacy formula bit-for-bit', () => {
  // Pin the legacy Math.min(1680, 420 + count * 220) shape so future refactors
  // don't silently change the retry cadence.
  for (let retry = 0; retry < 10; retry++) {
    const expected = Math.min(1680, 420 + retry * 220)
    assert.equal(getNoSpeechRestartDelay(retry), expected, `retry=${retry}`)
  }
})

// ── getRestartDelay ────────────────────────────────────────────────────────

test('getRestartDelay initial uses caller-provided delay when supplied', () => {
  assert.equal(getRestartDelay('initial', { requested: 1_234 }), 1_234)
})

test('getRestartDelay initial falls back to default when no delay requested', () => {
  assert.equal(getRestartDelay('initial'), RESTART_DEFAULT_INITIAL_DELAY_MS)
})

test('getRestartDelay retry always uses the backoff delay (ignores caller)', () => {
  // The retry branch must ignore caller-provided delay — legacy scheduler
  // hard-coded 320ms for reschedules past a blocking guard, so we need the
  // same.
  assert.equal(
    getRestartDelay('retry', { requested: 9_999 }),
    RESTART_RETRY_BACKOFF_DELAY_MS,
  )
})

test('getRestartDelay bus_effect honors caller delay, falling back to tight default', () => {
  assert.equal(getRestartDelay('bus_effect'), RESTART_BUS_EFFECT_DELAY_MS)
  assert.equal(getRestartDelay('bus_effect', { requested: 200 }), 200)
})
