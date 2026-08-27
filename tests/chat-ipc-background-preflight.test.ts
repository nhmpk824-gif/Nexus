import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

import { getChatConnectionTestPreflightFailure } from '../electron/chatRuntime.js'
import { CHAT_IPC_ERROR_CODES } from '../shared/chatErrorCodes.js'

const ROOT = join(import.meta.dirname, '..')
const chatIpc = readFileSync(join(ROOT, 'electron/ipc/chatIpc.js'), 'utf8')
const completeHandler = chatIpc.slice(
  chatIpc.indexOf("ipcMain.handle('chat:complete'"),
  chatIpc.indexOf("ipcMain.handle('chat:complete-stream'"),
)

test('missing-key preflight is a safe local failure', () => {
  const failure = getChatConnectionTestPreflightFailure({
    providerId: 'minimax',
    apiKey: '',
  })
  assert.equal(failure?.ok, false)
  assert.equal(failure?.code, 'missing_api_key')
  assert.equal(failure?.ipcCode, CHAT_IPC_ERROR_CODES.MISSING_API_KEY)
  assert.equal(failure?.messageKey, 'settings.chat_connection.missing_api_key')
  // No human-readable fallback copy leaves the main process anymore.
  assert.equal(failure?.message, failure?.messageKey)
})

test('header-unsafe key preflight shares the complete-path IPC class', () => {
  const failure = getChatConnectionTestPreflightFailure({
    providerId: 'openai',
    apiKey: 'sk-test 模型说明',
  })
  assert.equal(failure?.ok, false)
  assert.equal(failure?.ipcCode, CHAT_IPC_ERROR_CODES.API_KEY_HEADER_UNSAFE)
  assert.equal(failure?.messageKey, 'settings.chat_connection.api_key_header_unsafe')
})

test('chat:complete gates before request construction and network', () => {
  const preflight = completeHandler.indexOf('getChatConnectionTestPreflightFailure')
  const build = completeHandler.indexOf('buildChatRequest')
  const network = completeHandler.indexOf('performNetworkRequestWithRetry')
  assert.ok(preflight >= 0)
  assert.ok(build > preflight)
  assert.ok(network > build)
  assert.match(
    completeHandler.slice(preflight, build),
    /console\.warn\('\[chat:complete\] preflight blocked', \{[\s\S]*traceId[\s\S]*providerId[\s\S]*model[\s\S]*code/s,
  )
  const safeLog = completeHandler.slice(
    completeHandler.indexOf("console.warn('[chat:complete] preflight blocked'"),
    build,
  )
  assert.doesNotMatch(
    safeLog,
    /apiKey|messages|prompt|baseUrl/s,
  )
  assert.match(completeHandler, /buildChatIpcError\([\s\S]*CHAT_IPC_ERROR_CODES\.AUTH_FAILED[\s\S]*error\.status = 401/)
})

test('chat:complete-stream gates missing/unsafe keys before the network', () => {
  const streamHandler = chatIpc.slice(
    chatIpc.indexOf("ipcMain.handle('chat:complete-stream'"),
    chatIpc.indexOf("ipcMain.handle('chat:abort-stream'"),
  )
  const preflight = streamHandler.indexOf('getChatConnectionTestPreflightFailure')
  const build = streamHandler.indexOf('buildChatRequest')
  const network = streamHandler.indexOf('performNetworkRequestWithRetry')
  assert.ok(preflight >= 0)
  assert.ok(build > preflight)
  assert.ok(network > build)
})

test('complete stream and test-connection pass the shared timeout code as timeoutMessage', () => {
  assert.match(
    chatIpc,
    /ipcMain\.handle\('chat:complete'[\s\S]*timeoutMessage:\s*CHAT_IPC_ERROR_CODES\.TIMEOUT/,
  )
  assert.match(
    chatIpc,
    /ipcMain\.handle\('chat:complete-stream'[\s\S]*timeoutMessage:\s*CHAT_IPC_ERROR_CODES\.TIMEOUT/,
  )
  assert.match(
    chatIpc,
    /timeoutMessage:\s*CHAT_IPC_ERROR_CODES\.TIMEOUT/,
  )
})

test('chat:list-models uses the shared timeout class and passes the transport error', () => {
  const listHandler = chatIpc.slice(
    chatIpc.indexOf("ipcMain.handle('chat:list-models'"),
    chatIpc.indexOf("ipcMain.handle('service:test-connection'"),
  )
  assert.match(listHandler, /timeoutMessage:\s*CHAT_IPC_ERROR_CODES\.TIMEOUT/)
  assert.match(listHandler, /summarizeChatConnectionTransportFailure\(\{[\s\S]*error,/)
})
