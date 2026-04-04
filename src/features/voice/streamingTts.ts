const DEFAULT_MAX_CHUNK_LENGTH = 72
const DEFAULT_MIN_FORCED_CHUNK_LENGTH = 24
const DEFAULT_PREFERRED_EARLY_SPLIT_LENGTH = 18
const ABSOLUTE_MIN_CHUNK_LENGTH = 2
const SENTENCE_BOUNDARY_PATTERN = /[。！？!?；;：:\n]/u
const SOFT_BOUNDARY_PATTERN = /[,，、]/u
const FORCED_SPLIT_BOUNDARY_PATTERN = /[\s,，、]/u

export type StreamingTtsChunkerOptions = {
  maxChunkLength?: number
  minForcedChunkLength?: number
  preferredEarlySplitLength?: number
  firstChunkMaxLength?: number
  firstChunkMinForcedChunkLength?: number
  firstChunkPreferredEarlySplitLength?: number
  absoluteMinChunkLength?: number
}

function normalizeOptions(options?: StreamingTtsChunkerOptions) {
  const absoluteMinChunkLength = Math.max(
    ABSOLUTE_MIN_CHUNK_LENGTH,
    options?.absoluteMinChunkLength ?? ABSOLUTE_MIN_CHUNK_LENGTH,
  )
  const maxChunkLength = Math.max(
    absoluteMinChunkLength,
    options?.maxChunkLength ?? DEFAULT_MAX_CHUNK_LENGTH,
  )
  const minForcedChunkLength = Math.max(
    absoluteMinChunkLength,
    options?.minForcedChunkLength ?? DEFAULT_MIN_FORCED_CHUNK_LENGTH,
  )
  const preferredEarlySplitLength = Math.max(
    absoluteMinChunkLength,
    options?.preferredEarlySplitLength ?? DEFAULT_PREFERRED_EARLY_SPLIT_LENGTH,
  )
  const firstChunkMaxLength = Math.max(
    absoluteMinChunkLength,
    options?.firstChunkMaxLength ?? maxChunkLength,
  )
  const firstChunkMinForcedChunkLength = Math.max(
    absoluteMinChunkLength,
    options?.firstChunkMinForcedChunkLength ?? minForcedChunkLength,
  )
  const firstChunkPreferredEarlySplitLength = Math.max(
    absoluteMinChunkLength,
    options?.firstChunkPreferredEarlySplitLength ?? preferredEarlySplitLength,
  )

  return {
    maxChunkLength,
    minForcedChunkLength: Math.min(minForcedChunkLength, maxChunkLength),
    preferredEarlySplitLength: Math.min(preferredEarlySplitLength, maxChunkLength),
    firstChunkMaxLength,
    firstChunkMinForcedChunkLength: Math.min(firstChunkMinForcedChunkLength, firstChunkMaxLength),
    firstChunkPreferredEarlySplitLength: Math.min(firstChunkPreferredEarlySplitLength, firstChunkMaxLength),
  }
}

function normalizeChunk(text: string) {
  return text.replace(/^\s+|\s+$/g, '')
}

function findBoundarySplitIndex(
  buffer: string,
  preferredEarlySplitLength: number,
  minForcedChunkLength: number,
) {
  for (let index = preferredEarlySplitLength; index < buffer.length; index += 1) {
    const char = buffer[index]
    if (char && SOFT_BOUNDARY_PATTERN.test(char)) {
      return index + 1
    }
  }

  for (let index = buffer.length - 1; index >= minForcedChunkLength; index -= 1) {
    const char = buffer[index]
    if (char && SOFT_BOUNDARY_PATTERN.test(char)) {
      return index + 1
    }
  }

  return -1
}

function findForcedSplitIndex(
  buffer: string,
  maxChunkLength: number,
  minForcedChunkLength: number,
) {
  if (buffer.length <= maxChunkLength) {
    return -1
  }

  for (let index = maxChunkLength; index >= minForcedChunkLength; index -= 1) {
    const char = buffer[index]
    if (char && FORCED_SPLIT_BOUNDARY_PATTERN.test(char)) {
      return index + 1
    }
  }

  return maxChunkLength
}

function collectCompletedChunks(
  buffer: string,
  options: ReturnType<typeof normalizeOptions>,
  forceFlush = false,
  firstChunkPending = false,
) {
  const chunks: string[] = []
  let remaining = buffer

  while (remaining.length) {
    const isFirstChunk = firstChunkPending && chunks.length === 0
    const activeOptions = isFirstChunk
      ? {
          maxChunkLength: options.firstChunkMaxLength,
          minForcedChunkLength: options.firstChunkMinForcedChunkLength,
          preferredEarlySplitLength: options.firstChunkPreferredEarlySplitLength,
        }
      : options
    let splitIndex = -1

    if (isFirstChunk) {
      const earlyBoundarySplitIndex = findBoundarySplitIndex(
        remaining,
        activeOptions.preferredEarlySplitLength,
        activeOptions.minForcedChunkLength,
      )

      if (earlyBoundarySplitIndex > 0) {
        const chunk = normalizeChunk(remaining.slice(0, earlyBoundarySplitIndex))
        if (chunk) {
          chunks.push(chunk)
        }
        remaining = remaining.slice(earlyBoundarySplitIndex)
        continue
      }
    }

    for (let index = 0; index < remaining.length; index += 1) {
      if (SENTENCE_BOUNDARY_PATTERN.test(remaining[index] ?? '')) {
        if (index + 1 >= activeOptions.preferredEarlySplitLength || forceFlush) {
          splitIndex = index + 1
          break
        }
      }
    }

    if (splitIndex > 0) {
      const chunk = normalizeChunk(remaining.slice(0, splitIndex))
      if (chunk) {
        chunks.push(chunk)
      }
      remaining = remaining.slice(splitIndex)
      continue
    }

    const boundarySplitIndex = findBoundarySplitIndex(
      remaining,
      activeOptions.preferredEarlySplitLength,
      activeOptions.minForcedChunkLength,
    )

    if (boundarySplitIndex > 0) {
      const chunk = normalizeChunk(remaining.slice(0, boundarySplitIndex))
      if (chunk) {
        chunks.push(chunk)
      }
      remaining = remaining.slice(boundarySplitIndex)
      continue
    }

    const forcedSplitIndex = findForcedSplitIndex(
      remaining,
      activeOptions.maxChunkLength,
      activeOptions.minForcedChunkLength,
    )

    if (forcedSplitIndex > 0) {
      const chunk = normalizeChunk(remaining.slice(0, forcedSplitIndex))
      if (chunk) {
        chunks.push(chunk)
      }
      remaining = remaining.slice(forcedSplitIndex)
      continue
    }

    if (forceFlush) {
      const chunk = normalizeChunk(remaining)
      if (chunk) {
        chunks.push(chunk)
      }
      remaining = ''
    }

    break
  }

  return {
    chunks,
    remaining,
  }
}

export class StreamingTtsChunker {
  private buffer = ''
  private readonly options: ReturnType<typeof normalizeOptions>
  private emittedChunkCount = 0

  constructor(options?: StreamingTtsChunkerOptions) {
    this.options = normalizeOptions(options)
  }

  pushText(delta: string) {
    if (!delta) {
      return []
    }

    this.buffer += delta
    const result = collectCompletedChunks(
      this.buffer,
      this.options,
      false,
      this.emittedChunkCount === 0,
    )
    this.buffer = result.remaining
    this.emittedChunkCount += result.chunks.length
    return result.chunks
  }

  flush() {
    const result = collectCompletedChunks(
      this.buffer,
      this.options,
      true,
      this.emittedChunkCount === 0,
    )
    this.buffer = ''
    this.emittedChunkCount += result.chunks.length
    return result.chunks
  }

  reset() {
    this.buffer = ''
    this.emittedChunkCount = 0
  }
}

export function segmentTextForSpeech(text: string, options?: StreamingTtsChunkerOptions) {
  const chunker = new StreamingTtsChunker(options)
  return [...chunker.pushText(text), ...chunker.flush()]
}
