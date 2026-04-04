/**
 * Always-on wake word listener using sherpa-onnx KeywordSpotter.
 *
 * Captures microphone audio in the renderer process via ScriptProcessor,
 * sends chunks to the main process KWS engine via IPC, and fires a callback
 * when a wake keyword is detected.
 */

import { requestVoiceInputStream } from '../voice/runtimeSupport.ts'

const KWS_SAMPLE_RATE = 16000
const KWS_BUFFER_SIZE = 2048

export type WakewordListenerCallbacks = {
  onKeywordDetected: (keyword: string) => void
  onError?: (message: string) => void
  onStatusChange?: (active: boolean) => void
}

export type WakewordListenerOptions = {
  wakeWord?: string
}

export type WakewordListener = {
  stop: () => void
}

export async function startWakewordListener(
  callbacks: WakewordListenerCallbacks,
  options: WakewordListenerOptions = {},
): Promise<WakewordListener> {
  const api = window.desktopPet
  if (!api?.kwsStart || !api.kwsFeed || !api.kwsStop) {
    throw new Error('当前环境不支持唤醒词检测。')
  }
  const wakewordApi = api

  const wakeWord = options.wakeWord?.trim() || ''
  await wakewordApi.kwsStart({ wakeWord })
  callbacks.onStatusChange?.(true)

  let stream: MediaStream
  try {
    const microphone = await requestVoiceInputStream({
      preferredSampleRate: KWS_SAMPLE_RATE,
      purpose: 'wakeword',
    })
    stream = microphone.stream
  } catch (error) {
    callbacks.onStatusChange?.(false)
    wakewordApi.kwsStop().catch(() => undefined)
    throw error
  }

  const audioContext = new AudioContext({ sampleRate: KWS_SAMPLE_RATE })
  await audioContext.resume().catch(() => undefined)

  const source = audioContext.createMediaStreamSource(stream)
  const processor = audioContext.createScriptProcessor(KWS_BUFFER_SIZE, 1, 1)
  const output = audioContext.createGain()
  output.gain.value = 0

  source.connect(processor)
  processor.connect(output)
  output.connect(audioContext.destination)

  let destroyed = false
  let feedChain = Promise.resolve()

  processor.onaudioprocess = (event) => {
    if (destroyed) return

    const channelData = event.inputBuffer.getChannelData(0)
    if (!channelData.length) return

    const samples = new Float32Array(channelData)

    feedChain = feedChain.catch(() => undefined).then(async () => {
      if (destroyed) return

      try {
        const result = await wakewordApi.kwsFeed({
          samples,
          sampleRate: audioContext.sampleRate,
        })

        if (result?.keyword && !destroyed) {
          callbacks.onKeywordDetected(result.keyword)
        }
      } catch (error) {
        if (!destroyed) {
          callbacks.onError?.(error instanceof Error ? error.message : '唤醒词检测出错。')
        }
      }
    })
  }

  function teardown() {
    if (destroyed) return
    destroyed = true

    processor.onaudioprocess = null
    try { source.disconnect() } catch { /* no-op */ }
    try { processor.disconnect() } catch { /* no-op */ }
    try { output.disconnect() } catch { /* no-op */ }

    stream.getTracks().forEach((track) => track.stop())
    void audioContext.close().catch(() => undefined)
    wakewordApi.kwsStop().catch(() => undefined)
    callbacks.onStatusChange?.(false)
  }

  return { stop: teardown }
}

export async function checkWakewordAvailability(
  options: WakewordListenerOptions = {},
): Promise<{
  installed: boolean
  modelFound: boolean
  active: boolean
  reason?: string
  modelKind?: 'zh' | 'en' | null
}> {
  const api = window.desktopPet
  if (!api?.kwsStatus) {
    return { installed: false, modelFound: false, active: false }
  }

  return api.kwsStatus({ wakeWord: options.wakeWord?.trim() || '' })
}
