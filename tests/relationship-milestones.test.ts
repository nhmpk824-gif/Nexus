import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import {
  type RelationshipLevel,
  type RelationshipState,
  createDefaultRelationshipState,
  detectLevelTransition,
  formatAbsenceContext,
  formatMilestoneForPrompt,
  getRelationshipLevel,
  recordLevelMilestone,
} from '../src/features/autonomy/relationshipTracker.ts'

function stateAtScore(score: number, extras: Partial<RelationshipState> = {}): RelationshipState {
  return {
    ...createDefaultRelationshipState(),
    score,
    ...extras,
  }
}

describe('detectLevelTransition', () => {
  test('returns null when level is unchanged', () => {
    const before = stateAtScore(40)
    const after = stateAtScore(45)
    assert.equal(detectLevelTransition(before, after), null)
  })

  test('detects stranger → acquaintance (score 9 → 10)', () => {
    const before = stateAtScore(9)
    const after = recordLevelMilestone(stateAtScore(10))
    const milestone = detectLevelTransition(before, after)
    assert.ok(milestone, 'expected a milestone')
    assert.equal(milestone!.level, 'acquaintance')
    assert.equal(milestone!.previousLevel, 'stranger')
  })

  test('detects acquaintance → friend (score 29 → 30)', () => {
    const before = stateAtScore(29, { levelReachedAt: { acquaintance: '2026-04-01T00:00:00Z' } })
    const after = recordLevelMilestone(stateAtScore(30, {
      levelReachedAt: { acquaintance: '2026-04-01T00:00:00Z' },
    }))
    const milestone = detectLevelTransition(before, after)
    assert.ok(milestone)
    assert.equal(milestone!.level, 'friend')
  })

  test('detects friend → close_friend (score 54 → 55)', () => {
    const before = stateAtScore(54)
    const after = recordLevelMilestone(stateAtScore(55))
    assert.equal(detectLevelTransition(before, after)!.level, 'close_friend')
  })

  test('detects close_friend → intimate (score 79 → 80)', () => {
    const before = stateAtScore(79)
    const after = recordLevelMilestone(stateAtScore(80))
    assert.equal(detectLevelTransition(before, after)!.level, 'intimate')
  })

  test('does not fire on downward transition (level decay)', () => {
    const before = stateAtScore(55)
    const after = stateAtScore(40)
    assert.equal(detectLevelTransition(before, after), null)
  })

  test('does not fire when a level is re-reached after decay', () => {
    // User reached 'friend' before, decayed to acquaintance, and is now back at friend.
    const before = stateAtScore(28, {
      levelReachedAt: {
        acquaintance: '2026-04-01T00:00:00Z',
        friend: '2026-04-05T00:00:00Z',
      },
    })
    const after = stateAtScore(30, {
      levelReachedAt: {
        acquaintance: '2026-04-01T00:00:00Z',
        friend: '2026-04-05T00:00:00Z',
      },
    })
    assert.equal(detectLevelTransition(before, after), null)
  })

  test('fires when a level is reached for the first time even if score was previously higher', () => {
    const before = stateAtScore(9)
    const after = recordLevelMilestone(stateAtScore(10))
    const milestone = detectLevelTransition(before, after)
    assert.ok(milestone)
    assert.ok(milestone!.at)
  })

  test('includes daysInteracted in the milestone payload', () => {
    const before = stateAtScore(54)
    const after = recordLevelMilestone(stateAtScore(55, { totalDaysInteracted: 42 }))
    assert.equal(detectLevelTransition(before, after)!.daysInteracted, 42)
  })
})

describe('formatMilestoneForPrompt', () => {
  const levels: RelationshipLevel[] = ['acquaintance', 'friend', 'close_friend', 'intimate']

  for (const level of levels) {
    test(`returns non-empty instructional text for ${level}`, () => {
      const text = formatMilestoneForPrompt({
        level,
        previousLevel: 'stranger',
        at: new Date().toISOString(),
        daysInteracted: 5,
      })
      assert.ok(text.length > 50, `expected meaningful text, got ${text.length} chars`)
      assert.ok(!text.includes('null'))
      assert.ok(!text.includes('undefined'))
    })
  }

  test('stranger milestone has empty instruction (never fired as upward transition)', () => {
    const text = formatMilestoneForPrompt({
      level: 'stranger',
      previousLevel: 'stranger',
      at: new Date().toISOString(),
      daysInteracted: 0,
    })
    assert.equal(text, '')
  })

  test('does not explicitly announce the level change (lets it come through in tone)', () => {
    const text = formatMilestoneForPrompt({
      level: 'friend',
      previousLevel: 'acquaintance',
      at: new Date().toISOString(),
      daysInteracted: 20,
    })
    // Should not literally tell the model to say "we are now friends" —
    // the instruction is about performing the shift, not announcing it.
    assert.ok(!/announce|say.*now.*friend/i.test(text))
  })
})

describe('formatAbsenceContext (enhanced)', () => {
  function stateWithAbsence(daysAgo: number, extras: Partial<RelationshipState> = {}): RelationshipState {
    const d = new Date()
    d.setUTCDate(d.getUTCDate() - daysAgo)
    return {
      ...createDefaultRelationshipState(),
      lastInteractionDate: d.toISOString().slice(0, 10),
      score: 45, // friend level by default
      ...extras,
    }
  }

  test('returns empty string when no prior interaction', () => {
    assert.equal(formatAbsenceContext(createDefaultRelationshipState()), '')
  })

  test('returns empty string when last interaction was today', () => {
    const today = new Date().toISOString().slice(0, 10)
    assert.equal(formatAbsenceContext({ ...createDefaultRelationshipState(), lastInteractionDate: today }), '')
  })

  test('short absence at friend level includes directive to weave topic naturally', () => {
    const text = formatAbsenceContext(stateWithAbsence(2, {
      score: 45,
      lastSessionTopic: 'the project deadline',
    }))
    assert.ok(/weave it back/i.test(text) || /naturally/i.test(text),
      `expected directive to weave topic, got: ${text}`)
    assert.ok(/project deadline/.test(text))
  })

  test('short absence at stranger level gets topic reference without directive', () => {
    const text = formatAbsenceContext(stateWithAbsence(2, {
      score: 5,
      lastSessionTopic: 'work stress',
    }))
    assert.ok(/work stress/.test(text))
    // Stranger level shouldn't get the "weave it back" kind of directive
    assert.ok(!/weave it back/i.test(text))
  })

  test('medium absence (4–7 days) gets "turning it over" framing', () => {
    const text = formatAbsenceContext(stateWithAbsence(5, {
      score: 45,
      lastSessionTopic: 'their interview',
    }))
    assert.ok(/turning it over/i.test(text),
      `expected "turning it over" framing, got: ${text}`)
  })

  test('long absence at close_friend level triggers reunion framing', () => {
    const text = formatAbsenceContext(stateWithAbsence(8, {
      score: 60,
    }))
    assert.ok(/genuinely missed/i.test(text))
    assert.ok(/reunion|where have you been/i.test(text))
  })

  test('long absence + high concern at close_friend asks if things got better', () => {
    const text = formatAbsenceContext(stateWithAbsence(10, {
      score: 65,
      lastSessionEmotion: { energy: 0.3, warmth: 0.5, curiosity: 0.3, concern: 0.8 },
    }))
    assert.ok(/gotten better|gently/i.test(text),
      `expected gentle check-in language, got: ${text}`)
  })

  test('warm parting reference stays light', () => {
    const text = formatAbsenceContext(stateWithAbsence(2, {
      score: 45,
      lastSessionEmotion: { energy: 0.6, warmth: 0.8, curiosity: 0.5, concern: 0.1 },
    }))
    assert.ok(/warm terms/i.test(text))
  })
})

describe('getRelationshipLevel boundaries', () => {
  // Ensure the milestone detection thresholds match getRelationshipLevel.
  test('level thresholds are 10 / 30 / 55 / 80', () => {
    assert.equal(getRelationshipLevel(stateAtScore(9)), 'stranger')
    assert.equal(getRelationshipLevel(stateAtScore(10)), 'acquaintance')
    assert.equal(getRelationshipLevel(stateAtScore(29)), 'acquaintance')
    assert.equal(getRelationshipLevel(stateAtScore(30)), 'friend')
    assert.equal(getRelationshipLevel(stateAtScore(54)), 'friend')
    assert.equal(getRelationshipLevel(stateAtScore(55)), 'close_friend')
    assert.equal(getRelationshipLevel(stateAtScore(79)), 'close_friend')
    assert.equal(getRelationshipLevel(stateAtScore(80)), 'intimate')
  })
})
