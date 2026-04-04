import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'

import { loadSettings, SETTINGS_STORAGE_KEY } from '../src/lib/storage.ts'

const LOCAL_FIRST_TTS_MIGRATION_STORAGE_KEY = 'nexus:migration:tts-local-first-v1'

type LocalStorageMock = {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
  clear: () => void
}

function createLocalStorageMock(initial: Record<string, string> = {}): LocalStorageMock {
  const store = new Map(Object.entries(initial))

  return {
    getItem(key) {
      return store.has(key) ? store.get(key) ?? null : null
    },
    setItem(key, value) {
      store.set(key, String(value))
    },
    removeItem(key) {
      store.delete(key)
    },
    clear() {
      store.clear()
    },
  }
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'window', {
    value: {
      localStorage: createLocalStorageMock(),
    },
    configurable: true,
    writable: true,
  })
})

test('promotes legacy volcengine primary tts to cosyvoice and preserves the old volcengine profile', () => {
  const localStorage = createLocalStorageMock({
    [SETTINGS_STORAGE_KEY]: JSON.stringify({
      speechOutputProviderId: 'volcengine-tts',
      speechOutputApiBaseUrl: 'https://openspeech.bytedance.com/api',
      speechOutputApiKey: '1000:test-token',
      speechOutputModel: 'volcano_tts',
      speechOutputVoice: 'BV001_streaming',
      speechOutputInstructions: 'legacy volcengine instructions',
    }),
  })

  Object.defineProperty(globalThis, 'window', {
    value: { localStorage },
    configurable: true,
    writable: true,
  })

  const settings = loadSettings()

  assert.equal(settings.speechOutputProviderId, 'cosyvoice-tts')
  assert.equal(settings.speechOutputApiBaseUrl, 'http://127.0.0.1:50000')
  assert.equal(settings.speechOutputModel, 'sft')
  assert.equal(settings.speechOutputVoice, '中文女')
  assert.equal(settings.speechOutputApiKey, '')
  assert.equal(
    settings.speechOutputProviderProfiles['volcengine-tts']?.apiBaseUrl,
    'https://openspeech.bytedance.com/api',
  )
  assert.equal(
    settings.speechOutputProviderProfiles['volcengine-tts']?.apiKey,
    '1000:test-token',
  )
  assert.equal(
    settings.speechOutputProviderProfiles['volcengine-tts']?.instructions,
    'legacy volcengine instructions',
  )
  assert.ok(localStorage.getItem(LOCAL_FIRST_TTS_MIGRATION_STORAGE_KEY))
})

test('honors a later explicit volcengine selection after the one-time local-first migration marker exists', () => {
  const localStorage = createLocalStorageMock({
    [LOCAL_FIRST_TTS_MIGRATION_STORAGE_KEY]: JSON.stringify({
      appliedAt: '2026-03-30T00:00:00.000Z',
    }),
    [SETTINGS_STORAGE_KEY]: JSON.stringify({
      speechOutputProviderId: 'volcengine-tts',
      speechOutputApiBaseUrl: 'https://openspeech.bytedance.com/api',
      speechOutputApiKey: '1000:test-token',
      speechOutputModel: 'volcano_tts',
      speechOutputVoice: 'BV001_streaming',
    }),
  })

  Object.defineProperty(globalThis, 'window', {
    value: { localStorage },
    configurable: true,
    writable: true,
  })

  const settings = loadSettings()

  assert.equal(settings.speechOutputProviderId, 'volcengine-tts')
  assert.equal(settings.speechOutputApiBaseUrl, 'https://openspeech.bytedance.com/api')
  assert.equal(settings.speechOutputApiKey, '1000:test-token')
  assert.equal(settings.speechOutputModel, 'volcano_tts')
  assert.equal(settings.speechOutputVoice, 'BV001_streaming')
})

test('preserves an explicit local whisper speech input selection on load', () => {
  const localStorage = createLocalStorageMock({
    [SETTINGS_STORAGE_KEY]: JSON.stringify({
      speechInputProviderId: 'local-whisper',
      speechInputApiBaseUrl: 'http://should-not-stick.example.com',
      speechInputApiKey: 'legacy-secret',
      speechInputModel: 'Xenova/whisper-small',
    }),
  })

  Object.defineProperty(globalThis, 'window', {
    value: { localStorage },
    configurable: true,
    writable: true,
  })

  const settings = loadSettings()

  assert.equal(settings.speechInputProviderId, 'local-whisper')
  assert.equal(settings.speechInputApiBaseUrl, '')
  assert.equal(settings.speechInputApiKey, '')
  assert.equal(settings.speechInputModel, 'Xenova/whisper-small')
})
