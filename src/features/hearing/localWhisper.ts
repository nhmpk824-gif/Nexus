export type LocalAsrWorkerResponse =
  | {
      type: 'status'
      requestId: number
      message: string
    }
  | {
      type: 'result'
      requestId: number
      text: string
    }
  | {
      type: 'error'
      requestId: number
      message: string
    }

export function createLocalAsrWorker() {
  return new Worker(new URL('./localAsrWorker.ts', import.meta.url), {
    type: 'module',
  })
}

export async function warmupLocalAsrWorker(
  worker: Worker,
  model: string,
  language?: string,
  timeoutMs = 90_000,
) {
  const requestId = Math.floor(Math.random() * 1_000_000_000)
  const audio = new Float32Array(16_000)

  return new Promise<void>((resolve, reject) => {
    const timer = globalThis.setTimeout(() => {
      cleanup()
      reject(new Error('本地 Whisper 预热超时，请检查网络或稍后重试。'))
    }, timeoutMs)

    const cleanup = () => {
      globalThis.clearTimeout(timer)
      worker.removeEventListener('message', handleMessage as EventListener)
      worker.removeEventListener('error', handleError)
    }

    const handleError = () => {
      cleanup()
      reject(new Error('本地 Whisper Worker 启动失败。'))
    }

    const handleMessage = (event: MessageEvent<LocalAsrWorkerResponse>) => {
      const payload = event.data
      if (!payload || payload.requestId !== requestId) return

      if (payload.type === 'error') {
        cleanup()
        reject(new Error(payload.message || '本地 Whisper 预热失败。'))
        return
      }

      if (payload.type === 'result') {
        cleanup()
        resolve()
      }
    }

    worker.addEventListener('message', handleMessage as EventListener)
    worker.addEventListener('error', handleError)
    worker.postMessage({
      type: 'transcribe',
      requestId,
      model,
      language,
      audio,
    }, [audio.buffer])
  })
}

export async function preloadLocalAsrWorker(
  worker: Worker,
  model: string,
  timeoutMs = 90_000,
) {
  const requestId = Math.floor(Math.random() * 1_000_000_000)

  return new Promise<void>((resolve, reject) => {
    const timer = globalThis.setTimeout(() => {
      cleanup()
      reject(new Error('本地 Whisper 模型预加载超时，请检查网络或稍后重试。'))
    }, timeoutMs)

    const cleanup = () => {
      globalThis.clearTimeout(timer)
      worker.removeEventListener('message', handleMessage as EventListener)
      worker.removeEventListener('error', handleError)
    }

    const handleError = () => {
      cleanup()
      reject(new Error('本地 Whisper Worker 启动失败。'))
    }

    const handleMessage = (event: MessageEvent<LocalAsrWorkerResponse>) => {
      const payload = event.data
      if (!payload || payload.requestId !== requestId) return

      if (payload.type === 'error') {
        cleanup()
        reject(new Error(payload.message || '本地 Whisper 模型预加载失败。'))
        return
      }

      if (payload.type === 'result') {
        cleanup()
        resolve()
      }
    }

    worker.addEventListener('message', handleMessage as EventListener)
    worker.addEventListener('error', handleError)
    worker.postMessage({
      type: 'preload',
      requestId,
      model,
    })
  })
}

export function normalizeWhisperLanguage(language: string) {
  const normalized = String(language ?? '').trim().toLowerCase()

  if (!normalized) return undefined
  if (normalized.startsWith('zh')) return 'chinese'
  if (normalized.startsWith('en')) return 'english'
  if (normalized.startsWith('ja')) return 'japanese'
  if (normalized.startsWith('ko')) return 'korean'
  if (normalized.startsWith('fr')) return 'french'
  if (normalized.startsWith('de')) return 'german'
  if (normalized.startsWith('es')) return 'spanish'

  return undefined
}

export async function decodeAudioBlobToMonoFloat32(blob: Blob, sampleRate = 16000) {
  const arrayBuffer = await blob.arrayBuffer()
  const decodingContext = new AudioContext()

  try {
    const audioBuffer = await decodingContext.decodeAudioData(arrayBuffer.slice(0))
    const frameCount = Math.max(1, Math.ceil(audioBuffer.duration * sampleRate))
    const offlineContext = new OfflineAudioContext(1, frameCount, sampleRate)
    const source = offlineContext.createBufferSource()
    source.buffer = audioBuffer
    source.connect(offlineContext.destination)
    source.start(0)

    const renderedBuffer = await offlineContext.startRendering()
    const channelData = renderedBuffer.getChannelData(0)
    return new Float32Array(channelData)
  } finally {
    await decodingContext.close().catch(() => undefined)
  }
}
