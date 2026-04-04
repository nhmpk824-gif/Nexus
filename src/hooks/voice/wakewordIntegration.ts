import type { MutableRefObject, RefObject } from 'react'
import {
  createWakewordRuntime,
  type WakewordRuntimeController,
} from '../../features/hearing/wakewordRuntime.ts'
import { clamp } from '../../lib/common'
import { speakText as speakBrowserText } from '../../lib/voice'
import type {
  AppSettings,
  VoicePipelineState,
  VoiceState,
  VoiceTraceEntry,
  WakewordRuntimeState,
} from '../../types'
import type { VoiceConversationOptions } from './types'

type ShowPetStatus = (
  message: string,
  duration?: number,
  dedupeWindowMs?: number,
) => void

export type AcknowledgeWakewordAndStartListeningRuntimeOptions = {
  keyword: string
  wakewordAcknowledgingRef: MutableRefObject<boolean>
  currentSettings: AppSettings
  showPetStatus: ShowPetStatus
  updateVoicePipeline: (
    step: VoicePipelineState['step'],
    detail: string,
    transcript?: string,
  ) => void
  startVoiceConversation: (options?: VoiceConversationOptions) => void
}

export type HandleWakewordRuntimeStateChangeRuntimeOptions = {
  nextState: WakewordRuntimeState
  previousState: WakewordRuntimeState
  setWakewordState: (state: WakewordRuntimeState) => void
  appendVoiceTrace: (
    title: string,
    detail: string,
    tone?: VoiceTraceEntry['tone'],
  ) => void
  showPetStatus: ShowPetStatus
}

export type HandleWakewordKeywordDetectedRuntimeOptions = {
  keyword: string
  voiceStateRef: MutableRefObject<VoiceState>
  busyRef: RefObject<boolean>
  wakewordAcknowledgingRef: MutableRefObject<boolean>
  appendVoiceTrace: (
    title: string,
    detail: string,
    tone?: VoiceTraceEntry['tone'],
  ) => void
  acknowledgeWakewordAndStartListening: (keyword: string) => void
}

export type CreateWakewordRuntimeBindingOptions = {
  wakewordRuntimeRef: MutableRefObject<WakewordRuntimeController | null>
  wakewordRuntimeStateChangeRef: MutableRefObject<(
    nextState: WakewordRuntimeState,
    previousState: WakewordRuntimeState,
  ) => void>
  wakewordKeywordDetectedRef: MutableRefObject<(keyword: string) => void>
  setWakewordState: (state: WakewordRuntimeState) => void
}

const WAKEWORD_ACK_PHRASES = [
  { speech: '我在', status: '我在。' },
  { speech: '在的', status: '在的～' },
  { speech: '我在听', status: '我在听。' },
  { speech: '你说', status: '你说～' },
  { speech: '嗯？', status: '嗯？' },
  { speech: '来了', status: '来了来了～' },
  { speech: '我在呢', status: '我在呢。' },
  { speech: '诶', status: '诶？什么事～' },
  { speech: '好的，说吧', status: '好的，说吧。' },
  { speech: '随时待命', status: '随时待命。' },
]

function pickAckPhrase() {
  return WAKEWORD_ACK_PHRASES[Math.floor(Math.random() * WAKEWORD_ACK_PHRASES.length)]
}

export function acknowledgeWakewordAndStartListeningRuntime(
  options: AcknowledgeWakewordAndStartListeningRuntimeOptions,
) {
  if (options.wakewordAcknowledgingRef.current) {
    return
  }

  options.wakewordAcknowledgingRef.current = true
  let settled = false
  let fallbackTimerId: number | null = null

  const finish = () => {
    if (settled) {
      return
    }

    settled = true
    options.wakewordAcknowledgingRef.current = false
    if (fallbackTimerId !== null) {
      window.clearTimeout(fallbackTimerId)
    }
    options.startVoiceConversation({ wakewordTriggered: true })
  }

  const ack = pickAckPhrase()
  options.showPetStatus(ack.status, 1_600, 1_000)
  options.updateVoicePipeline('recognized', `检测到唤醒词”${options.keyword}”，正在进入收音`)

  const utterance = speakBrowserText({
    text: ack.speech,
    lang: options.currentSettings.speechSynthesisLang || 'zh-CN',
    rate: clamp(
      Number.isFinite(options.currentSettings.speechRate)
        ? options.currentSettings.speechRate * 1.08
        : 1.08,
      0.9,
      1.6,
    ),
    pitch: 1,
    volume: clamp(
      Number.isFinite(options.currentSettings.speechVolume)
        ? Math.max(options.currentSettings.speechVolume, 0.72)
        : 0.82,
      0.4,
      1,
    ),
    onEnd: finish,
    onError: () => finish(),
  })

  if (!utterance) {
    finish()
    return
  }

  fallbackTimerId = window.setTimeout(() => {
    finish()
  }, 1_200)
}

export function handleWakewordRuntimeStateChangeRuntime(
  options: HandleWakewordRuntimeStateChangeRuntimeOptions,
) {
  options.setWakewordState(options.nextState)

  const phaseChanged = options.nextState.phase !== options.previousState.phase
  const wakeWordChanged = options.nextState.wakeWord !== options.previousState.wakeWord
  const reasonChanged = options.nextState.reason !== options.previousState.reason
  const errorChanged = options.nextState.error !== options.previousState.error

  if (
    (phaseChanged || wakeWordChanged)
    && options.nextState.phase === 'listening'
    && options.nextState.wakeWord
  ) {
    options.appendVoiceTrace('唤醒词监听已启动', `正在等待“${options.nextState.wakeWord}”`)
    return
  }

  if (
    options.nextState.phase === 'unavailable'
    && options.nextState.reason
    && (phaseChanged || wakeWordChanged || reasonChanged)
  ) {
    console.warn('[Voice] Wake word unavailable:', options.nextState.reason)
    options.appendVoiceTrace(
      '唤醒词不可用',
      `唤醒词“${options.nextState.wakeWord || '未设置'}”不可用：${options.nextState.reason}`,
      'error',
    )
    options.showPetStatus(`唤醒词不可用：${options.nextState.reason}`, 4_200, 4_500)
    return
  }

  if (
    options.nextState.phase === 'error'
    && options.nextState.error
    && (phaseChanged || errorChanged)
  ) {
    console.warn('[Voice] Wake word listener error:', options.nextState.error)
    options.appendVoiceTrace('唤醒词监听异常', options.nextState.error, 'error')
    options.showPetStatus(`唤醒词监听异常：${options.nextState.error}`, 4_200, 4_500)
  }
}

export function handleWakewordKeywordDetectedRuntime(
  options: HandleWakewordKeywordDetectedRuntimeOptions,
) {
  if (
    options.voiceStateRef.current !== 'idle'
    || options.busyRef.current
    || options.wakewordAcknowledgingRef.current
  ) {
    return
  }

  console.info('[Voice] Wake word detected:', options.keyword)
  options.appendVoiceTrace('唤醒词已触发', `检测到“${options.keyword}”，开始打开语音会话`)
  options.acknowledgeWakewordAndStartListening(options.keyword)
}

export function createWakewordRuntimeBinding(
  options: CreateWakewordRuntimeBindingOptions,
) {
  const runtime = createWakewordRuntime({
    onStateChange: (nextState, previousState) => {
      options.wakewordRuntimeStateChangeRef.current(nextState, previousState)
    },
    onKeywordDetected: (keyword) => {
      options.wakewordKeywordDetectedRef.current(keyword)
    },
  })

  options.wakewordRuntimeRef.current = runtime
  options.setWakewordState(runtime.getState())

  return () => {
    runtime.destroy()
    options.wakewordRuntimeRef.current = null
  }
}
