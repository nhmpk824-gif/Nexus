import type { VoicePipelineState, VoiceTraceEntry } from '../../types'
import {
  readJson,
  VOICE_PIPELINE_STORAGE_KEY,
  VOICE_TRACE_STORAGE_KEY,
  writeJsonDebounced,
} from './core.ts'

const defaultVoicePipelineState: VoicePipelineState = {
  step: 'idle',
  transcript: '',
  detail: '等待语音输入',
  updatedAt: '',
}

const defaultVoiceTrace: VoiceTraceEntry[] = []

export function loadVoicePipelineState(): VoicePipelineState {
  return {
    ...defaultVoicePipelineState,
    ...readJson<Partial<VoicePipelineState>>(VOICE_PIPELINE_STORAGE_KEY, {}),
  }
}

export function saveVoicePipelineState(state: VoicePipelineState) {
  writeJsonDebounced(VOICE_PIPELINE_STORAGE_KEY, state, 300)
}

export function loadVoiceTrace(): VoiceTraceEntry[] {
  return readJson<VoiceTraceEntry[]>(VOICE_TRACE_STORAGE_KEY, defaultVoiceTrace).slice(0, 8)
}

export function saveVoiceTrace(trace: VoiceTraceEntry[]) {
  writeJsonDebounced(VOICE_TRACE_STORAGE_KEY, trace.slice(0, 8), 300)
}
