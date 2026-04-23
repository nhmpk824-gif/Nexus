import { ipcMain } from 'electron'
import {
  vaultStore,
  vaultRetrieve,
  vaultDelete,
  vaultListSlots,
  vaultStoreMany,
  vaultRetrieveMany,
  vaultIsAvailable,
} from '../services/keyVault.js'
import {
  requireTrustedSender,
  requireSlotName,
  requireSlotNames,
  requireVaultEntries,
  expectString,
} from './validate.js'
import { audit } from '../services/auditLog.js'

// Per-sender rate limit on bulk vault operations. Hostile renderer code
// (XSS in chat-rendered markdown, compromised plugin page) could
// otherwise enumerate every stored API key in milliseconds via
// retrieve-many. The limit is generous for legit settings hydration on
// startup but kicks in fast enough to make brute exfil noisy.
//
// Strict rate-limit on bulk reads only — single retrieve(slot) requires
// the renderer to know each slot name, which is itself a barrier.
const BULK_OP_WINDOW_MS = 60_000
const BULK_OP_MAX_PER_WINDOW = 6

const _bulkOpHistory = new WeakMap() // webContents → [timestamps]

function rateLimitBulkOp(event, opName) {
  const now = Date.now()
  const history = _bulkOpHistory.get(event.sender) ?? []
  const recent = history.filter((t) => now - t < BULK_OP_WINDOW_MS)
  if (recent.length >= BULK_OP_MAX_PER_WINDOW) {
    audit('vault', `${opName}-rate-limited`, { recentCount: recent.length })
    throw new Error(
      `vault ${opName} rate-limited: more than ${BULK_OP_MAX_PER_WINDOW} bulk operations in 60s — `
      + 'looks like programmatic enumeration. Check the audit log.',
    )
  }
  recent.push(now)
  _bulkOpHistory.set(event.sender, recent)
}

export function register() {
  ipcMain.handle('vault:is-available', (event) => {
    requireTrustedSender(event)
    return vaultIsAvailable()
  })

  ipcMain.handle('vault:store', (event, slot, plaintext) => {
    requireTrustedSender(event)
    const name = requireSlotName(slot)
    audit('vault', 'store', { slot: name })
    return vaultStore(name, expectString(plaintext, 'plaintext'))
  })

  ipcMain.handle('vault:retrieve', (event, slot) => {
    requireTrustedSender(event)
    const name = requireSlotName(slot)
    audit('vault', 'retrieve', { slot: name })
    return vaultRetrieve(name)
  })

  ipcMain.handle('vault:delete', (event, slot) => {
    requireTrustedSender(event)
    const name = requireSlotName(slot)
    audit('vault', 'delete', { slot: name })
    return vaultDelete(name)
  })

  ipcMain.handle('vault:list-slots', (event) => {
    requireTrustedSender(event)
    rateLimitBulkOp(event, 'list-slots')
    audit('vault', 'list-slots')
    return vaultListSlots()
  })

  ipcMain.handle('vault:store-many', (event, entries) => {
    requireTrustedSender(event)
    const validated = requireVaultEntries(entries)
    // requireVaultEntries returns a Record<slot, plaintext> — using
    // Array.map on it crashes; pull the slot names via Object.keys so the
    // audit log is accurate and settings save doesn't bail out here.
    audit('vault', 'store-many', { slots: Object.keys(validated) })
    return vaultStoreMany(validated)
  })

  ipcMain.handle('vault:retrieve-many', (event, slots) => {
    requireTrustedSender(event)
    rateLimitBulkOp(event, 'retrieve-many')
    const names = requireSlotNames(slots)
    audit('vault', 'retrieve-many', { slots: names })
    return vaultRetrieveMany(names)
  })
}
