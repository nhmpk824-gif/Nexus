import type { MutableRefObject } from 'react'
import {
  createVoiceActivityDetector,
  encodeVadAudioToWavBlob,
} from '../../features/hearing/browserVad.ts'
import { createMainProcessVadController } from '../../features/hearing/mainProcessVad.ts'
import type { WakewordRuntimeController } from '../../features/hearing/wakewordRuntime.ts'
import type { VoiceBusEvent } from '../../features/voice/busEvents'
import { formatTraceLabel } from '../../features/voice/shared'
import type {
  VoiceSessionEvent,
  VoiceSessionTransport,
} from '../../features/voice/sessionMachine'
import { VoiceReasonCodes } from '../../features/voice/voiceReasonCodes'
import { blobToBase64 } from '../../lib/common'
import { createId } from '../../lib'
import { recordSttUsage } from '../../features/metering/speechCost'
import { mapSpeechError } from '../../lib/voice'
import type {
  AppSettings,
  PetMood,
  VoicePipelineState,
  VoiceState,
} from '../../types'
import {
  API_RECORDING_MAX_DURATION_MS,
  API_RECORDING_MAX_IDLE_MS,
} from './constants'
import type {
  VadConversationSession,
  VoiceConversationOptions,
} from './types'

type ShowPetStatus = (
  message: string,
  duration?: number,
  dedupeWindowMs?: number,
) => void

export type StartVadConversationOptions = {
  transcribeMode: 'api' | 'local'
  options?: VoiceConversationOptions
  currentSettings: AppSettings
  vadSessionRef: MutableRefObject<VadConversationSession | null>
  wakewordRuntimeRef: MutableRefObject<WakewordRuntimeController | null>
  voiceStateRef: MutableRefObject<VoiceState>
  suppressVoiceReplyRef: MutableRefObject<boolean>
  clearPendingVoiceRestart: () => void
  canInterruptSpeech: () => boolean
  interruptSpeakingForVoiceInput: () => boolean
  setContinuousVoiceSession: (active: boolean) => void
  shouldKeepContinuousVoiceSession: () => boolean
  resetNoSpeechRestartCount: () => void
  beginVoiceListeningSession: (transport: VoiceSessionTransport) => unknown
  dispatchVoiceSession: (event: VoiceSessionEvent) => unknown
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
  destroyVadSession: (session: VadConversationSession | null) => Promise<void>
  handleRecognizedVoiceTranscript: (
    transcript: string,
    options?: { traceId?: string },
  ) => Promise<boolean>
  handleVoiceListeningFailure: (
    message: string,
    errorCode?: string,
  ) => void
  startFallbackConversation: (
    options?: VoiceConversationOptions,
  ) => Promise<void>
  shouldAutoRestartVoice: () => boolean
  busEmit?: (event: VoiceBusEvent) => void
}

export async function startVadConversation(
  params: StartVadConversationOptions,
) {
  const restart = params.options?.restart ?? false
  const passive = params.options?.passive ?? false

  if (params.transcribeMode === 'api' && !window.desktopPet?.transcribeAudio) {
    params.setContinuousVoiceSession(false)
    params.setError('当前环境未连接桌面客户端，无法使用内置语音识别。')
    return
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    params.setContinuousVoiceSession(false)
    params.setError('当前环境不支持麦克风输入，请检查系统录音权限。')
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

  // Prefer the shared-audio path: if the always-on wakeword listener is
  // live, VAD subscribes to its ScriptProcessor frames and runs Silero on
  // the same samples KWS is decoding. No second getUserMedia, no MicVAD,
  // no mic-device race with Chromium/WASAPI. Falls back to the legacy
  // MicVAD path only when the wakeword listener isn't available (e.g.,
  // manual voice start while wake word is off, or the listener is in an
  // error/retry state and has no active ScriptProcessor).
  const wakewordRuntime = params.wakewordRuntimeRef.current
  const wakewordPhase = wakewordRuntime?.getState().phase
  const useFrameDriver = Boolean(
    wakewordRuntime && (wakewordPhase === 'listening' || wakewordPhase === 'paused'),
  )

  // Declare up front so the shared VAD event handlers below can close over
  // the session variable — TS would otherwise complain about use-before-
  // assignment inside the handlers passed into the detector/frame driver.
  let session!: VadConversationSession

  const handleSpeechStart = () => {
    if (params.vadSessionRef.current !== session) return
    session.speechDetected = true
    params.dispatchVoiceSession({ type: 'speech_detected' })
    params.busEmit?.({
      type: 'vad:speech_start',
      reason: VoiceReasonCodes.VAD_SPEECH_START,
    })
    params.updateVoicePipeline('listening', '已检测到说话，继续收音中')
  }

  const handleSpeechRealStart = () => {
    if (params.vadSessionRef.current !== session) return
    params.resetNoSpeechRestartCount()
  }

  const handleFrameProcessed = (speechProbability: number) => {
    if (params.vadSessionRef.current !== session) return
    params.setSpeechLevelValue(speechProbability)
  }

  const handleMisfire = () => {
    if (params.vadSessionRef.current !== session || session.cancelled) return
    // Misfire = speech detected but shorter than minSpeechMs. With the
    // frame driver path VAD starts receiving audio the instant the
    // wakeword session fires, so it often picks up the tail of "星绘"
    // before the real command arrives. Don't tear the session down —
    // just keep listening for the real utterance. The noSpeechTimer
    // still guards against truly empty sessions.
    console.warn('[VAD] onMisfire — ignoring, keep listening')
    session.speechDetected = false
    params.setSpeechLevelValue(0)
  }

  const handleSpeechEnd = async (audio: Float32Array) => {
    if (params.vadSessionRef.current !== session || session.cancelled) return

    params.vadSessionRef.current = null
    if (session.noSpeechTimer) {
      window.clearTimeout(session.noSpeechTimer)
    }
    if (session.maxDurationTimer) {
      window.clearTimeout(session.maxDurationTimer)
    }
    params.setSpeechLevelValue(0)
    params.busEmit?.({
      type: 'vad:speech_end',
      reason: VoiceReasonCodes.VAD_SPEECH_END,
    })

    try {
      params.dispatchVoiceSessionAndSync({ type: 'stt_finalizing' })
      params.setMood('thinking')
      const traceId = createId('voice')
      const traceLabel = formatTraceLabel(traceId)
      params.appendVoiceTrace(
        params.transcribeMode === 'local' ? 'Start local transcription' : 'Start transcription',
        `#${traceLabel} ${
          params.transcribeMode === 'local'
            ? 'calling local Whisper'
            : 'requesting speech recognition service'
        }`,
      )
      params.updateVoicePipeline(
        'transcribing',
        '录音结束，正在用 VAD 转写语音',
      )

      const audioBlob = encodeVadAudioToWavBlob(audio)
      const transcript = (
        await window.desktopPet!.transcribeAudio({
          providerId: params.currentSettings.speechInputProviderId,
          baseUrl: params.currentSettings.speechInputApiBaseUrl,
          apiKey: params.currentSettings.speechInputApiKey,
          model: params.currentSettings.speechInputModel,
          traceId,
          language: params.currentSettings.speechRecognitionLang,
          hotwords: params.currentSettings.speechInputHotwords,
          audioBase64: await blobToBase64(audioBlob),
          mimeType: 'audio/wav',
          fileName: 'speech.wav',
        })
      ).text.trim()

      await session.tearDown().catch(() => undefined)

      if (!transcript) {
        params.handleVoiceListeningFailure(mapSpeechError('no-speech'), 'no-speech')
        return
      }

      if (params.transcribeMode !== 'local') {
        recordSttUsage({
          providerId: params.currentSettings.speechInputProviderId,
          modelId: params.currentSettings.speechInputModel,
          transcriptChars: transcript.length,
        })
      }

      params.appendVoiceTrace(
        params.transcribeMode === 'local' ? 'Local transcription complete' : 'Transcription complete',
        `#${traceLabel} received recognized text`,
      )
      await params.handleRecognizedVoiceTranscript(transcript, { traceId })
    } catch (error) {
      await session.tearDown().catch(() => undefined)

      params.handleVoiceListeningFailure(
        error instanceof Error
          ? error.message
          : '语音识别失败，请稍后再试。',
      )
    }
  }

  try {
    if (useFrameDriver) {
      const mainVad = await createMainProcessVadController(
        {
          onSpeechStart: handleSpeechStart,
          onSpeechRealStart: handleSpeechRealStart,
          onSpeechEnd: handleSpeechEnd,
          onMisfire: handleMisfire,
          onFrameProcessed: handleFrameProcessed,
        },
        params.currentSettings.vadSensitivity,
      )

      const unsubscribe = wakewordRuntime!.subscribeMicFrames((samples) => {
        mainVad.pushSamples(samples)
      })

      session = {
        detector: null,
        frameDriver: mainVad,
        unsubscribeFrames: unsubscribe,
        async tearDown() {
          try { unsubscribe() } catch { /* no-op */ }
          await mainVad.destroy().catch(() => undefined)
        },
        noSpeechTimer: null,
        maxDurationTimer: null,
        cancelled: false,
        speechDetected: false,
      }
    } else {
      const detector = await createVoiceActivityDetector(
        {
          onSpeechStart: handleSpeechStart,
          onSpeechRealStart: handleSpeechRealStart,
          onSpeechEnd: handleSpeechEnd,
          onMisfire: handleMisfire,
          onFrameProcessed: handleFrameProcessed,
        },
        params.currentSettings.vadSensitivity,
      )

      session = {
        detector,
        frameDriver: null,
        unsubscribeFrames: null,
        async tearDown() {
          await detector.destroy().catch(() => undefined)
        },
        noSpeechTimer: null,
        maxDurationTimer: null,
        cancelled: false,
        speechDetected: false,
      }
    }

    params.vadSessionRef.current = session
    params.beginVoiceListeningSession(
      params.transcribeMode === 'local' ? 'local_vad' : 'remote_vad',
    )
    params.setMood('happy')
    params.setError(null)
    params.setLiveTranscript('')
    params.updateVoicePipeline(
      'listening',
      params.transcribeMode === 'local'
        ? (
            params.shouldAutoRestartVoice()
              ? '本地 VAD 连续语音已启动，正在听你说话'
              : '正在用本地 VAD 监听你的语音'
          )
        : (
            params.shouldAutoRestartVoice()
              ? 'VAD 连续语音已启动，正在听你说话'
              : '正在用 VAD 监听你的语音'
          ),
    )

    if (!passive) {
      params.showPetStatus(
        params.shouldAutoRestartVoice()
          ? '连续语音已开启，我会在你停下时自动送去识别。'
          : '我在听，你停下时我会自动识别。',
        4_200,
        3_600,
      )
    }

    session.noSpeechTimer = window.setTimeout(() => {
      if (
        params.vadSessionRef.current !== session
        || session.cancelled
        || session.speechDetected
      ) {
        return
      }

      console.warn('[VAD] destroy source: noSpeechTimer')
      void params.destroyVadSession(session)
      params.handleVoiceListeningFailure(mapSpeechError('no-speech'), 'no-speech')
    }, API_RECORDING_MAX_IDLE_MS)

    session.maxDurationTimer = window.setTimeout(() => {
      if (params.vadSessionRef.current !== session || session.cancelled) return

      if (!session.speechDetected) {
        console.warn('[VAD] destroy source: maxDurationTimer (no speech)')
        void params.destroyVadSession(session)
        params.handleVoiceListeningFailure(mapSpeechError('no-speech'), 'no-speech')
        return
      }

      // Only the legacy MicVAD exposes a pause() that flushes the current
      // speech segment via submitUserSpeechOnPause. The frame-driver path
      // doesn't open its own mic; just force-tear down the session here.
      if (session.detector) {
        void session.detector.pause().catch(() => undefined)
      } else {
        void params.destroyVadSession(session)
      }
    }, API_RECORDING_MAX_DURATION_MS)

    if (session.detector) {
      await session.detector.start()
    }
  } catch (error) {
    params.setVoiceState('idle')
    params.setMood('idle')
    params.setSpeechLevelValue(0)
    const originalMessage = (
      error instanceof Error
        ? error.message
        : 'VAD 语音检测启动失败，请检查麦克风权限或本地运行环境。'
    )
    const fallbackMessage = 'Silero VAD 启动失败，已自动切换到兼容录音模式。'

    console.warn('[Voice] Silero VAD unavailable, falling back to legacy recording', error)
    params.updateVoicePipeline('idle', fallbackMessage)
    params.showPetStatus(fallbackMessage, 4_800, 4_500)
    params.setError(`${fallbackMessage} 原始错误：${originalMessage}`)

    await params.startFallbackConversation(params.options)
  }
}
