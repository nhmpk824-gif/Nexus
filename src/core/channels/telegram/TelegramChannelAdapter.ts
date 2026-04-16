import type { ChannelAdapter, ChannelAdapterStatus, InboundHandler } from '../ChannelAdapter'
import type {
  ChannelCapabilities,
  ChannelId,
  InboundMessage,
  OutboundMessage,
  SendResult,
} from '../types'

const TELEGRAM_CAPABILITIES: ChannelCapabilities = {
  streaming: false,
  voice: false,
  images: false,
  files: false,
  typing: false,
  reactions: false,
  threadedReplies: true,
}

export type TelegramChannelAdapterConfig = {
  botToken: string
  allowedChatIds?: number[]
}

export class TelegramChannelAdapter implements ChannelAdapter {
  readonly id: ChannelId = 'telegram'
  readonly displayName = 'Telegram'
  readonly capabilities = TELEGRAM_CAPABILITIES

  private status: ChannelAdapterStatus = 'offline'
  private readonly handlers = new Set<InboundHandler>()
  private unsubscribe: (() => void) | null = null
  private readonly config: TelegramChannelAdapterConfig

  constructor(config: TelegramChannelAdapterConfig) {
    this.config = config
  }

  async start(): Promise<void> {
    const bridge = window.desktopPet
    if (!bridge?.telegramConnect || !bridge.subscribeTelegramMessage) {
      this.status = 'error'
      throw new Error('Telegram bridge is not available')
    }
    this.status = 'starting'
    try {
      const status = await bridge.telegramConnect({
        botToken: this.config.botToken,
        allowedChatIds: this.config.allowedChatIds,
      })
      this.status = status.state === 'connected' ? 'online' : 'error'
    } catch (error) {
      this.status = 'error'
      throw error
    }

    this.unsubscribe = bridge.subscribeTelegramMessage((msg) => {
      const inbound: InboundMessage = {
        channelId: this.id,
        messageId: String(msg.messageId),
        conversationId: `telegram:${msg.chatId}`,
        fromUserId: msg.fromUser,
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
    await window.desktopPet?.telegramDisconnect?.()
    this.status = 'offline'
  }

  getStatus(): ChannelAdapterStatus {
    return this.status
  }

  async send(message: OutboundMessage): Promise<SendResult> {
    const bridge = window.desktopPet
    if (!bridge?.telegramSendMessage) {
      throw new Error('Telegram bridge is not available')
    }
    const chatId = parseChatIdFromConversationId(message.conversationId)
    const replyToMessageId = message.replyToMessageId
      ? Number(message.replyToMessageId)
      : undefined
    await bridge.telegramSendMessage({
      chatId,
      text: message.text,
      replyToMessageId: Number.isFinite(replyToMessageId) ? replyToMessageId : undefined,
    })
    return {
      messageId: `telegram-out-${Date.now()}`,
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

function parseChatIdFromConversationId(conversationId: string): number {
  const prefix = 'telegram:'
  if (!conversationId.startsWith(prefix)) {
    throw new Error(`Expected telegram:<chatId> conversation id, got ${conversationId}`)
  }
  const chatId = Number(conversationId.slice(prefix.length))
  if (!Number.isFinite(chatId)) {
    throw new Error(`Invalid Telegram chatId in conversation id ${conversationId}`)
  }
  return chatId
}
