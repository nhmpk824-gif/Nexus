import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  checkPermission,
  getIntegrationPermissionMode,
  isActionAllowed,
} from '../src/features/integrations/permissions.ts'
import {
  MAX_INTEGRATION_WHITELIST_ENTRIES,
  parseDiscordChannelIdList,
  parseTelegramChatIdList,
} from '../src/features/integrations/allowlists.ts'
import {
  parseCsvIdSet,
  resolveBridgeReplyTarget,
} from '../src/app/controllers/bridgeUtils.ts'
import type { AppSettings } from '../src/types/app.ts'

function settings(overrides: Partial<AppSettings> = {}): AppSettings {
  return {
    minecraftPermissionMode: 'read-only',
    factorioPermissionMode: 'confirm',
    telegramPermissionMode: 'confirm',
    discordPermissionMode: 'auto',
    mcpPermissionMode: 'auto',
    ...overrides,
  } as AppSettings
}

test('integration permissions enforce read, confirmation, and auto levels', () => {
  const s = settings()

  assert.equal(getIntegrationPermissionMode(s, 'minecraft'), 'read-only')
  assert.deepEqual(checkPermission(s, 'minecraft', 'read'), { allowed: true })
  assert.equal(checkPermission(s, 'minecraft', 'send').reason, 'blocked')

  const telegramSend = checkPermission(s, 'telegram', 'send')
  assert.equal(telegramSend.allowed, false)
  if (!telegramSend.allowed) assert.equal(telegramSend.reason, 'needs_confirmation')

  assert.equal(isActionAllowed(s, 'discord', 'execute'), true)
  assert.equal(isActionAllowed(s, 'discord', 'configure'), true)
  assert.equal(isActionAllowed(s, 'telegram', 'configure'), false)
})

test('unknown integrations default to confirm mode instead of silent auto', () => {
  const s = settings()

  assert.equal(getIntegrationPermissionMode(s, 'unknown-service'), 'confirm')
  const result = checkPermission(s, 'unknown-service', 'execute')
  assert.equal(result.allowed, false)
  if (!result.allowed) assert.equal(result.reason, 'needs_confirmation')
})

test('integration allowlist parsers keep only valid target ids and dedupe them', () => {
  assert.deepEqual(
    parseTelegramChatIdList('123, -100123456, 1.5, 1e3, 0, nope, 123, 9007199254740993'),
    [123, -100123456],
  )

  assert.deepEqual(
    parseDiscordChannelIdList('123456789012345678, general, 123456789012345678, 98765432101234567890, 123-456'),
    ['123456789012345678', '98765432101234567890'],
  )
})

test('integration allowlist parsers are safe for malformed persisted values', () => {
  assert.deepEqual(parseTelegramChatIdList(undefined), [])
  assert.deepEqual(parseTelegramChatIdList(['123'] as never), [])
  assert.deepEqual(parseDiscordChannelIdList(null), [])
  assert.deepEqual(parseDiscordChannelIdList({ value: '123' } as never), [])
})

test('integration allowlist parsers cap pathological lists', () => {
  const manyTelegramIds = Array.from({ length: MAX_INTEGRATION_WHITELIST_ENTRIES + 20 }, (_, index) => String(index + 1))
    .join(',')
  const manyDiscordIds = Array.from(
    { length: MAX_INTEGRATION_WHITELIST_ENTRIES + 20 },
    (_, index) => (100000000000000000n + BigInt(index)).toString(),
  )
    .join(',')

  assert.equal(parseTelegramChatIdList(manyTelegramIds).length, MAX_INTEGRATION_WHITELIST_ENTRIES)
  assert.equal(parseDiscordChannelIdList(manyDiscordIds).length, MAX_INTEGRATION_WHITELIST_ENTRIES)
})

test('bridge owner id parser trims, dedupes, caps, and ignores malformed values', () => {
  assert.deepEqual([...parseCsvIdSet(' 123,abc,123, ,456 ')], ['123', 'abc', '456'])
  assert.deepEqual([...parseCsvIdSet(undefined)], [])

  const manyIds = Array.from({ length: MAX_INTEGRATION_WHITELIST_ENTRIES + 10 }, (_, index) => String(index + 1))
    .join(',')
  assert.equal(parseCsvIdSet(manyIds).size, MAX_INTEGRATION_WHITELIST_ENTRIES)
})

test('bridge reply target does not fall back to the latest chat when an explicit target is unknown', () => {
  const latest = { chatId: 1, messageId: 10 }
  const entries = new Map<number, typeof latest>([[1, latest]])

  assert.equal(resolveBridgeReplyTarget(entries, latest), latest)
  assert.equal(resolveBridgeReplyTarget(entries, latest, 1), latest)
  assert.equal(resolveBridgeReplyTarget(entries, latest, 2), null)
})
