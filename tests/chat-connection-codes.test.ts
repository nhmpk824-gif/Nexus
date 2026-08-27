import assert from 'node:assert/strict'
import { before, test } from 'node:test'

import {
  CHAT_IPC_ERROR_CODES,
  buildChatIpcError,
  chatIpcErrorCodeFromConnectionCode,
  classifyChatTransportFailure,
  extractChatIpcErrorCode,
} from '../shared/chatErrorCodes.js'
import { summarizeChatConnectionTransportFailure } from '../electron/chatRuntime.js'
import { isFailoverEligibleError } from '../src/features/failover/runtime.ts'
import { humanizeError } from '../src/lib/humanizeError.ts'
import { ensureLocaleLoaded, setLocale } from '../src/i18n/runtime.ts'

before(async () => {
  await ensureLocaleLoaded('en-US')
  setLocale('en-US')
})

test('timeout transport errors classify as NEXUS_ERR_CHAT_TIMEOUT', () => {
  const transport = Object.assign(new Error(CHAT_IPC_ERROR_CODES.TIMEOUT), {
    code: 'request_timeout',
  })
  const ipcCode = classifyChatTransportFailure(transport)
  assert.equal(ipcCode, CHAT_IPC_ERROR_CODES.TIMEOUT)

  const thrown = buildChatIpcError(ipcCode, `chat request failed: ${transport.message}`)
  assert.equal(extractChatIpcErrorCode(thrown), CHAT_IPC_ERROR_CODES.TIMEOUT)

  const out = humanizeError(thrown, 'chat')
  assert.match(out, /(too long|faster|try)/i)
  assert.doesNotMatch(out, /Something went wrong/)
  assert.equal(isFailoverEligibleError(thrown), true)
})

test('unreachable transport errors classify as NEXUS_ERR_CHAT_UNREACHABLE', () => {
  const transport = new Error('chat request failed: ECONNREFUSED 127.0.0.1:11434')
  const ipcCode = classifyChatTransportFailure(transport)
  assert.equal(ipcCode, CHAT_IPC_ERROR_CODES.UNREACHABLE)

  const thrown = buildChatIpcError(ipcCode, transport.message)
  const out = humanizeError(thrown, 'chat')
  assert.match(out, /(reach|connect|server)/i)
  assert.doesNotMatch(out, /ECONNREFUSED/)
  assert.equal(isFailoverEligibleError(thrown), true)
})

test('test-connection timeout uses the shared TIMEOUT class and messageKey', () => {
  const transport = Object.assign(new Error(CHAT_IPC_ERROR_CODES.TIMEOUT), {
    code: 'request_timeout',
  })
  const result = summarizeChatConnectionTransportFailure({
    providerId: 'openai',
    reason: transport.message,
    baseUrl: 'https://api.openai.com',
    error: transport,
  })
  assert.equal(result.ok, false)
  assert.equal(result.ipcCode, CHAT_IPC_ERROR_CODES.TIMEOUT)
  assert.equal(result.code, 'request_timeout')
  assert.equal(result.messageKey, 'settings.chat_connection.request_timeout')
})

test('missing and header-unsafe connection codes map to the complete-path IPC class', () => {
  assert.equal(
    chatIpcErrorCodeFromConnectionCode('missing_api_key'),
    CHAT_IPC_ERROR_CODES.MISSING_API_KEY,
  )
  assert.equal(
    chatIpcErrorCodeFromConnectionCode('api_key_header_unsafe'),
    CHAT_IPC_ERROR_CODES.API_KEY_HEADER_UNSAFE,
  )
  assert.equal(
    chatIpcErrorCodeFromConnectionCode('api_key_contains_cjk'),
    CHAT_IPC_ERROR_CODES.API_KEY_HEADER_UNSAFE,
  )
  const missing = buildChatIpcError(
    CHAT_IPC_ERROR_CODES.MISSING_API_KEY,
    'settings.chat_connection.missing_api_key',
  )
  const unsafe = buildChatIpcError(
    CHAT_IPC_ERROR_CODES.API_KEY_HEADER_UNSAFE,
    'settings.chat_connection.api_key_header_unsafe',
  )
  assert.equal(isFailoverEligibleError(missing), false)
  assert.equal(isFailoverEligibleError(unsafe), false)
  assert.match(humanizeError(missing, 'chat'), /(API key|Settings)/i)
  assert.match(humanizeError(unsafe, 'chat'), /(API key|Settings)/i)
})

test('chat path does not classify leftover Chinese timeout copy as the contract', () => {
  const out = humanizeError('模型回复太慢了，看看网络和服务有没有问题？', 'chat')
  assert.doesNotMatch(out, /(too long|faster)/i)
})
