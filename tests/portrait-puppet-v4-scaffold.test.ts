import assert from 'node:assert/strict'
import { test } from 'node:test'

import { validatePortraitPuppetV4Manifest } from '../shared/portraitPuppetV4Contract.js'
import { buildPortraitPuppetV4Manifest } from '../scripts/scaffold-portrait-puppet-v4.mjs'

const COMPLETE_PARTS = [
  'back-hair',
  'face-base',
  'brow-left',
  'brow-right',
  'eye-white-left',
  'eye-white-right',
  'iris-left',
  'iris-right',
  'eyelid-upper-left',
  'eyelid-upper-right',
  'mouth-closed',
  'mouth-cavity',
  'front-bangs',
  'side-hair-left',
  'side-hair-right',
  'neck',
  'torso',
  'arm-left',
  'arm-right',
  'cloth-left',
  'cloth-right',
  'accessory',
]

test('v4 scaffold produces a complete reusable rig without hand-authored JSON', () => {
  const manifest = buildPortraitPuppetV4Manifest({
    id: 'AI Character',
    displayName: 'AI Character',
    width: 1024,
    height: 1536,
    partRoles: COMPLETE_PARTS,
    maskRoles: ['face', 'eye-left', 'eye-right', 'mouth'],
  })
  const validation = validatePortraitPuppetV4Manifest(manifest)

  assert.equal(validation.valid, true, JSON.stringify(validation.errors, null, 2))
  assert.equal(manifest.id, 'ai-character')
  assert.equal(manifest.parts.find((part) => part.id === 'face-base').mesh.columns, 12)
  assert.equal(manifest.parts.find((part) => part.id === 'face-base').mesh.rows, 14)
  assert.equal(
    manifest.parts
      .find((part) => part.id === 'face-base')
      .bindings
      .find((binding) => binding.parameter === 'ParamAngleX')
      .keyforms[2]
      .vertexOffsets.length,
    195,
  )
  assert.equal(manifest.parts.find((part) => part.id === 'iris-left').maskId, 'eye-left-mask')
  assert.ok(manifest.parts
    .find((part) => part.id === 'brow-left')
    .bindings
    .some((binding) => binding.parameter === 'ParamBrowForm'))
  assert.ok(manifest.parts
    .find((part) => part.id === 'brow-left')
    .bindings
    .some((binding) => binding.parameter === 'ParamBrowLY'))
  assert.ok(manifest.parts
    .find((part) => part.id === 'brow-left')
    .bindings
    .some((binding) => binding.parameter === 'ParamBrowLAngle'))
  assert.ok(manifest.parts
    .find((part) => part.id === 'brow-left')
    .bindings
    .some((binding) => binding.parameter === 'ParamBrowLX'))
  assert.ok(manifest.parts
    .find((part) => part.id === 'iris-left')
    .bindings
    .some((binding) => binding.parameter === 'ParamEyeBallForm'))
  assert.ok(manifest.parts
    .find((part) => part.id === 'mouth-closed')
    .bindings
    .some((binding) => binding.parameter === 'ParamMouthDown'))
  assert.ok(manifest.parts
    .find((part) => part.id === 'iris-left')
    .bindings
    .some((binding) => binding.parameter === 'ParamEyeLForm'))
  assert.ok(manifest.parts
    .find((part) => part.id === 'face-base')
    .bindings
    .some((binding) => binding.parameter === 'ParamCheek'))
  assert.ok(manifest.parts
    .find((part) => part.id === 'eyelid-upper-left')
    .bindings
    .some((binding) => binding.parameter === 'ParamEyeLSmile'))
  assert.ok(manifest.parts
    .find((part) => part.id === 'torso')
    .bindings
    .some((binding) => binding.parameter === 'ParamBodyAngleY'))
  assert.ok(manifest.parts
    .find((part) => part.id === 'mouth-cavity')
    .bindings
    .some((binding) => binding.parameter === 'ParamMouthRound'))
  assert.deepEqual(
    manifest.physics.map((group) => group.output),
    ['ParamHairSway', 'ParamClothSway', 'ParamAccessorySway'],
  )
})

test('v4 scaffold output preserves grounded roots and independent secondary parents', () => {
  const manifest = buildPortraitPuppetV4Manifest({
    displayName: 'Parent Fixture',
    width: 1024,
    height: 1536,
    partRoles: COMPLETE_PARTS,
    maskRoles: ['face', 'eye-left', 'eye-right', 'mouth'],
  })
  const byId = new Map(manifest.parts.map((part) => [part.id, part]))

  assert.equal(byId.get('torso').parentId, '')
  assert.equal(byId.get('neck').parentId, 'torso')
  assert.equal(byId.get('face-base').parentId, 'neck')
  assert.equal(byId.get('front-bangs').parentId, 'face-base')
  assert.equal(byId.get('cloth-left').parentId, 'torso')
  assert.ok(byId.get('front-bangs').bindings.some((entry) => entry.parameter === 'ParamHairSway'))
  assert.ok(byId.get('arm-right').bindings.some((entry) => entry.parameter === 'ParamArmSway'))
  assert.deepEqual(byId.get('arm-right').pivot, [0.62, 0.36])
})

test('v4 ears and nose follow head turn', () => {
  const manifest = buildPortraitPuppetV4Manifest({
    displayName: 'Head Fixture',
    width: 1024,
    height: 1536,
    partRoles: [...COMPLETE_PARTS, 'ear-left', 'ear-right', 'nose'],
    maskRoles: ['face', 'eye-left', 'eye-right', 'mouth'],
  })
  const byId = new Map(manifest.parts.map((part) => [part.id, part]))
  assert.ok(byId.get('ear-left').bindings.some((entry) => entry.parameter === 'ParamAngleX'))
  assert.ok(byId.get('nose').bindings.some((entry) => entry.parameter === 'ParamAngleY'))
})

test('v4 lower eyelids close upward while upper eyelids close downward', () => {
  const manifest = buildPortraitPuppetV4Manifest({
    displayName: 'Lid Fixture',
    width: 1024,
    height: 1536,
    partRoles: [
      ...COMPLETE_PARTS,
      'eyelid-lower-left',
      'eyelid-lower-right',
    ],
    maskRoles: ['face', 'eye-left', 'eye-right', 'mouth'],
  })
  const byId = new Map(manifest.parts.map((part) => [part.id, part]))
  const upperClose = byId.get('eyelid-upper-left').bindings
    .find((binding) => binding.parameter === 'ParamEyeLOpen')
    .keyforms[0]
  const lowerClose = byId.get('eyelid-lower-left').bindings
    .find((binding) => binding.parameter === 'ParamEyeLOpen')
    .keyforms[0]

  assert.ok(upperClose.translate[1] > 0)
  assert.ok(lowerClose.translate[1] < 0)
})
