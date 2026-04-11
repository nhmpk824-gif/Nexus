import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  createVoiceSessionState,
  getVoiceStateForSessionPhase,
  reduceVoiceSessionState,
} from '../src/features/voice/sessionMachine.ts'

test('starts a new listening session with cleared transcript state', () => {
  const state = reduceVoiceSessionState(createVoiceSessionState(), {
    type: 'session_started',
    sessionId: 'voice-session-1',
    transport: 'local_sherpa',
  })

  assert.deepEqual(state, {
    sessionId: 'voice-session-1',
    transport: 'local_sherpa',
    phase: 'listening',
    transcript: '',
    partialTranscript: '',
    endpointTranscript: '',
    finalTranscript: '',
    speechDetected: false,
    endpointDetected: false,
    closeReason: null,
    errorCode: null,
    errorMessage: null,
  })
})

test('promotes partial and endpoint transcript updates into the active session snapshot', () => {
  const started = reduceVoiceSessionState(createVoiceSessionState(), {
    type: 'session_started',
    sessionId: 'voice-session-2',
    transport: 'local_sherpa',
  })

  const withPartial = reduceVoiceSessionState(started, {
    type: 'stt_partial',
    text: '帮我看看今天',
  })

  const withEndpoint = reduceVoiceSessionState(withPartial, {
    type: 'stt_endpoint',
    text: '帮我看看今天天气',
  })

  assert.equal(withPartial.phase, 'listening')
  assert.equal(withPartial.transcript, '帮我看看今天')
  assert.equal(withPartial.partialTranscript, '帮我看看今天')
  assert.equal(withPartial.speechDetected, true)

  assert.equal(withEndpoint.phase, 'listening')
  assert.equal(withEndpoint.transcript, '帮我看看今天天气')
  assert.equal(withEndpoint.endpointTranscript, '帮我看看今天天气')
  assert.equal(withEndpoint.endpointDetected, true)
})

test('moves into transcribing and speaking phases with stable voice-state mapping', () => {
  const started = reduceVoiceSessionState(createVoiceSessionState(), {
    type: 'session_started',
    sessionId: 'voice-session-3',
    transport: 'browser',
  })

  const finalizing = reduceVoiceSessionState(started, {
    type: 'stt_finalizing',
    text: '深圳今天天气怎么样',
  })

  const finalized = reduceVoiceSessionState(finalizing, {
    type: 'stt_final',
    text: '深圳今天天气怎么样',
  })

  const speaking = reduceVoiceSessionState(finalized, {
    type: 'tts_started',
    text: '深圳今天阴天，可能有小雨。',
  })

  assert.equal(finalizing.phase, 'transcribing')
  assert.equal(getVoiceStateForSessionPhase(finalizing.phase), 'processing')
  assert.equal(finalized.finalTranscript, '深圳今天天气怎么样')
  assert.equal(speaking.phase, 'speaking')
  assert.equal(getVoiceStateForSessionPhase(speaking.phase), 'speaking')
  assert.equal(speaking.transcript, '深圳今天阴天，可能有小雨。')
})

test('records interruption, completion, and no-speech failures as terminal idle states', () => {
  const started = reduceVoiceSessionState(createVoiceSessionState(), {
    type: 'session_started',
    sessionId: 'voice-session-4',
    transport: 'remote_api',
  })

  const interrupted = reduceVoiceSessionState(started, {
    type: 'tts_interrupted',
  })

  const completed = reduceVoiceSessionState(started, {
    type: 'session_completed',
  })

  const failed = reduceVoiceSessionState(started, {
    type: 'error',
    code: 'no-speech',
    message: '没有检测到说话',
  })

  assert.equal(interrupted.phase, 'idle')
  assert.equal(interrupted.closeReason, 'interrupted')
  assert.equal(completed.phase, 'idle')
  assert.equal(completed.closeReason, 'completed')
  assert.equal(failed.phase, 'idle')
  assert.equal(failed.closeReason, 'no_speech')
  assert.equal(failed.errorMessage, '没有检测到说话')
})
