import assert from 'node:assert/strict'
import { beforeEach, describe, test } from 'node:test'

import {
  MAX_EMOTION_BOOST,
  _internals,
  clearPrimingBuffer,
  computeEmotionResonance,
  detectRegulatoryMode,
  projectToVA,
  recordPrimingCentroid,
} from '../src/features/memory/emotionResonance.ts'

import type { EmotionState } from '../src/features/autonomy/emotionModel.ts'

const calm: EmotionState = { energy: 0.5, warmth: 0.5, curiosity: 0.4, concern: 0.15 }
const joyful: EmotionState = { energy: 0.85, warmth: 0.9, curiosity: 0.7, concern: 0.1 }
const distressed: EmotionState = { energy: 0.3, warmth: 0.25, curiosity: 0.2, concern: 0.85 }
const melancholy: EmotionState = { energy: 0.2, warmth: 0.35, curiosity: 0.25, concern: 0.7 }

describe('projectToVA', () => {
  test('maps the 4D emotion to 2D VA with valence = warmth − concern', () => {
    const va = projectToVA(joyful)
    assert.ok(Math.abs(va.valence - 0.8) < 1e-9)
    assert.ok(Math.abs(va.arousal - 0.775) < 1e-9)
  })

  test('distressed emotion has negative valence', () => {
    const va = projectToVA(distressed)
    assert.ok(va.valence < 0)
  })

  test('calm emotion lands near the neutral point', () => {
    const va = projectToVA(calm)
    assert.ok(Math.abs(va.valence - 0.35) < 0.01)
    assert.ok(Math.abs(va.arousal - 0.45) < 0.01)
  })
})

describe('resonance / salience / intensity', () => {
  const { resonance, salience, intensity } = _internals

  test('resonance of identical points is 1', () => {
    const p = projectToVA(joyful)
    assert.ok(Math.abs(resonance(p, p) - 1) < 1e-9)
  })

  test('resonance decreases with distance', () => {
    const hi = projectToVA(joyful)
    const lo = projectToVA(distressed)
    assert.ok(resonance(hi, lo) < resonance(hi, projectToVA(calm)))
  })

  test('salience of neutral point is 0', () => {
    assert.equal(salience({ valence: 0, arousal: 0.5 }), 0)
  })

  test('salience grows with emotional charge', () => {
    assert.ok(salience(projectToVA(joyful)) > salience(projectToVA(calm)))
    assert.ok(salience(projectToVA(distressed)) > salience(projectToVA(calm)))
  })

  test('intensity of neutral state is 0', () => {
    assert.equal(intensity({ valence: 0, arousal: 0.5 }), 0)
  })

  test('intensity grows with strong emotion', () => {
    assert.ok(intensity(projectToVA(joyful)) > intensity(projectToVA(calm)))
  })
})

describe('detectRegulatoryMode', () => {
  test('defaults to reinforce with no cues', () => {
    assert.equal(detectRegulatoryMode(calm, 'hello'), 'reinforce')
    assert.equal(detectRegulatoryMode(joyful, '今天真棒'), 'reinforce')
  })

  test('detects empathy from Chinese cue + concern', () => {
    const state: EmotionState = { ...distressed, concern: 0.75 }
    assert.equal(detectRegulatoryMode(state, '陪陪我好吗'), 'empathy')
  })

  test('detects empathy from English cue + concern', () => {
    const state: EmotionState = { ...distressed, concern: 0.75 }
    assert.equal(detectRegulatoryMode(state, 'I need you to listen to me'), 'empathy')
  })

  test('empathy cue without elevated concern stays reinforce', () => {
    assert.equal(detectRegulatoryMode(calm, '陪陪我'), 'reinforce')
  })

  test('detects repair from Chinese "不想提了" cue', () => {
    assert.equal(detectRegulatoryMode(distressed, '算了 换个话题'), 'repair')
  })

  test('detects repair from English "change topic" cue', () => {
    assert.equal(detectRegulatoryMode(distressed, 'can we move on'), 'repair')
  })

  test('falls back to repair on sustained severe distress', () => {
    const severe: EmotionState = { energy: 0.25, warmth: 0.2, curiosity: 0.2, concern: 0.9 }
    assert.equal(detectRegulatoryMode(severe, 'just some text'), 'repair')
  })

  test('handles undefined message gracefully', () => {
    assert.equal(detectRegulatoryMode(calm, undefined), 'reinforce')
  })
})

describe('computeEmotionResonance', () => {
  beforeEach(() => clearPrimingBuffer())

  test('returns 0 when the current emotion is neutral (intensity gate)', () => {
    const boost = computeEmotionResonance({
      currentEmotion: { energy: 0.5, warmth: 0.5, curiosity: 0.4, concern: 0.15 },
      memorySnapshot: joyful,
      mode: 'reinforce',
    })
    // Calm state is close to neutral — boost should be near zero.
    assert.ok(boost < 0.02, `expected < 0.02, got ${boost}`)
  })

  test('returns 0 when memory has neither snapshot nor valence', () => {
    const boost = computeEmotionResonance({
      currentEmotion: joyful,
      mode: 'reinforce',
    })
    assert.equal(boost, 0)
  })

  test('reinforce: matching joyful memory gets higher boost than distressed', () => {
    const matchBoost = computeEmotionResonance({
      currentEmotion: joyful,
      memorySnapshot: joyful,
      mode: 'reinforce',
    })
    const contrastBoost = computeEmotionResonance({
      currentEmotion: joyful,
      memorySnapshot: distressed,
      mode: 'reinforce',
    })
    assert.ok(matchBoost > contrastBoost,
      `expected matchBoost (${matchBoost}) > contrastBoost (${contrastBoost})`)
  })

  test('repair: positive distant memory beats matching-distressed memory', () => {
    const uplifting = computeEmotionResonance({
      currentEmotion: distressed,
      memorySnapshot: joyful,
      mode: 'repair',
    })
    const matching = computeEmotionResonance({
      currentEmotion: distressed,
      memorySnapshot: melancholy,
      mode: 'repair',
    })
    assert.ok(uplifting > matching,
      `repair should favor joyful memories (got uplifting=${uplifting}, matching=${matching})`)
  })

  test('empathy: matching distressed memory beats uplifting memory', () => {
    const witnessed = computeEmotionResonance({
      currentEmotion: distressed,
      memorySnapshot: melancholy,
      mode: 'empathy',
    })
    const distracting = computeEmotionResonance({
      currentEmotion: distressed,
      memorySnapshot: joyful,
      mode: 'empathy',
    })
    assert.ok(witnessed > distracting,
      `empathy should favor matching emotional tone (got witnessed=${witnessed}, distracting=${distracting})`)
  })

  test('boost never exceeds MAX_EMOTION_BOOST', () => {
    for (const mode of ['reinforce', 'empathy', 'repair'] as const) {
      const boost = computeEmotionResonance({
        currentEmotion: joyful,
        memorySnapshot: joyful,
        mode,
      })
      assert.ok(boost <= MAX_EMOTION_BOOST,
        `boost ${boost} exceeded cap ${MAX_EMOTION_BOOST} in ${mode} mode`)
    }
  })

  test('boost is always non-negative', () => {
    for (const mode of ['reinforce', 'empathy', 'repair'] as const) {
      for (const mem of [joyful, distressed, calm, melancholy]) {
        const boost = computeEmotionResonance({
          currentEmotion: distressed,
          memorySnapshot: mem,
          mode,
        })
        assert.ok(boost >= 0, `negative boost ${boost} in ${mode} for mem ${JSON.stringify(mem)}`)
      }
    }
  })

  test('valence fallback: positive valence gets non-zero boost when snapshot missing', () => {
    const boost = computeEmotionResonance({
      currentEmotion: joyful,
      memoryValence: 'positive',
      mode: 'reinforce',
    })
    assert.ok(boost > 0, `expected positive boost from valence fallback, got ${boost}`)
  })

  test('valence fallback: neutral valence produces low boost', () => {
    const positiveBoost = computeEmotionResonance({
      currentEmotion: joyful,
      memoryValence: 'positive',
      mode: 'reinforce',
    })
    const neutralBoost = computeEmotionResonance({
      currentEmotion: joyful,
      memoryValence: 'neutral',
      mode: 'reinforce',
    })
    assert.ok(positiveBoost > neutralBoost)
  })
})

describe('priming coherence', () => {
  beforeEach(() => clearPrimingBuffer())

  test('empty buffer produces no centroid', () => {
    assert.equal(_internals.primingCentroid(), null)
  })

  test('records up to 3 entries and drops the oldest', () => {
    recordPrimingCentroid({ valence: 1, arousal: 1 })
    recordPrimingCentroid({ valence: 0.5, arousal: 0.5 })
    recordPrimingCentroid({ valence: 0, arousal: 0 })
    recordPrimingCentroid({ valence: -1, arousal: 0 })

    assert.equal(_internals.primingBuffer.length, 3)
    // Oldest (1, 1) should have been evicted.
    assert.ok(!_internals.primingBuffer.some((p) => p.valence === 1 && p.arousal === 1))
  })

  test('priming boosts memories near the recent centroid', () => {
    // Establish a joyful priming centroid.
    recordPrimingCentroid(projectToVA(joyful))
    recordPrimingCentroid(projectToVA(joyful))

    const nearCentroid = computeEmotionResonance({
      currentEmotion: joyful,
      memorySnapshot: joyful,
      mode: 'reinforce',
    })

    clearPrimingBuffer()
    const withoutPriming = computeEmotionResonance({
      currentEmotion: joyful,
      memorySnapshot: joyful,
      mode: 'reinforce',
    })

    assert.ok(nearCentroid >= withoutPriming,
      `priming should not lower the boost (near=${nearCentroid}, none=${withoutPriming})`)
  })

  test('clearPrimingBuffer empties the ring', () => {
    recordPrimingCentroid({ valence: 0.5, arousal: 0.5 })
    clearPrimingBuffer()
    assert.equal(_internals.primingBuffer.length, 0)
  })
})
