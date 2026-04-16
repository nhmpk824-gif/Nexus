/**
 * Phase 2-0 scaffold barrel — re-exports the session machine surface so
 * consumers can pull from `features/voice/session` rather than individual
 * files. Keeping the barrel small makes Phase 2-1 refactors cheap: the
 * shape callers depend on stays stable even if the file layout changes.
 */

export {
  createInitialVoiceSessionState,
  reduceVoiceSession,
} from './voiceSessionMachine.ts'
export {
  INTERNAL_TO_UI_PHASE,
  toUiPhase,
  VoiceSessionStates,
  type VoiceSessionEffect,
  type VoiceSessionEvent,
  type VoiceSessionMachineState,
  type VoiceSessionReducerResult,
  type VoiceSessionStateName,
} from './voiceSessionTypes.ts'
export {
  BargeInModes,
  DEFAULT_VOICE_SESSION_POLICIES,
  EchoGuardLevels,
  FailureRecoveryDecisions,
  ListenRecoveryDecisions,
  type BargeInMode,
  type EchoGuardLevel,
  type FailureRecoveryDecision,
  type ListenRecoveryDecision,
  type VoiceSessionPolicies,
} from './voiceSessionPolicies.ts'
export {
  VoiceSessionTimerKinds,
  type VoiceSessionTimerDescriptor,
  type VoiceSessionTimerKind,
} from './voiceSessionTimers.ts'
