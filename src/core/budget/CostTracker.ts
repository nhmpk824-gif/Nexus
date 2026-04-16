import type { ProviderId } from '../routing/types'
import type { BudgetConfig, BudgetStatus, CostEntry, CostEntryKind } from './types'
import { UsagePricingTable } from './UsagePricing'

export type RecordUsageInput = {
  providerId: ProviderId
  modelId: string
  tier: CostEntry['tier']
  inputTokens: number
  outputTokens: number
  conversationId?: string
  timestamp?: number
}

/**
 * Non-chat usage: TTS / STT / remote embeddings. The caller pre-computes
 * costUsd via features/metering/speechCost.ts since each subtype has a
 * different pricing model. Tier is fixed at 'cheap' — these aren't subject
 * to chat-tier downgrade logic.
 */
export type RecordAuxiliaryInput = {
  kind: Exclude<CostEntryKind, 'chat'>
  providerId: ProviderId
  modelId: string
  units: number
  costUsd: number
  conversationId?: string
  timestamp?: number
}

export class CostTracker {
  private readonly entries: CostEntry[] = []
  private readonly pricing: UsagePricingTable
  private config: BudgetConfig

  constructor(options?: { pricing?: UsagePricingTable; config?: BudgetConfig }) {
    this.pricing = options?.pricing ?? new UsagePricingTable()
    this.config = options?.config ?? {}
  }

  setConfig(config: BudgetConfig): void {
    this.config = config
  }

  getConfig(): BudgetConfig {
    return this.config
  }

  record(input: RecordUsageInput): CostEntry {
    const costUsd = this.pricing.computeCost(
      input.providerId,
      input.modelId,
      input.inputTokens,
      input.outputTokens,
    )
    const entry: CostEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: input.timestamp ?? Date.now(),
      providerId: input.providerId,
      modelId: input.modelId,
      tier: input.tier,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      costUsd,
      conversationId: input.conversationId,
      kind: 'chat',
    }
    this.entries.push(entry)
    return entry
  }

  recordAuxiliary(input: RecordAuxiliaryInput): CostEntry {
    const entry: CostEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: input.timestamp ?? Date.now(),
      providerId: input.providerId,
      modelId: input.modelId,
      tier: 'cheap',
      inputTokens: 0,
      outputTokens: 0,
      costUsd: input.costUsd,
      conversationId: input.conversationId,
      kind: input.kind,
      units: input.units,
    }
    this.entries.push(entry)
    return entry
  }

  totalForDay(day: Date = new Date()): number {
    const start = startOfDay(day).getTime()
    const end = start + 24 * 60 * 60 * 1000
    return this.sumCostInRange(start, end)
  }

  totalForMonth(day: Date = new Date()): number {
    const start = new Date(day.getFullYear(), day.getMonth(), 1).getTime()
    const end = new Date(day.getFullYear(), day.getMonth() + 1, 1).getTime()
    return this.sumCostInRange(start, end)
  }

  status(now: Date = new Date()): BudgetStatus {
    const dailyUsed = this.totalForDay(now)
    const monthlyUsed = this.totalForMonth(now)
    const { dailyCapUsd, monthlyCapUsd, downgradeThresholdRatio, hardStop } = this.config

    const dailyRatio = dailyCapUsd ? dailyUsed / dailyCapUsd : 0
    const monthlyRatio = monthlyCapUsd ? monthlyUsed / monthlyCapUsd : 0
    const threshold = downgradeThresholdRatio ?? 0.8
    const shouldDowngrade = dailyRatio >= threshold || monthlyRatio >= threshold

    const exceededDaily = dailyCapUsd !== undefined && dailyUsed >= dailyCapUsd
    const exceededMonthly = monthlyCapUsd !== undefined && monthlyUsed >= monthlyCapUsd
    const shouldHardStop = Boolean(hardStop) && (exceededDaily || exceededMonthly)

    return {
      dailyUsedUsd: dailyUsed,
      monthlyUsedUsd: monthlyUsed,
      dailyCapUsd,
      monthlyCapUsd,
      shouldDowngrade,
      shouldHardStop,
    }
  }

  listEntries(): CostEntry[] {
    return this.entries.slice()
  }

  clear(): void {
    this.entries.length = 0
  }

  private sumCostInRange(startMs: number, endMs: number): number {
    let total = 0
    for (const entry of this.entries) {
      if (entry.timestamp >= startMs && entry.timestamp < endMs) {
        total += entry.costUsd
      }
    }
    return total
  }
}

function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}
