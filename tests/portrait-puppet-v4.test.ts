import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  isPortraitPuppetV4Manifest,
  normalizePortraitPuppetV4Manifest,
  PORTRAIT_PUPPET_V4_IMAGE_GENERATION_PROMPT,
  validatePortraitPuppetV4Manifest,
} from '../shared/portraitPuppetV4Contract.js'

test('v4 image prompt demands polished registered layers instead of a visible fixture', () => {
  assert.match(PORTRAIT_PUPPET_V4_IMAGE_GENERATION_PROMPT, /production-quality layered/i)
  assert.match(PORTRAIT_PUPPET_V4_IMAGE_GENERATION_PROMPT, /preview approval/i)
  assert.match(PORTRAIT_PUPPET_V4_IMAGE_GENERATION_PROMPT, /parts\/front-bangs\.png/i)
  assert.match(PORTRAIT_PUPPET_V4_IMAGE_GENERATION_PROMPT, /masks\/eye-left\.png/i)
  assert.match(PORTRAIT_PUPPET_V4_IMAGE_GENERATION_PROMPT, /do not merely crop/i)
  assert.match(PORTRAIT_PUPPET_V4_IMAGE_GENERATION_PROMPT, /low-detail chibi placeholder/i)
})

function keyforms() {
  return [
    { value: -1, translate: [-0.012, 0] },
    { value: 0, translate: [0, 0] },
    { value: 1, translate: [0.012, 0] },
  ]
}

function openKeyforms() {
  return [
    { value: 0, opacity: 0 },
    { value: 1, opacity: 1 },
  ]
}

function bindingsForRole(role: string) {
  const parameterIds: Record<string, string[]> = {
    'face-base': ['ParamAngleX', 'ParamAngleY', 'ParamAngleZ'],
    'iris-left': ['ParamEyeBallX', 'ParamEyeBallY'],
    'iris-right': ['ParamEyeBallX', 'ParamEyeBallY'],
    'eyelid-upper-left': ['ParamEyeLOpen'],
    'eyelid-upper-right': ['ParamEyeROpen'],
    'mouth-closed': ['ParamMouthOpenY'],
    'mouth-cavity': ['ParamMouthOpenY'],
    'torso': ['ParamBreath', 'ParamBodyAngleZ'],
    'back-hair': ['ParamHairSway'],
    'cloth-left': ['ParamClothSway'],
  }
  return (parameterIds[role] ?? []).map((parameter) => ({
    parameter,
    keyforms: parameter === 'ParamEyeLOpen'
      || parameter === 'ParamEyeROpen'
      || parameter === 'ParamMouthOpenY'
      ? openKeyforms()
      : parameter === 'ParamAngleX' && role === 'face-base'
        ? keyforms().map((keyform) => ({
          ...keyform,
          vertexOffsets: Array.from({ length: 9 }, (_, index) => (
            [keyform.value * (index % 3) * 0.001, 0]
          )),
        }))
        : keyforms(),
  }))
}

function makeCompleteManifest() {
  const roles = [
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
  ]
  return {
    id: 'layered-test',
    displayName: 'Layered Test',
    kind: 'portrait-puppet',
    formatVersion: 4,
    renderMode: 'layered-artmesh-v1',
    qualityTier: 'complete',
    portraitPath: 'preview.png',
    canvas: { width: 1024, height: 1536 },
    masks: [
      { id: 'face-mask', role: 'face', path: 'masks/face.png', parentId: 'face-base' },
      { id: 'eye-left-mask', role: 'eye-left', path: 'masks/eye-left.png', parentId: 'face-base' },
      { id: 'eye-right-mask', role: 'eye-right', path: 'masks/eye-right.png', parentId: 'face-base' },
      { id: 'mouth-mask', role: 'mouth', path: 'masks/mouth.png', parentId: 'face-base' },
    ],
    parts: roles.map((role, index) => ({
      id: role,
      role,
      path: `parts/${role}.png`,
      parentId: role === 'front-bangs' ? 'face-base' : '',
      pivot: [0.5, 0.25],
      zIndex: index,
      maskId: role === 'iris-left'
        ? 'eye-left-mask'
        : role === 'iris-right'
          ? 'eye-right-mask'
          : role === 'mouth-cavity'
            ? 'mouth-mask'
            : '',
      mesh: { columns: 2, rows: 2 },
      bindings: bindingsForRole(role),
    })),
    physics: [
      {
        id: 'hair-follow',
        input: 'ParamAngleX',
        output: 'ParamHairSway',
        scale: 1,
        mass: 0.8,
        stiffness: 100,
        damping: 14,
        delayMs: 110,
        min: -1.5,
        max: 1.5,
      },
      {
        id: 'cloth-follow',
        input: 'ParamBodyAngleZ',
        output: 'ParamClothSway',
        scale: 1,
        mass: 1,
        stiffness: 85,
        damping: 13,
        delayMs: 160,
        min: -1.5,
        max: 1.5,
      },
    ],
  }
}

test('v4 layered manifest normalizes into a deterministic complete contract', () => {
  const source = makeCompleteManifest()
  const result = validatePortraitPuppetV4Manifest(source)

  assert.equal(result.valid, true, JSON.stringify(result.errors, null, 2))
  assert.equal(result.manifest.formatVersion, 4)
  assert.equal(result.manifest.renderMode, 'layered-artmesh-v1')
  assert.equal(result.manifest.parts[1].mesh.columns, 2)
  assert.equal(result.manifest.parts[1].bindings[0].keyforms[0].value, -1)
  assert.equal(isPortraitPuppetV4Manifest(source), true)
})

test('v4 rejects traversal, duplicate ids, missing semantic parts, and parent cycles', () => {
  const source = makeCompleteManifest()
  source.qualityTier = 'standard'
  source.parts = [
    {
      id: 'face-base',
      role: 'face-base',
      path: '../outside.png',
      parentId: 'torso',
    },
    {
      id: 'torso',
      role: 'torso',
      path: 'parts/torso.png',
      parentId: 'face-base',
    },
    {
      id: 'torso',
      role: 'neck',
      path: 'parts/neck.png',
    },
  ]

  const result = validatePortraitPuppetV4Manifest(source)
  const codes = new Set(result.errors.map((entry) => entry.code))
  assert.equal(result.valid, false)
  assert.equal(codes.has('unsafe-asset-path'), true)
  assert.equal(codes.has('duplicate-part-id'), true)
  assert.equal(codes.has('parent-cycle'), true)
  assert.equal(codes.has('missing-core-role'), true)
})

test('v4 validates binding parameters, keyforms, meshes, masks, and physics links', () => {
  const source = makeCompleteManifest()
  source.parts[1].maskId = 'missing-mask'
  source.parts[1].bindings = [{
    parameter: 'UnknownParam',
    keyforms: [{
      value: 0,
      vertexOffsets: [[0, 0]],
    }],
  }]
  source.physics[0].input = 'MissingInput'

  const result = validatePortraitPuppetV4Manifest(source)
  const codes = new Set(result.errors.map((entry) => entry.code))
  assert.equal(codes.has('unknown-mask'), true)
  assert.equal(codes.has('unknown-parameter'), true)
  assert.equal(codes.has('insufficient-keyforms'), true)
  assert.equal(codes.has('invalid-vertex-offset-count'), true)
  assert.equal(codes.has('unknown-physics-input'), true)
})

test('v4 clamps hostile numeric input without producing NaN transforms', () => {
  const manifest = normalizePortraitPuppetV4Manifest({
    canvas: { width: Infinity, height: -10 },
    parts: [{
      id: 'face-base',
      role: 'face-base',
      path: 'parts/face.png',
      pivot: [NaN, Infinity],
      mesh: { columns: 10_000, rows: -2 },
    }],
  })

  assert.deepEqual(manifest.canvas, { width: 1024, height: 64 })
  assert.deepEqual(manifest.parts[0].pivot, [0.5, 0.5])
  assert.deepEqual(manifest.parts[0].mesh, { columns: 24, rows: 1 })
})
