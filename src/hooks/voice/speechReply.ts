import type { VoiceSessionEvent } from '../../features/voice/sessionMachine'
import { isSherpaTtsUnavailableMessage } from '../../features/voice/runtimeSupport'
import { isBrowserSpeechOutputProvider } from '../../lib/audioProviders'
import type { AppSettings, PetMood } from '../../types'
import {
  createStreamingSpeechOutputController,
  type StreamingSpeechOutputRuntime,
} from './streamingSpeechOutput'
import type { StreamingSpeechOutputController } from './types'

type DispatchVoiceSessionAndSync = (event: VoiceSessionEvent) => unknown
type ScheduleVoiceRestart = (statusText?: string, delay?: number) => void

type BaseSpeechReplyOptions = {
  speechGeneration: number
  shouldResumeContinuousVoice: boolean
  currentSettings: AppSettings
  dispatchVoiceSessionAndSync: DispatchVoiceSessionAndSync
  setMood: (mood: PetMood) => void
  setError: (error: string | null) => void
  shouldAutoRestartVoice: () => boolean
  scheduleVoiceRestart: ScheduleVoiceRestart
  startSpeechInterruptMonitor: (
    speechGeneration: number,
    shouldResumeContinuousVoice: boolean,
  ) => Promise<void>
  stopSpeechInterruptMonitor: () => void
  isSpeechInterrupted: (speechGeneration: number) => boolean
  clearSpeechInterruptedFlag: (speechGeneration: number) => void
}

export type SpeakAssistantReplyRuntimeOptions = BaseSpeechReplyOptions & {
  text: string
  startSpeechOutput: (
    text: string,
    speechSettings: AppSettings,
    options?: {
      onStart?: () => void
      onEnd?: () => void
      onError?: (message: string) => void
    },
  ) => Promise<void>
}

export type BeginStreamingSpeechReplyRuntimeOptions = BaseSpeechReplyOptions & {
  streamingRuntime: StreamingSpeechOutputRuntime
  switchSpeechOutputToBrowser: (statusText?: string) => unknown
}

function scheduleResumeIfNeeded(
  shouldResumeContinuousVoice: boolean,
  shouldAutoRestartVoice: () => boolean,
  scheduleVoiceRestart: ScheduleVoiceRestart,
  statusText: string,
  delay: number,
) {
  if (shouldResumeContinuousVoice && shouldAutoRestartVoice()) {
    scheduleVoiceRestart(statusText, delay)
  }
}

function shouldIgnoreInterruptedSpeech(
  speechGeneration: number,
  usesBrowserSpeechOutput: boolean,
  isSpeechInterrupted: (speechGeneration: number) => boolean,
  clearSpeechInterruptedFlag: (speechGeneration: number) => void,
) {
  if (!isSpeechInterrupted(speechGeneration)) {
    return false
  }

  if (usesBrowserSpeechOutput) {
    clearSpeechInterruptedFlag(speechGeneration)
  }

  return true
}

function createSpeechReplyCallbacks(
  options: BaseSpeechReplyOptions & {
    text: string
    usesBrowserSpeechOutput: boolean
  },
) {
  return {
    onStart: () => {
      options.dispatchVoiceSessionAndSync({ type: 'tts_started', text: options.text })
      options.setMood('happy')
      // Speech interrupt monitor disabled: echo-cancelled mic still picks up
      // TTS output, causing false interrupts that abort multi-chunk speech.
    },
    onEnd: () => {
      options.stopSpeechInterruptMonitor()

      if (shouldIgnoreInterruptedSpeech(
        options.speechGeneration,
        options.usesBrowserSpeechOutput,
        options.isSpeechInterrupted,
        options.clearSpeechInterruptedFlag,
      )) {
        return
      }

      options.dispatchVoiceSessionAndSync({ type: 'session_completed' })
      options.setMood('idle')
      if (options.shouldResumeContinuousVoice) {
        options.scheduleVoiceRestart('我继续收音，你可以接着说。', 520)
      }
    },
    onError: (message: string) => {
      options.stopSpeechInterruptMonitor()

      if (shouldIgnoreInterruptedSpeech(
        options.speechGeneration,
        options.usesBrowserSpeechOutput,
        options.isSpeechInterrupted,
        options.clearSpeechInterruptedFlag,
      )) {
        return
      }

      options.dispatchVoiceSessionAndSync({
        type: 'error',
        code: 'tts',
        message,
      })
      options.setMood('idle')
      options.setError(message)
      if (options.shouldResumeContinuousVoice) {
        options.scheduleVoiceRestart('播报出了点问题，但收音不会停。', 620)
      }
    },
  }
}

export async function speakAssistantReplyRuntime(
  options: SpeakAssistantReplyRuntimeOptions,
) {
  const usesBrowserSpeechOutput = isBrowserSpeechOutputProvider(
    options.currentSettings.speechOutputProviderId,
  )

  if (!options.currentSettings.speechOutputEnabled || !options.text.trim()) {
    options.stopSpeechInterruptMonitor()
    options.clearSpeechInterruptedFlag(options.speechGeneration)
    options.dispatchVoiceSessionAndSync({ type: 'session_completed' })
    window.setTimeout(() => options.setMood('idle'), 2_600)

    scheduleResumeIfNeeded(
      options.shouldResumeContinuousVoice,
      options.shouldAutoRestartVoice,
      options.scheduleVoiceRestart,
      '我继续收音，你可以接着说。',
      520,
    )
    return
  }

  try {
    await options.startSpeechOutput(
      options.text,
      options.currentSettings,
      createSpeechReplyCallbacks({
        ...options,
        text: options.text,
        usesBrowserSpeechOutput,
      }),
    )
  } catch (error) {
    options.stopSpeechInterruptMonitor()

    if (options.isSpeechInterrupted(options.speechGeneration)) {
      options.clearSpeechInterruptedFlag(options.speechGeneration)
      options.dispatchVoiceSessionAndSync({ type: 'tts_interrupted' })
      return
    }

    throw error
  }
}

export function beginStreamingSpeechReplyRuntime(
  options: BeginStreamingSpeechReplyRuntimeOptions,
): StreamingSpeechOutputController | null {
  const usesBrowserSpeechOutput = isBrowserSpeechOutputProvider(
    options.currentSettings.speechOutputProviderId,
  )

  if (!options.currentSettings.speechOutputEnabled || usesBrowserSpeechOutput) {
    return null
  }

  try {
    return createStreamingSpeechOutputController(
      options.currentSettings,
      options.streamingRuntime,
      createSpeechReplyCallbacks({
        ...options,
        text: '(streaming)',
        usesBrowserSpeechOutput,
      }),
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : '流式语音播报失败。'
    if (isSherpaTtsUnavailableMessage(message)) {
      options.switchSpeechOutputToBrowser('本地 Sherpa TTS 模型缺失，已自动切换到 CosyVoice2 播报。')
      return null
    }

    throw error instanceof Error ? error : new Error(message)
  }
}
