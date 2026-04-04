import assert from 'node:assert/strict'
import { test } from 'node:test'

import { encodeVadAudioToWavBlob } from '../src/features/hearing/browserVad.ts'

test('encodeVadAudioToWavBlob writes a mono 16-bit wav payload', async () => {
  const samples = new Float32Array([0, 0.5, -0.5, 1, -1])
  const blob = encodeVadAudioToWavBlob(samples, 16_000)
  const buffer = Buffer.from(await blob.arrayBuffer())

  assert.equal(blob.type, 'audio/wav')
  assert.equal(buffer.toString('ascii', 0, 4), 'RIFF')
  assert.equal(buffer.toString('ascii', 8, 12), 'WAVE')
  assert.equal(buffer.toString('ascii', 12, 16), 'fmt ')
  assert.equal(buffer.toString('ascii', 36, 40), 'data')
  assert.equal(buffer.readUInt16LE(22), 1)
  assert.equal(buffer.readUInt16LE(34), 16)
  assert.equal(buffer.readUInt32LE(24), 16_000)
  assert.equal(buffer.readUInt32LE(40), samples.length * 2)
  assert.equal(buffer.length, 44 + samples.length * 2)
})
