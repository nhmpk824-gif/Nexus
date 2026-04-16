/**
 * Phase 2-0 scaffold — policy-layer types for the voice session machine.
 *
 * The roadmap calls for four explicit policies that currently live as
 * scattered if/else in continuousVoice, wakewordIntegration, and
 * speechOutputRuntime. This module declares the shape; Phase 2-1 fills in
 * the decision functions; Phase 2-2 rewires callers to go through them.
 *
 * Keeping these as plain type + enum declarations (no runtime) means Phase
 * 2-0 has zero side effects on the build — the scaffold is purely the
 * vocabulary the reducer will speak when it lands.
 */

// ── ListenRecoveryPolicy ───────────────────────────────────────────────────
// What do we do after a listening session ends without a delivered transcript?
//   - return_to_wakeword:  close mic, wait for next wake word
//   - return_to_idle:      fully disable voice; user must reopen
//   - continue_listening:  reopen recognition immediately (continuous mode)
export const ListenRecoveryDecisions = {
  RETURN_TO_WAKEWORD: 'return_to_wakeword',
  RETURN_TO_IDLE: 'return_to_idle',
  CONTINUE_LISTENING: 'continue_listening',
} as const
export type ListenRecoveryDecision =
  (typeof ListenRecoveryDecisions)[keyof typeof ListenRecoveryDecisions]

// ── BargeInPolicy ──────────────────────────────────────────────────────────
// How aggressively do we allow the user to interrupt TTS playback?
//   - disabled:         no barge-in at all (TTS always runs to completion)
//   - vad_only:         VAD speech activity during TTS → abort
//   - wakeword_or_vad:  either a wake word hit OR VAD speech → abort
export const BargeInModes = {
  DISABLED: 'disabled',
  VAD_ONLY: 'vad_only',
  WAKEWORD_OR_VAD: 'wakeword_or_vad',
} as const
export type BargeInMode = (typeof BargeInModes)[keyof typeof BargeInModes]

// ── EchoGuardPolicy ────────────────────────────────────────────────────────
// How hard do we try to suppress echo/feedback between speaker and mic?
//   - off:     no guard (AEC is still on but no extra dead time)
//   - soft:    brief cooldown after TTS ends
//   - strict:  full cooldown + dynamic threshold based on TTS level
export const EchoGuardLevels = {
  OFF: 'off',
  SOFT: 'soft',
  STRICT: 'strict',
} as const
export type EchoGuardLevel = (typeof EchoGuardLevels)[keyof typeof EchoGuardLevels]

// ── FailureRecoveryPolicy ──────────────────────────────────────────────────
// What do we do when STT or TTS fails in a recoverable way?
//   - retry_same_provider:  exponential backoff, same provider
//   - fallback_provider:    switch to the next provider in the chain
//   - enter_cooldown:       give the session a breathing room, then retry
//   - hard_fail:            surface to the user, require manual restart
export const FailureRecoveryDecisions = {
  RETRY_SAME_PROVIDER: 'retry_same_provider',
  FALLBACK_PROVIDER: 'fallback_provider',
  ENTER_COOLDOWN: 'enter_cooldown',
  HARD_FAIL: 'hard_fail',
} as const
export type FailureRecoveryDecision =
  (typeof FailureRecoveryDecisions)[keyof typeof FailureRecoveryDecisions]

// ── Aggregate policy set ───────────────────────────────────────────────────
// The reducer will read this as a bag of configured policies rather than
// splitting them across four function signatures. Phase 2-1 decides where
// the values come from (probably AppSettings + defaults).

export type VoiceSessionPolicies = {
  listenRecovery: ListenRecoveryDecision
  bargeIn: BargeInMode
  echoGuard: EchoGuardLevel
  failureRecovery: FailureRecoveryDecision
}

export const DEFAULT_VOICE_SESSION_POLICIES: VoiceSessionPolicies = {
  listenRecovery: ListenRecoveryDecisions.CONTINUE_LISTENING,
  bargeIn: BargeInModes.VAD_ONLY,
  echoGuard: EchoGuardLevels.SOFT,
  failureRecovery: FailureRecoveryDecisions.RETRY_SAME_PROVIDER,
}
