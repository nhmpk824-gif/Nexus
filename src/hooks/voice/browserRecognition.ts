import type { MutableRefObject } from 'react'
import type { VoiceSessionEvent, VoiceSessionTransport } from '../../features/voice/sessionMachine'
import {
  getSpeechRecognitionCtor,
  mapSpeechError,
  type BrowserSpeechRecognition,
  type BrowserSpeechRecognitionEvent,
} from '../../lib/voice'
import type { PetMood, TranslationKey, TranslationParams, VoicePipelineState, VoiceState } from '../../types'
import type { VoiceConversationOptions } from './types'

type ShowPetStatus = (
  message: string,
  duration?: number,
  dedupeWindowMs?: number,
) => void

type Translator = (key: TranslationKey, params?: TranslationParams) => string

export type StartBrowserRecognitionConversationOptions = {
  options?: VoiceConversationOptions
  currentSettings: {
    speechRecognitionLang: string
  }
  recognitionRef: MutableRefObject<BrowserSpeechRecognition | null>
  voiceStateRef: MutableRefObject<VoiceState>
  suppressVoiceReplyRef: MutableRefObject<boolean>
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
  handleRecognizedVoiceTranscript: (transcript: string) => Promise<boolean>
  handleVoiceListeningFailure: (message: string, errorCode?: string) => void
  shouldAutoRestartVoice: () => boolean
  scheduleVoiceRestart: (statusText?: string, delay?: number) => void
  ti: Translator
}

export function startBrowserRecognitionConversation(
  params: StartBrowserRecognitionConversationOptions,
) {
  const SpeechRecognitionCtor = getSpeechRecognitionCtor()
  if (!SpeechRecognitionCtor) {
    params.setContinuousVoiceSession(false)
    params.setError(params.ti('voice.provider.browser.unsupported'))
    return false
  }

  const restart = params.options?.restart ?? false
  const passive = params.options?.passive ?? false

  params.clearPendingVoiceRestart()

  if (params.voiceStateRef.current === 'speaking') {
    if (!params.canInterruptSpeech()) {
      params.showPetStatus(params.ti('voice.interruption_disabled'), 2_800, 3_200)
      return false
    }

    if (!params.interruptSpeakingForVoiceInput()) {
      return false
    }
  }

  params.suppressVoiceReplyRef.current = false

  if (!restart) {
    params.setContinuousVoiceSession(params.shouldKeepContinuousVoiceSession())
    params.resetNoSpeechRestartCount()
  }

  params.recognitionRef.current?.abort()
  const recognition = new SpeechRecognitionCtor()
  params.recognitionRef.current = recognition
  recognition.continuous = false
  recognition.interimResults = true
  recognition.lang = params.currentSettings.speechRecognitionLang
  recognition.maxAlternatives = 1

  recognition.onstart = () => {
    params.beginVoiceListeningSession('browser')
    params.setMood('happy')
    params.setError(null)
    params.setLiveTranscript('')
    params.updateVoicePipeline(
      'listening',
      params.shouldAutoRestartVoice() ? params.ti('voice.pipeline.recording_continuous') : params.ti('voice.pipeline.recording_listening'),
    )

    if (!passive) {
      params.showPetStatus(
        params.shouldAutoRestartVoice()
          ? params.ti('voice.status.continuous_recording_start')
          : params.ti('voice.status.recording_listening'),
        4_200,
        3_600,
      )
    }
  }

  let finalized = false

  recognition.onresult = async (event: BrowserSpeechRecognitionEvent) => {
    if (finalized) return

    let finalTranscript = ''
    let interimTranscript = ''

    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const result = event.results[index]
      const transcript = result[0]?.transcript?.trim() ?? ''
      if (!transcript) {
        continue
      }

      if (result.isFinal) {
        finalTranscript += transcript
      } else {
        interimTranscript += transcript
      }
    }

    params.setLiveTranscript(interimTranscript || finalTranscript)
    if (interimTranscript || finalTranscript) {
      params.updateVoicePipeline('listening', params.ti('voice.pipeline.browser_recognizing'), interimTranscript || finalTranscript)
    }

    if (finalTranscript) {
      finalized = true
      params.resetNoSpeechRestartCount()
      params.recognitionRef.current = null
      recognition.stop()
      await params.handleRecognizedVoiceTranscript(finalTranscript)
    }
  }

  recognition.onerror = (event) => {
    params.recognitionRef.current = null
    params.handleVoiceListeningFailure(mapSpeechError(event.error), event.error)
  }

  recognition.onend = () => {
    if (params.recognitionRef.current === recognition) {
      params.recognitionRef.current = null
      params.dispatchVoiceSessionAndSync({ type: 'session_completed' })
      params.setLiveTranscript('')
      params.setMood('idle')

      if (params.shouldAutoRestartVoice()) {
        params.scheduleVoiceRestart(params.ti('voice.status.resume_listening'), 520)
      }
    }
  }

  try {
    recognition.start()
    return true
  } catch {
    params.recognitionRef.current = null
    params.setContinuousVoiceSession(false)
    const startFailedMsg = params.ti('voice.provider.api.start_failed')
    params.dispatchVoiceSessionAndSync({
      type: 'error',
      message: startFailedMsg,
    })
    params.setMood('idle')
    params.setError(startFailedMsg)
    return false
  }
}
