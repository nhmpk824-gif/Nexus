import assert from 'node:assert/strict'
import { test } from 'node:test'

import { clamp } from '../src/lib/common.ts'

test('clamp bounds finite numbers and snaps non-finite values to min', () => {
  assert.equal(clamp(-2, -1, 1), -1)
  assert.equal(clamp(2, 0, 1), 1)
  assert.equal(clamp(0.4, 0, 1), 0.4)
  assert.equal(clamp(Number.NaN, 0, 1), 0)
  assert.equal(clamp(Number.POSITIVE_INFINITY, 0, 1), 0)
})
