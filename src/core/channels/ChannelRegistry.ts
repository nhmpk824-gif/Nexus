import type { ChannelAdapter } from './ChannelAdapter'
import type { ChannelId } from './types'

export class ChannelRegistry {
  private readonly adapters = new Map<ChannelId, ChannelAdapter>()

  register(adapter: ChannelAdapter): void {
    if (this.adapters.has(adapter.id)) {
      throw new Error(`Channel adapter "${adapter.id}" is already registered`)
    }
    this.adapters.set(adapter.id, adapter)
  }

  unregister(id: ChannelId): void {
    this.adapters.delete(id)
  }

  get(id: ChannelId): ChannelAdapter | undefined {
    return this.adapters.get(id)
  }

  list(): ChannelAdapter[] {
    return Array.from(this.adapters.values())
  }

  async startAll(): Promise<void> {
    await Promise.all(this.list().map((adapter) => adapter.start()))
  }

  async stopAll(): Promise<void> {
    await Promise.all(this.list().map((adapter) => adapter.stop()))
  }
}
