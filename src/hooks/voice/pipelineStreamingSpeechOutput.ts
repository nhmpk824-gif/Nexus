import type { AppSettings } from '../../types'
import {
  AudioPlayerSink,
  FrameProcessor,
  Pipeline,
  SentenceAggregator,
  TTSStreamService,
  createEndFrame,
  createInterruptionFrame,
  createStartFrame,
  createTextDeltaFrame,
  type Frame,
  type TtsIpcBridge,
} from '../../features/voice/tts-pipeline/index.ts'
import { createId } from '../../lib'
import { getMaxRequestCharsForProvider } from './speechTextSegmentation.ts'
import type {
  StreamingSpeechOutputOptions,
  StreamingSpeechOutputRuntime,
} from './streamingSpeechOutput'
import type { StreamingSpeechOutputController } from './types.ts'

/**
 * Pipeline-backed alternative to the monolithic streamingSpeechOutput
 * controller. Exposes the same StreamingSpeechOutputController surface
 * (pushDelta / flushPending / finish / abort / hasStarted /
 * waitForCompletion) so callers can't tell which path they're on, then
 * internally drives a pipecat-style pipeline of:
 *
 *   Observer → SentenceAggregator → TTSStreamService → AudioPlayerSink
 *
 * The Observer sits at the head so `hasStarted()` can track whether
 * any AudioFrame has reached playback yet.
 */
export function createPipelineStreamingSpeechController(
  speechSettings: AppSettings,
  runtime: StreamingSpeechOutputRuntime,
  options?: StreamingSpeechOutputOptions,
): StreamingSpeechOutputController {
  const bridge = window.desktopPet as unknown as TtsIpcBridge | undefined
  if (
    !bridge
    || typeof bridge.ttsStreamStart !== 'function'
    || typeof bridge.subscribeTtsStream !== 'function'
  ) {
    throw new Error('Desktop client is not connected in the current environment; streaming speech playback is unavailable.')
  }

  const turnId = createId('tts-turn')
  const player = runtime.getPlayer()
  let hasAudio = false
  let resolveCompletion: (() => void) | null = null
  let rejectCompletion: ((error: Error) => void) | null = null
  const completion = new Promise<void>((resolve, reject) => {
    resolveCompletion = resolve
    rejectCompletion = reject
  })
  let finishRequested = false
  let aborted = false
  let onStartFired = false

  // Tail observer sits AFTER AudioPlayerSink so it can see AudioFrames —
  // those are injected by TTSStreamService's IPC callback into the
  // downstream chain, so anything upstream of TTSStreamService would
  // never see them. Tracks hasAudio for hasStarted() and fires onStart
  // on the first chunk that actually reaches the player.
  class TailObserver extends FrameProcessor {
    async process(frame: Frame): Promise<void> {
      if (frame.type === 'audio' && !hasAudio) {
        hasAudio = true
        if (!onStartFired) {
          onStartFired = true
          options?.onStart?.()
        }
      }
      await this.pushDownstream(frame)
    }
  }

  const pipeline = new Pipeline([
    new SentenceAggregator({
      maxSentenceChars: getMaxRequestCharsForProvider(speechSettings.speechOutputProviderId),
    }),
    new TTSStreamService({
      settings: speechSettings,
      ipc: bridge,
    }),
    new AudioPlayerSink({ getPlayer: () => player }),
    new TailObserver(),
  ])

  // Serialize every frame push through one chained promise so StartFrame
  // has fully propagated (TTSStreamService sets activeTurnId/requestId,
  // subscribes to IPC) before any TextDeltaFrame arrives. `void pipeline.push`
  // would let those race and drop the first sentence as "stale turn".
  let pushChain: Promise<void> = Promise.resolve()
  const enqueue = (frame: Frame): Promise<void> => {
    pushChain = pushChain.then(() => pipeline.push(frame)).catch((err) => {
      console.error('[TTS pipeline] frame push failed:', err)
    })
    return pushChain
  }

  enqueue(createStartFrame(turnId))

  const controller: StreamingSpeechOutputController = {
    pushDelta(delta: string) {
      if (!delta || finishRequested || aborted) return
      void enqueue(createTextDeltaFrame(turnId, delta))
    },

    flushPending() {
      // SentenceAggregator drains whole sentences eagerly on every
      // TextDeltaFrame, so there's nothing queued to flush between
      // tool-call rounds — the old controller needed this because it
      // buffered until finish(). No-op here preserves the API.
    },

    finish() {
      if (finishRequested || aborted) return
      finishRequested = true

      void (async () => {
        try {
          await enqueue(createEndFrame(turnId))
          // TTSStreamService has called ttsStreamFinish; the main
          // process drains its chain and the last chunks are on their
          // way. Wait for playback to actually finish — but cap the
          // wait so a dropped chunk path can't hang the completion
          // promise forever (the upstream chat handler has its own 12 s
          // limit; 10 s here lets us surface a cleaner error first).
          const DRAIN_TIMEOUT_MS = 10_000
          await Promise.race([
            player.waitForDrain(),
            new Promise<never>((_, reject) => {
              setTimeout(
                () => reject(new Error(hasAudio
                  ? 'Pipeline drain timeout — some audio played but player never marked idle.'
                  : 'Pipeline drain timeout — no audio ever reached the player.')),
                DRAIN_TIMEOUT_MS,
              )
            }),
          ])
          if (resolveCompletion) resolveCompletion()
          options?.onEnd?.()
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          if (rejectCompletion) rejectCompletion(error instanceof Error ? error : new Error(message))
          options?.onError?.(message)
        } finally {
          runtime.setActiveController?.(null)
        }
      })()
    },

    abort() {
      if (aborted) return
      aborted = true
      const wasFinished = finishRequested
      finishRequested = true
      void (async () => {
        try {
          await enqueue(createInterruptionFrame(turnId, 'abort-requested'))
        } catch {
          // InterruptionFrame propagation should never throw; if it
          // does, the abort signal is still delivered by stop() below.
        }
        await pipeline.stop()
        runtime.resetPlayer?.()
        runtime.setActiveController?.(null)
        if (!wasFinished && rejectCompletion) {
          rejectCompletion(new Error('Speech playback has been stopped.'))
        }
      })()
    },

    hasStarted() {
      return hasAudio
    },

    waitForCompletion() {
      return completion
    },
  }

  runtime.setActiveController?.(controller)
  return controller
}

/**
 * Feature flag for the pipecat-style TTS pipeline. Originally default-on,
 * but in practice it stalls `waitForCompletion()` without emitting audio
 * — the chat turn hits the 12 s "TTS wait timeout" and no sound ever
 * plays. Rolled the default back to `false` so Edge TTS + other simple
 * providers work out of the box. The new pipeline stays available for
 * explicit opt-in while it's being debugged:
 *
 *   localStorage.setItem('nexus:useTtsPipeline', 'true')
 *   location.reload()
 *
 * Default: false. Any value other than exactly 'true' keeps the legacy
 * streamingSpeechOutput controller (which worked reliably in v0.2.x).
 */
export function isPipelineTtsEnabled(): boolean {
  try {
    if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
      return window.localStorage.getItem('nexus:useTtsPipeline') === 'true'
    }
  } catch {
    // localStorage access can throw in some sandboxed renderer contexts.
  }
  return false
}
