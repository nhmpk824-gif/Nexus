import { useCallback, useRef } from 'react'
import {
  type RhythmProfile,
  applyWeeklyDecay,
  createDefaultRhythmProfile,
  formatRhythmSummary,
  recordInteraction,
  shouldAllowProactiveSpeech,
} from '../../features/autonomy/rhythmLearner'
import { AUTONOMY_RHYTHM_STORAGE_KEY, readJson, writeJson } from '../../lib/storage'

export function useRhythmState() {
  const rhythmRef = useRef<RhythmProfile>(
    readJson<RhythmProfile>(AUTONOMY_RHYTHM_STORAGE_KEY, createDefaultRhythmProfile()),
  )

  const decayOnTick = useCallback(() => {
    rhythmRef.current = applyWeeklyDecay(rhythmRef.current)
  }, [])

  const isProactiveSpeechAllowed = useCallback(
    () => shouldAllowProactiveSpeech(rhythmRef.current),
    [],
  )

  const recordInteractionInRhythm = useCallback(() => {
    rhythmRef.current = recordInteraction(rhythmRef.current)
    writeJson(AUTONOMY_RHYTHM_STORAGE_KEY, rhythmRef.current)
  }, [])

  const getRhythmPrompt = useCallback(() => formatRhythmSummary(rhythmRef.current), [])

  return {
    rhythmRef,
    decayOnTick,
    isProactiveSpeechAllowed,
    recordInteractionInRhythm,
    getRhythmPrompt,
  }
}
