import type { ModelTier, ProviderId } from '../../routing/types'

export type MoaParticipant = {
  id: string
  providerId: ProviderId
  modelId: string
  tier: ModelTier
  weight?: number
}

export type MoaSampleInput = {
  prompt: string
  system?: string
  conversationId?: string
}

export type MoaSampleResult = {
  participantId: string
  providerId: ProviderId
  modelId: string
  tier: ModelTier
  text: string
  durationMs: number
  weight: number
  error?: string
}

export type MoaAggregateStrategy = 'first' | 'longest' | 'voting' | 'synthesizer'

export type MoaRunOptions = {
  strategy?: MoaAggregateStrategy
  timeoutMs?: number
  synthesizer?: (samples: MoaSampleResult[]) => Promise<string>
}

export type MoaSampler = (
  participant: MoaParticipant,
  input: MoaSampleInput,
) => Promise<string>

export class MixtureOfAgents {
  private readonly participants: MoaParticipant[]
  private readonly sampler: MoaSampler

  constructor(participants: MoaParticipant[], sampler: MoaSampler) {
    if (participants.length === 0) {
      throw new Error('MixtureOfAgents requires at least one participant')
    }
    this.participants = participants
    this.sampler = sampler
  }

  async run(
    input: MoaSampleInput,
    options: MoaRunOptions = {},
  ): Promise<{ answer: string; samples: MoaSampleResult[] }> {
    const samples = await Promise.all(
      this.participants.map((participant) => this.sampleOne(participant, input, options)),
    )
    const strategy = options.strategy ?? 'voting'
    const answer = await this.aggregate(samples, strategy, options.synthesizer)
    return { answer, samples }
  }

  private async sampleOne(
    participant: MoaParticipant,
    input: MoaSampleInput,
    options: MoaRunOptions,
  ): Promise<MoaSampleResult> {
    const started = Date.now()
    try {
      const text = await withTimeout(this.sampler(participant, input), options.timeoutMs)
      return {
        participantId: participant.id,
        providerId: participant.providerId,
        modelId: participant.modelId,
        tier: participant.tier,
        text,
        durationMs: Date.now() - started,
        weight: participant.weight ?? 1,
      }
    } catch (error) {
      return {
        participantId: participant.id,
        providerId: participant.providerId,
        modelId: participant.modelId,
        tier: participant.tier,
        text: '',
        durationMs: Date.now() - started,
        weight: participant.weight ?? 1,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  private async aggregate(
    samples: MoaSampleResult[],
    strategy: MoaAggregateStrategy,
    synthesizer?: (samples: MoaSampleResult[]) => Promise<string>,
  ): Promise<string> {
    const valid = samples.filter((s) => !s.error && s.text.length > 0)
    if (valid.length === 0) {
      const firstError = samples.find((s) => s.error)?.error ?? 'all participants failed'
      throw new Error(`MixtureOfAgents: ${firstError}`)
    }
    switch (strategy) {
      case 'first':
        return valid[0].text
      case 'longest':
        return valid.reduce((a, b) => (b.text.length > a.text.length ? b : a)).text
      case 'synthesizer': {
        if (!synthesizer) throw new Error('MixtureOfAgents synthesizer strategy requires `synthesizer` option')
        return synthesizer(valid)
      }
      case 'voting':
      default:
        return pickByVotingWeight(valid)
    }
  }
}

function pickByVotingWeight(samples: MoaSampleResult[]): string {
  const buckets = new Map<string, number>()
  for (const sample of samples) {
    const normalized = sample.text.trim()
    buckets.set(normalized, (buckets.get(normalized) ?? 0) + sample.weight)
  }
  let bestText = ''
  let bestWeight = -Infinity
  for (const [text, weight] of buckets.entries()) {
    if (weight > bestWeight) {
      bestWeight = weight
      bestText = text
    }
  }
  return bestText
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs?: number): Promise<T> {
  if (!timeoutMs || timeoutMs <= 0) return promise
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout after ${timeoutMs}ms`)), timeoutMs)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (err) => {
        clearTimeout(timer)
        reject(err)
      },
    )
  })
}
