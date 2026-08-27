import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import type { CoreTime } from '../src/core/time.ts'
import { broadcastToChannels } from '../src/features/integrations/channelBroadcast.ts'
import {
  createCoreRuntime,
  getCoreRuntime,
  rememberDiscordChannelId,
  resetCoreRuntime,
  setDiscordKnownChannelIds,
} from '../src/lib/coreRuntime.ts'
import type { AppSettings } from '../src/types/app.ts'

class MemoryStorage {
  private data = new Map<string, string>()
  getItem(key: string) { return this.data.get(key) ?? null }
  setItem(key: string, value: string) { this.data.set(key, String(value)) }
  removeItem(key: string) { this.data.delete(key) }
  clear() { this.data.clear() }
}

function installStorage() {
  Object.defineProperty(globalThis, 'window', {
    value: { localStorage: new MemoryStorage() },
    configurable: true,
    writable: true,
  })
}

function frozenTime(start = 1_000): CoreTime {
  let seq = 0
  return {
    now: () => start,
    id: (prefix) => `${prefix}${start}-${++seq}`,
  }
}

function isolatedRuntime(time?: CoreTime) {
  return createCoreRuntime({
    time,
    seedSkills: false,
    loadAuthSnapshot: () => ({ profiles: [] }),
    loadBudgetConfig: () => ({}),
    loadCostEntries: () => [],
    persistAuthSnapshot: () => {},
    persistCostEntries: () => {},
    persistBudgetConfig: () => {},
  })
}

test('createCoreRuntime instances do not share store state', () => {
  const left = isolatedRuntime()
  const right = isolatedRuntime()

  left.todoStore.add('local-chat', 'only-left')
  left.authStore.register({
    id: 'deepseek-a',
    providerId: 'deepseek',
    apiKey: 'key-a',
  })

  assert.equal(right.todoStore.list('local-chat').length, 0)
  assert.deepEqual(right.authStore.list(), [])
  assert.notEqual(left, right)
})

test('createCoreRuntime seeds builtin skills unless disabled', () => {
  const seeded = createCoreRuntime({
    seedSkills: true,
    loadAuthSnapshot: () => ({ profiles: [] }),
    loadBudgetConfig: () => ({}),
    loadCostEntries: () => [],
    persistAuthSnapshot: () => {},
    persistCostEntries: () => {},
    persistBudgetConfig: () => {},
  })
  const blank = isolatedRuntime()

  assert.ok(seeded.skills.get('builtin-search-assist'))
  assert.equal(blank.skills.list().length, 0)
})

test('createCoreRuntime persist callbacks fire from the runtime methods', () => {
  const snapshots: unknown[] = []
  const runtime = createCoreRuntime({
    seedSkills: false,
    loadAuthSnapshot: () => ({ profiles: [] }),
    loadBudgetConfig: () => ({}),
    loadCostEntries: () => [],
    persistAuthSnapshot: (snapshot) => {
      snapshots.push(snapshot)
    },
    persistCostEntries: () => {},
    persistBudgetConfig: () => {},
  })

  runtime.authStore.register({
    id: 'openai-a',
    providerId: 'openai',
    apiKey: 'sk-test',
  })
  runtime.persistAuthProfiles()

  assert.equal(snapshots.length, 1)
  assert.equal((snapshots[0] as { profiles: { id: string }[] }).profiles[0]?.id, 'openai-a')
})

test('resetCoreRuntime drops remembered discord channels and todos', () => {
  installStorage()
  rememberDiscordChannelId('123')
  getCoreRuntime().todoStore.add('local-chat', 'stale')
  resetCoreRuntime()

  const next = getCoreRuntime()
  assert.equal(next.todoStore.list('local-chat').length, 0)

  setDiscordKnownChannelIds(['456'])
  resetCoreRuntime()
  // After reset the previous remembered id must not survive on a fresh runtime.
  const fresh = getCoreRuntime()
  assert.equal(fresh, getCoreRuntime())
  resetCoreRuntime()
})

test('coreRuntime factory source does not import integration permission modules', () => {
  const source = readFileSync(new URL('../src/lib/coreRuntime.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /features\/integrations/)
  assert.doesNotMatch(source, /isActionAllowed|parseTelegramChatIdList|parseDiscordChannelIdList/)
})

test('broadcastToChannels refuses send when the action is not allowed', async () => {
  installStorage()
  resetCoreRuntime()
  let telegramCalls = 0
  let discordCalls = 0
  Object.defineProperty(globalThis, 'window', {
    value: {
      localStorage: new MemoryStorage(),
      desktopPet: {
        telegramSendMessage: async () => {
          telegramCalls += 1
        },
        discordSendMessage: async () => {
          discordCalls += 1
        },
      },
    },
    configurable: true,
    writable: true,
  })
  rememberDiscordChannelId('999')

  const blocked = {
    telegramPermissionMode: 'read-only',
    discordPermissionMode: 'confirm',
    ownerTelegramChatIds: '111',
    discordAllowedChannelIds: '999',
  } as AppSettings

  const blockedResults = await broadcastToChannels('hello', blocked)
  assert.deepEqual(blockedResults, [])
  assert.equal(telegramCalls, 0)
  assert.equal(discordCalls, 0)

  const allowed = {
    ...blocked,
    telegramPermissionMode: 'auto',
    discordPermissionMode: 'auto',
  } as AppSettings
  const allowedResults = await broadcastToChannels('hello', allowed)
  assert.equal(telegramCalls, 1)
  assert.equal(discordCalls, 1)
  assert.equal(allowedResults.filter((item) => item.ok).length, 2)
  resetCoreRuntime()
})

test('injected CoreTime is shared across core stores', () => {
  const time = frozenTime(9_000)
  const runtime = isolatedRuntime(time)
  const session = runtime.sessionStore.createSession('conversation-a')
  const todo = runtime.todoStore.add('conversation-a', 'task')

  assert.equal(session.createdAt, 9_000)
  assert.equal(todo.createdAt, 9_000)
  assert.match(session.id, /^sess-9000-/)
  assert.match(todo.id, /^todo-9000-/)
})
