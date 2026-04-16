import type { ToolDefinition } from '../../tools/types'
import type { ToolExecutor } from '../../tools/ManagedToolGateway'
import type { ModelTier } from '../../routing/types'

export type DelegateArgs = {
  task: string
  tier?: ModelTier
  context?: string
  maxOutputTokens?: number
}

export type DelegateHandler = (args: DelegateArgs) => Promise<{
  output: string
  tier: ModelTier
  modelId?: string
  durationMs: number
}>

export const delegateTool: ToolDefinition = {
  id: 'agent.delegate',
  displayName: 'Delegate',
  description:
    'Hand off a focused subtask to another model (typically a cheaper or stronger tier) and return its answer. Use when the current tier is overqualified or underqualified for a subtask.',
  parameterSchema: {
    type: 'object',
    required: ['task'],
    properties: {
      task: { type: 'string', description: 'The subtask to delegate' },
      tier: {
        type: 'string',
        enum: ['cheap', 'standard', 'heavy'],
        description: 'Target model tier',
      },
      context: { type: 'string', description: 'Optional extra context to pass along' },
      maxOutputTokens: { type: 'number' },
    },
  },
  requiresApproval: false,
  source: 'builtin',
}

export function createDelegateExecutor(handler: DelegateHandler): ToolExecutor {
  return async (args) => {
    const parsed = args as DelegateArgs
    if (!parsed?.task || typeof parsed.task !== 'string') {
      throw new Error('delegate: `task` is required')
    }
    return handler(parsed)
  }
}
