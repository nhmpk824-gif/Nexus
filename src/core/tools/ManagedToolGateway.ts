import type { ToolCall, ToolContext, ToolDefinition, ToolId, ToolResult } from './types'

export type ToolExecutor = (args: unknown, context: ToolContext) => Promise<unknown>

export type ManagedToolGateway = {
  register(tool: ToolDefinition, executor: ToolExecutor): void
  unregister(id: ToolId): void
  list(): ToolDefinition[]
  execute(call: ToolCall, context: ToolContext): Promise<ToolResult>
}
