/**
 * Host-path outbound broadcast for reminder notices.
 *
 * Kept out of src/lib/coreRuntime.ts so the core-store factory does not
 * import integration permission/allowlist modules. The send-permission
 * and allowlist gates here are the same ones that used to live on the
 * runtime singleton.
 */
import { isActionAllowed } from './permissions.ts'
import { parseDiscordChannelIdList, parseTelegramChatIdList } from './allowlists.ts'
import { listKnownDiscordChannelIds } from '../../lib/coreRuntime.ts'
import type { AppSettings } from '../../types/index.ts'

type BroadcastChannelId = 'telegram' | 'discord'

export type BroadcastResult = {
  channelId: BroadcastChannelId
  target: string
  ok: boolean
  error?: string
}

/**
 * Broadcast a reminder/notice to the master's own bridge chats.
 *
 * Targets are the owner's Telegram chats and the allowlisted Discord
 * channels only. Each channel must pass isActionAllowed('send').
 */
export async function broadcastToChannels(text: string, settings: AppSettings): Promise<BroadcastResult[]> {
  const bridge = typeof window !== 'undefined' ? window.desktopPet : undefined
  const results: BroadcastResult[] = []
  if (!bridge) return results

  if (bridge.telegramSendMessage && isActionAllowed(settings, 'telegram', 'send')) {
    const ownerChatIds = parseTelegramChatIdList(settings.ownerTelegramChatIds)
    for (const chatId of ownerChatIds) {
      try {
        await bridge.telegramSendMessage({ chatId, text })
        results.push({ channelId: 'telegram', target: String(chatId), ok: true })
      } catch (error) {
        results.push({
          channelId: 'telegram',
          target: String(chatId),
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
  }

  if (bridge.discordSendMessage && isActionAllowed(settings, 'discord', 'send')) {
    const allowedChannels = new Set(parseDiscordChannelIdList(settings.discordAllowedChannelIds))
    for (const channelId of listKnownDiscordChannelIds()) {
      if (!allowedChannels.has(channelId)) continue
      try {
        await bridge.discordSendMessage({ channelId, text })
        results.push({ channelId: 'discord', target: channelId, ok: true })
      } catch (error) {
        results.push({
          channelId: 'discord',
          target: channelId,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
  }

  return results
}
