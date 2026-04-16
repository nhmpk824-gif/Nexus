import type { ChannelRegistry } from '../channels/ChannelRegistry'
import type { OutboundMessage } from '../channels/types'
import { nextCronFireTime } from './cronExpression'
import type {
  CreateJobInput,
  Schedule,
  ScheduledJob,
  ScheduledJobPayload,
} from './types'

export type SchedulerFireEvent = {
  job: ScheduledJob
  firedAt: number
  payload: ScheduledJobPayload
  deliveryResult?: 'delivered' | 'skipped' | 'failed'
  error?: string
}

export type SchedulerFireHandler = (event: SchedulerFireEvent) => void | Promise<void>

export type SchedulerOptions = {
  channelRegistry?: ChannelRegistry
  tickIntervalMs?: number
  now?: () => number
}

export class Scheduler {
  private readonly jobs = new Map<string, ScheduledJob>()
  private readonly handlers = new Set<SchedulerFireHandler>()
  private readonly channelRegistry?: ChannelRegistry
  private readonly tickIntervalMs: number
  private readonly nowFn: () => number
  private timer: ReturnType<typeof setInterval> | null = null
  private running = false

  constructor(options: SchedulerOptions = {}) {
    this.channelRegistry = options.channelRegistry
    this.tickIntervalMs = options.tickIntervalMs ?? 15_000
    this.nowFn = options.now ?? (() => Date.now())
  }

  create(input: CreateJobInput): ScheduledJob {
    const now = this.nowFn()
    const id = input.id ?? `job-${now}-${Math.random().toString(36).slice(2, 6)}`
    const job: ScheduledJob = {
      id,
      name: input.name,
      schedule: input.schedule,
      payload: input.payload,
      enabled: input.enabled,
      createdAt: now,
      updatedAt: now,
      metadata: input.metadata,
    }
    job.nextFireAt = this.computeNextFireTime(job.schedule, now)
    this.jobs.set(id, job)
    return job
  }

  update(id: string, patch: Partial<Pick<ScheduledJob, 'enabled' | 'schedule' | 'payload' | 'name' | 'metadata'>>): ScheduledJob | undefined {
    const job = this.jobs.get(id)
    if (!job) return undefined
    if (patch.name !== undefined) job.name = patch.name
    if (patch.enabled !== undefined) job.enabled = patch.enabled
    if (patch.payload !== undefined) job.payload = patch.payload
    if (patch.metadata !== undefined) job.metadata = patch.metadata
    if (patch.schedule !== undefined) {
      job.schedule = patch.schedule
      job.nextFireAt = this.computeNextFireTime(patch.schedule, this.nowFn())
    }
    job.updatedAt = this.nowFn()
    return job
  }

  remove(id: string): boolean {
    return this.jobs.delete(id)
  }

  get(id: string): ScheduledJob | undefined {
    return this.jobs.get(id)
  }

  list(): ScheduledJob[] {
    return Array.from(this.jobs.values()).sort(
      (a, b) => (a.nextFireAt ?? Infinity) - (b.nextFireAt ?? Infinity),
    )
  }

  onFire(handler: SchedulerFireHandler): () => void {
    this.handlers.add(handler)
    return () => {
      this.handlers.delete(handler)
    }
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.timer = setInterval(() => {
      void this.tick()
    }, this.tickIntervalMs)
  }

  stop(): void {
    this.running = false
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  async tick(now: number = this.nowFn()): Promise<ScheduledJob[]> {
    const fired: ScheduledJob[] = []
    for (const job of this.jobs.values()) {
      if (!job.enabled) continue
      if (job.nextFireAt === undefined || job.nextFireAt > now) continue
      await this.fireJob(job, now)
      fired.push(job)
    }
    return fired
  }

  private async fireJob(job: ScheduledJob, now: number): Promise<void> {
    job.lastFiredAt = now
    job.nextFireAt = this.computeNextFireTime(job.schedule, now + 1)
    job.updatedAt = now

    let deliveryResult: SchedulerFireEvent['deliveryResult']
    let error: string | undefined
    if (job.payload.kind === 'outbound' && this.channelRegistry) {
      try {
        await this.deliverOutbound(job.payload.message)
        deliveryResult = 'delivered'
      } catch (err) {
        deliveryResult = 'failed'
        error = err instanceof Error ? err.message : String(err)
      }
    } else if (job.payload.kind === 'outbound' && !this.channelRegistry) {
      deliveryResult = 'skipped'
      error = 'no channel registry configured'
    }

    const event: SchedulerFireEvent = {
      job,
      firedAt: now,
      payload: job.payload,
      deliveryResult,
      error,
    }
    for (const handler of this.handlers) {
      await handler(event)
    }
  }

  private async deliverOutbound(message: OutboundMessage): Promise<void> {
    if (!this.channelRegistry) throw new Error('ChannelRegistry not available')
    const adapter = this.channelRegistry.get(message.channelId)
    if (!adapter) throw new Error(`Channel adapter "${message.channelId}" not registered`)
    await adapter.send(message)
  }

  private computeNextFireTime(schedule: Schedule, fromMs: number): number | undefined {
    switch (schedule.kind) {
      case 'at':
        return schedule.at > fromMs ? schedule.at : undefined
      case 'every': {
        const anchor = schedule.anchorAt ?? fromMs
        if (anchor > fromMs) return anchor
        const elapsed = fromMs - anchor
        const intervals = Math.ceil(elapsed / schedule.everyMs)
        return anchor + intervals * schedule.everyMs
      }
      case 'cron':
        return nextCronFireTime(schedule.expression, new Date(fromMs)).getTime()
      default:
        return undefined
    }
  }
}
