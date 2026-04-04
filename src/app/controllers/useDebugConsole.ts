import { useCallback, useState } from 'react'
import {
  createId,
  loadDebugConsoleEvents,
  saveDebugConsoleEvents,
} from '../../lib'
import type { DebugConsoleEvent, DebugConsoleEventDraft } from '../../types'

export function useDebugConsole() {
  const [debugConsoleEvents, setDebugConsoleEvents] = useState<DebugConsoleEvent[]>(
    () => loadDebugConsoleEvents(),
  )

  const appendDebugConsoleEvent = useCallback((draft: DebugConsoleEventDraft) => {
    const title = draft.title.trim()
    const detail = draft.detail.trim()
    if (!title || !detail) {
      return
    }

    setDebugConsoleEvents((current) => {
      const nextEvent: DebugConsoleEvent = {
        id: createId('debug-event'),
        source: draft.source,
        title,
        detail,
        tone: draft.tone ?? 'info',
        createdAt: draft.createdAt ?? new Date().toISOString(),
        relatedTaskId: draft.relatedTaskId?.trim() || undefined,
      }
      const nextEvents = [nextEvent, ...current].slice(0, 60)
      saveDebugConsoleEvents(nextEvents)
      return nextEvents
    })
  }, [])

  const clearDebugConsoleEvents = useCallback(() => {
    setDebugConsoleEvents([])
    saveDebugConsoleEvents([])
  }, [])

  return {
    debugConsoleEvents,
    setDebugConsoleEvents,
    appendDebugConsoleEvent,
    clearDebugConsoleEvents,
  }
}
