// Factory that produces the audio diagnostic / smoke-test entry points used
// by the settings UI.  These wrap the lower-level diagnostics runtime helpers
// with the bound bindings + lifecycle from the runtime bag.

import {
  probeSpeechOutputPlaybackStartRuntime,
  runAudioSmokeTestRuntime,
  testSpeechInputConnectionRuntime,
  testSpeechOutputReadinessRuntime,
} from './diagnostics'
import type { AppSettings } from '../../types'
import { expectHolderValue, type VoiceRuntimeBag, type VoiceTestEntries } from './voiceRuntimeBag'

export function createVoiceTestEntries(bag: VoiceRuntimeBag): VoiceTestEntries {
  const { bindingsHolder } = bag

  const bindings = expectHolderValue(
    bindingsHolder,
    'createVoiceTestEntries: bindings must be built first',
  )

  async function testSpeechInputConnection(draftSettings: AppSettings) {
    return testSpeechInputConnectionRuntime({
      draftSettings,
      testSpeechInputReadiness: bindings.testSpeechInputReadiness,
    })
  }

  async function probeSpeechOutputPlaybackStart(
    draftSettings: AppSettings,
    text: string,
  ) {
    await probeSpeechOutputPlaybackStartRuntime({
      draftSettings,
      text,
      stopActiveSpeechOutput: bindings.stopActiveSpeechOutput,
      startSpeechOutput: bindings.startSpeechOutput,
    })
  }

  async function testSpeechOutputReadiness(
    draftSettings: AppSettings,
    options?: {
      playSample?: boolean
      sampleText?: string
    },
  ) {
    return testSpeechOutputReadinessRuntime({
      draftSettings,
      options,
      probeSpeechOutputPlaybackStart,
    })
  }

  async function runAudioSmokeTest(draftSettings: AppSettings) {
    return runAudioSmokeTestRuntime({
      draftSettings,
      testSpeechInputConnection,
      testSpeechOutputReadiness,
    })
  }

  return {
    testSpeechInputConnection,
    probeSpeechOutputPlaybackStart,
    testSpeechOutputReadiness,
    runAudioSmokeTest,
  }
}
