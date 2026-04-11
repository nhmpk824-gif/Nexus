import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  addReminderTaskToCollection,
  removeReminderTaskFromCollection,
  updateReminderTaskInCollection,
} from '../src/features/reminders/schedule.ts'
import { shouldRunReminderScheduler } from '../src/features/reminders/runtime.ts'

const NOW = new Date('2026-03-29T10:00:00+08:00')

test('addReminderTaskToCollection returns the created reminder immediately', () => {
  const result = addReminderTaskToCollection([], (prefix) => `${prefix}-1`, {
    title: '\u559d\u6c34',
    prompt: '\u559d\u6c34',
    action: { kind: 'notice' },
    enabled: true,
    schedule: {
      kind: 'at',
      at: new Date(NOW.getTime() + 5 * 60_000).toISOString(),
    },
  }, NOW)

  assert.equal(result.createdTask.id, 'reminder-1')
  assert.equal(result.createdTask.title, '\u559d\u6c34')
  assert.equal(result.tasks.length, 1)
  assert.equal(result.tasks[0]?.id, 'reminder-1')
})

test('updateReminderTaskInCollection returns the updated reminder immediately', () => {
  const result = updateReminderTaskInCollection([
    {
      id: 'reminder-1',
      title: '\u559d\u6c34\u63d0\u9192',
      prompt: '\u559d\u6c34',
      action: { kind: 'notice' },
      enabled: true,
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
      nextRunAt: '2026-03-29T10:05:00.000Z',
      schedule: {
        kind: 'at',
        at: '2026-03-29T10:05:00.000Z',
      },
    },
  ], 'reminder-1', {
    prompt: '\u559d\u6c34\u5e76\u7ad9\u8d77\u6765\u6d3b\u52a8\u4e00\u4e0b',
  }, NOW)

  assert.equal(result.updatedTask?.id, 'reminder-1')
  assert.equal(result.updatedTask?.prompt, '\u559d\u6c34\u5e76\u7ad9\u8d77\u6765\u6d3b\u52a8\u4e00\u4e0b')
  assert.equal(result.tasks[0]?.prompt, '\u559d\u6c34\u5e76\u7ad9\u8d77\u6765\u6d3b\u52a8\u4e00\u4e0b')
})

test('removeReminderTaskFromCollection returns the removed reminder immediately', () => {
  const result = removeReminderTaskFromCollection([
    {
      id: 'reminder-1',
      title: '\u559d\u6c34\u63d0\u9192',
      prompt: '\u559d\u6c34',
      action: { kind: 'notice' },
      enabled: true,
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
      nextRunAt: '2026-03-29T10:05:00.000Z',
      schedule: {
        kind: 'at',
        at: '2026-03-29T10:05:00.000Z',
      },
    },
  ], 'reminder-1')

  assert.equal(result.removedTask?.id, 'reminder-1')
  assert.equal(result.tasks.length, 0)
})

test('panel scheduler takes over only when the pet window is offline', () => {
  assert.equal(shouldRunReminderScheduler('pet', {
    petOnline: true,
    panelOnline: true,
  }), true)

  assert.equal(shouldRunReminderScheduler('panel', {
    petOnline: true,
    panelOnline: true,
  }), false)

  assert.equal(shouldRunReminderScheduler('panel', {
    petOnline: false,
    panelOnline: true,
  }), true)

  assert.equal(shouldRunReminderScheduler('panel', {
    petOnline: false,
    panelOnline: false,
  }), false)
})
