import type { ToolDefinition } from '../../tools/types'
import type { ToolExecutor } from '../../tools/ManagedToolGateway'
import type { AgentMessage } from '../types'

export type CheckpointEntry = {
  id: string
  conversationId: string
  label: string
  createdAt: number
  history: AgentMessage[]
  metadata?: Record<string, unknown>
}

export type CheckpointAction = 'save' | 'restore' | 'list' | 'delete'

export type CheckpointArgs = {
  action: CheckpointAction
  label?: string
  id?: string
  metadata?: Record<string, unknown>
}

export class CheckpointManager {
  private readonly checkpoints = new Map<string, CheckpointEntry>()

  save(
    conversationId: string,
    label: string,
    history: AgentMessage[],
    metadata?: Record<string, unknown>,
  ): CheckpointEntry {
    const id = `ckpt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const entry: CheckpointEntry = {
      id,
      conversationId,
      label,
      createdAt: Date.now(),
      history: history.map((m) => ({ ...m })),
      metadata,
    }
    this.checkpoints.set(id, entry)
    return entry
  }

  restore(id: string): CheckpointEntry | undefined {
    const entry = this.checkpoints.get(id)
    if (!entry) return undefined
    return {
      ...entry,
      history: entry.history.map((m) => ({ ...m })),
    }
  }

  list(conversationId?: string): CheckpointEntry[] {
    const all = Array.from(this.checkpoints.values())
    const filtered = conversationId ? all.filter((e) => e.conversationId === conversationId) : all
    return filtered.sort((a, b) => b.createdAt - a.createdAt)
  }

  delete(id: string): boolean {
    return this.checkpoints.delete(id)
  }

  clear(): void {
    this.checkpoints.clear()
  }
}

export const checkpointTool: ToolDefinition = {
  id: 'agent.checkpoint',
  displayName: 'Checkpoint',
  description:
    'Save, restore, list, or delete conversation checkpoints. Useful before risky multi-step operations so you can roll back if the plan fails.',
  parameterSchema: {
    type: 'object',
    required: ['action'],
    properties: {
      action: { type: 'string', enum: ['save', 'restore', 'list', 'delete'] },
      label: { type: 'string' },
      id: { type: 'string' },
      metadata: { type: 'object' },
    },
  },
  requiresApproval: false,
  source: 'builtin',
}

export function createCheckpointExecutor(
  manager: CheckpointManager,
  historyProvider: (conversationId: string) => AgentMessage[],
): ToolExecutor {
  return async (args, context) => {
    const parsed = args as CheckpointArgs
    if (!parsed?.action) {
      throw new Error('checkpoint: `action` is required')
    }
    switch (parsed.action) {
      case 'save': {
        const label = parsed.label ?? 'checkpoint'
        const history = historyProvider(context.conversationId)
        return manager.save(context.conversationId, label, history, parsed.metadata)
      }
      case 'restore': {
        if (!parsed.id) throw new Error('checkpoint restore: `id` is required')
        const restored = manager.restore(parsed.id)
        if (!restored) throw new Error(`checkpoint ${parsed.id} not found`)
        return restored
      }
      case 'list':
        return manager.list(context.conversationId)
      case 'delete': {
        if (!parsed.id) throw new Error('checkpoint delete: `id` is required')
        return { deleted: manager.delete(parsed.id) }
      }
      default:
        throw new Error(`checkpoint: unknown action ${String(parsed.action)}`)
    }
  }
}
