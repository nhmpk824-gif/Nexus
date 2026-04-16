import type { ChannelAdapter, ChannelAdapterStatus, InboundHandler } from '../ChannelAdapter'
import type {
  ChannelCapabilities,
  ChannelId,
  InboundMessage,
  OutboundMessage,
  SendResult,
} from '../types'

const DISCORD_CAPABILITIES: ChannelCapabilities = {
  streaming: false,
  voice: false,
  images: true,
  files: true,
  typing: false,
  reactions: true,
  threadedReplies: true,
}

export type DiscordChannelAdapterConfig = {
  botToken: string
  allowedChannelIds?: string[]
}

export class DiscordChannelAdapter implements ChannelAdapter {
  readonly id: ChannelId = 'discord'
  readonly displayName = 'Discord'
  readonly capabilities = DISCORD_CAPABILITIES

  private status: ChannelAdapterStatus = 'offline'
  private readonly handlers = new Set<InboundHandler>()
  private unsubscribe: (() => void) | null = null
  private readonly config: DiscordChannelAdapterConfig

  constructor(config: DiscordChannelAdapterConfig) {
    this.config = config
  }

  async start(): Promise<void> {
    const bridge = window.desktopPet
    if (!bridge?.discordConnect || !bridge.subscribeDiscordMessage) {
      this.status = 'error'
      throw new Error('Discord bridge is not available')
    }
    this.status = 'starting'
    try {
      const status = await bridge.discordConnect({
        botToken: this.config.botToken,
        allowedChannelIds: this.config.allowedChannelIds,
      })
      this.status = status.state === 'connected' ? 'online' : 'error'
    } catch (error) {
      this.status = 'error'
      throw error
    }

    this.unsubscribe = bridge.subscribeDiscordMessage((msg) => {
      const inbound: InboundMessage = {
        channelId: this.id,
        messageId: msg.messageId,
        conversationId: `discord:${msg.channelId}`,
        fromUserId: msg.fromUserId,
        fromDisplayName: msg.fromUser,
        text: msg.text,
        timestamp: Date.parse(msg.timestamp) || Date.now(),
        raw: msg,
      }
      for (const handler of this.handlers) {
        void handler(inbound)
      }
    })
  }

  async stop(): Promise<void> {
    this.unsubscribe?.()
    this.unsubscribe = null
    await window.desktopPet?.discordDisconnect?.()
    this.status = 'offline'
  }

  getStatus(): ChannelAdapterStatus {
    return this.status
  }

  async send(message: OutboundMessage): Promise<SendResult> {
    const bridge = window.desktopPet
    if (!bridge?.discordSendMessage) {
      throw new Error('Discord bridge is not available')
    }
    const channelId = parseChannelIdFromConversationId(message.conversationId)
    await bridge.discordSendMessage({
      channelId,
      text: message.text,
      replyToMessageId: message.replyToMessageId,
    })
    return {
      messageId: `discord-out-${Date.now()}`,
      deliveredAt: Date.now(),
    }
  }

  onInbound(handler: InboundHandler): () => void {
    this.handlers.add(handler)
    return () => {
      this.handlers.delete(handler)
    }
  }
}

function parseChannelIdFromConversationId(conversationId: string): string {
  const prefix = 'discord:'
  if (!conversationId.startsWith(prefix)) {
    throw new Error(`Expected discord:<channelId> conversation id, got ${conversationId}`)
  }
  return conversationId.slice(prefix.length)
}
