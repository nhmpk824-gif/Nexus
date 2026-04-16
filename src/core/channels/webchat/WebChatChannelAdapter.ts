import type { ChannelAdapter, ChannelAdapterStatus, InboundHandler } from '../ChannelAdapter'
import type {
  ChannelCapabilities,
  ChannelId,
  InboundMessage,
  OutboundMessage,
  SendResult,
} from '../types'

const WEBCHAT_CAPABILITIES: ChannelCapabilities = {
  streaming: true,
  voice: true,
  images: true,
  files: false,
  typing: true,
  reactions: false,
  threadedReplies: false,
}

export type WebChatOutboundHandler = (message: OutboundMessage) => void | Promise<void>

export class WebChatChannelAdapter implements ChannelAdapter {
  readonly id: ChannelId = 'webchat'
  readonly displayName = 'Live2D WebChat'
  readonly capabilities = WEBCHAT_CAPABILITIES

  private status: ChannelAdapterStatus = 'online'
  private readonly inboundHandlers = new Set<InboundHandler>()
  private readonly outboundHandlers = new Set<WebChatOutboundHandler>()

  async start(): Promise<void> {
    this.status = 'online'
  }

  async stop(): Promise<void> {
    this.status = 'offline'
  }

  getStatus(): ChannelAdapterStatus {
    return this.status
  }

  async send(message: OutboundMessage): Promise<SendResult> {
    for (const handler of this.outboundHandlers) {
      await handler(message)
    }
    return {
      messageId: `webchat-out-${Date.now()}`,
      deliveredAt: Date.now(),
    }
  }

  onInbound(handler: InboundHandler): () => void {
    this.inboundHandlers.add(handler)
    return () => {
      this.inboundHandlers.delete(handler)
    }
  }

  onOutbound(handler: WebChatOutboundHandler): () => void {
    this.outboundHandlers.add(handler)
    return () => {
      this.outboundHandlers.delete(handler)
    }
  }

  pushInbound(message: InboundMessage): void {
    for (const handler of this.inboundHandlers) {
      void handler(message)
    }
  }
}
