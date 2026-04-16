import type { AgentTurnEvent, AgentTurnRequest } from './types'

export type AgentRuntime = {
  runTurn(request: AgentTurnRequest, signal?: AbortSignal): AsyncIterable<AgentTurnEvent>
}
