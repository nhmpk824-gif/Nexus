/**
 * Default network-timeout token used when a caller does not pass its own
 * timeoutMessage to performNetworkRequest. Domain IPC paths (chat/speech/pet)
 * override this with their own NEXUS_ERR_* code.
 */

export const NET_IPC_ERROR_CODES = Object.freeze({
  TIMEOUT: 'NEXUS_ERR_NET_TIMEOUT',
})

const CODE_PATTERN = /NEXUS_ERR_NET_TIMEOUT/

export function extractNetIpcErrorCode(error) {
  if (error && typeof error === 'object' && typeof error.code === 'string' && CODE_PATTERN.test(error.code)) {
    return error.code
  }
  const message = error instanceof Error ? error.message : String(error ?? '')
  const match = CODE_PATTERN.exec(message)
  return match ? match[0] : null
}
