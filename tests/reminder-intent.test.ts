import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  buildReminderTaskDigest,
  findBestReminderTaskMatch,
  parseReminderIntent,
  parseReminderPromptOnly,
  parseReminderScheduleOnly,
} from '../src/features/reminders/parseReminderIntent.ts'

const NOW = new Date('2026-03-29T10:00:00+08:00')

test('creates an interval reminder from natural language', () => {
  const parsed = parseReminderIntent('每30分钟提醒我喝水', NOW)

  assert.equal(parsed?.kind, 'create')
  assert.equal(parsed?.draft.title, '喝水')
  assert.equal(parsed?.draft.prompt, '喝水')
  assert.deepEqual(parsed?.draft.schedule, {
    kind: 'every',
    everyMinutes: 30,
    anchorAt: NOW.toISOString(),
  })
})

test('creates a daily scheduled reminder from natural language', () => {
  const parsed = parseReminderIntent('每天早上九点提醒我看天气', NOW)

  assert.equal(parsed?.kind, 'create')
  assert.equal(parsed?.draft.prompt, '看天气')
  assert.deepEqual(parsed?.draft.schedule, {
    kind: 'cron',
    expression: '0 9 * * *',
  })
  assert.deepEqual(parsed?.draft.action, {
    kind: 'weather',
    location: '',
  })
})

test('creates an automatic weather task from natural language', () => {
  const parsed = parseReminderIntent('每天早上九点播报深圳天气', NOW)

  assert.equal(parsed?.kind, 'create')
  assert.deepEqual(parsed?.draft.action, {
    kind: 'weather',
    location: '深圳',
  })
})

test('creates an automatic search task from natural language', () => {
  const parsed = parseReminderIntent('每天十点搜索 AI 新闻', NOW)

  assert.equal(parsed?.kind, 'create')
  assert.deepEqual(parsed?.draft.action, {
    kind: 'web_search',
    query: 'AI 新闻',
    limit: 5,
  })
})

test('creates a one-off reminder from “之后” phrasing', () => {
  const parsed = parseReminderIntent('五分钟之后提醒我喝水', NOW)

  assert.equal(parsed?.kind, 'create')
  assert.equal(parsed?.draft.prompt, '喝水')
  assert.deepEqual(parsed?.draft.schedule, {
    kind: 'at',
    at: new Date(NOW.getTime() + 5 * 60_000).toISOString(),
  })
})

test('asks for reminder content when the command ends with a truncated prompt', () => {
  const parsed = parseReminderIntent('五分钟之后提醒我喝', NOW)

  assert.equal(parsed?.kind, 'clarify_prompt')
  assert.equal(parsed?.draft.partialPrompt, '喝')
  assert.deepEqual(parsed?.draft.schedule, {
    kind: 'at',
    at: new Date(NOW.getTime() + 5 * 60_000).toISOString(),
  })
})

test('asks for reminder time when the command is missing a schedule', () => {
  const parsed = parseReminderIntent('提醒我喝水', NOW)

  assert.equal(parsed?.kind, 'clarify_time')
  assert.equal(parsed?.draft.title, '喝水')
  assert.equal(parsed?.draft.prompt, '喝水')
})

test('keeps broken STT reminder fragments inside reminder clarification flow', () => {
  const parsed = parseReminderIntent('最后提醒我喝水', NOW)

  assert.equal(parsed?.kind, 'clarify_time')
  assert.equal(parsed?.draft.prompt, '喝水')
})

test('parses schedule-only follow-up text for reminder clarification', () => {
  const parsed = parseReminderScheduleOnly('能五分钟之后', NOW)

  assert.deepEqual(parsed, {
    kind: 'at',
    at: new Date(NOW.getTime() + 5 * 60_000).toISOString(),
  })
})

test('parses prompt-only follow-up text for reminder content clarification', () => {
  assert.equal(parseReminderPromptOnly('水', '喝'), '喝水')
  assert.equal(parseReminderPromptOnly('好的', '喝'), null)
})

test('parses reminder list intent for task center queries', () => {
  const parsed = parseReminderIntent('看看任务中心', NOW)

  assert.deepEqual(parsed, {
    kind: 'list',
  })
})

test('parses reminder update intent with schedule rewrite', () => {
  const parsed = parseReminderIntent('把喝水提醒改成每45分钟提醒我站起来活动一下', NOW)

  assert.equal(parsed?.kind, 'update')
  assert.equal(parsed?.targetText, '喝水')
  assert.equal(parsed?.updates.prompt, '站起来活动一下')
  assert.deepEqual(parsed?.updates.schedule, {
    kind: 'every',
    everyMinutes: 45,
    anchorAt: NOW.toISOString(),
  })
})

test('matches reminder tasks by title or prompt text', () => {
  const matched = findBestReminderTaskMatch([
    {
      id: 'reminder-1',
      title: '喝水提醒',
      prompt: '先喝点水，顺便活动一下肩颈。',
      action: { kind: 'notice' },
      enabled: true,
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
      nextRunAt: '2026-03-29T11:00:00.000Z',
      schedule: {
        kind: 'every',
        everyMinutes: 60,
        anchorAt: NOW.toISOString(),
      },
    },
    {
      id: 'reminder-2',
      title: '晚间收尾',
      prompt: '记得早点休息。',
      action: { kind: 'notice' },
      enabled: true,
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
      nextRunAt: '2026-03-29T15:00:00.000Z',
      schedule: {
        kind: 'cron',
        expression: '0 23 * * *',
      },
    },
  ], '喝水')

  assert.equal(matched?.id, 'reminder-1')
})

test('builds a readable task center digest', () => {
  const digest = buildReminderTaskDigest([
    {
      id: 'reminder-1',
      title: '喝水提醒',
      prompt: '先喝点水，顺便活动一下肩颈。',
      action: { kind: 'notice' },
      enabled: true,
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
      nextRunAt: '2026-03-29T11:00:00.000Z',
      schedule: {
        kind: 'every',
        everyMinutes: 60,
        anchorAt: NOW.toISOString(),
      },
    },
  ])

  assert.match(digest, /本地自动任务中心/u)
  assert.match(digest, /喝水提醒/u)
  assert.match(digest, /普通提醒/u)
})
