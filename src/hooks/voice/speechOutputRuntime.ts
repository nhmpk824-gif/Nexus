import type { VoiceBusEvent } from '../../features/voice/busEvents'
import type { StreamAudioPlayer } from '../../features/voice/streamAudioPlayer'
import { prepareTextForTts } from '../../features/voice/text'
import { shorten } from '../../lib/common'
import { executeWithFailover, type FailoverCandidate } from '../../features/failover/orchestrator.ts'
import type { AppSettings, VoiceTraceEntry } from '../../types'
import { createStreamingSpeechOutputController } from './streamingSpeechOutput'
import type { StreamingSpeechOutputController } from './types'

type SpeechOutputCallbacks = {
  onStart?: () => void
  onEnd?: () => void
  onError?: (message: string) => void
}

type TelemetryHooks = {
  busEmit?: (event: VoiceBusEvent) => void
  speechGeneration?: number
}

export type SpeechOutputPlaybackRuntime = {
  getStreamAudioPlayer: () => StreamAudioPlayer
  setActiveController?: (controller: StreamingSpeechOutputController | null) => void
  resetPlayer?: () => void
  stopSpeechTracking: () => void
}

export type StartSpeechOutputRuntimeOptions = {
  text: string
  speechSettings: AppSettings
  runtime: SpeechOutputPlaybackRuntime
  callbacks?: SpeechOutputCallbacks
  buildSpeechOutputFailoverCandidates: (settings: AppSettings) => AppSettings[]
  applySpeechOutputProviderFallback: (providerId: string, statusText?: string) => AppSettings
  appendVoiceTrace: (
    title: string,
    detail: string,
    tone?: VoiceTraceEntry['tone'],
  ) => void
  telemetry?: TelemetryHooks
}

export async function playSpeechOutputWithSettingsRuntime(
  text: string,
  speechSettings: AppSettings,
  runtime: SpeechOutputPlaybackRuntime,
  callbacks?: SpeechOutputCallbacks,
  telemetry?: TelemetryHooks,
) {
  const content = prepareTextForTts(text)

  if (!speechSettings.speechOutputEnabled) {
    throw new Error('请先开启语音播报。')
  }

  if (!content) {
    throw new Error('没有可播报的文本内容。')
  }

  if (!window.desktopPet?.ttsStreamStart) {
    throw new Error('当前环境未连接桌面客户端，无法使用内置语音播报。')
  }

  // Drive the streaming TTS controller with the full text so all segments
  // share a single TTS session. The electron side pins the resolved voice
  // and cluster after the first chunk, which prevents timbre drift across
  // segments on long sentences (Volcengine etc. may otherwise re-walk the
  // fallback chain per segment and land on different voice backends).
  const controller = createStreamingSpeechOutputController(
    speechSettings,
    {
      getPlayer: runtime.getStreamAudioPlayer,
      setActiveController: runtime.setActiveController,
      resetPlayer: runtime.resetPlayer,
    },
    {
      ...callbacks,
      busEmit: telemetry?.busEmit,
      speechGeneration: telemetry?.speechGeneration,
    },
  )

  controller.pushDelta(content)
  controller.finish()
  await controller.waitForCompletion()
}

export async function startSpeechOutputRuntime(
  options: StartSpeechOutputRuntimeOptions,
) {
  const candidateSettingsList = options.buildSpeechOutputFailoverCandidates(options.speechSettings)

  const candidates: FailoverCandidate<AppSettings>[] = candidateSettingsList.map((s) => ({
    id: s.speechOutputProviderId,
    identity: [
      s.speechOutputProviderId,
      s.speechOutputApiBaseUrl,
      s.speechOutputModel,
      s.speechOutputVoice,
    ].join('|'),
    payload: s,
  }))

  const result = await executeWithFailover<AppSettings, void>({
    domain: 'speech-output',
    candidates,
    failoverEnabled: options.speechSettings.speechOutputFailoverEnabled,
    execute: async (candidate) => {
      await playSpeechOutputWithSettingsRuntime(
        options.text,
        candidate.payload,
        options.runtime,
        options.callbacks,
        options.telemetry,
      )
    },
    onEvent: (event) => {
      if (event.type === 'failure' && event.isPrimary) {
        options.appendVoiceTrace(
          'Speech output primary chain error',
          `${options.speechSettings.speechOutputProviderId}: ${shorten(event.error, 80)}`,
          'error',
        )
      }
    },
  })

  if (result.usedFallback) {
    // Only log the fallback — do NOT mutate settingsRef.  Previous behavior
    // permanently switched the runtime settings to the fallback provider,
    // meaning all subsequent responses would use a different provider/voice
    // even if the primary provider recovered on the very next request.
    options.appendVoiceTrace(
      'Speech output fallback (this turn only)',
      `${options.speechSettings.speechOutputProviderId} -> ${result.candidateId} (this turn only, settings unchanged)`,
      'success',
    )
  }
}
