import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import sharp from 'sharp'

import {
  copyPortraitPuppetV4Assets,
  resolvePortraitPuppetV4Package,
  validatePortraitPuppetV4Assets,
} from '../electron/services/portraitPuppetV4Package.js'
import { readSpritePetPackage } from '../electron/services/spritePetPackage.js'
import { createSpritePetPackageFromImage } from '../electron/services/spritePetMaker.js'
import {
  isFlatPortraitPuppetV4ImageSet,
  resolvePortraitPuppetV4LayerRoot,
} from '../electron/services/portraitPuppetV4Package.js'
import {
  PET_IPC_ERROR_CODES,
  extractPetIpcErrorCode,
} from '../shared/petErrorCodes.js'
import { listSpritePetModelsFromRoot } from '../electron/services/spritePetModelDiscovery.js'

const CORE_ROLES = [
  'face-base',
  'eye-white-left',
  'eye-white-right',
  'iris-left',
  'iris-right',
  'eyelid-upper-left',
  'eyelid-upper-right',
  'mouth-closed',
  'mouth-cavity',
  'neck',
  'torso',
]

async function writeLayer(filePath: string, width = 64, height = 96) {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 120, g: 80, b: 200, alpha: 0.8 },
    },
  }).png().toFile(filePath)
}

function manifestFixture() {
  return {
    id: 'package-test',
    displayName: 'Package Test',
    kind: 'portrait-puppet',
    formatVersion: 4,
    renderMode: 'layered-artmesh-v1',
    qualityTier: 'standard',
    portraitPath: 'preview.png',
    canvas: { width: 64, height: 96 },
    parts: CORE_ROLES.map((role, index) => ({
      id: role,
      role,
      path: `parts/${role}.png`,
      zIndex: index,
    })),
    masks: [],
    physics: [],
  }
}

test('v4 package resolves, decodes, and copies same-canvas alpha assets', async () => {
  const rootPath = await fs.mkdtemp(path.join(os.tmpdir(), 'nexus-portrait-v4-'))
  const targetPath = await fs.mkdtemp(path.join(os.tmpdir(), 'nexus-portrait-v4-import-'))
  try {
    const source = manifestFixture()
    await writeLayer(path.join(rootPath, source.portraitPath))
    for (const part of source.parts) await writeLayer(path.join(rootPath, part.path))
    const manifestPath = path.join(rootPath, 'pet.json')
    await fs.writeFile(manifestPath, JSON.stringify(source), 'utf8')

    const resolved = resolvePortraitPuppetV4Package(source, manifestPath)
    const audit = await validatePortraitPuppetV4Assets(resolved)
    const throughPetReader = await readSpritePetPackage(manifestPath)
    const discovered = await listSpritePetModelsFromRoot({
      rootPath,
      description: 'test',
      imagePathBuilder: (relativePath: string) => `asset://${relativePath}`,
    })
    const copied = await copyPortraitPuppetV4Assets(resolved, targetPath)

    assert.equal(audit.assetCount, 12)
    assert.equal(audit.alignment.aligned, true)
    assert.equal(audit.alignment.missingPixels, 0)
    assert.equal(throughPetReader.renderMode, 'layered-artmesh-v1')
    assert.equal(discovered[0].portraitPuppet.layeredRig.parts.length, 11)
    assert.equal(
      discovered[0].portraitPuppet.layeredRig.parts[0].path,
      'asset://parts/face-base.png',
    )
    assert.equal(copied.parts.length, 11)
    assert.equal(copied.parts[0].path, 'parts/face-base.png')
    await fs.access(path.join(targetPath, 'parts/face-base.png'))
  } finally {
    await fs.rm(rootPath, { recursive: true, force: true })
    await fs.rm(targetPath, { recursive: true, force: true })
  }
})

test('maker prefers a v4 layer folder over the single-image v3 fallback', async () => {
  const rootPath = await fs.mkdtemp(path.join(os.tmpdir(), 'nexus-portrait-v4-maker-src-'))
  const targetDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'nexus-portrait-v4-maker-out-'))
  try {
    const parts = [
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
    await writeLayer(path.join(rootPath, 'preview.png'))
    for (const role of parts) await writeLayer(path.join(rootPath, 'parts', `${role}.png`))
    for (const role of ['face', 'eye-left', 'eye-right', 'mouth']) {
      await writeLayer(path.join(rootPath, 'masks', `${role}.png`))
    }

    assert.equal(await resolvePortraitPuppetV4LayerRoot([rootPath]), rootPath)
    assert.equal(
      isFlatPortraitPuppetV4ImageSet([
        path.join(rootPath, 'preview.png'),
        ...parts.map((role) => path.join(rootPath, 'parts', `${role}.png`)),
      ]),
      true,
    )

    const result = await createSpritePetPackageFromImage({
      sourcePath: rootPath,
      targetDirectory,
      id: 'layered-maker',
      displayName: 'Layered Maker',
      force: true,
    })
    const packageInfo = await readSpritePetPackage(result.manifestPath)

    assert.equal(packageInfo.kind, 'portrait-puppet')
    assert.equal(packageInfo.formatVersion, 4)
    assert.equal(packageInfo.renderMode, 'layered-artmesh-v1')
    assert.equal(result.sourceLayout, 'layered-v4')
  } finally {
    await fs.rm(rootPath, { recursive: true, force: true })
    await fs.rm(targetDirectory, { recursive: true, force: true })
  }
})

test('formatVersion 4 without a v4 renderMode fails closed instead of becoming v3', async () => {
  const rootPath = await fs.mkdtemp(path.join(os.tmpdir(), 'nexus-portrait-v4-downgrade-'))
  try {
    await writeLayer(path.join(rootPath, 'preview.png'))
    const manifestPath = path.join(rootPath, 'pet.json')
    await fs.writeFile(manifestPath, JSON.stringify({
      id: 'broken-v4',
      displayName: 'Broken v4',
      kind: 'portrait-puppet',
      formatVersion: 4,
      portraitPath: 'preview.png',
    }), 'utf8')

    await assert.rejects(
      () => readSpritePetPackage(manifestPath),
      (error) => extractPetIpcErrorCode(error) === PET_IPC_ERROR_CODES.UNSUPPORTED_FILE,
    )
  } finally {
    await fs.rm(rootPath, { recursive: true, force: true })
  }
})

test('v4 package rejects a wrong-size or non-alpha part before import', async () => {
  const rootPath = await fs.mkdtemp(path.join(os.tmpdir(), 'nexus-portrait-v4-bad-'))
  try {
    const source = manifestFixture()
    await writeLayer(path.join(rootPath, source.portraitPath))
    for (const part of source.parts) await writeLayer(
      path.join(rootPath, part.path),
      part.id === 'iris-left' ? 63 : 64,
      96,
    )
    const resolved = resolvePortraitPuppetV4Package(source, path.join(rootPath, 'pet.json'))

    await assert.rejects(
      validatePortraitPuppetV4Assets(resolved),
      /NEXUS_ERR_PET_UNSUPPORTED_FILE/u,
    )
  } finally {
    await fs.rm(rootPath, { recursive: true, force: true })
  }
})

test('v4 package rejects traversal before touching outside files', () => {
  const source = manifestFixture()
  source.parts[0].path = '../escape.png'
  assert.throws(
    () => resolvePortraitPuppetV4Package(source, '/tmp/portrait-v4/pet.json'),
    /NEXUS_ERR_PET_UNSUPPORTED_FILE/u,
  )
})
