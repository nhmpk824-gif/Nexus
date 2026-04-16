import type { OutboundMessage } from '../channels/types'

export type ScheduleKind = 'at' | 'every' | 'cron'

export type Schedule =
  | { kind: 'at'; at: number }
  | { kind: 'every'; everyMs: number; anchorAt?: number }
  | { kind: 'cron'; expression: string }

export type ScheduledJobPayload =
  | { kind: 'notice'; text: string }
  | { kind: 'outbound'; message: OutboundMessage }
  | { kind: 'custom'; data: unknown }

export type ScheduledJob = {
  id: string
  name: string
  schedule: Schedule
  payload: ScheduledJobPayload
  enabled: boolean
  createdAt: number
  updatedAt: number
  nextFireAt?: number
  lastFiredAt?: number
  metadata?: Record<string, unknown>
}

export type CreateJobInput = Omit<
  ScheduledJob,
  'id' | 'createdAt' | 'updatedAt' | 'nextFireAt' | 'lastFiredAt'
> & {
  id?: string
}
