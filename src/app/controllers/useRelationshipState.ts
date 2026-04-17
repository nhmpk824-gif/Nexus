import { useCallback, useRef } from 'react'
import {
  type RelationshipState,
  applyAbsenceDecay,
  createDefaultRelationshipState,
  formatRelationshipForPrompt,
  markDailyInteraction,
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
    relationshipRef.current = markDailyInteraction(prev)
    if (relationshipRef.current !== prev) {
      writeJson(AUTONOMY_RELATIONSHIP_STORAGE_KEY, relationshipRef.current)
    }
  }, [])

  const getRelationshipPrompt = useCallback(
    () => formatRelationshipForPrompt(relationshipRef.current),
    [],
  )

  return {
    relationshipRef,
    decayOnTick,
    markInteraction,
    getRelationshipPrompt,
  }
}
