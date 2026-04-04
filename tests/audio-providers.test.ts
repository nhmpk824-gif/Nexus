import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  getSpeechOutputAdjustmentSupport,
  getSpeechOutputProviderPreset,
  isCoquiSpeechOutputProvider,
  isPiperSpeechOutputProvider,
  normalizeSpeechOutputApiBaseUrl,
  USER_VISIBLE_SPEECH_INPUT_PROVIDER_PRESETS,
} from '../src/lib/audioProviders.ts'

test('exposes local whisper in the visible speech input provider list', () => {
  assert.equal(
    USER_VISIBLE_SPEECH_INPUT_PROVIDER_PRESETS.some((provider) => provider.id === 'local-whisper'),
    true,
  )
  assert.equal(
    USER_VISIBLE_SPEECH_INPUT_PROVIDER_PRESETS.some((provider) => provider.id === 'browser'),
    false,
  )
})

test('exposes the Piper and Coqui local CLI presets', () => {
  const piper = getSpeechOutputProviderPreset('piper-tts')
  const coqui = getSpeechOutputProviderPreset('coqui-tts')

  assert.equal(piper.label, 'Piper 本地 TTS')
  assert.equal(coqui.label, 'Coqui 本地 TTS')
  assert.equal(piper.baseUrl, '')
  assert.equal(coqui.baseUrl, '')
})

test('identifies Piper and Coqui speech output providers', () => {
  assert.equal(isPiperSpeechOutputProvider('piper-tts'), true)
  assert.equal(isPiperSpeechOutputProvider('coqui-tts'), false)
  assert.equal(isCoquiSpeechOutputProvider('coqui-tts'), true)
  assert.equal(isCoquiSpeechOutputProvider('openai-tts'), false)
})

test('disables fine-grained tuning for local CLI speech output providers', () => {
  assert.deepEqual(getSpeechOutputAdjustmentSupport('piper-tts'), {
    rate: false,
    pitch: false,
    volume: false,
    note: '当前是本地 CLI 合成链路，语速、语调和音量仍由各自模型参数控制，Nexus 里暂时还没有把这些细粒度调节直通进去。',
  })

  assert.deepEqual(getSpeechOutputAdjustmentSupport('coqui-tts'), {
    rate: false,
    pitch: false,
    volume: false,
    note: '当前是本地 CLI 合成链路，语速、语调和音量仍由各自模型参数控制，Nexus 里暂时还没有把这些细粒度调节直通进去。',
  })
})

test('keeps non-CosyVoice base URLs unchanged', () => {
  assert.equal(
    normalizeSpeechOutputApiBaseUrl('openai-tts', ' https://api.openai.com/v1/ '),
    'https://api.openai.com/v1',
  )
})

test('keeps local CLI command paths as trimmed plain strings', () => {
  assert.equal(
    normalizeSpeechOutputApiBaseUrl('piper-tts', ' C:\\tools\\piper\\piper.exe '),
    'C:\\tools\\piper\\piper.exe',
  )
  assert.equal(
    normalizeSpeechOutputApiBaseUrl('coqui-tts', ' tts '),
    'tts',
  )
})

test('normalizes CosyVoice localhost to the IPv4 loopback address', () => {
  assert.equal(
    normalizeSpeechOutputApiBaseUrl('cosyvoice-tts', 'http://localhost:50000/'),
    'http://127.0.0.1:50000',
  )
})

test('normalizes CosyVoice IPv6 loopback to the IPv4 loopback address', () => {
  assert.equal(
    normalizeSpeechOutputApiBaseUrl('cosyvoice-tts', 'http://[::1]:50000/'),
    'http://127.0.0.1:50000',
  )
})
