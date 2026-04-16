/**
 * Phase 2-0 scaffold — timer descriptor types for the voice session machine.
 *
 * The current subsystem has at least four concurrent timers (no-speech
 * timeout, restart backoff, echo guard cooldown, wake retry) living as raw
 * setTimeout handles sprinkled across continuousVoice, useVoice, and
 * wakewordIntegration. Phase 2-1 will collapse those into a single
 * timer-id → handle map owned by the session runtime, with the reducer
 * emitting `schedule_timer` / `cancel_timer` effects.
 *
 * This file just declares the vocabulary.
 */

export const VoiceSessionTimerKinds = {
  /** "No speech detected" watchdog during listening. */
  NO_SPEECH: 'no_speech',
  /** Auto-restart retry when guards were busy at the last attempt. */
  RESTART_RETRY: 'restart_retry',
  /** Echo-guard cooldown after TTS ends. */
  ECHO_COOLDOWN: 'echo_cooldown',
  /** Wake-word engine re-arm after an error. */
  WAKE_REARM: 'wake_rearm',
  /** Provider-level cooldown after a failure. */
  PROVIDER_COOLDOWN: 'provider_cooldown',
} as const

export type VoiceSessionTimerKind =
  (typeof VoiceSessionTimerKinds)[keyof typeof VoiceSessionTimerKinds]

export type VoiceSessionTimerDescriptor = {
  kind: VoiceSessionTimerKind
  /** Absolute ms value (monotonic clock) when the timer should fire. */
  firesAt: number
  /** Opaque payload the reducer needs when the timer fires. */
  payload?: Record<string, unknown>
}
