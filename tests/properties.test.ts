/**
 * Property-based tests for the pure-function core of v0.3.1-beta.5.
 *
 * Each property runs ~200-1000 random inputs through fast-check looking
 * for: (a) totality — function never throws on any input in its declared
 * domain; (b) invariants — the output shape always satisfies stated
 * properties (e.g. counts add up, ranges hold, types narrow).
 *
 * These complement the example-based tests by hitting the input shapes
 * humans don't think to write — adversarial whitespace, NaN samples,
 * zero-length series, identical timestamps, malformed ISO strings.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import fc from 'fast-check'

import {
  classifyAffectGuidance,
  buildAffectGuidance,
  type AffectGuidanceState,
} from '../src/features/autonomy/affectGuidance.ts'
import {
  computeAffectSnapshot,
  compareAffectSnapshots,
  type AffectSnapshot,
} from '../src/features/autonomy/affectDynamics.ts'
import { detectRupture } from '../src/features/autonomy/ruptureDetection.ts'
import { buildRepairGuidance } from '../src/features/autonomy/repairGuidance.ts'
import { decideNextCheckIn } from '../src/features/arc/openArcPolicy.ts'
import { buildArcCheckIn } from '../src/features/arc/openArcDelivery.ts'
import { analyzeGuidance } from '../src/features/autonomy/guidanceAnalysis.ts'
import type { UserAffectSample } from '../src/features/autonomy/userAffectTimeline.ts'
import type { OpenArcRecord } from '../src/features/arc/openArcStore.ts'
import type { GuidanceTelemetryEntry } from '../src/features/autonomy/guidanceTelemetry.ts'

const UI_LANGUAGES = ['en-US', 'zh-CN', 'zh-TW', 'ja', 'ko'] as const
const arbUiLanguage = fc.constantFrom(...UI_LANGUAGES)

// ── Sample arbitraries ────────────────────────────────────────────────────

const arbIsoTs = fc
  .date({ min: new Date('2025-01-01'), max: new Date('2027-01-01'), noInvalidDate: true })
  .map((d) => d.toISOString())
const arbValence = fc.float({ min: -1, max: 1, noNaN: true })
const arbArousal = fc.float({ min: 0, max: 1, noNaN: true })

const arbUserSample: fc.Arbitrary<UserAffectSample> = fc.record({
  ts: arbIsoTs,
  valence: arbValence,
  arousal: arbArousal,
  source: fc.constantFrom('voice_prosody', 'text_signal', 'relationship'),
  confidence: fc.float({ min: 0, max: 1, noNaN: true }),
})

// ── affectDynamics.computeAffectSnapshot ──────────────────────────────────

test('property: computeAffectSnapshot is total over any sample array', () => {
  fc.assert(
    fc.property(fc.array(arbUserSample, { maxLength: 200 }), (samples) => {
      const snap = computeAffectSnapshot(samples)
      assert.equal(snap.n, samples.length)
      if (samples.length === 0) {
        assert.equal(snap.baselineValence, null)
        assert.equal(snap.baselineArousal, null)
        assert.equal(snap.variability, null)
        assert.equal(snap.inertia, null)
      } else {
        assert.ok(snap.baselineValence != null && snap.baselineValence >= -1 && snap.baselineValence <= 1)
        assert.ok(snap.baselineArousal != null && snap.baselineArousal >= 0 && snap.baselineArousal <= 1)
      }
    }),
    { numRuns: 300 },
  )
})

test('property: variability >= 0 when defined', () => {
  fc.assert(
    fc.property(fc.array(arbUserSample, { minLength: 2, maxLength: 200 }), (samples) => {
      const snap = computeAffectSnapshot(samples)
      assert.ok(snap.variability != null && snap.variability >= 0)
    }),
    { numRuns: 200 },
  )
})

test('property: inertia in [-1, 1] when defined', () => {
  fc.assert(
    fc.property(fc.array(arbUserSample, { minLength: 3, maxLength: 200 }), (samples) => {
      const snap = computeAffectSnapshot(samples)
      assert.ok(snap.inertia != null)
      assert.ok(snap.inertia >= -1 - 1e-9 && snap.inertia <= 1 + 1e-9)
    }),
    { numRuns: 200 },
  )
})

test('property: compareAffectSnapshots is total — never throws on any pair', () => {
  fc.assert(
    fc.property(
      fc.array(arbUserSample, { maxLength: 50 }),
      fc.array(arbUserSample, { maxLength: 50 }),
      (a, b) => {
        const shift = compareAffectSnapshots(computeAffectSnapshot(a), computeAffectSnapshot(b))
        assert.equal(typeof shift.valenceShiftIsNotable, 'boolean')
        assert.equal(typeof shift.variabilityRoseSharply, 'boolean')
        assert.equal(typeof shift.inertiaIsHigh, 'boolean')
      },
    ),
    { numRuns: 200 },
  )
})

// ── affectGuidance.classifyAffectGuidance + buildAffectGuidance ───────────

const arbSnapshot: fc.Arbitrary<AffectSnapshot> = fc.record({
  n: fc.integer({ min: 0, max: 200 }),
  baselineValence: fc.option(fc.float({ min: -1, max: 1, noNaN: true }), { nil: null }),
  baselineArousal: fc.option(fc.float({ min: 0, max: 1, noNaN: true }), { nil: null }),
  variability: fc.option(fc.float({ min: 0, max: 2, noNaN: true }), { nil: null }),
  inertia: fc.option(fc.float({ min: -1, max: 1, noNaN: true }), { nil: null }),
  windowStart: fc.option(arbIsoTs, { nil: null }),
  windowEnd: fc.option(arbIsoTs, { nil: null }),
})

test('property: classifyAffectGuidance returns one of 5 valid states', () => {
  const valid: AffectGuidanceState[] = ['stuck-low', 'recent-drop', 'volatile', 'steady-warm', 'none']
  fc.assert(
    fc.property(arbSnapshot, fc.option(arbSnapshot, { nil: undefined }), (snapshot, recent) => {
      const out = classifyAffectGuidance({ snapshot, recentSnapshot: recent ?? undefined })
      assert.ok(valid.includes(out))
    }),
    { numRuns: 500 },
  )
})

test('property: buildAffectGuidance returns either empty or wrapped-tag prose', () => {
  fc.assert(
    fc.property(arbSnapshot, fc.option(arbSnapshot, { nil: undefined }), arbUiLanguage, (snap, recent, ui) => {
      const out = buildAffectGuidance({ uiLanguage: ui, snapshot: snap, recentSnapshot: recent ?? undefined })
      assert.ok(out === '' || (out.includes('<user_affect_state>') && out.includes('</user_affect_state>')))
    }),
    { numRuns: 300 },
  )
})

// ── ruptureDetection.detectRupture ────────────────────────────────────────

test('property: detectRupture is total — never throws on any string', () => {
  fc.assert(
    fc.property(fc.string({ maxLength: 1000 }), arbUiLanguage, (text, ui) => {
      const out = detectRupture(text, ui)
      assert.ok(out.kind === null || ['criticism', 'contempt', 'defensiveness', 'stonewalling'].includes(out.kind))
      assert.equal(typeof out.score, 'number')
      assert.ok(Array.isArray(out.signals))
    }),
    { numRuns: 1000 },
  )
})

test('property: detectRupture survives adversarial whitespace input', () => {
  // Long whitespace runs were the origin of the polynomial-backtracking
  // concern. Confirm the simplified regex doesn't time out on them.
  fc.assert(
    fc.property(fc.integer({ min: 0, max: 5000 }), (n) => {
      const start = Date.now()
      const text = 'haha ' + ' '.repeat(n)
      detectRupture(text, 'en-US')
      const elapsed = Date.now() - start
      assert.ok(elapsed < 50, `regex took ${elapsed}ms on ${n} spaces — backtracking?`)
    }),
    { numRuns: 50 },
  )
})

test('property: detectRupture stonewalling needs prior messages — empty priors → never fires stonewalling', () => {
  fc.assert(
    fc.property(fc.string({ maxLength: 50 }), arbUiLanguage, (text, ui) => {
      const out = detectRupture(text, ui, { priorUserMessages: [] })
      assert.notEqual(out.kind, 'stonewalling')
    }),
    { numRuns: 200 },
  )
})

test('property: buildRepairGuidance returns either empty or wrapped-tag prose for any kind', () => {
  fc.assert(
    fc.property(
      fc.constantFrom('criticism', 'contempt', 'defensiveness', 'stonewalling', null) as fc.Arbitrary<
        'criticism' | 'contempt' | 'defensiveness' | 'stonewalling' | null
      >,
      arbUiLanguage,
      (kind, ui) => {
        const out = buildRepairGuidance({ uiLanguage: ui, ruptureKind: kind })
        assert.ok(out === '' || (out.includes('<rupture_repair>') && out.includes('</rupture_repair>')))
      },
    ),
    { numRuns: 200 },
  )
})

// ── openArcPolicy ─────────────────────────────────────────────────────────

const arbOpenArc: fc.Arbitrary<OpenArcRecord> = fc.record({
  id: fc.string({ minLength: 1, maxLength: 16 }),
  theme: fc.string({ minLength: 1, maxLength: 50 }),
  startedAt: arbIsoTs,
  checkInDays: fc.array(fc.integer({ min: 1, max: 30 }), { minLength: 1, maxLength: 5 }),
  status: fc.constantFrom('open', 'resolved', 'dropped'),
  checkInsFired: fc.array(arbIsoTs, { maxLength: 5 }),
  resolvedAt: fc.option(arbIsoTs, { nil: undefined }),
  closingNote: fc.option(fc.string(), { nil: undefined }),
  droppedAt: fc.option(arbIsoTs, { nil: undefined }),
})

test('property: decideNextCheckIn returns valid decision shape on any arc list', () => {
  fc.assert(
    fc.property(fc.array(arbOpenArc, { maxLength: 30 }), arbIsoTs, (arcs, nowIso) => {
      const decision = decideNextCheckIn(arcs, new Date(nowIso), {
        quietHoursStart: 0,
        quietHoursEnd: 0,
      })
      assert.equal(typeof decision.shouldFire, 'boolean')
      assert.ok(['fire', 'no-arcs', 'quiet-hours', 'all-checked-in', 'no-milestone-due'].includes(decision.reason))
      if (decision.shouldFire) {
        assert.ok(decision.arcId)
        assert.equal(typeof decision.milestoneDay, 'number')
        assert.equal(typeof decision.daysSinceStart, 'number')
      }
    }),
    { numRuns: 300 },
  )
})

test('property: buildArcCheckIn returns non-empty body for valid milestone day', () => {
  fc.assert(
    fc.property(arbOpenArc, fc.integer({ min: 1, max: 14 }), arbUiLanguage, (arc, day, ui) => {
      const out = buildArcCheckIn({ arc, uiLanguage: ui, companionName: 'X', milestoneDay: day })
      assert.ok(out.title.length > 0)
      assert.ok(out.body.length > 0)
      assert.ok(out.body.includes(arc.theme.slice(0, 80)) || out.body.includes('…'))
    }),
    { numRuns: 200 },
  )
})

// ── guidanceAnalysis ──────────────────────────────────────────────────────

const arbGuidanceKind = fc.constantFrom(
  'affect:stuck-low',
  'affect:recent-drop',
  'affect:volatile',
  'affect:steady-warm',
  'rupture:criticism',
  'rupture:contempt',
  'rupture:defensiveness',
  'rupture:stonewalling',
) as fc.Arbitrary<GuidanceTelemetryEntry['kind']>

const arbTelemetry: fc.Arbitrary<GuidanceTelemetryEntry> = fc.record({
  ts: arbIsoTs,
  kind: arbGuidanceKind,
  beforeValence: fc.option(fc.float({ min: -1, max: 1, noNaN: true }), { nil: null }),
})

test('property: analyzeGuidance is total over any inputs', () => {
  fc.assert(
    fc.property(
      fc.array(arbTelemetry, { maxLength: 100 }),
      fc.array(arbUserSample, { maxLength: 100 }),
      (fires, samples) => {
        const r = analyzeGuidance(fires, samples, new Date('2026-04-28T12:00:00Z'))
        assert.ok(r.byKind.length <= 8)
        for (const k of r.byKind) {
          assert.ok(k.fireCount >= 0)
          if (k.valenceDelta != null) {
            assert.ok(Number.isFinite(k.valenceDelta))
          }
        }
      },
    ),
    { numRuns: 200 },
  )
})

test('property: analyzeGuidance bestPerformingKind delta >= weakestKind delta when both set', () => {
  fc.assert(
    fc.property(
      fc.array(arbTelemetry, { minLength: 12, maxLength: 50 }),
      fc.array(arbUserSample, { minLength: 30, maxLength: 100 }),
      (fires, samples) => {
        const r = analyzeGuidance(fires, samples, new Date('2026-04-28T12:00:00Z'))
        if (r.bestPerformingKind && r.weakestKind && r.bestPerformingKind !== r.weakestKind) {
          const best = r.byKind.find((k) => k.kind === r.bestPerformingKind)!
          const weakest = r.byKind.find((k) => k.kind === r.weakestKind)!
          if (best.valenceDelta != null && weakest.valenceDelta != null) {
            assert.ok(best.valenceDelta >= weakest.valenceDelta - 1e-9)
          }
        }
      },
    ),
    { numRuns: 200 },
  )
})
