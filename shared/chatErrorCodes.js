/**
 * Canonical chat IPC error codes — single source of truth for the stable
 * error contract between the Electron main process (ipc/chatIpc.js) and the
 * Vite renderer (lib/humanizeError.ts, backgroundChatPolicy, failover
 * eligibility).
 *
 * Why codes ride inside the message: Electron's ipcMain.handle serializes a
 * thrown error to `Error: <message>` — custom properties like `error.code`
 * do NOT cross the bridge. Embedding the code token in the message keeps it
 * intact all the way to the renderer, where extractChatIpcErrorCode pulls it
 * back out. The renderer classifies by this code instead of pattern-matching
 * human-readable (formerly Chinese) copy.
 */
export const CHAT_IPC_ERROR_CODES = Object.freeze({
  UNSAFE_BASE_URL: 'NEXUS_ERR_CHAT_UNSAFE_BASE_URL',
  MISSING_API_KEY: 'NEXUS_ERR_CHAT_MISSING_API_KEY',
  API_KEY_HEADER_UNSAFE: 'NEXUS_ERR_CHAT_API_KEY_HEADER_UNSAFE',
  AUTH_FAILED: 'NEXUS_ERR_CHAT_AUTH_FAILED',
  UNREACHABLE: 'NEXUS_ERR_CHAT_UNREACHABLE',
  TIMEOUT: 'NEXUS_ERR_CHAT_TIMEOUT',
  FORBIDDEN: 'NEXUS_ERR_CHAT_FORBIDDEN',
  NOT_FOUND: 'NEXUS_ERR_CHAT_NOT_FOUND',
  RATE_LIMITED: 'NEXUS_ERR_CHAT_RATE_LIMITED',
  PROVIDER_SERVER_ERROR: 'NEXUS_ERR_CHAT_PROVIDER_SERVER_ERROR',
  PROVIDER_STATUS: 'NEXUS_ERR_CHAT_PROVIDER_STATUS',
  EMPTY_CONTENT: 'NEXUS_ERR_CHAT_EMPTY_CONTENT',
})

const CODE_PATTERN = /NEXUS_ERR_CHAT_[A-Z_]+/

/**
 * Build an Error whose message carries the stable code token (see header).
 * `error.code` is also set for same-process consumers and tests.
 */
export function buildChatIpcError(code, detail, { cause } = {}) {
  const error = new Error(detail ? `${code}: ${detail}` : code, cause ? { cause } : undefined)
  error.code = code
  return error
}

/**
 * Pull the code token back out of an error — works on either side of the IPC
 * bridge, including messages wrapped by Electron's "Error invoking remote
 * method" prefix or by failover's "candidateId: message" aggregation.
 */
export function extractChatIpcErrorCode(error) {
  if (error && typeof error === 'object' && typeof error.code === 'string' && CODE_PATTERN.test(error.code)) {
    return error.code
  }
  const message = error instanceof Error ? error.message : String(error ?? '')
  const match = CODE_PATTERN.exec(message)
  return match ? match[0] : null
}

const CONNECTION_CODE_TO_IPC = Object.freeze({
  missing_api_key: CHAT_IPC_ERROR_CODES.MISSING_API_KEY,
  api_key_header_unsafe: CHAT_IPC_ERROR_CODES.API_KEY_HEADER_UNSAFE,
  api_key_contains_cjk: CHAT_IPC_ERROR_CODES.API_KEY_HEADER_UNSAFE,
  api_key_contains_whitespace: CHAT_IPC_ERROR_CODES.API_KEY_HEADER_UNSAFE,
  request_timeout: CHAT_IPC_ERROR_CODES.TIMEOUT,
  provider_unreachable: CHAT_IPC_ERROR_CODES.UNREACHABLE,
})

/**
 * Map renderer/main short connection codes onto the IPC failure class.
 * CJK/whitespace keys share API_KEY_HEADER_UNSAFE with other header-unsafe keys.
 */
export function chatIpcErrorCodeFromConnectionCode(code) {
  if (typeof code !== 'string' || !code) return null
  if (CODE_PATTERN.test(code)) return code
  return CONNECTION_CODE_TO_IPC[code] ?? null
}

/**
 * Classify a transport-level chat failure as TIMEOUT vs UNREACHABLE.
 * net.js tags wall-clock aborts with `request_timeout`; chat IPC passes
 * CHAT_IPC_ERROR_CODES.TIMEOUT as the timeoutMessage so the token is in
 * the Error even before the handler wraps it.
 */
export function classifyChatTransportFailure(error) {
  const code = error && typeof error === 'object' ? error.code : undefined
  const extracted = extractChatIpcErrorCode(error)
  if (
    code === CHAT_IPC_ERROR_CODES.TIMEOUT
    || extracted === CHAT_IPC_ERROR_CODES.TIMEOUT
    || code === 'request_timeout'
  ) {
    return CHAT_IPC_ERROR_CODES.TIMEOUT
  }
  return CHAT_IPC_ERROR_CODES.UNREACHABLE
}
