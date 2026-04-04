import type { MutableRefObject, RefObject } from 'react'
import {
  isBrowserSpeechInputProvider,
  isFunAsrSpeechInputProvider,
  isLocalSherpaSpeechInputProvider,
  isLocalWhisperSpeechInputProvider,
} from '../../lib/audioProviders'
import { checkSherpaAvailability } from '../../features/hearing/localSherpa.ts'
import type {
  VoiceSessionEvent,
  VoiceSessionTransport,
} from '../../features/voice/sessionMachine'
import type {
  AppSettings,
  PetMood,
  VoicePipelineState,
  VoiceState,
} from '../../types'
import { startBrowserRecognitionConversation } from './browserRecognition'
import type {
  VadConversationSession,
  VoiceConversationOptions,
} from './types'
import type { BrowserSpeechRecognition } from '../../lib/voice'
import type { FunasrStreamSession } from '../../features/hearing/localFunasr.ts'
import type { SherpaStreamSession } from '../../features/hearing/localSherpa.ts'

type ShowPetStatus = (
  message: string,
  duration?: number,
  dedupeWindowMs?: number,
) => void

type ActiveVoiceConversationOptions = {
  restart?: boolean
  passive?: boolean
  wakewordTriggered?: boolean
}

export type StartVoiceConversationEntrypointOptions = {
  options?: VoiceConversationOptions
  settingsRef: RefObject<AppSettings>
  busyRef: RefObject<boolean>
  activeVoiceConversationOptionsRef: MutableRefObject<ActiveVoiceConversationOptions>
  voiceStateRef: MutableRefObject<VoiceState>
  suppressVoiceReplyRef: MutableRefObject<boolean>
  recognitionRef: MutableRefObject<BrowserSpeechRecognition | null>
  vadSessionRef: MutableRefObject<VadConversationSession | null>
  sherpaSessionRef: MutableRefObject<SherpaStreamSession | null>
  funasrSessionRef: MutableRefObject<FunasrStreamSession | null>
  clearPendingVoiceRestart: () => void
  canInterruptSpeech: () => boolean
  interruptSpeakingForVoiceInput: () => boolean
  setContinuousVoiceSession: (active: boolean) => void
  shouldKeepContinuousVoiceSession: () => boolean
  resetNoSpeechRestartCount: () => void
  beginVoiceListeningSession: (transport: VoiceSessionTransport) => unknown
  dispatchVoiceSessionAndSync: (event: VoiceSessionEvent) => unknown
  setMood: (mood: PetMood) => void
  setError: (error: string | null) => void
  setLiveTranscript: (transcript: string) => void
  updateVoicePipeline: (
    step: VoicePipelineState['step'],
    detail: string,
    transcript?: string,
  ) => void
  showPetStatus: ShowPetStatus
  handleRecognizedVoiceTranscript: (
    transcript: string,
    options?: { traceId?: string },
  ) => Promise<boolean>
  handleVoiceListeningFailure: (message: string, errorCode?: string) => void
  shouldAutoRestartVoice: () => boolean
  scheduleVoiceRestart: (statusText?: string, delay?: number) => void
  ensureSupportedSpeechInputSettings: (announce?: boolean) => AppSettings
  switchSpeechInputToLocalWhisper: (statusText?: string) => unknown
  startSherpaVoiceConversation: (options?: VoiceConversationOptions) => Promise<void>
  startFunasrVoiceConversation: (options?: VoiceConversationOptions) => Promise<void>
  startVadVoiceConversation: (
    transcribeMode: 'api' | 'local',
    options?: VoiceConversationOptions,
  ) => Promise<void>
  startLocalWhisperConversation: (
    options?: VoiceConversationOptions,
    runtimeSettings?: AppSettings,
  ) => Promise<void>
  startApiVoiceConversation: (options?: VoiceConversationOptions) => Promise<void>
}

export type StopVoiceConversationEntrypointOptions = {
  continuousVoiceActiveRef: MutableRefObject<boolean>
  suppressVoiceReplyRef: MutableRefObject<boolean>
  recognitionRef: MutableRefObject<BrowserSpeechRecognition | null>
  sherpaSessionRef: MutableRefObject<SherpaStreamSession | null>
  funasrSessionRef: MutableRefObject<FunasrStreamSession | null>
  clearPendingVoiceRestart: () => void
  setContinuousVoiceSession: (active: boolean) => void
  resetNoSpeechRestartCount: () => void
  clearSherpaConversationState: () => void
  clearFunasrConversationState: () => void
  stopApiRecording: (cancel?: boolean) => void
  stopVadListening: (cancel?: boolean) => Promise<void>
  stopActiveSpeechOutput: () => void
  dispatchVoiceSessionAndSync: (event: VoiceSessionEvent) => unknown
  setLiveTranscript: (transcript: string) => void
  setMood: (mood: PetMood) => void
  updateVoicePipeline: (
    step: VoicePipelineState['step'],
    detail: string,
    transcript?: string,
  ) => void
  showPetStatus: ShowPetStatus
}

export function startVoiceConversationEntrypoint(
  params: StartVoiceConversationEntrypointOptions,
) {
  params.activeVoiceConversationOptionsRef.current = {
    restart: params.options?.restart ?? false,
    passive: params.options?.passive ?? false,
    wakewordTriggered: params.options?.wakewordTriggered ?? false,
  }

  let currentSettings = params.ensureSupportedSpeechInputSettings(true)

  if (isLocalSherpaSpeechInputProvider(currentSettings.speechInputProviderId)) {
    void checkSherpaAvailability().then((status) => {
      if (!isLocalSherpaSpeechInputProvider(params.settingsRef.current.speechInputProviderId)) {
        return
      }

      if (!status.installed || !status.modelFound) {
        params.switchSpeechInputToLocalWhisper('本地 Sherpa 识别模型缺失，已自动切换到本地 Whisper。')
        return
      }

      void params.startSherpaVoiceConversation(params.options)
    }).catch(() => {
      params.switchSpeechInputToLocalWhisper('本地 Sherpa 识别不可用，已自动切换到本地 Whisper。')
    })
    return
  }

  if (isFunAsrSpeechInputProvider(currentSettings.speechInputProviderId)) {
    void params.startFunasrVoiceConversation(params.options)
    return
  }

  currentSettings = params.settingsRef.current

  if (!currentSettings.speechInputEnabled) {
    params.setContinuousVoiceSession(false)
    params.setError('请先在设置中启用语音输入。')
    return
  }

  if (
    params.busyRef.current
    || params.vadSessionRef.current
    || params.sherpaSessionRef.current
    || params.funasrSessionRef.current
    || params.voiceStateRef.current === 'processing'
  ) {
    return
  }

  if (isLocalWhisperSpeechInputProvider(currentSettings.speechInputProviderId)) {
    if (currentSettings.voiceActivityDetectionEnabled) {
      void params.startVadVoiceConversation('local', params.options)
      return
    }

    void params.startLocalWhisperConversation(params.options)
    return
  }

  if (!isBrowserSpeechInputProvider(currentSettings.speechInputProviderId)) {
    if (currentSettings.voiceActivityDetectionEnabled) {
      void params.startVadVoiceConversation('api', params.options)
      return
    }

    void params.startApiVoiceConversation(params.options)
    return
  }

  startBrowserRecognitionConversation({
    options: params.options,
    currentSettings,
    recognitionRef: params.recognitionRef,
    voiceStateRef: params.voiceStateRef,
    suppressVoiceReplyRef: params.suppressVoiceReplyRef,
    clearPendingVoiceRestart: params.clearPendingVoiceRestart,
    canInterruptSpeech: params.canInterruptSpeech,
    interruptSpeakingForVoiceInput: params.interruptSpeakingForVoiceInput,
    setContinuousVoiceSession: params.setContinuousVoiceSession,
    shouldKeepContinuousVoiceSession: params.shouldKeepContinuousVoiceSession,
    resetNoSpeechRestartCount: params.resetNoSpeechRestartCount,
    beginVoiceListeningSession: params.beginVoiceListeningSession,
    dispatchVoiceSessionAndSync: params.dispatchVoiceSessionAndSync,
    setMood: params.setMood,
    setError: params.setError,
    setLiveTranscript: params.setLiveTranscript,
    updateVoicePipeline: params.updateVoicePipeline,
    showPetStatus: params.showPetStatus,
    handleRecognizedVoiceTranscript: params.handleRecognizedVoiceTranscript,
    handleVoiceListeningFailure: params.handleVoiceListeningFailure,
    shouldAutoRestartVoice: params.shouldAutoRestartVoice,
    scheduleVoiceRestart: params.scheduleVoiceRestart,
  })
}

export function stopVoiceConversationEntrypoint(
  params: StopVoiceConversationEntrypointOptions,
) {
  const wasContinuousVoiceActive = params.continuousVoiceActiveRef.current

  params.clearPendingVoiceRestart()
  params.setContinuousVoiceSession(false)
  params.resetNoSpeechRestartCount()
  params.suppressVoiceReplyRef.current = true
  params.recognitionRef.current?.abort()
  params.recognitionRef.current = null
  params.clearSherpaConversationState()
  params.sherpaSessionRef.current?.abort()
  params.sherpaSessionRef.current = null
  params.clearFunasrConversationState()
  params.funasrSessionRef.current?.abort()
  params.funasrSessionRef.current = null
  params.stopApiRecording(true)
  void params.stopVadListening(true)
  params.stopActiveSpeechOutput()
  params.dispatchVoiceSessionAndSync({ type: 'aborted' })
  params.setLiveTranscript('')
  params.setMood('idle')
  params.updateVoicePipeline(
    'idle',
    wasContinuousVoiceActive ? '连续语音已停止' : '语音已停止',
  )
  params.showPetStatus(
    wasContinuousVoiceActive ? '连续语音已停止。' : '语音已停止。',
    2_600,
    2_800,
  )
}
