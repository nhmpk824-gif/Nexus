import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  PET_IPC_ERROR_CODES,
  buildPetIpcError,
  extractPetIpcErrorCode,
} from '../shared/petErrorCodes.js'
import { humanizeError } from '../src/lib/humanizeError.ts'

test('pet IPC errors carry a stable code through an Electron-style message wrap', () => {
  const error = buildPetIpcError(PET_IPC_ERROR_CODES.ALREADY_IMPORTED)
  assert.equal(error.code, PET_IPC_ERROR_CODES.ALREADY_IMPORTED)
  assert.equal(extractPetIpcErrorCode(error), PET_IPC_ERROR_CODES.ALREADY_IMPORTED)
  assert.equal(
    extractPetIpcErrorCode(`Error invoking remote method 'pet-model:import': Error: ${error.message}`),
    PET_IPC_ERROR_CODES.ALREADY_IMPORTED,
  )
})

test('humanizeError maps pet IPC codes instead of leaking the token', () => {
  assert.match(
    humanizeError(buildPetIpcError(PET_IPC_ERROR_CODES.ALREADY_IMPORTED), 'pet'),
    /本地库|library/i,
  )
  assert.match(
    humanizeError(new Error('NEXUS_ERR_PET_UNSUPPORTED_FILE'), 'pet'),
    /model3\.json/,
  )
  assert.equal(
    humanizeError(new Error('some unexpected pet failure'), 'pet'),
    humanizeError(new Error('NEXUS_ERR_PET_UNKNOWN'), 'pet'),
  )
})
