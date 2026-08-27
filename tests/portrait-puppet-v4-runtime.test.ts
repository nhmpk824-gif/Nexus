import assert from 'node:assert/strict'
import { test } from 'node:test'

import { normalizePortraitPuppetV4Manifest } from '../shared/portraitPuppetV4Contract.js'
import {
  applyPortraitPuppetV4Matrix,
  createPortraitPuppetV4Runtime,
  resolvePortraitPuppetV4Binding,
  resolvePortraitPuppetV4Parts,
  stepPortraitPuppetV4Runtime,
} from '../src/features/pet/portraitPuppetV4Runtime.ts'

function manifestFixture() {
  return normalizePortraitPuppetV4Manifest({
    id: 'runtime-fixture',
    kind: 'portrait-puppet',
    formatVersion: 4,
    renderMode: 'layered-artmesh-v1',
    qualityTier: 'standard',
    portraitPath: 'preview.png',
    parts: [
      {
        id: 'head',
        role: 'face-base',
        path: 'parts/head.png',
        pivot: [0.5, 0.25],
        zIndex: 1,
        mesh: { columns: 1, rows: 1 },
        bindings: [{
          parameter: 'ParamAngleX',
          keyforms: [
            { value: -1, translate: [-0.02, 0], rotateDeg: -4 },
            { value: 0, translate: [0, 0], rotateDeg: 0 },
            { value: 1, translate: [0.02, 0], rotateDeg: 4 },
          ],
        }],
      },
      {
        id: 'bangs',
        role: 'front-bangs',
        path: 'parts/bangs.png',
        parentId: 'head',
        pivot: [0.5, 0.12],
        zIndex: 2,
        mesh: { columns: 1, rows: 1 },
        bindings: [{
          parameter: 'ParamHairSway',
          keyforms: [
            { value: -1, rotateDeg: -8 },
            { value: 0, rotateDeg: 0 },
            { value: 1, rotateDeg: 8 },
          ],
        }],
      },
    ],
    physics: [{
      id: 'hair',
      input: 'ParamAngleX',
      output: 'ParamHairSway',
      scale: 1,
      mass: 1,
      stiffness: 90,
      damping: 10,
      delayMs: 80,
      min: -1.5,
      max: 1.5,
    }],
  })
}

test('v4 binding interpolates transforms and mesh offsets between keyforms', () => {
  const resolved = resolvePortraitPuppetV4Binding({
    parameter: 'ParamAngleX',
    keyforms: [
      {
        value: -1,
        translate: [-0.02, 0],
        rotateDeg: -10,
        scale: [0.9, 1],
        opacity: 0.5,
        vertexOffsets: [[-0.01, 0]],
      },
      {
        value: 1,
        translate: [0.02, 0.01],
        rotateDeg: 10,
        scale: [1.1, 1],
        opacity: 1,
        vertexOffsets: [[0.01, 0.02]],
      },
    ],
  }, 0, 1)

  assert.deepEqual(resolved.translate, [0, 0.005])
  assert.equal(resolved.rotateDeg, 0)
  assert.deepEqual(resolved.scale, [1, 1])
  assert.equal(resolved.opacity, 0.75)
  assert.deepEqual(resolved.vertexOffsets, [[0, 0.01]])
})

test('v4 runtime keeps blink immediate while smoothing head parameters', () => {
  const runtime = createPortraitPuppetV4Runtime(manifestFixture())
  stepPortraitPuppetV4Runtime(runtime, {
    headYaw: 1,
    blinkLeft: 1,
    blinkRight: 0.5,
  }, 16)

  assert.ok(runtime.parameters.ParamAngleX > 0)
  assert.ok(runtime.parameters.ParamAngleX < 1)
  assert.equal(runtime.parameters.ParamEyeLOpen, 0)
  assert.equal(runtime.parameters.ParamEyeROpen, 0.5)
})

test('v4 runtime maps round and narrow mouth targets onto optional parameters', () => {
  const runtime = createPortraitPuppetV4Runtime(manifestFixture())
  runtime.manifest.parameters = [
    ...runtime.manifest.parameters,
    { id: 'ParamMouthRound', min: 0, max: 1, defaultValue: 0 },
    { id: 'ParamMouthNarrow', min: 0, max: 1, defaultValue: 0 },
  ]
  runtime.parameters.ParamMouthRound = 0
  runtime.parameters.ParamMouthNarrow = 0
  stepPortraitPuppetV4Runtime(runtime, { mouthRound: 0.25, mouthNarrow: 0.08 }, 100)
  assert.ok(runtime.parameters.ParamMouthRound > 0)
  assert.ok(runtime.parameters.ParamMouthNarrow > 0)
  assert.ok(runtime.parameters.ParamMouthRound > runtime.parameters.ParamMouthNarrow)
})

test('v4 runtime maps brow and cheek targets onto optional Live2D-shaped parameters', () => {
  const runtime = createPortraitPuppetV4Runtime(manifestFixture())
  runtime.manifest.parameters = [
    ...runtime.manifest.parameters,
    { id: 'ParamBrowForm', min: -1, max: 1, defaultValue: 0 },
    { id: 'ParamCheek', min: 0, max: 1, defaultValue: 0 },
  ]
  runtime.parameters.ParamBrowForm = 0
  runtime.parameters.ParamCheek = 0
  stepPortraitPuppetV4Runtime(runtime, { browForm: -0.4, cheek: 0.5 }, 100)
  assert.ok(runtime.parameters.ParamBrowForm < 0)
  assert.ok(runtime.parameters.ParamCheek > 0)
})

test('v4 runtime maps eye smile, split brows, and body pitch onto Cubism parameters', () => {
  const runtime = createPortraitPuppetV4Runtime(manifestFixture())
  stepPortraitPuppetV4Runtime(runtime, {
    eyeSmileLeft: 0.7,
    eyeSmileRight: 0.5,
    browLeftY: 0.4,
    browRightY: -0.3,
    bodyPitch: 0.35,
  }, 120)
  assert.ok(runtime.parameters.ParamEyeLSmile > 0.3)
  assert.ok(runtime.parameters.ParamEyeRSmile > 0.2)
  assert.ok(runtime.parameters.ParamEyeLSmile > runtime.parameters.ParamEyeRSmile)
  assert.ok(runtime.parameters.ParamBrowLY > 0)
  assert.ok(runtime.parameters.ParamBrowRY < 0)
  assert.ok(runtime.parameters.ParamBodyAngleY > 0.1)
})

test('v4 runtime maps mouth down, brow X, eye-ball form, and split brow form', () => {
  const runtime = createPortraitPuppetV4Runtime(manifestFixture())
  stepPortraitPuppetV4Runtime(runtime, {
    mouthDown: 0.5,
    browLeftX: 0.3,
    browRightX: -0.2,
    eyeBallForm: 0.6,
    browForm: -0.4,
  }, 120)
  assert.ok(runtime.parameters.ParamMouthDown > 0.2)
  assert.ok(runtime.parameters.ParamBrowLX > 0)
  assert.ok(runtime.parameters.ParamBrowRX < 0)
  assert.ok(runtime.parameters.ParamEyeBallForm > 0.2)
  assert.ok(runtime.parameters.ParamBrowLForm < 0)
  assert.ok(runtime.parameters.ParamBrowRForm < 0)
})

test('v4 runtime maps brow angle and eye form onto Cubism parameters', () => {
  const runtime = createPortraitPuppetV4Runtime(manifestFixture())
  stepPortraitPuppetV4Runtime(runtime, {
    browLeftAngle: 0.4,
    browRightAngle: -0.3,
    eyeFormLeft: 0.35,
    eyeFormRight: -0.2,
  }, 120)
  assert.ok(runtime.parameters.ParamBrowLAngle > 0)
  assert.ok(runtime.parameters.ParamBrowRAngle < 0)
  assert.ok(runtime.parameters.ParamEyeLForm > 0)
  assert.ok(runtime.parameters.ParamEyeRForm < 0)
})

test('v4 runtime maps pose arm sway onto ParamArmSway', () => {
  const runtime = createPortraitPuppetV4Runtime(manifestFixture())
  stepPortraitPuppetV4Runtime(runtime, { armSway: 0.9 }, 120)
  assert.ok(runtime.parameters.ParamArmSway > 0.5)
})

test('v4 spring output visibly lags and overshoots a reversed head target', () => {
  const runtime = createPortraitPuppetV4Runtime(manifestFixture())
  for (let frame = 0; frame < 24; frame += 1) {
    stepPortraitPuppetV4Runtime(runtime, { headYaw: 1 }, 16)
  }
  const beforeReverse = runtime.parameters.ParamHairSway
  stepPortraitPuppetV4Runtime(runtime, { headYaw: -1 }, 16)
  const firstReverse = runtime.parameters.ParamHairSway

  assert.ok(beforeReverse > 0.2)
  assert.ok(firstReverse > 0, 'hair should keep its old direction immediately after reversal')
  for (let frame = 0; frame < 60; frame += 1) {
    stepPortraitPuppetV4Runtime(runtime, { headYaw: -1 }, 16)
  }
  assert.ok(runtime.parameters.ParamHairSway < -0.5)
})

test('v4 parent transforms move child hair with the head while retaining local motion', () => {
  const manifest = manifestFixture()
  const parts = resolvePortraitPuppetV4Parts(manifest, {
    ParamAngleX: 1,
    ParamHairSway: 1,
  })
  const head = parts.find((entry) => entry.part.id === 'head')
  const bangs = parts.find((entry) => entry.part.id === 'bangs')
  assert.ok(head)
  assert.ok(bangs)

  const headPivot = applyPortraitPuppetV4Matrix(head.matrix, [0.5, 0.25])
  const bangsPivot = applyPortraitPuppetV4Matrix(bangs.matrix, [0.5, 0.12])
  assert.ok(headPivot[0] > 0.5)
  assert.ok(bangsPivot[0] > 0.5)
  assert.notDeepEqual(bangs.matrix, head.matrix)
  assert.deepEqual(parts.map((entry) => entry.part.id), ['head', 'bangs'])
})
