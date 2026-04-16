import assert from 'node:assert/strict'
import { test } from 'node:test'

import type { VoiceBusEvent } from '../src/features/voice/busEvents.ts'
import {
  createInitialVoiceSessionState,
  reduceVoiceSession,
} from '../src/features/voice/session/voiceSessionMachine.ts'
import {
  toBusPhase,
  type VoicePhase,
  type VoiceSessionEffect,
  type VoiceSessionMachineState,
} from '../src/features/voice/session/voiceSessionTypes.ts'
import { VoiceReasonCodes } from '../src/features/voice/voiceReasonCodes.ts'
import { VoiceTransitionLog } from '../src/features/voice/voiceTransitionLog.ts'

// Legacy aliases so the harness reads like the Phase 1-3 original — the
// Phase 2-2 swap renamed the reducer underneath but preserved the shape.
type BusEffect = VoiceSessionEffect

// ── End-to-end harness ─────────────────────────────────────────────────────
//
// Phase 1-3 sequence tests: drive the real VoiceBus + VoiceTransitionLog
// through realistic event streams as if they were being emitted by the
// wakeword / VAD / STT / TTS subsystems. Pure in-memory — no React, no IPC,
// no DOM — so these run under the plain node test runner.
//
// Why this file exists: the bus reducer covers individual events in isolation
// (voice-core/voice-session tests), but nothing was exercising the happy path
// end-to-end or the tricky multi-event sequences like barge-in and no-speech
// timeout. These tests pin the observable behavior so Phase 2's state machine
// collapse has a regression baseline.

// Drives the reducer with an event and mirrors the transition into the log,
// the way useVoice does in production (busEmit → record({ prevPhase,
// nextPhase })). We intentionally skip the VoiceBus class and talk to the
// reducer directly: (a) it's the real unit under test, (b) the class pulls in
// non-type imports that break the node strip-types test runner.
function createHarness() {
  let state: VoiceSessionMachineState = createInitialVoiceSessionState({ now: () => 1_000_000 })
  let clock = 1_000_000
  const log = new VoiceTransitionLog({ now: () => clock })
  const allEffects: BusEffect[] = []
  const transitions: Array<{ event: VoiceBusEvent; prev: VoicePhase; next: VoicePhase }> = []

  function emit(event: VoiceBusEvent): BusEffect[] {
    const prevPhase = toBusPhase(state.state)
    const result = reduceVoiceSession(state, event)
    state = result.state
    const nextPhase = toBusPhase(state.state)
    log.record({ event, prevPhase, nextPhase })
    transitions.push({ event, prev: prevPhase, next: nextPhase })
    allEffects.push(...result.effects)
    return result.effects
  }

  return {
    log,
    get state() { return state },
    get phase() { return toBusPhase(state.state) },
    get lastError() { return state.lastError },
    get effects() { return allEffects },
    get transitions() { return transitions },
    advance(deltaMs: number) { clock += deltaMs },
    emit,
  }
}

function countEffect(effects: readonly BusEffect[], type: BusEffect['type']): number {
  return effects.filter((effect) => effect.type === type).length
}

// ── Happy path ─────────────────────────────────────────────────────────────

test('happy path: wake → VAD → STT → TTS drives bus through listening/transcribing/speaking/idle', () => {
  const h = createHarness()
  const sessionId = 'seq-happy-1'

  // Wake armed (observability-only, phase stays idle).
  h.emit({
    type: 'wake:armed',
    wakeWord: '小助手',
    reason: VoiceReasonCodes.WAKE_ARMED,
  })
  assert.equal(h.phase, 'idle')

  // Wake detected (still observability-only — bus waits for session:started).
  h.advance(50)
  h.emit({
    type: 'wake:detected',
    wakeWord: '小助手',
    keyword: '小助手',
    sessionId,
    reason: VoiceReasonCodes.WAKE_MATCH,
  })
  assert.equal(h.phase, 'idle', 'wake:detected alone does not advance bus phase (Phase 1)')

  // Session starts → listening.
  h.advance(30)
  h.emit({
    type: 'session:started',
    sessionId,
    transport: 'browser_speech',
    reason: VoiceReasonCodes.SESSION_STARTED,
  })
  assert.equal(h.phase, 'listening')

  // Mic acquired (observability).
  h.advance(40)
  h.emit({
    type: 'mic:acquired',
    purpose: 'voice_input',
    sessionId,
    reason: VoiceReasonCodes.MIC_ACQUIRED,
  })
  assert.equal(h.phase, 'listening')

  // User speaks.
  h.advance(200)
  h.emit({ type: 'vad:speech_start', sessionId, reason: VoiceReasonCodes.VAD_SPEECH_START })
  h.advance(1800)
  h.emit({ type: 'vad:speech_end', sessionId, reason: VoiceReasonCodes.VAD_SPEECH_END })

  // STT finalizing → transcribing.
  h.emit({ type: 'stt:finalizing', sessionId })
  assert.equal(h.phase, 'transcribing', 'stt:finalizing advances to transcribing')

  h.advance(400)
  h.emit({
    type: 'stt:final',
    text: '帮我查天气',
    sessionId,
    reason: VoiceReasonCodes.STT_SUCCESS,
  })
  assert.equal(h.phase, 'transcribing')

  // TTS starts → speaking.
  h.advance(600)
  h.emit({
    type: 'tts:started',
    text: '今天晴,气温 22 度。',
    speechGeneration: 1,
    sessionId,
  })
  assert.equal(h.phase, 'speaking')

  // First audio chunk — request-level latency marker.
  h.emit({
    type: 'tts:first_audio',
    speechGeneration: 1,
    sessionId,
  })

  // TTS completes with continuous resume on.
  h.advance(2_400)
  h.emit({
    type: 'tts:completed',
    speechGeneration: 1,
    shouldResumeContinuousVoice: true,
    sessionId,
    reason: VoiceReasonCodes.SESSION_COMPLETED,
  })
  assert.equal(h.phase, 'idle', 'tts:completed returns bus to idle')

  // tts:completed with resume=true schedules exactly one restart_voice effect.
  assert.equal(
    countEffect(h.effects, 'restart_voice'),
    1,
    'continuous resume schedules one restart_voice effect',
  )

  // Session completed wraps things up.
  h.emit({
    type: 'session:completed',
    sessionId,
    reason: VoiceReasonCodes.SESSION_COMPLETED,
  })
  assert.equal(h.phase, 'idle')
})

// ── No-speech timeout ──────────────────────────────────────────────────────

test('no-speech timeout: VAD fires without user speech, bus returns cleanly to idle', () => {
  const h = createHarness()
  const sessionId = 'seq-nospeech-1'

  h.emit({
    type: 'wake:detected',
    wakeWord: '小助手',
    keyword: '小助手',
    sessionId,
    reason: VoiceReasonCodes.WAKE_MATCH,
  })
  h.emit({
    type: 'session:started',
    sessionId,
    transport: 'browser_vad',
    reason: VoiceReasonCodes.SESSION_STARTED,
  })
  assert.equal(h.phase, 'listening')

  // 8s go by with no speech — VAD gives up.
  h.advance(8_000)
  h.emit({
    type: 'vad:no_speech_timeout',
    waitedMs: 8_000,
    sessionId,
    reason: VoiceReasonCodes.VAD_NO_SPEECH_TIMEOUT,
    meta: { source: 'browser_vad' },
  })
  // Observability-only — bus stays in listening until someone aborts the session.
  assert.equal(h.phase, 'listening')

  // The caller (continuousVoice) aborts the session on timeout.
  h.emit({
    type: 'session:aborted',
    sessionId,
    abortReason: 'no_speech_timeout',
    reason: VoiceReasonCodes.SESSION_ABORTED,
  })
  assert.equal(h.phase, 'idle', 'session:aborted from listening returns to idle')

  // No restart_voice effect — no-speech path must NOT auto-loop
  // (that would trap the user in a silent listening cycle).
  assert.equal(
    countEffect(h.effects, 'restart_voice'),
    0,
    'no_speech_timeout path schedules no restart_voice',
  )

  // Mood resets to idle when the session aborts.
  const moodIdle = h.effects.some(
    (effect) => effect.type === 'set_mood' && effect.mood === 'idle',
  )
  assert.equal(moodIdle, true, 'aborted session sets mood back to idle')

  // Transition log has the timeout captured with its meta for diagnostics.
  const entries = h.log.getEntries()
  const timeoutEntry = entries.find((e) => e.eventType === 'vad:no_speech_timeout')
  assert.ok(timeoutEntry, 'timeout recorded in transition log')
  assert.equal(timeoutEntry.reason, VoiceReasonCodes.VAD_NO_SPEECH_TIMEOUT)
  assert.deepEqual(timeoutEntry.meta, { source: 'browser_vad' })
})

// ── Barge-in during TTS ────────────────────────────────────────────────────

test('barge-in: VAD speech_start during speaking phase aborts TTS and returns to idle', () => {
  const h = createHarness()
  const sessionId = 'seq-bargein-1'

  // Prime: session → TTS started → speaking.
  h.emit({
    type: 'session:started',
    sessionId,
    transport: 'paraformer',
    reason: VoiceReasonCodes.SESSION_STARTED,
  })
  h.emit({
    type: 'stt:final',
    text: '讲个笑话',
    sessionId,
    reason: VoiceReasonCodes.STT_SUCCESS,
  })
  h.advance(500)
  h.emit({
    type: 'tts:started',
    text: '从前有个程序员...',
    speechGeneration: 1,
    sessionId,
  })
  h.emit({ type: 'tts:first_audio', speechGeneration: 1, sessionId })
  assert.equal(h.phase, 'speaking')

  // Mid-playback: user starts talking. The speech interrupt monitor in
  // continuousVoice.ts observes this and emits tts:interrupted.
  h.advance(800)
  h.emit({
    type: 'vad:speech_start',
    sessionId,
    reason: VoiceReasonCodes.VAD_SPEECH_START,
  })
  // vad:speech_start itself is observability-only — bus stays in speaking.
  assert.equal(h.phase, 'speaking', 'raw VAD event does not abort TTS — caller must emit tts:interrupted')

  h.emit({
    type: 'tts:interrupted',
    speechGeneration: 1,
    sessionId,
  })
  assert.equal(h.phase, 'idle', 'tts:interrupted drops bus to idle')

  // Barge-in must not auto-schedule a restart through the bus — the caller
  // decides via voice:restart_requested or continuous-voice policy. This
  // assertion pins that contract so future reducer changes can't silently
  // start looping TTS on every barge-in.
  assert.equal(
    countEffect(h.effects, 'restart_voice'),
    0,
    'tts:interrupted itself schedules no restart_voice',
  )

  // Now the caller explicitly requests a restart to resume the conversation.
  h.emit({
    type: 'voice:restart_requested',
    restartReason: 'barge_in_resume',
    force: false,
    delayMs: 60,
    sessionId,
  })
  assert.equal(
    countEffect(h.effects, 'restart_voice'),
    1,
    'explicit restart request schedules exactly one restart_voice',
  )
})

// ── Wake-word misfire ─────────────────────────────────────────────────────

test('wake misfire: wake:detected followed by debounce stays in idle, no session started', () => {
  const h = createHarness()

  h.emit({
    type: 'wake:armed',
    wakeWord: '小助手',
    reason: VoiceReasonCodes.WAKE_ARMED,
  })
  assert.equal(h.phase, 'idle')

  // A detection fires (echo off speaker, or ambient false positive).
  h.emit({
    type: 'wake:detected',
    wakeWord: '小助手',
    keyword: '小助手',
    sessionId: 'seq-misfire-1',
    reason: VoiceReasonCodes.WAKE_MATCH,
  })
  // Bus stays idle — wake:detected does not advance phase (only session:started does).
  assert.equal(h.phase, 'idle')

  // Debounce logic immediately rejects it (e.g. within cooldown window).
  h.emit({
    type: 'wake:debounced',
    wakeWord: '小助手',
    keyword: '小助手',
    sessionId: 'seq-misfire-1',
    reason: VoiceReasonCodes.WAKE_DEBOUNCED,
  })
  assert.equal(h.phase, 'idle', 'debounced wake leaves bus in idle')

  // Then wake arms again for the next attempt.
  h.emit({
    type: 'wake:armed',
    wakeWord: '小助手',
    reason: VoiceReasonCodes.WAKE_ARMED,
  })
  assert.equal(h.phase, 'idle')

  // Zero session lifecycle effects were produced — a misfire must not cause
  // mood changes, status toasts, or restart scheduling.
  assert.equal(countEffect(h.effects, 'restart_voice'), 0)
  assert.equal(countEffect(h.effects, 'show_status'), 0)
  assert.equal(countEffect(h.effects, 'set_mood'), 0)

  // But the full sequence is still in the log for diagnostics.
  const eventTypes = h.log.getEntries().map((e) => e.eventType)
  assert.deepEqual(eventTypes, ['wake:armed', 'wake:detected', 'wake:debounced', 'wake:armed'])
})

// ── TTS error mid-stream ──────────────────────────────────────────────────

test('TTS error during speaking: bus returns to idle with error logged + conditional resume', () => {
  const h = createHarness()
  const sessionId = 'seq-ttserr-1'

  h.emit({
    type: 'session:started',
    sessionId,
    transport: 'paraformer',
    reason: VoiceReasonCodes.SESSION_STARTED,
  })
  h.emit({ type: 'stt:final', text: '帮我查天气', sessionId, reason: VoiceReasonCodes.STT_SUCCESS })
  h.emit({
    type: 'tts:started',
    text: '今天...',
    speechGeneration: 1,
    sessionId,
  })
  assert.equal(h.phase, 'speaking')

  // Provider blows up.
  h.emit({
    type: 'tts:error',
    message: 'fetch failed: ECONNRESET',
    speechGeneration: 1,
    shouldResumeContinuousVoice: true,
    sessionId,
    reason: VoiceReasonCodes.TTS_SEGMENT_NETWORK_ERROR,
  })
  assert.equal(h.phase, 'idle', 'tts:error unwinds to idle')
  assert.equal(h.lastError, 'fetch failed: ECONNRESET', 'lastError captured for UI status')

  // Exactly one restart_voice effect because shouldResumeContinuousVoice=true.
  assert.equal(
    countEffect(h.effects, 'restart_voice'),
    1,
    'tts:error with resume=true schedules one restart_voice',
  )

  // Error was logged with the provider message.
  const logEffects = h.effects.filter(
    (e): e is Extract<BusEffect, { type: 'log' }> => e.type === 'log',
  )
  const errorLog = logEffects.find((e) => e.level === 'error' && e.message.includes('TTS error'))
  assert.ok(errorLog, 'tts:error emits an error-level log effect')
  assert.match(errorLog.message, /ECONNRESET/)
})

test('TTS error without resume: bus idles but schedules no restart', () => {
  const h = createHarness()

  h.emit({ type: 'session:started', sessionId: 's', transport: 't', reason: VoiceReasonCodes.SESSION_STARTED })
  h.emit({ type: 'tts:started', text: 'x', speechGeneration: 1, sessionId: 's' })
  h.emit({
    type: 'tts:error',
    message: 'boom',
    speechGeneration: 1,
    shouldResumeContinuousVoice: false,
    sessionId: 's',
  })
  assert.equal(h.phase, 'idle')
  assert.equal(
    countEffect(h.effects, 'restart_voice'),
    0,
    'no restart scheduled when shouldResumeContinuousVoice=false',
  )
})

// ── Phase-change audit ────────────────────────────────────────────────────

test('bus phase transitions are monotonic within a happy-path session', () => {
  // Captures the exact ordered sequence of phase changes the happy path
  // produces. This pins the public state-machine contract so Phase 2's
  // reducer collapse can't accidentally drop or reorder a phase edge.
  const h = createHarness()
  const sessionId = 'seq-audit-1'

  h.emit({ type: 'session:started', sessionId, transport: 't', reason: VoiceReasonCodes.SESSION_STARTED })
  h.emit({ type: 'stt:finalizing', sessionId })
  h.emit({ type: 'stt:final', text: 'hi', sessionId, reason: VoiceReasonCodes.STT_SUCCESS })
  h.emit({ type: 'tts:started', text: 'hello', speechGeneration: 1, sessionId })
  h.emit({
    type: 'tts:completed',
    speechGeneration: 1,
    shouldResumeContinuousVoice: false,
    sessionId,
    reason: VoiceReasonCodes.SESSION_COMPLETED,
  })

  const phaseEdges = h.transitions
    .filter((t) => t.prev !== t.next)
    .map((t) => `${t.prev}→${t.next}`)

  assert.deepEqual(phaseEdges, [
    'idle→listening',       // session:started
    'listening→transcribing', // stt:finalizing
    'transcribing→speaking',  // tts:started
    'speaking→idle',          // tts:completed
  ])
})
