import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  PORTRAIT_PUPPET_FORMAT_VERSION,
  PORTRAIT_PUPPET_IMAGE_GENERATION_PROMPT,
  PORTRAIT_PUPPET_PROCEDURAL_RENDER_MODE,
  classifyPortraitLayerKey,
  isPortraitPuppetManifest,
  normalizePortraitPuppetRig,
} from '../shared/portraitPuppetContract.js'
import {
  applyPortraitPuppetDebugPose,
  deformPortraitPuppetPoint,
  interpolatePortraitPuppetPose,
  planPortraitPuppetBlink,
  planPortraitPuppetPose,
  resolvePortraitPuppetFaceImage,
  resolvePortraitPuppetRigidHeadFollow,
  resolvePortraitPuppetRigidTurn,
} from '../src/features/pet/portraitPuppet.ts'
import {
  createPortraitPuppetMesh,
  resolvePortraitPuppetProceduralGeometryPose,
  resolvePortraitPuppetTurnBlend,
} from '../src/features/pet/portraitPuppetRenderer.ts'
import {
  createPortraitPuppetPhysicsState,
  stepPortraitPuppetPhysics,
} from '../src/features/pet/portraitPuppetPhysics.ts'
import {
  isPetModelSelectionResolved,
  nextPetModelDiscoveryAfterError,
  nextPetModelDiscoveryBeforeLoad,
  shouldRepairPetModelSelection,
} from '../src/features/pet/models.ts'
import {
  createPortraitPuppetPackageFromImage,
  createPortraitPuppetPackageFromImages,
  inferPortraitPuppetRigFromImage,
} from '../electron/services/portraitPuppetPackage.js'
import {
  extractSpritePetZipArchive,
  readSpritePetPackage,
} from '../electron/services/spritePetPackage.js'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import sharp from 'sharp'

test('portrait file names map onto Live2D-shaped layer keys', () => {
  assert.equal(classifyPortraitLayerKey('happy.png'), 'happy')
  assert.equal(classifyPortraitLayerKey('2-speaking.webp'), 'speaking')
  assert.equal(classifyPortraitLayerKey('闭眼.png'), 'blink')
  assert.equal(classifyPortraitLayerKey('mouth-open.jpg'), 'mouth')
  assert.equal(classifyPortraitLayerKey('head-turn-left.png'), 'head-left')
  assert.equal(classifyPortraitLayerKey('右转.png'), 'head-right')
  assert.equal(classifyPortraitLayerKey('random-photo.png'), null)
})

test('authored expression layers replace the base face', () => {
  const face = resolvePortraitPuppetFaceImage({
    imagePath: 'portrait.png',
    layers: { happy: 'layers/happy.png', idle: 'layers/idle.png' },
  }, 'happy')
  assert.equal(face, 'layers/happy.png')
  assert.equal(resolvePortraitPuppetFaceImage({ imagePath: 'portrait.png' }, 'speaking'), 'portrait.png')
})

test('portrait puppet manifests are recognized without a spritesheet', () => {
  assert.equal(isPortraitPuppetManifest({ kind: 'portrait-puppet', portraitPath: 'portrait.png' }), true)
  assert.equal(isPortraitPuppetManifest({ portraitPath: 'face.webp' }), true)
  assert.equal(isPortraitPuppetManifest({ spritesheetPath: 'spritesheet.png' }), false)
})

test('portrait image prompt asks image models for a reusable single-character source', () => {
  assert.match(PORTRAIT_PUPPET_IMAGE_GENERATION_PROMPT, /transparent alpha background/i)
  assert.match(PORTRAIT_PUPPET_IMAGE_GENERATION_PROMPT, /complete head and hair silhouette/i)
  assert.match(PORTRAIT_PUPPET_IMAGE_GENERATION_PROMPT, /both feet/i)
  assert.match(PORTRAIT_PUPPET_IMAGE_GENERATION_PROMPT, /one character only/i)
  assert.match(PORTRAIT_PUPPET_IMAGE_GENERATION_PROMPT, /do not crop/i)
})

test('portrait pose follows Live2D-shaped speech and expression slots', () => {
  const idle = planPortraitPuppetPose({ mood: 'idle', nowMs: 0, prefersReducedMotion: true })
  assert.equal(idle.expression, 'idle')
  assert.equal(idle.mouth, 0)
  assert.equal(idle.blink, 0)

  const speaking = planPortraitPuppetPose({
    mood: 'idle',
    isSpeaking: true,
    speechLevel: 0.8,
    nowMs: 0,
  })
  assert.equal(speaking.expression, 'speaking')
  assert.ok(speaking.mouth > 0.5)

  const listening = planPortraitPuppetPose({ mood: 'idle', isListening: true, nowMs: 100 })
  assert.equal(listening.expression, 'listening')

  const shy = planPortraitPuppetPose({
    mood: 'idle',
    performanceCue: {
      id: 'cue',
      expressionSlot: 'embarrassed',
      durationMs: 800,
      stageDirection: '(害羞)',
    },
    nowMs: 200,
  })
  assert.equal(shy.expression, 'embarrassed')
  assert.ok(shy.tilt > 0)

  const sleepy = planPortraitPuppetPose({ mood: 'sleepy', nowMs: 100 })
  assert.equal(sleepy.expression, 'sleepy')
  assert.ok(sleepy.eyeDrop > 0.3)
})

test('portrait package writes pet.json plus portrait.png and round-trips through ZIP', async () => {
  const directoryPath = await fs.mkdtemp(path.join(os.tmpdir(), 'nexus-portrait-package-'))
  try {
    const sourcePath = path.join(directoryPath, 'face.png')
    await sharp({
      create: { width: 240, height: 320, channels: 4, background: { r: 40, g: 80, b: 90, alpha: 1 } },
    }).png().toFile(sourcePath)
    const created = await createPortraitPuppetPackageFromImage({
      sourcePath,
      targetDirectory: path.join(directoryPath, 'pet'),
      id: 'oak',
      displayName: 'Oak',
    })
    const packageInfo = await readSpritePetPackage(created.manifestPath)
    assert.equal(packageInfo.kind, 'portrait-puppet')
    assert.equal(packageInfo.formatVersion, PORTRAIT_PUPPET_FORMAT_VERSION)
    assert.equal(packageInfo.renderMode, PORTRAIT_PUPPET_PROCEDURAL_RENDER_MODE)
    assert.ok(packageInfo.sourcePortraitPath.endsWith('portrait.png'))

    const extracted = await extractSpritePetZipArchive(
      created.archivePath,
      path.join(directoryPath, 'unzipped'),
    )
    const extractedInfo = await readSpritePetPackage(extracted.manifestPath)
    assert.equal(extractedInfo.kind, 'portrait-puppet')
    assert.equal(extractedInfo.id, 'oak')
    assert.deepEqual(
      (await fs.readdir(path.dirname(extracted.manifestPath))).sort(),
      ['pet.json', 'portrait.png'],
    )
  } finally {
    await fs.rm(directoryPath, { recursive: true, force: true })
  }
})

test('one-image packaging infers face and body anchors locally without a model', async () => {
  const directoryPath = await fs.mkdtemp(path.join(os.tmpdir(), 'nexus-portrait-inference-'))
  try {
    const sourcePath = path.join(directoryPath, 'character.png')
    const svg = `<svg width="240" height="480" viewBox="0 0 240 480" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="120" cy="92" rx="82" ry="86" fill="#3f2858"/>
      <ellipse cx="120" cy="112" rx="62" ry="54" fill="#f1bea4"/>
      <ellipse cx="94" cy="108" rx="10" ry="8" fill="#30243d"/>
      <ellipse cx="146" cy="108" rx="10" ry="8" fill="#30243d"/>
      <path d="M111 137 Q120 143 129 137" fill="none" stroke="#71364b" stroke-width="3"/>
      <rect x="103" y="157" width="34" height="28" rx="12" fill="#e8b59c"/>
      <path d="M60 184 Q120 154 180 184 L196 360 Q120 392 44 360Z" fill="#64558d"/>
      <rect x="84" y="345" width="28" height="126" rx="14" fill="#e9b79f"/>
      <rect x="128" y="345" width="28" height="126" rx="14" fill="#e9b79f"/>
    </svg>`
    await sharp(Buffer.from(svg)).png().toFile(sourcePath)
    const rig = await inferPortraitPuppetRigFromImage(sourcePath)
    assert.ok(rig.eyeLeftX < rig.headX)
    assert.ok(rig.eyeRightX > rig.headX)
    assert.ok(rig.eyeY < rig.mouthY)
    assert.ok(rig.mouthY < rig.neckY)
    assert.ok(rig.neckY < rig.chestY)
    assert.ok(rig.chestY < rig.waistY)
    assert.ok(Object.values(rig).every(Number.isFinite))
  } finally {
    await fs.rm(directoryPath, { recursive: true, force: true })
  }
})

test('a named image set becomes expression layers', async () => {
  const directoryPath = await fs.mkdtemp(path.join(os.tmpdir(), 'nexus-portrait-set-'))
  try {
    const idlePath = path.join(directoryPath, 'idle.png')
    const happyPath = path.join(directoryPath, 'happy.png')
    const blinkPath = path.join(directoryPath, '闭眼.png')
    await sharp({
      create: { width: 200, height: 260, channels: 4, background: { r: 30, g: 40, b: 50, alpha: 1 } },
    }).png().toFile(idlePath)
    await sharp({
      create: { width: 200, height: 260, channels: 4, background: { r: 80, g: 40, b: 40, alpha: 1 } },
    }).png().toFile(happyPath)
    await sharp({
      create: { width: 200, height: 260, channels: 4, background: { r: 10, g: 10, b: 10, alpha: 1 } },
    }).png().toFile(blinkPath)

    const created = await createPortraitPuppetPackageFromImages({
      sourcePaths: [idlePath, happyPath, blinkPath],
      targetDirectory: path.join(directoryPath, 'pet'),
      id: 'set-pet',
    })
    const packageInfo = await readSpritePetPackage(created.manifestPath)
    assert.equal(packageInfo.kind, 'portrait-puppet')
    assert.ok(packageInfo.sourceLayerPaths.happy)
    assert.ok(packageInfo.sourceLayerPaths.blink)
    assert.equal(
      resolvePortraitPuppetFaceImage({
        imagePath: 'portrait.png',
        layers: { happy: 'layers/happy.png' },
      }, 'happy'),
      'layers/happy.png',
    )
  } finally {
    await fs.rm(directoryPath, { recursive: true, force: true })
  }
})

test('portrait blink closes on a short cycle then reopens', () => {
  const open = planPortraitPuppetPose({ mood: 'idle', nowMs: 100 })
  const closed = Array.from({ length: 12_000 }, (_, nowMs) => (
    planPortraitPuppetPose({ mood: 'idle', nowMs })
  )).reduce((mostClosed, pose) => pose.blink > mostClosed.blink ? pose : mostClosed)
  assert.equal(open.blink, 0)
  assert.equal(closed.blink, 1)
})

test('portrait blink is continuous and fully reopens across its cycle', () => {
  const samples = Array.from({ length: 5_701 }, (_, nowMs) => planPortraitPuppetBlink(nowMs))
  const largestStep = samples.slice(1).reduce((largest, value, index) => (
    Math.max(largest, Math.abs(value - samples[index]))
  ), 0)
  assert.ok(largestStep < 0.05)
  assert.equal(planPortraitPuppetBlink(0), 0)
  assert.equal(planPortraitPuppetBlink(5_700), 0)
})

test('mesh deformation grounds feet while head, chest, and edges move independently', () => {
  const pose = planPortraitPuppetPose({
    mood: 'idle',
    gazeX: 0.8,
    nowMs: 1_700,
  })
  const foot = deformPortraitPuppetPoint({ x: 0.5, y: 1 }, pose)
  const head = deformPortraitPuppetPoint({ x: 0.5, y: 0.2 }, pose)
  const chest = deformPortraitPuppetPoint({ x: 0.32, y: 0.42 }, pose)
  const edge = deformPortraitPuppetPoint({ x: 0.08, y: 0.68 }, pose)

  assert.ok(Math.abs(foot.x - 0.5) < 0.0001)
  assert.ok(Math.abs(foot.y - 1) < 0.0001)
  assert.ok(Math.abs(head.x - 0.5) > Math.abs(foot.x - 0.5))
  assert.notEqual(chest.x, 0.32)
  assert.notEqual(edge.x, 0.08)
  assert.ok(createPortraitPuppetMesh().triangles.length >= 250)
})

test('portrait pose transitions damp instead of snapping to a new state', () => {
  const idle = planPortraitPuppetPose({ mood: 'idle', nowMs: 1_000 })
  const speaking = planPortraitPuppetPose({
    mood: 'idle',
    isSpeaking: true,
    speechLevel: 1,
    nowMs: 1_016,
  })
  const firstFrame = interpolatePortraitPuppetPose(idle, speaking, 16)

  assert.ok(firstFrame.mouth > idle.mouth)
  assert.ok(firstFrame.mouth < speaking.mouth)
  assert.ok(Math.abs(firstFrame.headTilt - idle.headTilt) < Math.abs(speaking.headTilt - idle.headTilt))
})

test('one-image procedural rig exposes independent full-body idle channels', () => {
  const samples = [0, 900, 1_800, 2_700, 3_600, 4_500].map((nowMs) => (
    planPortraitPuppetPose({ mood: 'idle', nowMs })
  ))
  for (const key of ['breath', 'bodyLean', 'armSway', 'hairSway', 'clothSway', 'pendantSway'] as const) {
    const values = samples.map((pose) => pose[key])
    assert.ok(Math.max(...values) - Math.min(...values) > 0.08, `${key} should move during idle`)
  }
  assert.notDeepEqual(
    samples.map((pose) => pose.hairSway.toFixed(3)),
    samples.map((pose) => pose.clothSway.toFixed(3)),
  )
})

test('procedural head turn keeps the source mesh rigid and moves rigid head plus face patches', () => {
  const neutral = planPortraitPuppetPose({ mood: 'idle', nowMs: 0, prefersReducedMotion: true })
  const sourcePoints = [
    { x: 0.34, y: 0.19 },
    { x: 0.5, y: 0.23 },
    { x: 0.66, y: 0.19 },
    { x: 0.08, y: 0.12 },
  ]
  for (const point of sourcePoints) {
    const baseline = deformPortraitPuppetPoint(point, { ...neutral, headYaw: 0 })
    for (const headYaw of [-1, -0.5, 0.5, 1]) {
      assert.deepEqual(
        deformPortraitPuppetPoint(point, { ...neutral, headYaw }),
        baseline,
        'yaw must not bend source-image triangles',
      )
    }
  }

  const turns = [-1, -0.5, 0, 0.5, 1].map(resolvePortraitPuppetRigidTurn)
  assert.deepEqual(turns.map((turn) => turn.faceOffsetX), [-0.016, -0.008, 0, 0.008, 0.016])
  for (const turn of turns) {
    assert.equal(turn.scaleX, 1)
    assert.equal(turn.scaleY, 1)
    assert.equal(turn.shearX, 0)
    assert.equal(turn.shearY, 0)
  }

  const headTurns = [-1, -0.5, 0, 0.5, 1]
    .map((headYaw) => resolvePortraitPuppetRigidHeadFollow(headYaw, headYaw * 1.35, 0))
  assert.deepEqual(
    headTurns.map((turn) => turn.headOffsetX),
    [-0.006, -0.003, 0, 0.003, 0.006],
  )
  assert.ok(headTurns[0].rotationRadians < 0)
  assert.equal(headTurns[2].rotationRadians, 0)
  assert.ok(headTurns[4].rotationRadians > 0)
  for (const turn of headTurns) {
    assert.equal(turn.scaleX, 1)
    assert.equal(turn.scaleY, 1)
    assert.equal(turn.shearX, 0)
    assert.equal(turn.shearY, 0)
  }
  assert.equal(
    turns[4].faceOffsetX + headTurns[4].headOffsetX,
    0.022,
    'head plus relative face parallax must preserve the visible overall turn distance',
  )
})

test('procedural geometry caps combined idle strain instead of rubber-sheet warping', () => {
  const rig = normalizePortraitPuppetRig({
    headX: 0.502983,
    headY: 0.147169,
    headRadiusX: 0.34026,
    headRadiusY: 0.147169,
    neckY: 0.294339,
    eyeLeftX: 0.40771,
    eyeRightX: 0.598256,
    eyeY: 0.211346,
    eyeRadiusX: 0.066351,
    eyeRadiusY: 0.025012,
    mouthX: 0.502983,
    mouthY: 0.247726,
    mouthRadiusX: 0.047636,
    mouthRadiusY: 0.015916,
    chestY: 0.364905,
    waistY: 0.484867,
  })
  const sourcePose = {
    ...planPortraitPuppetPose({ mood: 'idle', nowMs: 0, prefersReducedMotion: true }),
    breath: 0.8,
    bodyLean: 0.7,
    headYaw: 0.75,
    headTilt: 1.2,
    headBob: 0.006,
    eyeX: 0.6,
    armSway: 0.5,
    hairSway: 0.55,
    clothSway: 0.5,
    pendantSway: 0.7,
    secondarySway: 0.5,
  }
  const pose = resolvePortraitPuppetProceduralGeometryPose(sourcePose)
  assert.equal(pose.headYaw, 0)
  assert.equal(pose.headTilt, 0)
  assert.equal(pose.headBob, 0)
  assert.equal(pose.eyeX, 0)

  const epsilon = 0.0015
  let maxStretch = 0
  let maxShear = 0
  let maxAnisotropy = 1
  for (let y = 0.04; y < 0.9; y += 0.018) {
    for (let x = 0.08; x < 0.92; x += 0.018) {
      const center = deformPortraitPuppetPoint({ x, y }, pose, rig, 0.75)
      const right = deformPortraitPuppetPoint({ x: x + epsilon, y }, pose, rig, 0.75)
      const down = deformPortraitPuppetPoint({ x, y: y + epsilon }, pose, rig, 0.75)
      const axisX = {
        x: (right.x - center.x) / epsilon,
        y: (right.y - center.y) / epsilon,
      }
      const axisY = {
        x: (down.x - center.x) / epsilon,
        y: (down.y - center.y) / epsilon,
      }
      const lengthX = Math.hypot(axisX.x, axisX.y)
      const lengthY = Math.hypot(axisY.x, axisY.y)
      maxStretch = Math.max(maxStretch, Math.abs(lengthX - 1), Math.abs(lengthY - 1))
      maxShear = Math.max(
        maxShear,
        Math.abs((axisX.x * axisY.x + axisX.y * axisY.y) / (lengthX * lengthY || 1)),
      )
      maxAnisotropy = Math.max(
        maxAnisotropy,
        Math.max(lengthX, lengthY) / Math.max(0.0001, Math.min(lengthX, lengthY)),
      )
    }
  }
  assert.ok(maxStretch < 0.07, `max local stretch ${maxStretch} must stay below 7%`)
  assert.ok(maxShear < 0.11, `max local shear ${maxShear} must stay below 11%`)
  assert.ok(maxAnisotropy < 1.075, `max anisotropy ${maxAnisotropy} must stay below 1.075`)
})

test('rigid head follow stays normalized across portrait resolutions and clamps extreme input', () => {
  const face = resolvePortraitPuppetRigidTurn(1)
  const head = resolvePortraitPuppetRigidHeadFollow(1, 1.35, 0)
  for (const targetWidth of [96, 168, 320, 768]) {
    const totalPixels = (face.faceOffsetX + head.headOffsetX) * targetWidth
    assert.ok(Math.abs(totalPixels / targetWidth - 0.022) < 1e-12)
  }

  const extreme = resolvePortraitPuppetRigidHeadFollow(50, 90, 1)
  const clamped = resolvePortraitPuppetRigidHeadFollow(1, 7, 0.018)
  assert.deepEqual(extreme, clamped)
  assert.equal(extreme.scaleX, 1)
  assert.equal(extreme.scaleY, 1)
  assert.equal(extreme.shearX, 0)
  assert.equal(extreme.shearY, 0)
})

test('portrait v2 key poses reach a visible left/right turn weight', () => {
  assert.equal(resolvePortraitPuppetTurnBlend(0).weight, 0)
  assert.equal(resolvePortraitPuppetTurnBlend(0.18).weight, 0)
  assert.equal(resolvePortraitPuppetTurnBlend(0.24).weight, 1)
  assert.equal(resolvePortraitPuppetTurnBlend(-1).direction, 'left')
  assert.equal(resolvePortraitPuppetTurnBlend(1).direction, 'right')
  assert.ok(resolvePortraitPuppetTurnBlend(0.5).weight > 0.6)
  assert.equal(resolvePortraitPuppetTurnBlend(1).weight, 1)
})

test('portrait debug pose makes native pixel captures deterministic', () => {
  const idle = planPortraitPuppetPose({ mood: 'idle', nowMs: 100 })
  assert.equal(applyPortraitPuppetDebugPose(idle, '?portraitBlink=1').blink, idle.blink)
  const forced = applyPortraitPuppetDebugPose(
    idle,
    '?portraitDebug=1&portraitBlink=1&portraitMouth=0.75&portraitHeadYaw=-1&portraitBodyBob=0.02',
  )
  assert.equal(forced.blink, 1)
  assert.equal(forced.mouth, 0.75)
  assert.equal(forced.headYaw, -1)
  assert.equal(forced.bodyBob, 0.02)
})

test('portrait second-order physics gives secondary parts inertial lag', () => {
  const state = createPortraitPuppetPhysicsState()
  stepPortraitPuppetPhysics(state, {
    headYaw: -1,
    headTilt: 0,
    bodyLean: 0,
    secondarySway: 0,
  }, 16)
  let sample = stepPortraitPuppetPhysics(state, {
    headYaw: 1,
    headTilt: 0,
    bodyLean: 0,
    secondarySway: 0,
  }, 16)
  const firstHead = sample.headYaw
  const firstSecondary = sample.secondarySway
  for (let index = 0; index < 20; index += 1) {
    sample = stepPortraitPuppetPhysics(state, {
      headYaw: 1,
      headTilt: 0,
      bodyLean: 0,
      secondarySway: 0,
    }, 16)
  }
  assert.ok(firstHead < sample.headYaw)
  assert.ok(Math.abs(firstSecondary) > 0.001)
  for (const value of Object.values(sample)) assert.ok(Number.isFinite(value))
})

test('portrait rig normalization bounds untrusted manifest anchors', () => {
  const rig = normalizePortraitPuppetRig({
    headX: 9,
    headY: -2,
    neckY: 0,
    motionIntensity: 99,
  })
  assert.equal(rig.headX, 0.75)
  assert.equal(rig.headY, 0.08)
  assert.ok(rig.neckY >= rig.headY + 0.06)
  assert.equal(rig.motionIntensity, 1.6)
})

test('persisted imported model selection is repaired only after successful discovery', () => {
  const builtIns = [{ id: 'mao' }]
  assert.equal(shouldRepairPetModelSelection('pending', 'imported-starlight', builtIns), false)
  assert.equal(shouldRepairPetModelSelection('failed', 'imported-starlight', builtIns), false)
  assert.equal(shouldRepairPetModelSelection('ready', 'imported-starlight', builtIns), true)
  assert.equal(shouldRepairPetModelSelection(
    'ready',
    'imported-starlight',
    [...builtIns, { id: 'imported-starlight' }],
  ), false)
})

test('pending imported selection does not mount the default Live2D model', () => {
  assert.equal(isPetModelSelectionResolved('pending', 'sprite-imported-pet'), false)
  assert.equal(isPetModelSelectionResolved('failed', 'sprite-imported-pet'), false)
  assert.equal(isPetModelSelectionResolved('ready', 'sprite-imported-pet'), true)
  assert.equal(isPetModelSelectionResolved('pending', 'mao'), true)
})

test('pet model discovery keeps a last-good list across refresh failures', () => {
  const empty = { status: 'pending' as const, models: [] }
  const loaded = { status: 'ready' as const, models: [{ id: 'imported-starlight' }] }

  assert.deepEqual(nextPetModelDiscoveryBeforeLoad(empty), { status: 'pending', models: [] })
  assert.deepEqual(nextPetModelDiscoveryBeforeLoad(loaded), loaded)
  assert.deepEqual(nextPetModelDiscoveryAfterError(empty), { status: 'failed', models: [] })
  assert.deepEqual(nextPetModelDiscoveryAfterError(loaded), { status: 'ready', models: loaded.models })
})
