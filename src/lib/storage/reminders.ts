import type { ReminderTask, ReminderTaskAction } from '../../types'
import { readJson, REMINDER_TASKS_STORAGE_KEY, writeJson } from './core.ts'

const defaultReminderTasks: ReminderTask[] = []

function normalizeReminderTaskAction(action: ReminderTaskAction | null | undefined): ReminderTaskAction {
  if (!action || action.kind === 'notice') {
    return { kind: 'notice' }
  }

  if (action.kind === 'weather') {
    return {
      kind: 'weather',
      location: String(action.location ?? '').trim(),
    }
  }

  if (action.kind === 'chat_action') {
    return {
      kind: 'chat_action',
      instruction: String(action.instruction ?? '').trim(),
    }
  }

  return {
    kind: 'web_search',
    query: String(action.query ?? '').trim(),
    limit: Math.max(1, Math.min(Number(action.limit) || 5, 8)),
  }
}

export function loadReminderTasks(): ReminderTask[] {
  return readJson<Array<Partial<ReminderTask>>>(REMINDER_TASKS_STORAGE_KEY, defaultReminderTasks)
    .map((task) => ({
      id: String(task.id ?? ''),
      title: String(task.title ?? '').trim(),
      prompt: String(task.prompt ?? '').trim(),
      speechText: String(task.speechText ?? '').trim() || undefined,
      action: normalizeReminderTaskAction(task.action),
      enabled: task.enabled !== false,
      createdAt: String(task.createdAt ?? ''),
      updatedAt: String(task.updatedAt ?? ''),
      lastTriggeredAt: String(task.lastTriggeredAt ?? '').trim() || undefined,
      nextRunAt: String(task.nextRunAt ?? '').trim() || undefined,
      schedule: task.schedule as ReminderTask['schedule'],
    }))
    .filter((task) => task.id && task.title && task.prompt && task.schedule)
}

export function saveReminderTasks(tasks: ReminderTask[]) {
  writeJson(REMINDER_TASKS_STORAGE_KEY, tasks)
}
