import type { CoreTime } from '../../time.ts'
import { systemTime } from '../../time.ts'

export type MemoryScope = 'global' | 'conversation' | 'user'

export type MemoryEntry = {
  id: string
  scope: MemoryScope
  ownerId: string
  key: string
  value: string
  tags?: string[]
  createdAt: number
  updatedAt: number
}

type MemoryBackend = {
  write(entry: Omit<MemoryEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<MemoryEntry>
  read(scope: MemoryScope, ownerId: string, key: string): Promise<MemoryEntry | undefined>
  search(query: string, options?: {
    scope?: MemoryScope
    ownerId?: string
    limit?: number
  }): Promise<MemoryEntry[]>
  delete(scope: MemoryScope, ownerId: string, key: string): Promise<boolean>
  list(scope: MemoryScope, ownerId: string): Promise<MemoryEntry[]>
}

function cloneEntry(entry: MemoryEntry): MemoryEntry {
  return {
    ...entry,
    ...(entry.tags ? { tags: [...entry.tags] } : {}),
  }
}

/**
 * Process-local note store used by `/note` slash commands.
 * Not the long-term memory feature; this is the core-runtime scratch pad.
 */
export class InMemoryMemoryBackend implements MemoryBackend {
  private readonly entries = new Map<string, MemoryEntry>()
  private readonly time: CoreTime

  constructor(options?: { time?: CoreTime }) {
    this.time = options?.time ?? systemTime()
  }

  async write(
    entry: Omit<MemoryEntry, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<MemoryEntry> {
    const now = this.time.now()
    const id = composeKey(entry.scope, entry.ownerId, entry.key)
    const existing = this.entries.get(id)
    const stored: MemoryEntry = existing
      ? { ...existing, value: entry.value, tags: entry.tags ? [...entry.tags] : undefined, updatedAt: now }
      : {
          id,
          scope: entry.scope,
          ownerId: entry.ownerId,
          key: entry.key,
          value: entry.value,
          tags: entry.tags ? [...entry.tags] : undefined,
          createdAt: now,
          updatedAt: now,
        }
    this.entries.set(id, stored)
    return cloneEntry(stored)
  }

  async read(
    scope: MemoryScope,
    ownerId: string,
    key: string,
  ): Promise<MemoryEntry | undefined> {
    const entry = this.entries.get(composeKey(scope, ownerId, key))
    return entry ? cloneEntry(entry) : undefined
  }

  async search(
    query: string,
    options?: { scope?: MemoryScope; ownerId?: string; limit?: number },
  ): Promise<MemoryEntry[]> {
    const q = query.toLowerCase()
    const all = Array.from(this.entries.values()).filter((entry) => {
      if (options?.scope && entry.scope !== options.scope) return false
      if (options?.ownerId && entry.ownerId !== options.ownerId) return false
      return (
        entry.key.toLowerCase().includes(q) ||
        entry.value.toLowerCase().includes(q) ||
        (entry.tags?.some((t) => t.toLowerCase().includes(q)) ?? false)
      )
    })
    all.sort((a, b) => b.updatedAt - a.updatedAt)
    const sliced = options?.limit ? all.slice(0, options.limit) : all
    return sliced.map(cloneEntry)
  }

  async delete(scope: MemoryScope, ownerId: string, key: string): Promise<boolean> {
    return this.entries.delete(composeKey(scope, ownerId, key))
  }

  async list(scope: MemoryScope, ownerId: string): Promise<MemoryEntry[]> {
    return Array.from(this.entries.values())
      .filter((e) => e.scope === scope && e.ownerId === ownerId)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map(cloneEntry)
  }
}

function composeKey(scope: MemoryScope, ownerId: string, key: string): string {
  return `${scope}::${ownerId}::${key}`
}
