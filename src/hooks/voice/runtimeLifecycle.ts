import type { MutableRefObject } from 'react'
import type { BrowserSpeechRecognition } from '../../lib/voice'

export type CleanupVoiceRuntimeResourcesOptions = {
  clearPendingVoiceRestart: () => void
  recognitionRef: MutableRefObject<BrowserSpeechRecognition | null>
  stopApiRecording: (cancel?: boolean) => void
  stopVadListening: (cancel?: boolean) => Promise<void>
  speechLevelValueRef: MutableRefObject<number>
  setSpeechLevel: (level: number) => void
  stopActiveSpeechOutput: () => void
}

export function cleanupVoiceRuntimeResources(
  options: CleanupVoiceRuntimeResourcesOptions,
) {
  options.clearPendingVoiceRestart()
  options.recognitionRef.current?.abort()
  options.stopApiRecording(true)
  void options.stopVadListening(true)

  options.speechLevelValueRef.current = 0
  options.setSpeechLevel(0)
  options.stopActiveSpeechOutput()
}
