import type { DebugConsoleEvent } from '../../types'
import {
  DEBUG_CONSOLE_EVENTS_STORAGE_KEY,
  readJson,
  writeJsonDebounced,
} from './core.ts'

const defaultDebugConsoleEvents: DebugConsoleEvent[] = []

export function loadDebugConsoleEvents(): DebugConsoleEvent[] {
  return readJson<Array<Partial<DebugConsoleEvent>>>(
    DEBUG_CONSOLE_EVENTS_STORAGE_KEY,
    defaultDebugConsoleEvents,
  )
    .map((event): DebugConsoleEvent => {
      const source: DebugConsoleEvent['source'] = (
        event.source === 'voice'
        || event.source === 'reminder'
        || event.source === 'scheduler'
        || event.source === 'tool'
        || event.source === 'system'
      )
        ? event.source
        : 'system'

      const tone: DebugConsoleEvent['tone'] = (
        event.tone === 'success'
        || event.tone === 'warning'
        || event.tone === 'error'
      )
        ? event.tone
        : 'info'

      return {
        id: String(event.id ?? '').trim(),
        source,
        title: String(event.title ?? '').trim(),
        detail: String(event.detail ?? '').trim(),
        tone,
        createdAt: String(event.createdAt ?? '').trim(),
        relatedTaskId: String(event.relatedTaskId ?? '').trim() || undefined,
      }
    })
    .filter((event) => event.id && event.title && event.detail && event.createdAt)
    .slice(0, 60)
}

export function saveDebugConsoleEvents(events: DebugConsoleEvent[]) {
  writeJsonDebounced(DEBUG_CONSOLE_EVENTS_STORAGE_KEY, events.slice(0, 60))
}
