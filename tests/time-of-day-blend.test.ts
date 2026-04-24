import assert from 'node:assert/strict'
import { test } from 'node:test'

import { getTimeOfDayBlend } from '../src/features/panelScene/weatherCondition.ts'

function at(hour: number, minute = 0): Date {
  const d = new Date(2026, 3, 25, hour, minute, 0, 0)
  return d
}

function approx(a: number, b: number, tol = 0.01): boolean {
  return Math.abs(a - b) <= tol
}

test('blend sums to 1 at every hour', () => {
  for (let h = 0; h < 24; h += 0.25) {
    const d = at(Math.floor(h), Math.round((h % 1) * 60))
    const b = getTimeOfDayBlend(d)
    assert.ok(approx(b.day + b.dusk + b.night, 1), `sum at ${h} was ${b.day + b.dusk + b.night}`)
  }
})

test('full night before 5:00', () => {
  const b = getTimeOfDayBlend(at(3))
  assert.deepEqual(b, { day: 0, dusk: 0, night: 1 })
})

test('full day at noon', () => {
  const b = getTimeOfDayBlend(at(12))
  assert.deepEqual(b, { day: 1, dusk: 0, night: 0 })
})

test('full dusk at 18:30', () => {
  const b = getTimeOfDayBlend(at(18, 30))
  assert.deepEqual(b, { day: 0, dusk: 1, night: 0 })
})

test('mixes night and day during 5-7 dawn window', () => {
  const b = getTimeOfDayBlend(at(6))
  assert.ok(b.day > 0 && b.day < 1, `day at 6:00 should be partial, got ${b.day}`)
  assert.ok(b.night > 0 && b.night < 1, `night at 6:00 should be partial, got ${b.night}`)
  assert.equal(b.dusk, 0)
})

test('mixes day and dusk during 16-18 evening window', () => {
  const b = getTimeOfDayBlend(at(17))
  assert.ok(b.day > 0 && b.day < 1)
  assert.ok(b.dusk > 0 && b.dusk < 1)
  assert.equal(b.night, 0)
})

test('mixes dusk and night during 19-21 window', () => {
  const b = getTimeOfDayBlend(at(20))
  assert.ok(b.dusk > 0 && b.dusk < 1)
  assert.ok(b.night > 0 && b.night < 1)
  assert.equal(b.day, 0)
})

test('smoothstep ease — midpoint is 0.5', () => {
  const dawnMid = getTimeOfDayBlend(at(6))
  assert.ok(approx(dawnMid.day, 0.5, 0.05), `expected 0.5 at midpoint, got ${dawnMid.day}`)
})
