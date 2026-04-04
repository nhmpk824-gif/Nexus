export type AudioQueueSegment<TMeta = unknown> = {
  audioBase64: string
  mimeType: string
  meta?: TMeta
}

type QueuedAudioSegment<TMeta> = AudioQueueSegment<TMeta> & {
  resolve: () => void
  reject: (error: Error) => void
}

export type AudioPlaybackQueueOptions<TMeta = unknown> = {
  onSegmentStart?: (segment: AudioQueueSegment<TMeta>, audio: HTMLAudioElement) => void
  onSegmentEnd?: (segment: AudioQueueSegment<TMeta>) => void
  onSegmentError?: (segment: AudioQueueSegment<TMeta>, message: string) => void
}

const AUDIO_PLAY_READY_FALLBACK_MS = 600
const AUDIO_PLAY_START_DELAY_MS = 24
const AUDIO_READY_STATE_CURRENT_DATA = 2

function buildAudioObjectUrl(mimeType: string, audioBase64: string) {
  const normalizedBase64 = audioBase64.replace(/\s+/g, '')
  const binary = window.atob(normalizedBase64)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  const blob = new Blob([bytes], {
    type: mimeType || 'audio/mpeg',
  })

  return URL.createObjectURL(blob)
}

function formatAudioPlaybackStartError(error: unknown) {
  const errorName =
    error && typeof error === 'object' && 'name' in error
      ? String(error.name ?? '').trim()
      : ''
  const errorMessage =
    error instanceof Error
      ? error.message.trim()
      : String(error ?? '').trim()

  if (errorName === 'NotAllowedError') {
    return '当前环境拦截了自动播放，请先确认系统输出设备可用，然后点一下桌宠窗口再重试。'
  }

  if (errorName === 'NotSupportedError') {
    return '当前音频格式没有被系统正常解码，请换一个音色或重启桌宠后再试。'
  }

  return errorMessage
    ? `原始错误：${errorName ? `${errorName}: ${errorMessage}` : errorMessage}`
    : '请检查系统音量、输出设备，或重启桌宠后再试。'
}

export class AudioPlaybackQueue<TMeta = unknown> {
  private readonly queue: Array<QueuedAudioSegment<TMeta>> = []
  private readonly options: AudioPlaybackQueueOptions<TMeta>
  private currentAudio: HTMLAudioElement | null = null
  private currentAudioUrl: string | null = null
  private currentReject: ((error: Error) => void) | null = null
  private draining = false
  private stopGeneration = 0

  constructor(options: AudioPlaybackQueueOptions<TMeta> = {}) {
    this.options = options
  }

  enqueue(segment: AudioQueueSegment<TMeta>) {
    return new Promise<void>((resolve, reject) => {
      this.queue.push({ ...segment, resolve, reject })
      void this.drain()
    })
  }

  stopAndClear() {
    this.stopGeneration += 1
    const stopError = new Error('语音播报已停止。')

    const currentAudio = this.currentAudio
    if (currentAudio) {
      currentAudio.pause()
      currentAudio.currentTime = 0
    }

    const currentReject = this.currentReject
    if (currentReject) {
      this.currentReject = null
      currentReject(stopError)
    } else {
      this.cleanupCurrentAudio()
    }

    while (this.queue.length) {
      const pending = this.queue.shift()
      pending?.reject(stopError)
    }
  }

  private cleanupCurrentAudio() {
    this.currentAudio = null
    this.currentReject = null

    if (this.currentAudioUrl) {
      URL.revokeObjectURL(this.currentAudioUrl)
      this.currentAudioUrl = null
    }
  }

  private async drain() {
    if (this.draining) {
      return
    }

    this.draining = true

    try {
      while (this.queue.length) {
        const next = this.queue.shift()
        if (!next) {
          continue
        }

        const generation = this.stopGeneration

        try {
          await this.playSegment(next, generation)
          next.resolve()
        } catch (error) {
          const message = error instanceof Error ? error.message : '语音播放失败，请检查本地音频输出设备。'
          const rejectError = error instanceof Error ? error : new Error(message)
          this.options.onSegmentError?.(next, message)
          next.reject(rejectError)

          // Reject all remaining queued segments so their callers don't hang.
          while (this.queue.length) {
            const remaining = this.queue.shift()
            remaining?.reject(rejectError)
          }

          throw rejectError
        }
      }
    } finally {
      this.draining = false
    }
  }

  private async playSegment(segment: QueuedAudioSegment<TMeta>, generation: number) {
    const audioUrl = buildAudioObjectUrl(segment.mimeType, segment.audioBase64)
    this.currentAudioUrl = audioUrl

    const audio = new Audio(audioUrl)
    audio.preload = 'auto'
    this.currentAudio = audio

    await new Promise<void>((resolve, reject) => {
      let finished = false
      let readyFallbackTimer: number | null = null
      let playDelayTimer: number | null = null
      let playbackRequested = false

      const clearTimers = () => {
        if (readyFallbackTimer !== null) {
          window.clearTimeout(readyFallbackTimer)
          readyFallbackTimer = null
        }

        if (playDelayTimer !== null) {
          window.clearTimeout(playDelayTimer)
          playDelayTimer = null
        }
      }

      const finalize = () => {
        if (finished) {
          return
        }

        finished = true
        clearTimers()
        audio.onloadedmetadata = null
        audio.oncanplay = null
        audio.oncanplaythrough = null
        audio.onplay = null
        audio.onended = null
        audio.onerror = null
        this.cleanupCurrentAudio()
      }

      const rejectWithError = (error: Error) => {
        finalize()
        reject(error)
      }

      this.currentReject = (error) => {
        rejectWithError(error)
      }

      const startPlayback = () => {
        if (finished || playbackRequested) {
          return
        }

        if (generation !== this.stopGeneration) {
          rejectWithError(new Error('语音播报已停止。'))
          return
        }

        playbackRequested = true
        playDelayTimer = window.setTimeout(() => {
          if (finished) {
            return
          }

          void audio.play().catch((error) => {
            rejectWithError(new Error(`音频播放启动失败。${formatAudioPlaybackStartError(error)}`))
          })
        }, AUDIO_PLAY_START_DELAY_MS)
      }

      const handleAudioReady = () => {
        if (finished) {
          return
        }

        if (readyFallbackTimer !== null) {
          window.clearTimeout(readyFallbackTimer)
          readyFallbackTimer = null
        }

        startPlayback()
      }

      audio.onloadedmetadata = handleAudioReady
      audio.oncanplay = handleAudioReady
      audio.oncanplaythrough = handleAudioReady

      audio.onplay = () => {
        if (generation !== this.stopGeneration) {
          rejectWithError(new Error('语音播报已停止。'))
          return
        }

        this.options.onSegmentStart?.(segment, audio)
      }

      audio.onended = () => {
        this.options.onSegmentEnd?.(segment)
        finalize()
        resolve()
      }

      audio.onerror = () => {
        rejectWithError(new Error('语音播放失败，请检查本地音频输出设备。'))
      }

      if (audio.readyState >= AUDIO_READY_STATE_CURRENT_DATA) {
        handleAudioReady()
        return
      }

      readyFallbackTimer = window.setTimeout(() => {
        handleAudioReady()
      }, AUDIO_PLAY_READY_FALLBACK_MS)

      audio.load()
    })
  }
}
