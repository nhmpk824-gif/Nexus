import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  computeConsiderationCadence,
  resolveAutonomyV2Config,
  ticksBetweenConsiderations,
} from '../src/features/autonomy/v2/providerResolution.ts'
import type { AppSettings } from '../src/types/app.ts'

// Minimal AppSettings stub — only the fields the resolver reads.
// Cast through unknown because the full AppSettings is huge and
// irrelevant for these pure-function tests.
function makeSettings(overrides: Partial<Record<string, unknown>>): AppSettings {
  return {
    apiProviderId: 'anthropic',
    apiBaseUrl: 'https://api.anthropic.com',
    apiKey: 'sk-test',
    model: 'claude-sonnet-4-6',
    autonomyLevelV2: 'med',
    autonomyModelV2: '',
    autonomyPersonaStrictnessV2: 'med',
    ...overrides,
  } as unknown as AppSettings
}

test('resolveAutonomyV2Config: level=off → enabled=false', () => {
  const cfg = resolveAutonomyV2Config(makeSettings({ autonomyLevelV2: 'off' }))
  assert.equal(cfg.enabled, false)
})

test('resolveAutonomyV2Config: level≠off → enabled=true', () => {
  const cfg = resolveAutonomyV2Config(makeSettings({ autonomyLevelV2: 'high' }))
  assert.equal(cfg.enabled, true)
  assert.equal(cfg.level, 'high')
})

test('resolveAutonomyV2Config: empty autonomyModelV2 falls back to primary model', () => {
  const cfg = resolveAutonomyV2Config(makeSettings({
    model: 'claude-sonnet-4-6',
    autonomyModelV2: '',
  }))
  assert.equal(cfg.decisionConfig.model, 'claude-sonnet-4-6')
  assert.equal(cfg.decisionConfig.providerId, 'anthropic')
  assert.equal(cfg.decisionConfig.apiKey, 'sk-test')
})

test('resolveAutonomyV2Config: non-empty autonomyModelV2 overrides model only', () => {
  const cfg = resolveAutonomyV2Config(makeSettings({
    model: 'claude-sonnet-4-6',
    autonomyModelV2: 'claude-haiku-4-5',
  }))
  // Model overridden
  assert.equal(cfg.decisionConfig.model, 'claude-haiku-4-5')
  // Provider + credentials still primary
  assert.equal(cfg.decisionConfig.providerId, 'anthropic')
  assert.equal(cfg.decisionConfig.baseUrl, 'https://api.anthropic.com')
  assert.equal(cfg.decisionConfig.apiKey, 'sk-test')
})

test('resolveAutonomyV2Config: whitespace-only autonomyModelV2 treated as empty', () => {
  const cfg = resolveAutonomyV2Config(makeSettings({
    model: 'main',
    autonomyModelV2: '   ',
  }))
  assert.equal(cfg.decisionConfig.model, 'main')
})

test('resolveAutonomyV2Config: strictness=med leaves judgeConfig undefined', () => {
  const cfg = resolveAutonomyV2Config(makeSettings({ autonomyPersonaStrictnessV2: 'med' }))
  assert.equal(cfg.judgeConfig, undefined)
})

test('resolveAutonomyV2Config: strictness=strict populates judgeConfig from decision', () => {
  const cfg = resolveAutonomyV2Config(makeSettings({ autonomyPersonaStrictnessV2: 'strict' }))
  assert.ok(cfg.judgeConfig)
  assert.deepEqual(cfg.judgeConfig, cfg.decisionConfig)
})

test('resolveAutonomyV2Config: strictness=loose leaves judgeConfig undefined', () => {
  const cfg = resolveAutonomyV2Config(makeSettings({ autonomyPersonaStrictnessV2: 'loose' }))
  assert.equal(cfg.judgeConfig, undefined)
  assert.equal(cfg.strictness, 'loose')
})

// ── ticksBetweenConsiderations ──────────────────────────────────────────

test('ticksBetweenConsiderations: off → +Infinity', () => {
  assert.equal(ticksBetweenConsiderations('off'), Number.POSITIVE_INFINITY)
})

test('ticksBetweenConsiderations: low > med > high', () => {
  const low = ticksBetweenConsiderations('low')
  const med = ticksBetweenConsiderations('med')
  const high = ticksBetweenConsiderations('high')
  assert.ok(low > med, `low (${low}) should be > med (${med})`)
  assert.ok(med > high, `med (${med}) should be > high (${high})`)
})

test('ticksBetweenConsiderations: all tiers return finite positive integers', () => {
  for (const tier of ['low', 'med', 'high'] as const) {
    const n = ticksBetweenConsiderations(tier)
    assert.ok(Number.isFinite(n))
    assert.ok(n > 0)
    assert.ok(Number.isInteger(n))
  }
})

// ── computeConsiderationCadence ─────────────────────────────────────────

const neutralSignals = {
  phase: 'awake' as const,
  energy: 0.45,
  curiosity: 0.45,
  idleSeconds: 0,
  relationshipScore: 50,
}

test('computeConsiderationCadence: neutral signals ≈ base cadence', () => {
  assert.equal(computeConsiderationCadence('med', neutralSignals), 8)
  assert.equal(computeConsiderationCadence('high', neutralSignals), 3)
  assert.equal(computeConsiderationCadence('low', neutralSignals), 20)
})

test('computeConsiderationCadence: level=off stays +Infinity regardless of signals', () => {
  const n = computeConsiderationCadence('off', {
    ...neutralSignals,
    phase: 'awake',
    energy: 1,
    curiosity: 1,
  })
  assert.equal(n, Number.POSITIVE_INFINITY)
})

test('computeConsiderationCadence: sleeping/dreaming stretches cadence toward ceiling', () => {
  const sleeping = computeConsiderationCadence('med', { ...neutralSignals, phase: 'sleeping' })
  const dreaming = computeConsiderationCadence('med', { ...neutralSignals, phase: 'dreaming' })
  assert.ok(sleeping > 8, `sleeping cadence (${sleeping}) should exceed base 8`)
  assert.ok(dreaming > 8, `dreaming cadence (${dreaming}) should exceed base 8`)
  // Ceiling clamp = 3*base = 24
  assert.ok(sleeping <= 24)
})

test('computeConsiderationCadence: high arousal + engaged user shortens cadence', () => {
  const engaged = computeConsiderationCadence('med', {
    ...neutralSignals,
    energy: 0.9,
    curiosity: 0.9,
    relationshipScore: 100,
  })
  assert.ok(engaged < 8, `engaged cadence (${engaged}) should be below base 8`)
  // Floor clamp = 2
  assert.ok(engaged >= 2)
})

test('computeConsiderationCadence: never drops below floor of 2 even at extremes', () => {
  const extreme = computeConsiderationCadence('high', {
    ...neutralSignals,
    energy: 1,
    curiosity: 1,
    relationshipScore: 100,
  })
  assert.ok(extreme >= 2, `floor violated: ${extreme}`)
})

test('computeConsiderationCadence: long idle stretches cadence but stays bounded', () => {
  const idle = computeConsiderationCadence('med', {
    ...neutralSignals,
    idleSeconds: 900, // 15 min
  })
  assert.ok(idle > 8, `idle cadence (${idle}) should exceed base 8`)
  assert.ok(idle <= 24, `idle cadence (${idle}) should honor 3×base ceiling`)
})
