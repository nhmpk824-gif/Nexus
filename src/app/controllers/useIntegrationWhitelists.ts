import { useEffect } from 'react'
import {
  setDiscordKnownChannelIds,
  setTelegramKnownChatIds,
} from '../../lib/coreRuntime'
import type { AppSettings } from '../../types'

/**
 * Cap applied to any parsed whitelist. A pathological config (user typo or
 * corrupt cloud sync) must not balloon the runtime arrays that every inbound
 * gateway message is matched against.
 */
const MAX_WHITELIST_ENTRIES = 256

/**
 * Parse a comma-separated whitelist string into an array of validated values.
 * Stops early once MAX_WHITELIST_ENTRIES is reached so the parser is O(cap)
 * on malicious input.
 */
function parseIdList<T>(
  raw: string,
  project: (piece: string) => T,
  keep: (value: T) => boolean,
): T[] {
  const out: T[] = []
  for (const piece of raw.split(',')) {
    const value = project(piece.trim())
    if (keep(value)) out.push(value)
    if (out.length >= MAX_WHITELIST_ENTRIES) break
  }
  return out
}

/**
 * Seed the core runtime's cross-channel broadcast targets from settings.
 * The React gateway hooks own the actual bridge connections; this hook only
 * keeps the allowed-id lists in sync with the user's settings string.
 */
export function useIntegrationWhitelists(settings: AppSettings): void {
  useEffect(() => {
    const allowedChatIds = settings.telegramIntegrationEnabled
      ? parseIdList(settings.telegramAllowedChatIds, Number, (n) => Number.isFinite(n) && n !== 0)
      : []
    setTelegramKnownChatIds(allowedChatIds)
  }, [settings.telegramIntegrationEnabled, settings.telegramAllowedChatIds])

  useEffect(() => {
    const allowedChannelIds = settings.discordIntegrationEnabled
      ? parseIdList(settings.discordAllowedChannelIds, (s) => s, (s) => s.length > 0)
      : []
    setDiscordKnownChannelIds(allowedChannelIds)
  }, [settings.discordIntegrationEnabled, settings.discordAllowedChannelIds])
}
