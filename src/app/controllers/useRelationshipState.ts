import { useCallback, useRef } from 'react'
import {
  type RelationshipState,
  applyAbsenceDecay,
  createDefaultRelationshipState,
  formatAbsenceContext,
  formatRelationshipForPrompt,
  markDailyInteraction,
  recordLevelMilestone,
} from '../../features/autonomy/relationshipTracker'
import { AUTONOMY_RELATIONSHIP_STORAGE_KEY, readJson, writeJson } from '../../lib/storage'

export function useRelationshipState() {
  const relationshipRef = useRef<RelationshipState>(
    readJson<RelationshipState>(AUTONOMY_RELATIONSHIP_STORAGE_KEY, createDefaultRelationshipState()),
  )
  const lastAbsenceCheckDateRef = useRef<string>('')

  const decayOnTick = useCallback(() => {
    const today = new Date().toISOString().slice(0, 10)
    if (today === lastAbsenceCheckDateRef.current) return
    lastAbsenceCheckDateRef.current = today
    relationshipRef.current = applyAbsenceDecay(relationshipRef.current)
    writeJson(AUTONOMY_RELATIONSHIP_STORAGE_KEY, relationshipRef.current)
  }, [])

  const markInteraction = useCallback(() => {
    const prev = relationshipRef.current
    let next = markDailyInteraction(prev)
    if (next !== prev) {
      next = recordLevelMilestone(next)
      relationshipRef.current = next
      writeJson(AUTONOMY_RELATIONSHIP_STORAGE_KEY, next)
    }
  }, [])

  const getRelationshipPrompt = useCallback(() => {
    const state = relationshipRef.current
    const base = formatRelationshipForPrompt(state)
    const absence = formatAbsenceContext(state)
    return absence ? `${base}\n${absence}` : base
  }, [])

  const updateSessionContext = useCallback((emotion: { energy: number; warmth: number; curiosity: number; concern: number }, topic: string) => {
    const prev = relationshipRef.current
    const trimmedTopic = topic.replace(/\s+/g, ' ').trim().slice(0, 80)
    relationshipRef.current = { ...prev, lastSessionEmotion: emotion, lastSessionTopic: trimmedTopic || prev.lastSessionTopic }
    writeJson(AUTONOMY_RELATIONSHIP_STORAGE_KEY, relationshipRef.current)
  }, [])

  return {
    relationshipRef,
    decayOnTick,
    markInteraction,
    getRelationshipPrompt,
    updateSessionContext,
  }
}
