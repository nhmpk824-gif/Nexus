import type { ToolDefinition } from '../../tools/types'
import type { ToolExecutor } from '../../tools/ManagedToolGateway'

export type ClarifyArgs = {
  question: string
  options?: string[]
  reason?: string
}

export type ClarifyResult = {
  question: string
  options?: string[]
  reason?: string
  askedAt: number
}

export const clarifyTool: ToolDefinition = {
  id: 'agent.clarify',
  displayName: 'Clarify',
  description:
    'Ask the user a single clarifying question when the request is ambiguous. Use sparingly — only when you cannot proceed without the answer.',
  parameterSchema: {
    type: 'object',
    required: ['question'],
    properties: {
      question: { type: 'string', description: 'The clarifying question to ask the user' },
      options: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional short-form options for the user to choose from',
      },
      reason: { type: 'string', description: 'Why the clarification is needed' },
    },
  },
  requiresApproval: false,
  source: 'builtin',
}

export const clarifyExecutor: ToolExecutor = async (args) => {
  const parsed = args as ClarifyArgs
  if (!parsed?.question || typeof parsed.question !== 'string') {
    throw new Error('clarify: `question` is required')
  }
  const result: ClarifyResult = {
    question: parsed.question,
    options: parsed.options,
    reason: parsed.reason,
    askedAt: Date.now(),
  }
  return result
}
