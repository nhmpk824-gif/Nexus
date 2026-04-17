import { FrameProcessor } from '../FrameProcessor.ts'
import type { Frame } from '../frames.ts'
import { createTextSentenceFrame } from '../frames.ts'

export type SentenceAggregatorOptions = {
  maxSentenceChars?: number
}

const DEFAULT_MAX_SENTENCE_CHARS = 3000

const SENTENCE_BOUNDARY_RE = /[。！？!?；;\n]/u

/**
 * Collects streamed text deltas and emits one TextSentenceFrame per
 * completed sentence. Downstream TTS services can then synthesize each
 * sentence in parallel or serially without worrying about partial input.
 */
export class SentenceAggregator extends FrameProcessor {
  private readonly maxSentenceChars: number
  private buffer = ''
  private segmentIndex = 0
  private activeTurnId: string | null = null

  constructor(options: SentenceAggregatorOptions = {}) {
    super()
    this.maxSentenceChars = options.maxSentenceChars ?? DEFAULT_MAX_SENTENCE_CHARS
  }

  override async process(frame: Frame): Promise<void> {
    switch (frame.type) {
      case 'start':
        this.buffer = ''
        this.segmentIndex = 0
        this.activeTurnId = frame.turnId
        await this.pushDownstream(frame)
        return

      case 'text-delta': {
        if (frame.turnId !== this.activeTurnId) {
          await this.pushDownstream(frame)
          return
        }
        this.buffer += frame.text
        await this.drainSentences()
        return
      }

      case 'end':
        if (frame.turnId === this.activeTurnId) {
          await this.flushRemaining(frame.turnId)
        }
        await this.pushDownstream(frame)
        return

      case 'interruption':
        if (frame.turnId === this.activeTurnId) {
          this.buffer = ''
        }
        await this.pushDownstream(frame)
        return

      default:
        await this.pushDownstream(frame)
    }
  }

  override async shutdown(): Promise<void> {
    this.buffer = ''
    this.activeTurnId = null
  }

  private async drainSentences(): Promise<void> {
    if (!this.activeTurnId) return
    while (true) {
      const boundary = SENTENCE_BOUNDARY_RE.exec(this.buffer)
      if (boundary) {
        const end = boundary.index + 1
        const sentence = this.buffer.slice(0, end)
        this.buffer = this.buffer.slice(end)
        await this.emitSentence(sentence, this.activeTurnId)
        continue
      }
      if (this.buffer.length >= this.maxSentenceChars) {
        const sentence = this.buffer.slice(0, this.maxSentenceChars)
        this.buffer = this.buffer.slice(this.maxSentenceChars)
        await this.emitSentence(sentence, this.activeTurnId)
        continue
      }
      return
    }
  }

  private async flushRemaining(turnId: string): Promise<void> {
    if (!this.buffer) return
    const tail = this.buffer
    this.buffer = ''
    await this.emitSentence(tail, turnId)
  }

  private async emitSentence(text: string, turnId: string): Promise<void> {
    const trimmed = text.trim()
    if (!trimmed) return
    const frame = createTextSentenceFrame(turnId, trimmed, this.segmentIndex)
    this.segmentIndex += 1
    await this.pushDownstream(frame)
  }
}
