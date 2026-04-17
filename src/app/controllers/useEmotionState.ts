import { useCallback, useRef } from 'react'
import {
  type EmotionSignal,
  type EmotionState,
  applyEmotionSignal as applySignal,
  createDefaultEmotionState,
  decayEmotion,
  emotionToPetMood,
  formatEmotionForPrompt,
} from '../../features/autonomy/emotionModel'

export function useEmotionState() {
  const emotionStateRef = useRef<EmotionState>(createDefaultEmotionState())
  const lastTimeSignalHourRef = useRef<number>(-1)

  const decayOnTick = useCallback((idleSeconds: number) => {
    emotionStateRef.current = decayEmotion(emotionStateRef.current)

    const hour = new Date().getHours()
    if (hour !== lastTimeSignalHourRef.current) {
      lastTimeSignalHourRef.current = hour
      if (hour >= 6 && hour <= 9) {
        emotionStateRef.current = applySignal(emotionStateRef.current, 'morning')
      } else if (hour >= 23 || hour < 4) {
        emotionStateRef.current = applySignal(emotionStateRef.current, 'late_night')
      }
    }

    if (idleSeconds > 600) {
      emotionStateRef.current = applySignal(emotionStateRef.current, 'long_idle')
    }
  }, [])

  const applyEmotionSignal = useCallback((signal: EmotionSignal) => {
    emotionStateRef.current = applySignal(emotionStateRef.current, signal)
  }, [])

  const getEmotionMood = useCallback(() => emotionToPetMood(emotionStateRef.current), [])
  const getEmotionPrompt = useCallback(() => formatEmotionForPrompt(emotionStateRef.current), [])

  return {
    emotionStateRef,
    decayOnTick,
    applyEmotionSignal,
    getEmotionMood,
    getEmotionPrompt,
  }
}
