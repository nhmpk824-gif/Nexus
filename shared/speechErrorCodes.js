/**
 * Canonical speech IPC timeout codes — TTS synth/download/voice-list and
 * STT transcribe/connection-test. Thrown failures carry a stable token
 * because Electron drops `error.code`; the renderer classifies by this
 * code instead of matching localized timeout copy.
 */

export const SPEECH_IPC_ERROR_CODES = Object.freeze({
  TTS_TIMEOUT: 'NEXUS_ERR_TTS_TIMEOUT',
  STT_TIMEOUT: 'NEXUS_ERR_STT_TIMEOUT',
})

const CODE_PATTERN = /NEXUS_ERR_(?:TTS|STT)_TIMEOUT/

/**
 * Pull the speech timeout token out of an IPC-wrapped or same-process error.
 * `error.code` is `request_timeout` from net.js; the NEXUS token rides in
 * the message (timeoutMessage) and survives Electron IPC serialization.
 */
export function extractSpeechIpcErrorCode(error) {
  if (error && typeof error === 'object' && typeof error.code === 'string' && CODE_PATTERN.test(error.code)) {
    return error.code
  }
  const message = error instanceof Error ? error.message : String(error ?? '')
  const match = CODE_PATTERN.exec(message)
  return match ? match[0] : null
}
