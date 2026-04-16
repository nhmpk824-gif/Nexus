import {
  AGENT_TRACE_STORAGE_KEY,
  createId,
  readJson,
  writeJsonDebounced,
} from '../../lib/storage/core'
import type { AgentStep, AgentStopReason } from './agentLoop'

export type AgentTrace = {
  id: string
  goal: string
  startedAt: number
  endedAt?: number
  status?: AgentStopReason
  steps: AgentStep[]
  finalResponse?: string
  planId?: string
}

export type AgentTraceListener = (traces: AgentTrace[]) => void

const MAX_TRACES = 20

class AgentTraceStoreImpl {
  private traces: AgentTrace[] = []
  private listeners = new Set<AgentTraceListener>()
  private hydrated = false

  hydrate(): void {
    if (this.hydrated) return
    this.traces = readJson<AgentTrace[]>(AGENT_TRACE_STORAGE_KEY, [])
    this.hydrated = true
  }

  list(): AgentTrace[] {
    this.hydrate()
    return [...this.traces]
  }

  get(id: string): AgentTrace | undefined {
    this.hydrate()
    return this.traces.find((t) => t.id === id)
  }

  start(goal: string): AgentTrace {
    this.hydrate()
    const trace: AgentTrace = {
      id: createId('trace'),
      goal,
      startedAt: Date.now(),
      steps: [],
    }
    this.traces.unshift(trace)
    while (this.traces.length > MAX_TRACES) this.traces.pop()
    this.persist()
    return trace
  }

  appendStep(traceId: string, step: AgentStep): void {
    this.hydrate()
    const idx = this.traces.findIndex((t) => t.id === traceId)
    if (idx < 0) return
    const next: AgentTrace = {
      ...this.traces[idx],
      steps: [...this.traces[idx].steps, step],
    }
    this.traces[idx] = next
    this.persist()
  }

  finish(traceId: string, info: {
    status: AgentStopReason
    finalResponse?: string
    planId?: string
  }): void {
    this.hydrate()
    const idx = this.traces.findIndex((t) => t.id === traceId)
    if (idx < 0) return
    const next: AgentTrace = {
      ...this.traces[idx],
      endedAt: Date.now(),
      status: info.status,
      finalResponse: info.finalResponse,
      planId: info.planId,
    }
    this.traces[idx] = next
    this.persist()
  }

  remove(traceId: string): void {
    this.hydrate()
    const before = this.traces.length
    this.traces = this.traces.filter((t) => t.id !== traceId)
    if (this.traces.length !== before) this.persist()
  }

  clear(): void {
    this.traces = []
    this.hydrated = true
    this.persist()
  }

  subscribe(listener: AgentTraceListener): () => void {
    this.hydrate()
    this.listeners.add(listener)
    listener(this.list())
    return () => {
      this.listeners.delete(listener)
    }
  }

  private persist(): void {
    writeJsonDebounced(AGENT_TRACE_STORAGE_KEY, this.traces)
    const snapshot = this.list()
    for (const listener of this.listeners) {
      try {
        listener(snapshot)
      } catch {
        // listener errors must not break the store
      }
    }
  }
}

export const agentTraceStore = new AgentTraceStoreImpl()
