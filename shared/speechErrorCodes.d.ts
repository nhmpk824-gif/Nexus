export declare const SPEECH_IPC_ERROR_CODES: {
  readonly TTS_TIMEOUT: 'NEXUS_ERR_TTS_TIMEOUT'
  readonly STT_TIMEOUT: 'NEXUS_ERR_STT_TIMEOUT'
}

export type SpeechIpcErrorCode = (typeof SPEECH_IPC_ERROR_CODES)[keyof typeof SPEECH_IPC_ERROR_CODES]

export declare function extractSpeechIpcErrorCode(error: unknown): SpeechIpcErrorCode | null
