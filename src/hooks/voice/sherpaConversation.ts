import type { MutableRefObject } from 'react'
import {
  normalizeRecognizedVoiceTranscript,
  shouldAttemptLocalWhisperRescore,
} from '../../features/hearing/core.ts'
import { startSherpaStream, type SherpaStreamSession } from '../../features/hearing/localSherpa.ts'
import { formatTraceLabel } from '../../features/voice/shared'
import type {
  VoiceSessionEvent,
  VoiceSessionState,
  VoiceSessionTransport,
} from '../../features/voice/sessionMachine'
import { clamp } from '../../lib/common'
import { createId } from '../../lib'
import { mapSpeechError } from '../../lib/voice'
import type {
  AppSettings,
  PetMood,
  VoicePipelineState,
  VoiceState,
} from '../../types'
import {
  API_RECORDING_MAX_DURATION_MS,
  SHERPA_STREAM_ACTIVITY_RMS_THRESHOLD,
  SHERPA_STREAM_ENDPOINT_FINALIZE_MS,
  SHERPA_STREAM_MAX_IDLE_MS,
  SHERPA_STREAM_RISKY_ENDPOINT_FINALIZE_MS,
  SHERPA_STREAM_SILENCE_FINISH_MS,
} from './constants'
import { createAdaptiveRmsGate } from './support'
import type {
  SherpaConversationState,
  VoiceConversationOptions,
} from './types'

type ShowPetStatus = (
  message: string,
  duration?: number,
  dedupeWindowMs?: number,
) => void

export type StartSherpaConversationOptions = {
  options?: VoiceConversationOptions
  currentSettings: AppSettings
  voiceStateRef: MutableRefObject<VoiceState>
  suppressVoiceReplyRef: MutableRefObject<boolean>
  sherpaSessionRef: MutableRefObject<SherpaStreamSession | null>
  sherpaConversationRef: MutableRefObject<SherpaConversationState | null>
  clearPendingVoiceRestart: () => void
  canInterruptSpeech: () => boolean
  interruptSpeakingForVoiceInput: () => boolean
  setContinuousVoiceSession: (active: boolean) => void
  shouldKeepContinuousVoiceSession: () => boolean
  resetNoSpeechRestartCount: () => void
  clearSherpaConversationState: () => void
  beginVoiceListeningSession: (transport: VoiceSessionTransport) => unknown
  dispatchVoiceSession: (event: VoiceSessionEvent) => VoiceSessionState
  dispatchVoiceSessionAndSync: (event: VoiceSessionEvent) => unknown
  setVoiceState: (state: VoiceState) => void
  setMood: (mood: PetMood) => void
  setError: (error: string | null) => void
  setLiveTranscript: (transcript: string) => void
  updateVoicePipeline: (
    step: VoicePipelineState['step'],
    detail: string,
    transcript?: string,
  ) => void
  appendVoiceTrace: (title: string, detail: string) => void
  showPetStatus: ShowPetStatus
  setSpeechLevelValue: (level: number) => void
  maybeRescoreSherpaTranscript: (options: {
    transcript: string
    audioSamples: Float32Array | null
    sampleRate: number
    currentSettings: AppSettings
    partialCount: number
    endpointCount: number
    traceLabel: string
  }) => Promise<string>
  handleRecognizedVoiceTranscript: (
    transcript: string,
    options?: { traceId?: string },
  ) => Promise<boolean>
  handleVoiceListeningFailure: (
    message: string,
    errorCode?: string,
  ) => void
  switchSpeechInputToLocalWhisper: (statusText?: string) => unknown
  shouldAutoRestartVoice: () => boolean
}

export async function startSherpaConversation(
  params: StartSherpaConversationOptions,
) {
  const restart = params.options?.restart ?? false
  const passive = params.options?.passive ?? false

  if (
    !window.desktopPet?.sherpaStart
    || !window.desktopPet.sherpaFeed
    || !window.desktopPet.sherpaFinish
    || !window.desktopPet.sherpaAbort
  ) {
    params.setContinuousVoiceSession(false)
    params.setError('当前环境未连接桌面客户端，无法使用本地流式识别。')
    return
  }

  params.clearPendingVoiceRestart()

  if (params.voiceStateRef.current === 'speaking') {
    if (!params.canInterruptSpeech()) {
      params.showPetStatus('当前关闭了语音打断，请等我说完。', 2_800, 3_200)
      return
    }

    if (!params.interruptSpeakingForVoiceInput()) {
      return
    }
  }

  params.suppressVoiceReplyRef.current = false

  if (!restart) {
    params.setContinuousVoiceSession(params.shouldKeepContinuousVoiceSession())
    params.resetNoSpeechRestartCount()
  }

  params.clearSherpaConversationState()

  try {
    const traceId = createId('voice')
    const traceLabel = formatTraceLabel(traceId)
    let session: SherpaStreamSession | null = null
    let latestText = ''
    let speechDetected = false
    let finalizing = false
    let lastSpeechAt = performance.now()
    const activityGate = createAdaptiveRmsGate(SHERPA_STREAM_ACTIVITY_RMS_THRESHOLD)

    const armSherpaInactivityTimer = () => {
      const state = params.sherpaConversationRef.current
      if (!state || !session) return

      if (state.noSpeechTimer) {
        window.clearTimeout(state.noSpeechTimer)
      }

      state.noSpeechTimer = window.setTimeout(() => {
        if (!session || finalizing || params.sherpaSessionRef.current !== session) return

        if (!speechDetected) {
          finalizing = true
          params.clearSherpaConversationState()
          session.abort()
          params.sherpaSessionRef.current = null
          params.handleVoiceListeningFailure(mapSpeechError('no-speech'), 'no-speech')
          return
        }

        void finalizeSherpaTranscript('长时间未继续说话，正在收尾', latestText, '（静默收尾）')
      }, SHERPA_STREAM_MAX_IDLE_MS)
    }

    const clearPendingEndpointFinalize = () => {
      const state = params.sherpaConversationRef.current
      if (!state?.endpointFinalizeTimer) return

      window.clearTimeout(state.endpointFinalizeTimer)
      state.endpointFinalizeTimer = null
    }

    const scheduleEndpointFinalize = (
      detail = '识别到你这一句说完了，正在快速提取',
      traceSuffix = '（endpoint）',
    ) => {
      const state = params.sherpaConversationRef.current
      if (!state || !session || finalizing) return

      clearPendingEndpointFinalize()
      const finalizeDelay = shouldAttemptLocalWhisperRescore(latestText, {
        partialCount: state.partialCount,
        endpointCount: state.endpointCount,
      })
        ? SHERPA_STREAM_RISKY_ENDPOINT_FINALIZE_MS
        : SHERPA_STREAM_ENDPOINT_FINALIZE_MS

      state.endpointFinalizeTimer = window.setTimeout(() => {
        if (!session || finalizing || params.sherpaSessionRef.current !== session) return
        state.endpointFinalizeTimer = null
        void finalizeSherpaTranscript(detail, latestText, traceSuffix)
      }, finalizeDelay)
    }

    const markSherpaSpeechDetected = () => {
      if (speechDetected) return

      speechDetected = true
      params.dispatchVoiceSession({ type: 'speech_detected' })
      params.resetNoSpeechRestartCount()
    }

    const finalizeSherpaTranscript = async (
      detail: string,
      transcriptHint = latestText,
      traceSuffix = '',
    ) => {
      if (!session || finalizing) return

      finalizing = true
      clearPendingEndpointFinalize()
      const conversationSnapshot = params.sherpaConversationRef.current
      params.clearSherpaConversationState()

      try {
        params.dispatchVoiceSessionAndSync({
          type: 'stt_finalizing',
          text: transcriptHint,
        })
        params.setMood('thinking')
        params.updateVoicePipeline('transcribing', detail)

        const stopResult = await session.stop()
        params.sherpaSessionRef.current = null
        const sherpaTranscript = normalizeRecognizedVoiceTranscript(
          stopResult.text || transcriptHint || latestText,
        )
        const transcript = await params.maybeRescoreSherpaTranscript({
          transcript: sherpaTranscript,
          audioSamples: stopResult.audioSamples,
          sampleRate: stopResult.sampleRate,
          currentSettings: params.currentSettings,
          partialCount: conversationSnapshot?.partialCount ?? 0,
          endpointCount: conversationSnapshot?.endpointCount ?? 0,
          traceLabel,
        })

        if (!transcript) {
          params.handleVoiceListeningFailure(mapSpeechError('no-speech'), 'no-speech')
          return
        }

        params.appendVoiceTrace('流式识别完成', `#${traceLabel} 已拿到最终文本${traceSuffix}`)
        await params.handleRecognizedVoiceTranscript(transcript, { traceId })
      } catch (error) {
        params.sherpaSessionRef.current = null
        params.handleVoiceListeningFailure(
          error instanceof Error ? error.message : '本地流式识别失败，请稍后再试。',
        )
      }
    }

    params.beginVoiceListeningSession('local_sherpa')
    params.setMood('happy')
    params.setError(null)
    params.setLiveTranscript('')
    params.updateVoicePipeline('listening', '本地流式识别已启动，边说边出字。')

    if (!passive) {
      params.showPetStatus(
        params.shouldAutoRestartVoice()
          ? '流式识别已开启，我会实时转写你说的话。'
          : '我在听，你说的话会实时显示。',
        4_200,
        3_600,
      )
    }

    params.appendVoiceTrace('开始流式识别', `#${traceLabel} 正在使用 Sherpa-onnx 本地流式转写`)

    session = await startSherpaStream({
      onActivity: (rms) => {
        if (!session || params.sherpaSessionRef.current !== session || finalizing) return

        params.setSpeechLevelValue(clamp(rms * 6, 0, 1))

        if (activityGate.isSpeech(rms)) {
          clearPendingEndpointFinalize()
          lastSpeechAt = performance.now()
          markSherpaSpeechDetected()
          armSherpaInactivityTimer()

          if (!latestText) {
            params.updateVoicePipeline('listening', '已检测到说话，正在本地实时识别')
          }
          return
        }

        if (
          speechDetected
          && performance.now() - lastSpeechAt >= SHERPA_STREAM_SILENCE_FINISH_MS
        ) {
          void finalizeSherpaTranscript(
            '检测到你已经停下，正在整理本地识别文本',
            latestText,
            '（静音收尾）',
          )
        }
      },
      onPartial: (text) => {
        if (!session || params.sherpaSessionRef.current !== session || finalizing) return

        const normalizedText = normalizeRecognizedVoiceTranscript(text)
        if (!normalizedText) return

        clearPendingEndpointFinalize()
        markSherpaSpeechDetected()
        lastSpeechAt = performance.now()
        latestText = normalizedText
        if (params.sherpaConversationRef.current) {
          params.sherpaConversationRef.current.partialCount += 1
        }
        const sessionState = params.dispatchVoiceSession({
          type: 'stt_partial',
          text: normalizedText,
        })
        params.setLiveTranscript(sessionState.transcript)
        params.updateVoicePipeline('listening', '正在实时识别', normalizedText)
        armSherpaInactivityTimer()
      },
      onEndpoint: (text) => {
        if (!session || params.sherpaSessionRef.current !== session || finalizing) return

        const normalizedText = normalizeRecognizedVoiceTranscript(text || latestText)
        if (!normalizedText) return

        markSherpaSpeechDetected()
        lastSpeechAt = performance.now()
        latestText = normalizedText
        if (params.sherpaConversationRef.current) {
          params.sherpaConversationRef.current.endpointCount += 1
        }
        const sessionState = params.dispatchVoiceSession({
          type: 'stt_endpoint',
          text: normalizedText,
        })
        params.setLiveTranscript(sessionState.transcript)
        params.updateVoicePipeline('listening', '检测到句尾，准备快速提取', normalizedText)
        armSherpaInactivityTimer()
        scheduleEndpointFinalize()
      },
      onError: (message) => {
        if (finalizing) return

        finalizing = true
        params.clearSherpaConversationState()
        params.sherpaSessionRef.current = null
        params.handleVoiceListeningFailure(message)
      },
    }, {
      modelId: params.currentSettings.speechInputModel,
    })

    params.sherpaSessionRef.current = session
    params.sherpaConversationRef.current = {
      noSpeechTimer: null,
      maxDurationTimer: null,
      endpointFinalizeTimer: null,
      partialCount: 0,
      endpointCount: 0,
    }

    armSherpaInactivityTimer()
    params.sherpaConversationRef.current.maxDurationTimer = window.setTimeout(() => {
      if (!session || finalizing || params.sherpaSessionRef.current !== session) return

      if (!speechDetected) {
        finalizing = true
        params.clearSherpaConversationState()
        session.abort()
        params.sherpaSessionRef.current = null
        params.handleVoiceListeningFailure(mapSpeechError('no-speech'), 'no-speech')
        return
      }

      void finalizeSherpaTranscript('录音时间到，正在收尾', latestText, '（时间到）')
    }, API_RECORDING_MAX_DURATION_MS)
  } catch (error) {
    params.clearSherpaConversationState()
    params.setVoiceState('idle')
    params.setMood('idle')
    params.setSpeechLevelValue(0)
    params.sherpaSessionRef.current?.abort()
    params.sherpaSessionRef.current = null

    const message = error instanceof Error
      ? error.message
      : '本地流式识别启动失败，请检查 sherpa-onnx 模型和配置。'

    if (params.currentSettings.speechInputFailoverEnabled) {
      params.switchSpeechInputToLocalWhisper('本地流式识别不可用，已自动切换到本地 Whisper。')
      return
    }

    params.updateVoicePipeline('idle', message)
    params.setError(message)
    params.showPetStatus(message, 4_800, 4_500)
  }
}
