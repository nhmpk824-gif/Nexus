import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  SPRITE_PET_DENSE_ATLAS_HEIGHT,
  SPRITE_PET_DENSE_ATLAS_WIDTH,
  SPRITE_PET_DENSE_ROW_CONTRACT,
  detectSpritePetAtlasEdition,
  resolveSpritePetWearState,
} from '../shared/spritePetWearContract.js'
import {
  createSpritePetWearSession,
  decideSpritePetWear,
  hasSpritePetWearIntent,
  planSpritePetWearBeats,
} from '../src/features/pet/spritePetWear.ts'

test('dense atlas is 8 by 15 and larger than the legacy 8x9 sheet', () => {
  assert.equal(SPRITE_PET_DENSE_ATLAS_WIDTH, 1536)
  assert.equal(SPRITE_PET_DENSE_ATLAS_HEIGHT, 3120)
  assert.equal(SPRITE_PET_DENSE_ROW_CONTRACT.length, 15)
  assert.deepEqual(SPRITE_PET_DENSE_ROW_CONTRACT.map((entry) => entry.state), [
    'idle',
    'listening',
    'speaking',
    'thinking',
    'happy',
    'shy',
    'sad',
    'waiting',
    'failed',
    'waving',
    'jumping',
    'review',
    'running',
    'running-right',
    'running-left',
  ])
})

test('detectSpritePetAtlasEdition tells dense sheets from Codex 8x9 and portraits', () => {
  assert.equal(detectSpritePetAtlasEdition(1536, 3120), 'dense')
  assert.equal(detectSpritePetAtlasEdition(1536, 1872), 'legacy-8x9')
  assert.equal(detectSpritePetAtlasEdition(800, 1200), 'unknown')
  assert.equal(detectSpritePetAtlasEdition(800, 1600), 'unknown')
  assert.equal(detectSpritePetAtlasEdition(768, 936), 'legacy-8x9')
  assert.equal(detectSpritePetAtlasEdition(0, 0), 'unknown')
})

test('legacy 8x9 falls back instead of inventing speaking and shy rows', () => {
  assert.equal(resolveSpritePetWearState('dense', 'speaking'), 'speaking')
  assert.equal(resolveSpritePetWearState('dense', 'shy'), 'shy')
  assert.equal(resolveSpritePetWearState('legacy-8x9', 'speaking'), 'waving')
  assert.equal(resolveSpritePetWearState('legacy-8x9', 'listening'), 'waiting')
  assert.equal(resolveSpritePetWearState('legacy-8x9', 'shy'), 'failed')
  assert.equal(resolveSpritePetWearState('unknown', 'speaking'), 'idle')
})

test('wear intent matches conversational phrasing and ignores a plain caption', () => {
  assert.equal(hasSpritePetWearIntent('用这张做一只宠物'), true)
  assert.equal(hasSpritePetWearIntent('换上'), true)
  assert.equal(hasSpritePetWearIntent('穿上'), true)
  assert.equal(hasSpritePetWearIntent('wear this'), true)
  assert.equal(hasSpritePetWearIntent('这是我今天拍的猫'), false)
  assert.equal(hasSpritePetWearIntent(''), false)
})

test('decideSpritePetWear treats a sheet as wear even without a spoken command', () => {
  assert.deepEqual(decideSpritePetWear({ imageWidth: 1536, imageHeight: 3120 }), {
    shouldWear: true,
    reason: 'atlas',
    edition: 'dense',
  })
  assert.equal(decideSpritePetWear({ text: '换上', imageWidth: 800, imageHeight: 800 }).reason, 'intent')
  assert.equal(decideSpritePetWear({ text: '看看这张', imageWidth: 800, imageHeight: 800 }).shouldWear, false)
})

test('speaking plans three dense beats and collapses on a legacy sheet', () => {
  const dense = planSpritePetWearBeats('dense', 'speaking')
  assert.deepEqual(dense.map((beat) => beat.playableState), ['thinking', 'speaking', 'happy'])
  assert.equal(dense.length, 3)

  const legacy = planSpritePetWearBeats('legacy-8x9', 'speaking')
  assert.deepEqual(legacy.map((beat) => beat.playableState), ['review', 'waving'])
  assert.ok(legacy.length <= 3)
})

test('createSpritePetWearSession only calls the host when a sheet should be worn', async () => {
  const calls: string[] = []
  const session = createSpritePetWearSession({
    async importSheet({ sourcePath, edition }) {
      calls.push(`import:${sourcePath}:${edition}`)
      return { petId: 'oak', displayName: 'Oak' }
    },
    async switchAvatar(imported) {
      calls.push(`switch:${imported.petId}`)
    },
    async claim(imported) {
      calls.push(`claim:${imported.petId}`)
    },
  })

  const skipped = await session.consider({ text: '看看这张', imageWidth: 64, imageHeight: 64 })
  assert.equal(skipped.applied, false)
  assert.deepEqual(calls, [])

  const worn = await session.consider({
    text: '换上',
    sourcePath: '/tmp/sheet.png',
    imageWidth: 1536,
    imageHeight: 3120,
  })
  assert.equal(worn.applied, true)
  assert.equal(worn.imported?.petId, 'oak')
  assert.deepEqual(calls, [
    'import:/tmp/sheet.png:dense',
    'switch:oak',
    'claim:oak',
  ])
})
