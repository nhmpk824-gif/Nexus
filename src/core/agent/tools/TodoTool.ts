import type { CoreTime } from '../../time.ts'
import { systemTime } from '../../time.ts'

export type TodoStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled'

export type TodoItem = {
  id: string
  conversationId: string
  text: string
  status: TodoStatus
  createdAt: number
  updatedAt: number
}

function cloneItem(item: TodoItem): TodoItem {
  return { ...item }
}

/**
 * Per-conversation todo list used by `/todo` slash commands.
 * Returns clones so slash-command formatting cannot mutate store state.
 */
export class TodoStore {
  private readonly items = new Map<string, TodoItem>()
  private readonly time: CoreTime

  constructor(options?: { time?: CoreTime }) {
    this.time = options?.time ?? systemTime()
  }

  add(conversationId: string, text: string): TodoItem {
    const now = this.time.now()
    const item: TodoItem = {
      id: this.time.id('todo-'),
      conversationId,
      text,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    }
    this.items.set(item.id, item)
    return cloneItem(item)
  }

  update(id: string, patch: { text?: string; status?: TodoStatus }): TodoItem | undefined {
    const item = this.items.get(id)
    if (!item) return undefined
    if (patch.text !== undefined) item.text = patch.text
    if (patch.status !== undefined) item.status = patch.status
    item.updatedAt = this.time.now()
    return cloneItem(item)
  }

  list(conversationId: string): TodoItem[] {
    return Array.from(this.items.values())
      .filter((item) => item.conversationId === conversationId)
      .sort((a, b) => a.createdAt - b.createdAt)
      .map(cloneItem)
  }

  remove(id: string): boolean {
    return this.items.delete(id)
  }

  clear(conversationId: string): number {
    let removed = 0
    for (const [id, item] of this.items.entries()) {
      if (item.conversationId === conversationId) {
        this.items.delete(id)
        removed += 1
      }
    }
    return removed
  }
}
