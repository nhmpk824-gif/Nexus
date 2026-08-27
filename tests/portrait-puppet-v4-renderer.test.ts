import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createPortraitPuppetV4Mesh } from '../src/features/pet/components/portraitPuppetV4Renderer.ts'

test('v4 renderer mesh has complete stable coverage for generated parts', () => {
  const mesh = createPortraitPuppetV4Mesh(3, 4)
  assert.equal(mesh.points.length, 20)
  assert.equal(mesh.triangles.length, 24)
  assert.deepEqual(mesh.points[0], [0, 0])
  assert.deepEqual(mesh.points.at(-1), [1, 1])
  assert.deepEqual(mesh.triangles[0], [0, 4, 1])
  assert.deepEqual(mesh.triangles.at(-1), [15, 18, 19])
})

test('v4 renderer clamps hostile mesh dimensions to bounded work', () => {
  const mesh = createPortraitPuppetV4Mesh(10_000, -20)
  assert.equal(mesh.points.length, 50)
  assert.equal(mesh.triangles.length, 48)
})
