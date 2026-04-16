import type {
  ChannelCapabilities,
  ChannelId,
  InboundMessage,
  OutboundMessage,
  SendResult,
} from './types'

export type ChannelAdapterStatus = 'offline' | 'starting' | 'online' | 'error'

export type InboundHandler = (message: InboundMessage) => void | Promise<void>

export type ChannelAdapter = {
  readonly id: ChannelId
  readonly displayName: string
  readonly capabilities: ChannelCapabilities

  start(): Promise<void>
  stop(): Promise<void>
  getStatus(): ChannelAdapterStatus

  send(message: OutboundMessage): Promise<SendResult>
  onInbound(handler: InboundHandler): () => void
}
