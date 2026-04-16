export type ChannelId = string

export type ChannelCapabilities = {
  streaming: boolean
  voice: boolean
  images: boolean
  files: boolean
  typing: boolean
  reactions: boolean
  threadedReplies: boolean
}

export type InboundAttachment =
  | { kind: 'image'; url: string; mimeType?: string }
  | { kind: 'audio'; url: string; mimeType?: string; durationMs?: number }
  | { kind: 'file'; url: string; mimeType?: string; name?: string }

export type InboundMessage = {
  channelId: ChannelId
  messageId: string
  conversationId: string
  fromUserId: string
  fromDisplayName: string
  text: string
  attachments?: InboundAttachment[]
  timestamp: number
  raw?: unknown
}

export type OutboundMessage = {
  channelId: ChannelId
  conversationId: string
  text: string
  attachments?: InboundAttachment[]
  replyToMessageId?: string
}

export type SendResult = {
  messageId: string
  deliveredAt: number
}
