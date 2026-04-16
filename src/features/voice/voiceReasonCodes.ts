/**
 * Reason codes attached to voice bus events so the transition log can classify
 * what actually happened at each step. Phase 1-1 observability — these codes
 * are pure metadata; no runtime branches on them yet.
 */

export const VoiceReasonCodes = {
  // ── Wake word ────────────────────────────────────────────────────────────
  WAKE_ARMED: 'wake_armed',
  WAKE_MATCH: 'wake_match',
  WAKE_DEBOUNCED: 'wake_debounced',
  WAKE_SUSPENDED: 'wake_suspended',
  WAKE_COOLDOWN: 'wake_cooldown',
  WAKE_RETRY_SCHEDULED: 'wake_retry_scheduled',
  WAKE_UNAVAILABLE: 'wake_unavailable',
  WAKE_RUNTIME_ERROR: 'wake_runtime_error',

  // ── VAD / mic ────────────────────────────────────────────────────────────
  VAD_SPEECH_START: 'vad_speech_start',
  VAD_SPEECH_END: 'vad_speech_end',
  VAD_NO_SPEECH_TIMEOUT: 'vad_no_speech_timeout',
  MIC_ACQUIRED: 'mic_acquired',
  MIC_RELEASED: 'mic_released',
  MIC_PERMISSION_DENIED: 'mic_permission_denied',
  MIC_DEVICE_ERROR: 'mic_device_error',

  // ── STT ──────────────────────────────────────────────────────────────────
  STT_STARTED: 'stt_started',
  STT_SUCCESS: 'stt_success',
  STT_NO_SPEECH: 'stt_no_speech',
  STT_NETWORK_ERROR: 'stt_network_error',
  STT_PROVIDER_FAILOVER: 'stt_provider_failover',
  STT_ABORTED: 'stt_aborted',

  // ── TTS ──────────────────────────────────────────────────────────────────
  TTS_SEGMENT_QUEUED: 'tts_segment_queued',
  TTS_SEGMENT_STARTED: 'tts_segment_started',
  TTS_SEGMENT_FINISHED: 'tts_segment_finished',
  TTS_SEGMENT_NETWORK_ERROR: 'tts_segment_network_error',
  TTS_SENDER_GONE: 'tts_sender_gone',
  TTS_SESSION_MISSING: 'tts_session_missing',
  TTS_ABORTED: 'tts_aborted',
  TTS_PROVIDER_FAILOVER: 'tts_provider_failover',

  // ── Session / control ────────────────────────────────────────────────────
  SESSION_STARTED: 'session_started',
  SESSION_COMPLETED: 'session_completed',
  SESSION_ABORTED: 'session_aborted',
  RESUME_CONTINUOUS: 'resume_continuous',
  RESUME_BLOCKED_CHAT_BUSY: 'resume_blocked_chat_busy',
} as const

export type VoiceReasonCode = (typeof VoiceReasonCodes)[keyof typeof VoiceReasonCodes]
