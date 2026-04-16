import type { ModelTier, ProviderId } from '../routing/types'
import type { UsagePricing } from './types'

const DEFAULT_PRICING: UsagePricing[] = [
  {
    providerId: 'anthropic',
    modelId: 'claude-opus-4-6',
    tier: 'heavy',
    inputPricePerMTokens: 15,
    outputPricePerMTokens: 75,
  },
  {
    providerId: 'anthropic',
    modelId: 'claude-sonnet-4-6',
    tier: 'standard',
    inputPricePerMTokens: 3,
    outputPricePerMTokens: 15,
  },
  {
    providerId: 'anthropic',
    modelId: 'claude-haiku-4-5-20251001',
    tier: 'cheap',
    inputPricePerMTokens: 0.8,
    outputPricePerMTokens: 4,
  },
  {
    providerId: 'openai',
    modelId: 'gpt-4o',
    tier: 'heavy',
    inputPricePerMTokens: 2.5,
    outputPricePerMTokens: 10,
  },
  {
    providerId: 'openai',
    modelId: 'gpt-4o-mini',
    tier: 'cheap',
    inputPricePerMTokens: 0.15,
    outputPricePerMTokens: 0.6,
  },
  {
    providerId: 'deepseek',
    modelId: 'deepseek-chat',
    tier: 'cheap',
    inputPricePerMTokens: 0.27,
    outputPricePerMTokens: 1.1,
  },
  {
    providerId: 'deepseek',
    modelId: 'deepseek-reasoner',
    tier: 'standard',
    inputPricePerMTokens: 0.55,
    outputPricePerMTokens: 2.19,
  },
]

export class UsagePricingTable {
  private readonly entries = new Map<string, UsagePricing>()

  constructor(initial: UsagePricing[] = DEFAULT_PRICING) {
    for (const entry of initial) {
      this.entries.set(keyOf(entry.providerId, entry.modelId), entry)
    }
  }

  get(providerId: ProviderId, modelId: string): UsagePricing | undefined {
    return this.entries.get(keyOf(providerId, modelId))
  }

  set(entry: UsagePricing): void {
    this.entries.set(keyOf(entry.providerId, entry.modelId), entry)
  }

  list(): UsagePricing[] {
    return Array.from(this.entries.values())
  }

  listByTier(tier: ModelTier): UsagePricing[] {
    return this.list().filter((e) => e.tier === tier)
  }

  computeCost(
    providerId: ProviderId,
    modelId: string,
    inputTokens: number,
    outputTokens: number,
  ): number {
    const pricing = this.get(providerId, modelId)
    if (!pricing) return 0
    const inputCost = (inputTokens / 1_000_000) * pricing.inputPricePerMTokens
    const outputCost = (outputTokens / 1_000_000) * pricing.outputPricePerMTokens
    return inputCost + outputCost
  }
}

function keyOf(providerId: ProviderId, modelId: string): string {
  return `${providerId}::${modelId}`
}
