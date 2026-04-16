import { getCoreRuntime } from '../../lib/coreRuntime'
import type { CostTracker } from '../../core/budget/CostTracker'

function safeCostTracker(): CostTracker | undefined {
  try {
    return getCoreRuntime().costTracker
  } catch {
    // CoreRuntime is not initialized in early-boot or test contexts.
    return undefined
  }
}

const TTS_PRICE_PER_M_CHARS: Record<string, number> = {
  'tts-1': 15,
  'tts-1-hd': 30,
  'gpt-4o-mini-tts': 12,
  'eleven_multilingual_v2': 30,
  'eleven_turbo_v2': 30,
}

const STT_PRICE_PER_MINUTE: Record<string, number> = {
  'whisper-1': 0.006,
  'gpt-4o-transcribe': 0.006,
  'gpt-4o-mini-transcribe': 0.003,
}

function lookupTtsRate(modelId: string): number {
  const direct = TTS_PRICE_PER_M_CHARS[modelId]
  if (direct !== undefined) return direct
  for (const [key, rate] of Object.entries(TTS_PRICE_PER_M_CHARS)) {
    if (modelId.includes(key)) return rate
  }
  return 0
}

function lookupSttRate(modelId: string): number {
  const direct = STT_PRICE_PER_MINUTE[modelId]
  if (direct !== undefined) return direct
  for (const [key, rate] of Object.entries(STT_PRICE_PER_MINUTE)) {
    if (modelId.includes(key)) return rate
  }
  return 0
}

export function recordTtsUsage(input: {
  providerId: string
  modelId: string
  text: string
}): void {
  const chars = input.text.length
  if (!chars) return
  const ratePerMillion = lookupTtsRate(input.modelId)
  const costUsd = (chars / 1_000_000) * ratePerMillion
  const tracker = safeCostTracker()
  if (!tracker) return
  tracker.recordAuxiliary({
    kind: 'tts',
    providerId: input.providerId,
    modelId: input.modelId,
    units: chars,
    costUsd,
  })
}

export function recordSttUsage(input: {
  providerId: string
  modelId: string
  durationSeconds?: number
  transcriptChars?: number
}): void {
  let seconds = input.durationSeconds ?? 0
  if (!seconds && input.transcriptChars) {
    // Rough proxy: speech averages ~15 chars/sec for English, less for CJK.
    seconds = Math.max(1, Math.round(input.transcriptChars / 15))
  }
  if (!seconds) return
  const ratePerMinute = lookupSttRate(input.modelId)
  const costUsd = (seconds / 60) * ratePerMinute
  const tracker = safeCostTracker()
  if (!tracker) return
  tracker.recordAuxiliary({
    kind: 'stt',
    providerId: input.providerId,
    modelId: input.modelId,
    units: seconds,
    costUsd,
  })
}

export function recordEmbeddingUsage(input: {
  providerId: string
  modelId: string
  tokens: number
}): void {
  if (!input.tokens) return
  // OpenAI text-embedding-3-small rate as a conservative default.
  const ratePerMillion = 0.1
  const costUsd = (input.tokens / 1_000_000) * ratePerMillion
  const tracker = safeCostTracker()
  if (!tracker) return
  tracker.recordAuxiliary({
    kind: 'embedding',
    providerId: input.providerId,
    modelId: input.modelId,
    units: input.tokens,
    costUsd,
  })
}
